import { Timestamp, Firestore } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase/admin';

const MASTER_ACCOUNT_ID = 'master';
const MOVEMENT_CATEGORY_COLLECTION = 'movement-categories';
const MOVEMENT_COLLECTION = 'movements';
const WORKOUT_CONFIG_COLLECTIONS = [
  'workoutTypes',
  'workoutCategories',
  'periods',
  'weekTemplates',
  'workoutStructureTemplates'
] as const;
const MIN_SEED_RATIO = 0.8;

type ProvisionParams = {
  userId: string;
  displayName?: string | null;
  email?: string | null;
};

type ProvisionResult = {
  accountId: string;
  createdAccount: boolean;
  createdMembership: boolean;
  clonedMovements: boolean;
  clonedWorkoutConfig: boolean;
};

async function getOwnerDocCount(db: Firestore, collectionName: string, ownerId: string) {
  const snapshot = await db
    .collection(collectionName)
    .where('ownerId', '==', ownerId)
    .select('__name__')
    .get();
  return snapshot.size;
}

async function deleteOwnerDocs(db: Firestore, collectionName: string, ownerId: string) {
  const snapshot = await db
    .collection(collectionName)
    .where('ownerId', '==', ownerId)
    .select('__name__')
    .get();

  if (snapshot.empty) {
    return;
  }

  const batchSize = 500;
  let batch = db.batch();
  let counter = 0;

  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    counter++;

    if (counter % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }

  if (counter % batchSize !== 0) {
    await batch.commit();
  }
}

async function cloneMovementCatalog(
  db: Firestore,
  targetAccountId: string,
  options?: { reseedExisting?: boolean }
) {
  const now = Timestamp.now();
  const [categoriesSnapshot, movementsSnapshot] = await Promise.all([
    db
      .collection(MOVEMENT_CATEGORY_COLLECTION)
      .where('ownerId', '==', MASTER_ACCOUNT_ID)
      .get(),
    db
      .collection(MOVEMENT_COLLECTION)
      .where('ownerId', '==', MASTER_ACCOUNT_ID)
      .get(),
  ]);

  if (categoriesSnapshot.empty && movementsSnapshot.empty) {
    return { clonedMovements: false };
  }

  if (options?.reseedExisting) {
    await deleteOwnerDocs(db, MOVEMENT_CATEGORY_COLLECTION, targetAccountId);
    await deleteOwnerDocs(db, MOVEMENT_COLLECTION, targetAccountId);
  }

  const categoryIdMap: Record<string, string> = {};
  let cloned = false;

  for (const categoryDoc of categoriesSnapshot.docs) {
    const categoryData = categoryDoc.data();
    const newCategoryRef = db.collection(MOVEMENT_CATEGORY_COLLECTION).doc();
    await newCategoryRef.set({
      ...categoryData,
      ownerId: targetAccountId,
      createdAt: now,
      updatedAt: now,
    });
    categoryIdMap[categoryDoc.id] = newCategoryRef.id;
    cloned = true;
  }

  for (const movementDoc of movementsSnapshot.docs) {
    const movementData = movementDoc.data();
    const newMovementRef = db.collection(MOVEMENT_COLLECTION).doc();
    await newMovementRef.set({
      ...movementData,
      ownerId: targetAccountId,
      categoryId: movementData.categoryId
        ? categoryIdMap[movementData.categoryId] || movementData.categoryId
        : movementData.categoryId,
      createdAt: now,
      updatedAt: now,
    });
    cloned = true;
  }

  return {
    clonedMovements: cloned,
  };
}

async function cloneWorkoutConfig(
  db: Firestore,
  targetAccountId: string,
  options?: { collectionsToReseed?: Set<string> }
) {
  const now = Timestamp.now();
  let cloned = false;

  for (const collectionName of WORKOUT_CONFIG_COLLECTIONS) {
    const shouldClone = options?.collectionsToReseed?.has(collectionName) ?? false;
    if (!shouldClone) {
      continue;
    }

    await deleteOwnerDocs(db, collectionName, targetAccountId);

    const snapshot = await db
      .collection(collectionName)
      .where('ownerId', '==', MASTER_ACCOUNT_ID)
      .get();

    if (snapshot.empty) {
      continue;
    }

    for (const docSnap of snapshot.docs) {
      const configData = docSnap.data();
      const newRef = db.collection(collectionName).doc();
      await newRef.set({
        ...configData,
        ownerId: targetAccountId,
        createdAt: now,
        updatedAt: now,
      });
      cloned = true;
    }
  }

  return { clonedWorkoutConfig: cloned };
}

export async function ensureAccountLibrarySnapshot(accountId: string) {
  if (accountId === MASTER_ACCOUNT_ID) {
    return { clonedMovements: false, clonedWorkoutConfig: false };
  }

  const db = getAdminDb();

  const [
    masterMovementCount,
    targetMovementCount,
    masterCategoryCount,
    targetCategoryCount,
  ] = await Promise.all([
    getOwnerDocCount(db, MOVEMENT_COLLECTION, MASTER_ACCOUNT_ID),
    getOwnerDocCount(db, MOVEMENT_COLLECTION, accountId),
    getOwnerDocCount(db, MOVEMENT_CATEGORY_COLLECTION, MASTER_ACCOUNT_ID),
    getOwnerDocCount(db, MOVEMENT_CATEGORY_COLLECTION, accountId),
  ]);

  const movementThreshold = Math.floor(masterMovementCount * MIN_SEED_RATIO);
  const categoryThreshold = Math.floor(masterCategoryCount * MIN_SEED_RATIO);

  const shouldReseedMovements =
    masterMovementCount > 0 &&
    (
      targetMovementCount === 0 ||
      targetCategoryCount === 0 ||
      targetMovementCount < movementThreshold ||
      targetCategoryCount < categoryThreshold
    );

  let clonedMovements = false;
  if (shouldReseedMovements) {
    const result = await cloneMovementCatalog(db, accountId, { reseedExisting: true });
    clonedMovements = result.clonedMovements;
  }

  const collectionsToReseed = new Set<string>();
  for (const collectionName of WORKOUT_CONFIG_COLLECTIONS) {
    const [masterCount, targetCount] = await Promise.all([
      getOwnerDocCount(db, collectionName, MASTER_ACCOUNT_ID),
      getOwnerDocCount(db, collectionName, accountId),
    ]);

    const threshold = Math.floor(masterCount * MIN_SEED_RATIO);
    if (
      masterCount > 0 &&
      (targetCount === 0 || targetCount < threshold)
    ) {
      collectionsToReseed.add(collectionName);
    }
  }

  const { clonedWorkoutConfig } = await cloneWorkoutConfig(db, accountId, {
    collectionsToReseed,
  });

  return { clonedMovements, clonedWorkoutConfig };
}

export async function ensureCoachAccountProvisioned({
  userId,
  displayName,
  email,
}: ProvisionParams): Promise<ProvisionResult> {
  const db = getAdminDb();
  const accountId = `acc-${userId}`;
  const now = Timestamp.now();

  const baseName = (displayName?.trim() || email?.split('@')[0] || 'Coach').trim();
  const accountName = baseName.endsWith("'s") ? `${baseName} Account` : `${baseName}'s Account`;

  const accountRef = db.collection('accounts').doc(accountId);
  const accountSnap = await accountRef.get();
  let createdAccount = false;

  if (!accountSnap.exists) {
    await accountRef.set({
      name: accountName,
      ownerId: userId,
      createdAt: now,
      updatedAt: now,
    });
    createdAccount = true;
  }

  const membershipId = `${accountId}_${userId}`;
  const membershipRef = db.collection('memberships').doc(membershipId);
  const membershipSnap = await membershipRef.get();
  let createdMembership = false;

  if (!membershipSnap.exists) {
    await membershipRef.set({
      userId,
      accountId,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    });
    createdMembership = true;
  }

  const shouldEnsureLibrarySnapshot = createdAccount || createdMembership;
  const { clonedMovements, clonedWorkoutConfig } = shouldEnsureLibrarySnapshot
    ? await ensureAccountLibrarySnapshot(accountId)
    : { clonedMovements: false, clonedWorkoutConfig: false };

  return {
    accountId,
    createdAccount,
    createdMembership,
    clonedMovements,
    clonedWorkoutConfig,
  };
}
