import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, getDb, auth } from '../config';
import { resolveActiveAccountId } from './memberships';
import { MovementCategory } from '@/lib/types';

const COLLECTION_NAME = 'movement-categories';

// Helper to get current user ID
function getOwnerId(): string {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  return currentUser.uid;
}

/**
 * Add a new movement category
 */
export async function addMovementCategory(
  categoryData: Omit<MovementCategory, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const accountId = await resolveActiveAccountId();
    if (!accountId) throw new Error('Unauthorized');

    const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), {
      ...categoryData,
      order: categoryData.order ?? Date.now(),
      ownerId: accountId,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error adding movement category:', error);
    throw error;
  }
}

/**
 * Get a single movement category by ID
 */
export async function getMovementCategory(id: string): Promise<MovementCategory | null> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as MovementCategory;
    }
    return null;
  } catch (error) {
    console.error('Error getting movement category:', error);
    throw error;
  }
}

/**
 * Get all movement categories
 */
export async function getAllMovementCategories(): Promise<MovementCategory[]> {
  try {
    const accountId = await resolveActiveAccountId();
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', accountId),
      orderBy('order', 'asc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as MovementCategory[];
  } catch (error) {
    console.error('Error getting movement categories:', error);
    throw error;
  }
}

/**
 * Update a movement category
 */
export async function updateMovementCategory(
  id: string,
  updates: Partial<Omit<MovementCategory, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating movement category:', error);
    throw error;
  }
}

/**
 * Delete a movement category
 */
export async function deleteMovementCategory(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting movement category:', error);
    throw error;
  }
}

/**
 * Subscribe to movement categories changes
 */
export function subscribeToMovementCategories(
  accountId: string,
  callback: (categories: MovementCategory[]) => void
): () => void {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('ownerId', '==', accountId),
    orderBy('order', 'asc')
  );

  return onSnapshot(q, (querySnapshot) => {
    const categories = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as MovementCategory[];

    callback(categories);
  }, (error) => {
    console.error('Error in movement categories subscription:', error);
  });
}

/**
 * Initialize default categories
 */
export async function initializeDefaultCategories(): Promise<void> {
  try {
    // Check if categories already exist
    const existingCategories = await getAllMovementCategories();
    if (existingCategories.length > 0) {
      return;
    }

    // Default categories with colors
    const defaultCategories = [
      { name: 'Accessory', color: '#8B5CF6', order: 1 },
      { name: 'Balance', color: '#06B6D4', order: 2 },
      { name: 'Cardio', color: '#EF4444', order: 3 },
      { name: 'Carry', color: '#F59E0B', order: 4 },
      { name: 'Cool Down', color: '#10B981', order: 5 },
      { name: 'Core - Anti-Rotation', color: '#EC4899', order: 6 },
      { name: 'Core - Rotation', color: '#F97316', order: 7 },
      { name: 'Functional Mobility', color: '#84CC16', order: 8 },
      { name: 'Hinge', color: '#6366F1', order: 9 },
      { name: 'Hinge Sup', color: '#8B5CF6', order: 10 },
      { name: 'Horizontal Pull', color: '#06B6D4', order: 11 },
      { name: 'Horizontal Push', color: '#EF4444', order: 12 },
      { name: 'Knee Pain Rehab', color: '#F59E0B', order: 13 },
      { name: 'Lunge', color: '#10B981', order: 14 },
      { name: 'Lunge Sup', color: '#EC4899', order: 15 },
      { name: 'Macros', color: '#F97316', order: 16 },
      { name: 'Olympic Lifts', color: '#84CC16', order: 17 },
      { name: 'OYO Workout', color: '#6366F1', order: 18 },
      { name: 'Pin Movements', color: '#8B5CF6', order: 19 },
      { name: 'Planks', color: '#06B6D4', order: 20 },
      { name: 'Post-Natal', color: '#EF4444', order: 21 },
      { name: 'Resistance - Accommodated', color: '#F59E0B', order: 22 },
      { name: 'Rest', color: '#10B981', order: 23 },
      { name: 'Squat', color: '#EC4899', order: 24 },
      { name: 'Squat Sup', color: '#F97316', order: 25 },
      { name: 'Stability', color: '#84CC16', order: 26 },
      { name: 'Vertical Pull', color: '#6366F1', order: 27 },
      { name: 'Vertical Push', color: '#8B5CF6', order: 28 },
      { name: 'Vo2 Max Training Protocol', color: '#06B6D4', order: 29 },
      { name: 'Warm Ups', color: '#EF4444', order: 30 },
      { name: 'Workout', color: '#F59E0B', order: 31 },
    ];

    // Add all categories
    const promises = defaultCategories.map(category =>
      addMovementCategory(category)
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Error initializing default categories:', error);
    throw error;
  }
}
