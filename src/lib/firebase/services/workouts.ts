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
import { resolveActiveAccountId } from './memberships';
import { WorkoutTemplate, WorkoutRound } from '@/lib/types';

const COLLECTION_NAME = 'workout-templates';

// Helper to get current account ID
async function getAccountId(): Promise<string> {
  const accountId = await resolveActiveAccountId();
  if (!accountId) {
    throw new Error('Unauthorized or No Active Account');
  }
  return accountId;
}

/**
 * Workout Template CRUD Operations
 */

export async function createWorkoutTemplate(
  templateData: Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), {
      ...templateData,
      ownerId: await getAccountId(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating workout template:', error);
    throw error;
  }
}

export async function getWorkoutTemplate(id: string): Promise<WorkoutTemplate | null> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as WorkoutTemplate;
    }
    return null;
  } catch (error) {
    console.error('Error getting workout template:', error);
    throw error;
  }
}

export async function getAllWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', await getAccountId())
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as WorkoutTemplate[];
  } catch (error) {
    console.error('Error getting workout templates:', error);
    throw error;
  }
}

export async function getWorkoutTemplatesByCreator(createdBy: string): Promise<WorkoutTemplate[]> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('createdBy', '==', createdBy)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as WorkoutTemplate[];
  } catch (error) {
    console.error('Error getting workout templates by creator:', error);
    throw error;
  }
}

export async function getPublicWorkoutTemplates(): Promise<WorkoutTemplate[]> {
  try {
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('isPublic', '==', true)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as WorkoutTemplate[];
  } catch (error) {
    console.error('Error getting public workout templates:', error);
    throw error;
  }
}

export async function updateWorkoutTemplate(
  id: string,
  updates: Partial<Omit<WorkoutTemplate, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating workout template:', error);
    throw error;
  }
}

export async function deleteWorkoutTemplate(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting workout template:', error);
    throw error;
  }
}

/**
 * Real-time subscription to workout templates
 */
export function subscribeToWorkoutTemplates(
  accountId: string,
  callback: (templates: WorkoutTemplate[]) => void,
  createdBy?: string
): () => void {
  // By default, only show templates owned by the user
  let q = query(
    collection(getDb(), COLLECTION_NAME),
    where('ownerId', '==', accountId)
  );

  if (createdBy) {
    q = query(
      collection(getDb(), COLLECTION_NAME),
      where('createdBy', '==', createdBy)
    );
  }

  return onSnapshot(q, (querySnapshot) => {
    const templates = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.name.localeCompare(b.name)) as WorkoutTemplate[];

    callback(templates);
  }, (error) => {
    console.error('Error in workout templates subscription:', error);
  });
}

/**
 * Search workout templates
 */
export async function searchWorkoutTemplates(searchTerm: string): Promise<WorkoutTemplate[]> {
  try {
    // Get all templates and filter client-side (for now)
    const templates = await getAllWorkoutTemplates();

    const lowercaseSearch = searchTerm.toLowerCase();
    return templates.filter(template =>
      template.name.toLowerCase().includes(lowercaseSearch) ||
      template.rounds.some(round =>
        round.name.toLowerCase().includes(lowercaseSearch) ||
        round.exercises.some(exercise =>
          // We'd need to resolve movementId to movement name for proper search
          // For now, just search by round names
          false
        )
      )
    );
  } catch (error) {
    console.error('Error searching workout templates:', error);
    throw error;
  }
}

/**
 * Duplicate a workout template
 */
export async function duplicateWorkoutTemplate(
  templateId: string,
  newName: string,
  createdBy: string
): Promise<string> {
  try {
    const originalTemplate = await getWorkoutTemplate(templateId);
    if (!originalTemplate) {
      throw new Error('Template not found');
    }

    return await createWorkoutTemplate({
      name: newName,
      createdBy,
      type: originalTemplate.type,
      isPublic: false, // Duplicates are private by default
      rounds: originalTemplate.rounds,
    });
  } catch (error) {
    console.error('Error duplicating workout template:', error);
    throw error;
  }
}

/**
 * Get default round templates for new workouts
 */
export function getDefaultRounds(): WorkoutRound[] {
  return [
    {
      name: 'PP/MB/Ballistics',
      orderIndex: 0,
      exercises: [],
    },
    {
      name: 'Movement Skill',
      orderIndex: 1,
      exercises: [],
    },
    {
      name: 'Strength 1',
      orderIndex: 2,
      exercises: [],
    },
    {
      name: 'Strength 2',
      orderIndex: 3,
      exercises: [],
    },
    {
      name: 'ESD',
      orderIndex: 4,
      exercises: [],
    },
  ];
}

/**
 * Validate workout template structure
 */
export function validateWorkoutTemplate(template: Partial<WorkoutTemplate>): string[] {
  const errors: string[] = [];

  if (!template.name || template.name.trim().length === 0) {
    errors.push('Workout name is required');
  }

  if (!template.rounds || template.rounds.length === 0) {
    errors.push('At least one round is required');
  }

  if (template.rounds) {
    template.rounds.forEach((round, roundIndex) => {
      if (!round.name || round.name.trim().length === 0) {
        errors.push(`Round ${roundIndex + 1} name is required`);
      }

      round.exercises.forEach((exercise, exerciseIndex) => {
        if (!exercise.movementId) {
          errors.push(`Round ${roundIndex + 1}, Exercise ${exerciseIndex + 1}: Movement is required`);
        }
        if (!exercise.sets || exercise.sets < 1) {
          errors.push(`Round ${roundIndex + 1}, Exercise ${exerciseIndex + 1}: Sets must be at least 1`);
        }
        if (!exercise.reps || exercise.reps.trim().length === 0) {
          errors.push(`Round ${roundIndex + 1}, Exercise ${exerciseIndex + 1}: Reps is required`);
        }
      });
    });
  }

  return errors;
}
