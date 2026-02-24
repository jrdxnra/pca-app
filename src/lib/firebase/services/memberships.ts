import {
    collection,
    doc,
    getDocs,
    query,
    where,
    setDoc,
    deleteDoc,
    limit,
    Timestamp
} from 'firebase/firestore';
import { getDb, auth } from '../config';
import { Membership } from '../../types';

const COLLECTION_NAME = 'memberships';

/**
 * Get the active membership for a user
 * For now, we assume one membership per user for simplicity
 */
export const getActiveMembership = async (userId: string): Promise<Membership | null> => {
    try {
        const q = query(
            collection(getDb(), COLLECTION_NAME),
            where('userId', '==', userId),
            limit(1)
        );
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            const data = docSnap.data();
            const correctId = `${data.accountId}_${data.userId}`;

            // Auto-migrate if ID is in the old format
            if (docSnap.id !== correctId) {
                console.log(`Auto-migrating membership ${docSnap.id} to ${correctId}`);
                const newDocRef = doc(getDb(), COLLECTION_NAME, correctId);
                await setDoc(newDocRef, {
                    ...data,
                    updatedAt: Timestamp.now()
                });

                // Try to delete old doc, but don't fail if we can't
                try {
                    await deleteDoc(docSnap.ref);
                } catch (e) {
                    console.warn('Could not delete old membership doc:', e);
                }

                return { id: correctId, ...data } as Membership;
            }

            return { id: docSnap.id, ...data } as Membership;
        }
        return null;
    } catch (error) {
        console.error('Error getting membership:', error);
        throw error;
    }
};

export const createMembership = async (userId: string, accountId: string, role: Membership['role']): Promise<void> => {
    try {
        const id = `${accountId}_${userId}`;
        const docRef = doc(getDb(), COLLECTION_NAME, id);
        await setDoc(docRef, {
            userId,
            accountId,
            role,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error creating membership:', error);
        throw error;
    }
};

// Basic memoization for account resolution in a single session
let sessionAccountId: string | null = null;
export const MASTER_UID = 'DuRPTA63JJOicaDVeF69XhpkTNh2';

/**
 * Helper to get the current user's account ID
 */
export const resolveActiveAccountId = async (): Promise<string | null> => {
    // 1. Check session cache
    if (sessionAccountId) return sessionAccountId;

    // Small helper to wait for auth state if it's currently null
    const getAuthUser = (): Promise<any> => {
        return new Promise((resolve) => {
            if (auth.currentUser) {
                resolve(auth.currentUser);
                return;
            }
            const unsubscribe = auth.onAuthStateChanged((user) => {
                unsubscribe();
                resolve(user);
            });
            // Timeout after 2 seconds to avoid hanging
            setTimeout(() => {
                unsubscribe();
                resolve(null);
            }, 2000);
        });
    };

    const user = await getAuthUser();
    if (!user) {
        console.warn('[resolveActiveAccountId] No authenticated user found after waiting.');
        return null;
    }

    console.log(`[resolveActiveAccountId] Resolving for UID: ${user.uid}`);

    // 2. Short-circuit for Master User to ensure stability
    if (user.uid === MASTER_UID) {
        console.log('[resolveActiveAccountId] Master user detected, resolving to "master"');
        sessionAccountId = 'master';
        return 'master';
    }

    try {
        const membership = await getActiveMembership(user.uid);
        if (membership?.accountId) {
            console.log(`[resolveActiveAccountId] Resolved to account: ${membership.accountId}`);
            sessionAccountId = membership.accountId;
            return membership.accountId;
        }
    } catch (error) {
        console.error('[resolveActiveAccountId] Error resolving account:', error);
    }

    console.warn('[resolveActiveAccountId] No active membership found for user.');
    return null;
};
