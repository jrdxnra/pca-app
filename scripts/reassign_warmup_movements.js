const admin = require('firebase-admin');

const PROJECT_ID = 'performancecoachapp-26bd1';

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: PROJECT_ID,
  });
}

const db = admin.firestore();

const TARGET_PATTERNS = [
  /^a\s*-?\s*skips?$/i,
  /^b\s*-?\s*skips?$/i,
  /^high\s*knees$/i,
  /^butt\s*kicks?$/i,
  /^butt\s*kickers$/i,
];

function isTargetMovement(name) {
  const trimmed = String(name || '').trim();
  return TARGET_PATTERNS.some((re) => re.test(trimmed));
}

function isWarmUpCategory(categoryName) {
  return /^warm\s*ups?$/i.test(String(categoryName || '').trim());
}

function parseArgs(argv) {
  const args = { apply: false, ownerId: null };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      args.apply = true;
    } else if (arg === '--ownerId') {
      args.ownerId = argv[i + 1] || null;
      i += 1;
    }
  }

  return args;
}

async function fetchCategories(ownerId) {
  let query = db.collection('movement-categories');
  if (ownerId) {
    query = query.where('ownerId', '==', ownerId);
  }

  const snap = await query.get();
  const byId = new Map();
  const warmUpByOwner = new Map();

  snap.forEach((doc) => {
    const data = doc.data() || {};
    const category = {
      id: doc.id,
      ownerId: data.ownerId || null,
      name: data.name || '',
    };

    byId.set(doc.id, category);

    if (category.ownerId && isWarmUpCategory(category.name)) {
      warmUpByOwner.set(category.ownerId, doc.id);
    }
  });

  return { byId, warmUpByOwner };
}

async function fetchMovements(ownerId) {
  let query = db.collection('movements');
  if (ownerId) {
    query = query.where('ownerId', '==', ownerId);
  }

  const snap = await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

async function run() {
  const { apply, ownerId } = parseArgs(process.argv);
  const mode = apply ? 'APPLY' : 'DRY RUN';

  console.log(`Running ${mode} for project ${PROJECT_ID}`);
  if (ownerId) {
    console.log(`Scoped to ownerId=${ownerId}`);
  } else {
    console.log('No ownerId provided; scanning all owners.');
  }

  const [{ byId: categoryById, warmUpByOwner }, movements] = await Promise.all([
    fetchCategories(ownerId),
    fetchMovements(ownerId),
  ]);

  const candidates = movements.filter((m) => isTargetMovement(m.name));

  if (candidates.length === 0) {
    console.log('No matching movements found.');
    return;
  }

  const toUpdate = [];
  const alreadyWarmUp = [];
  const skippedNoOwner = [];
  const skippedNoWarmUpCategory = [];

  for (const movement of candidates) {
    const owner = movement.ownerId || null;
    if (!owner) {
      skippedNoOwner.push(movement);
      continue;
    }

    const warmUpCategoryId = warmUpByOwner.get(owner);
    if (!warmUpCategoryId) {
      skippedNoWarmUpCategory.push(movement);
      continue;
    }

    if (movement.categoryId === warmUpCategoryId) {
      alreadyWarmUp.push(movement);
      continue;
    }

    const currentCategoryName = categoryById.get(movement.categoryId || '')?.name || 'Unknown';

    toUpdate.push({
      id: movement.id,
      name: movement.name,
      ownerId: owner,
      fromCategoryId: movement.categoryId || null,
      fromCategoryName: currentCategoryName,
      toCategoryId: warmUpCategoryId,
    });
  }

  console.log('----- Summary -----');
  console.log(`Matched target movements: ${candidates.length}`);
  console.log(`Already in Warm Ups: ${alreadyWarmUp.length}`);
  console.log(`Ready to move: ${toUpdate.length}`);
  console.log(`Skipped (missing ownerId): ${skippedNoOwner.length}`);
  console.log(`Skipped (no Warm Ups category for owner): ${skippedNoWarmUpCategory.length}`);

  if (toUpdate.length > 0) {
    console.log('----- Planned Updates -----');
    toUpdate.forEach((item) => {
      console.log(`${item.ownerId} | ${item.name} | ${item.fromCategoryName} -> Warm Ups`);
    });
  }

  if (!apply) {
    console.log('Dry run complete. Re-run with --apply to execute updates.');
    return;
  }

  const batchSize = 400;
  let processed = 0;

  while (processed < toUpdate.length) {
    const slice = toUpdate.slice(processed, processed + batchSize);
    const batch = db.batch();

    slice.forEach((item) => {
      const ref = db.collection('movements').doc(item.id);
      batch.update(ref, {
        categoryId: item.toCategoryId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    await batch.commit();
    processed += slice.length;
    console.log(`Committed ${processed}/${toUpdate.length}`);
  }

  console.log('Update complete.');
}

run().catch((error) => {
  console.error('Failed to reassign warm-up movements:', error);
  process.exit(1);
});
