import {
    collection,
    getDocs,
    setDoc,
    doc,
    query,
    where,
    limit,
    Timestamp
} from 'firebase/firestore';
import { getDb } from '../config';
import { createAccount } from './accounts';
import { createMembership } from './memberships';

/**
 * Deep copies movement categories and movements from master to a target account
 */
export const copyMovementCatalog = async (sourceAccountId: string, targetAccountId: string): Promise<void> => {
    try {
        const db = getDb();

        // 1. Get all categories from source
        const categoriesSnapshot = await getDocs(
            query(collection(db, 'movement-categories'), where('ownerId', '==', sourceAccountId))
        );

        // Map source category IDs to new target IDs to maintain relationships
        const categoryIdMap: Record<string, string> = {};

        for (const categoryDoc of categoriesSnapshot.docs) {
            const sourceData = categoryDoc.data();
            const newCategoryRef = doc(collection(db, 'movement-categories'));

            await setDoc(newCategoryRef, {
                ...sourceData,
                ownerId: targetAccountId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });

            categoryIdMap[categoryDoc.id] = newCategoryRef.id;
        }

        // 2. Get all movements from source
        const movementsSnapshot = await getDocs(
            query(collection(db, 'movements'), where('ownerId', '==', sourceAccountId))
        );

        for (const movementDoc of movementsSnapshot.docs) {
            const sourceData = movementDoc.data();
            const newMovementRef = doc(collection(db, 'movements'));

            await setDoc(newMovementRef, {
                ...sourceData,
                ownerId: targetAccountId,
                categoryId: categoryIdMap[sourceData.categoryId] || sourceData.categoryId,
                createdAt: Timestamp.now(),
                updatedAt: Timestamp.now(),
            });
        }

        console.log(`Cloned movement catalog from ${sourceAccountId} to ${targetAccountId}`);
    } catch (error) {
        console.error('Error cloning movement catalog:', error);
        throw error;
    }
};

/**
 * Deep copies workout configurations (types, categories, periods)
 */
export const copyWorkoutConfig = async (sourceAccountId: string, targetAccountId: string): Promise<void> => {
    try {
        const db = getDb();
        const configCollections = ['workoutTypes', 'workoutCategories', 'periods'];

        for (const collName of configCollections) {
            const snapshot = await getDocs(
                query(collection(db, collName), where('ownerId', '==', sourceAccountId))
            );

            for (const configDoc of snapshot.docs) {
                const sourceData = configDoc.data();
                const newRef = doc(collection(db, collName));

                await setDoc(newRef, {
                    ...sourceData,
                    ownerId: targetAccountId,
                    createdAt: Timestamp.now(),
                    updatedAt: Timestamp.now(),
                });
            }
        }

        console.log(`Cloned workout config from ${sourceAccountId} to ${targetAccountId}`);
    } catch (error) {
        console.error('Error cloning workout config:', error);
        throw error;
    }
};

/**
 * Initialises a new account for a user and clones the master library
 */
export const provisionNewAccount = async (userId: string, userName: string): Promise<string> => {
    try {
        const accountId = `acc-${userId}`;

        // 1. Create the Account
        await createAccount(accountId, `${userName}'s Account`, userId);

        // 2. Create the Membership
        await createMembership(userId, accountId, 'owner');

        // 3. Clone the Master Library
        await copyMovementCatalog('master', accountId);
        await copyWorkoutConfig('master', accountId);

        return accountId;
    } catch (error) {
        console.error('Error provisioning new account:', error);
        throw error;
    }
};

/**
 * Ensures an account has the master library. If empty, it clones it.
 */
export const ensureAccountProvisioned = async (accountId: string): Promise<void> => {
    try {
        if (accountId === 'master') return;

        const db = getDb();
        const movementsSnapshot = await getDocs(
            query(collection(db, 'movements'), where('ownerId', '==', accountId), limit(1))
        );

        if (movementsSnapshot.empty) {
            console.log(`Account ${accountId} is empty, cloning from master...`);
            await copyMovementCatalog('master', accountId);
            await copyWorkoutConfig('master', accountId);
        }
    } catch (error) {
        console.error('Error ensuring account provisioned:', error);
        throw error;
    }
};
