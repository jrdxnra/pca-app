import {
    collection,
    doc,
    getDoc,
    setDoc,
    Timestamp
} from 'firebase/firestore';
import { getDb } from '../config';
import { Account } from '../../types';

const COLLECTION_NAME = 'accounts';

export const getAccount = async (id: string): Promise<Account | null> => {
    try {
        const docRef = doc(getDb(), COLLECTION_NAME, id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, ...docSnap.data() } as Account;
        }
        return null;
    } catch (error) {
        console.error('Error getting account:', error);
        throw error;
    }
};

export const createAccount = async (id: string, name: string, ownerId: string): Promise<void> => {
    try {
        const docRef = doc(getDb(), COLLECTION_NAME, id);
        await setDoc(docRef, {
            name,
            ownerId,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });
    } catch (error) {
        console.error('Error creating account:', error);
        throw error;
    }
};
