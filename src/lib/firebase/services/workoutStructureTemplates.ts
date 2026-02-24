import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, getDb, auth } from '../config';
import { resolveActiveAccountId } from './memberships';
import { WorkoutStructureTemplate, WorkoutStructureTemplateSection } from '@/lib/types';

const COLLECTION_NAME = 'workoutStructureTemplates';

// Helper to get current account ID
async function getAccountId(): Promise<string> {
  const accountId = await resolveActiveAccountId();
  if (!accountId) {
    throw new Error('Unauthorized or No Active Account');
  }
  return accountId;
}

/**
 * Create a new workout structure template
 */
export const createWorkoutStructureTemplate = async (
  template: Omit<WorkoutStructureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>
): Promise<string> => {
  try {
    const accountId = await getAccountId();
    const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), {
      ...template,
      ownerId: accountId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: auth.currentUser?.uid
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating workout structure template:', error);
    throw error;
  }
};

/**
 * Update an existing workout structure template
 */
export const updateWorkoutStructureTemplate = async (
  id: string,
  updates: Partial<Omit<WorkoutStructureTemplate, 'id' | 'createdAt' | 'createdBy'>>
): Promise<void> => {
  try {
    await updateDoc(doc(getDb(), COLLECTION_NAME, id), {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating workout structure template:', error);
    throw error;
  }
};

/**
 * Delete a workout structure template
 */
export const deleteWorkoutStructureTemplate = async (id: string): Promise<void> => {
  try {
    await deleteDoc(doc(getDb(), COLLECTION_NAME, id));
  } catch (error) {
    console.error('Error deleting workout structure template:', error);
    throw error;
  }
};

/**
 * Fetch all workout structure templates
 */
export const fetchWorkoutStructureTemplates = async (): Promise<WorkoutStructureTemplate[]> => {
  try {
    const accountId = await getAccountId();
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', accountId),
      orderBy('createdAt', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WorkoutStructureTemplate[];
  } catch (error) {
    console.error('Error fetching workout structure templates:', error);
    throw error;
  }
};

/**
 * Subscribe to workout structure templates changes
 */
export const subscribeToWorkoutStructureTemplates = (
  callback: (templates: WorkoutStructureTemplate[]) => void
): () => void => {
  const q = async () => {
    const accountId = await getAccountId();
    return query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', accountId),
      orderBy('createdAt', 'asc')
    );
  };

  let unsubscribe: (() => void) | undefined;

  q().then(queryObj => {
    unsubscribe = onSnapshot(queryObj, (querySnapshot) => {
      const templates = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as WorkoutStructureTemplate[];
      callback(templates);
    }, (error) => {
      console.error('Error subscribing to workout structure templates:', error);
    });
  });

  return () => {
    if (unsubscribe) unsubscribe();
  };
};

