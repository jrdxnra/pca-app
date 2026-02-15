import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db, getDb, auth } from '../config';
import { Movement, MovementCategory } from '@/lib/types';
import { getMovementCategory } from './movementCategories';

const COLLECTION_NAME = 'movements';

// Helper to get current user ID
function getOwnerId(): string {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  return currentUser.uid;
}

/**
 * Add a new movement
 * If configuration is not provided, uses the category's default configuration
 */
export async function addMovement(
  movementData: Omit<Movement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    // If no configuration provided, try to get it from category
    let configuration = movementData.configuration;
    if (!configuration) {
      const category = await getMovementCategory(movementData.categoryId);
      if (category?.defaultConfiguration) {
        configuration = category.defaultConfiguration;
      } else {
        // Fallback to sensible defaults if no category default exists
        configuration = {
          useReps: true,
          useTempo: false,
          useTime: false,
          useWeight: true,
          weightMeasure: 'lbs',
          useDistance: false,
          distanceMeasure: 'm',
          usePace: false,
          paceMeasure: 'km',
          unilateral: false,
          usePercentage: false,
          useRPE: false,
        };
      }
    }

    // Filter out undefined values for Firestore
    const cleanData = {
      name: movementData.name,
      categoryId: movementData.categoryId,
      ordinal: movementData.ordinal,
      configuration: configuration,
      links: movementData.links || [],
      ...(movementData.instructions && { instructions: movementData.instructions }),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ownerId: getOwnerId(),
    };

    const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), cleanData);
    return docRef.id;
  } catch (error) {
    console.error('Error adding movement:', error);
    throw error;
  }
}

/**
 * Get a single movement by ID
 */
export async function getMovement(id: string, includeCategory = false): Promise<Movement | null> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const movement = { id: docSnap.id, ...docSnap.data() } as Movement;

      if (includeCategory && movement.categoryId) {
        movement.category = (await getMovementCategory(movement.categoryId)) || undefined;
      }

      return movement;
    }
    return null;
  } catch (error) {
    console.error('Error getting movement:', error);
    throw error;
  }
}

/**
 * Get all movements
 */
export async function getAllMovements(includeCategory = false): Promise<Movement[]> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', getOwnerId())
    );
    const querySnapshot = await getDocs(q);

    const movements = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as Movement[];

    if (includeCategory) {
      // Populate category data for each movement
      const movementsWithCategories = await Promise.all(
        movements.map(async (movement) => {
          if (movement.categoryId) {
            movement.category = (await getMovementCategory(movement.categoryId)) || undefined;
          }
          return movement;
        })
      );
      return movementsWithCategories;
    }

    return movements;
  } catch (error) {
    console.error('Error getting movements:', error);
    throw error;
  }
}

/**
 * Get movements by category
 */
export async function getMovementsByCategory(
  categoryId: string,
  includeCategory = false
): Promise<Movement[]> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('categoryId', '==', categoryId)
    );
    const querySnapshot = await getDocs(q);

    const movements = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Movement[];

    // Sort by ordinal first, then by name for movements with same ordinal
    movements.sort((a, b) => {
      if (a.ordinal !== b.ordinal) {
        return (a.ordinal || 0) - (b.ordinal || 0);
      }
      return a.name.localeCompare(b.name);
    });

    if (includeCategory) {
      const category = await getMovementCategory(categoryId);
      movements.forEach(movement => {
        movement.category = category || undefined;
      });
    }

    return movements;
  } catch (error) {
    console.error('Error getting movements by category:', error);
    throw error;
  }
}

/**
 * Update a movement
 */
export async function updateMovement(
  id: string,
  updates: Partial<Omit<Movement, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);

    // Filter out undefined values for Firestore
    const cleanUpdates: any = {
      updatedAt: Timestamp.now(),
    };

    if (updates.name !== undefined) cleanUpdates.name = updates.name;
    if (updates.categoryId !== undefined) cleanUpdates.categoryId = updates.categoryId;
    if (updates.ordinal !== undefined) cleanUpdates.ordinal = updates.ordinal;
    if (updates.configuration !== undefined) cleanUpdates.configuration = updates.configuration;
    if (updates.links !== undefined) cleanUpdates.links = updates.links;
    if (updates.instructions !== undefined) cleanUpdates.instructions = updates.instructions;

    await updateDoc(docRef, cleanUpdates);
  } catch (error) {
    console.error('Error updating movement:', error);
    throw error;
  }
}

/**
 * Delete a movement
 */
export async function deleteMovement(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting movement:', error);
    throw error;
  }
}

/**
 * Search movements across all categories
 */
export async function searchMovements(
  searchTerm: string,
  includeCategory = false
): Promise<Movement[]> {
  try {
    // Get all movements first (Firestore doesn't support full-text search)
    const allMovements = await getAllMovements(includeCategory);

    if (!searchTerm.trim()) {
      return allMovements;
    }

    const lowercaseSearch = searchTerm.toLowerCase();

    return allMovements.filter(movement =>
      movement.name.toLowerCase().includes(lowercaseSearch) ||
      movement.instructions?.toLowerCase().includes(lowercaseSearch) ||
      movement.category?.name.toLowerCase().includes(lowercaseSearch)
    );
  } catch (error) {
    console.error('Error searching movements:', error);
    throw error;
  }
}

/**
 * Reorder movements within a category
 */
export async function reorderMovements(
  categoryId: string,
  movementIds: string[]
): Promise<void> {
  try {
    const promises = movementIds.map((movementId, index) =>
      updateMovement(movementId, { ordinal: index })
    );

    await Promise.all(promises);
  } catch (error) {
    console.error('Error reordering movements:', error);
    throw error;
  }
}

/**
 * Subscribe to movements changes for a specific category
 */
export function subscribeToMovementsByCategory(
  categoryId: string,
  callback: (movements: Movement[]) => void
): () => void {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('categoryId', '==', categoryId)
  );

  return onSnapshot(q, (querySnapshot) => {
    const movements = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Movement[];

    // Sort by ordinal first, then by name for movements with same ordinal
    movements.sort((a, b) => {
      if (a.ordinal !== b.ordinal) {
        return (a.ordinal || 0) - (b.ordinal || 0);
      }
      return a.name.localeCompare(b.name);
    });

    callback(movements);
  }, (error) => {
    console.error('Error in movements subscription:', error);
  });
}

/**
 * Subscribe to all movements changes
 */
export function subscribeToMovements(callback: (movements: Movement[]) => void): () => void {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('ownerId', '==', getOwnerId())
  );

  return onSnapshot(q, (querySnapshot) => {
    const movements = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as Movement[];

    callback(movements);
  }, (error) => {
    console.error('Error in movements subscription:', error);
  });
}

/**
 * Get next ordinal number for a category
 */
export async function getNextOrdinal(categoryId: string): Promise<number> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('categoryId', '==', categoryId)
    );
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return 0;
    }

    const movements = querySnapshot.docs.map(doc => doc.data() as Movement);
    const maxOrdinal = Math.max(...movements.map(m => m.ordinal || 0));
    return maxOrdinal + 1;
  } catch (error) {
    console.error('Error getting next ordinal:', error);
    return 0;
  }
}

/**
 * Reorder movements within a category
 */
export async function reorderMovementsInCategory(
  categoryId: string,
  draggedIndex: number,
  dropIndex: number
): Promise<void> {
  try {
    // Get all movements for the category
    const movements = await getMovementsByCategory(categoryId);

    if (draggedIndex === dropIndex || draggedIndex < 0 || dropIndex < 0 ||
      draggedIndex >= movements.length || dropIndex >= movements.length) {
      return; // No change needed
    }

    // Create new order array
    const reorderedMovements = [...movements];
    const [draggedMovement] = reorderedMovements.splice(draggedIndex, 1);
    reorderedMovements.splice(dropIndex, 0, draggedMovement);

    // Update ordinals for all movements in the new order
    const updatePromises = reorderedMovements.map((movement, index) => {
      return updateMovement(movement.id, { ordinal: index });
    });

    await Promise.all(updatePromises);
  } catch (error) {
    console.error('Error reordering movements:', error);
    throw error;
  }
}