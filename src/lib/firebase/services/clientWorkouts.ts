import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc,
  getDocs,
  query, 
  where,
  orderBy,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config';
import type { 
  ClientWorkout, 
  ClientWorkoutWarmup,
  ClientWorkoutRound,
  WorkoutTemplate 
} from '@/lib/types';

const COLLECTION_NAME = 'clientWorkouts';

/**
 * Create a new client workout
 */
export async function createClientWorkout(
  clientWorkout: Omit<ClientWorkout, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ClientWorkout> {
  const now = Timestamp.now();
  
  const workoutData = {
    ...clientWorkout,
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await addDoc(collection(db, COLLECTION_NAME), workoutData);
  
  return {
    id: docRef.id,
    ...workoutData,
  };
}

/**
 * Get a single client workout by ID
 */
export async function getClientWorkout(id: string): Promise<ClientWorkout | null> {
  const docRef = doc(db, COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as ClientWorkout;
}

/**
 * Get all workouts for a specific client
 */
export async function fetchClientWorkouts(clientId: string): Promise<ClientWorkout[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('clientId', '==', clientId),
    orderBy('date', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ClientWorkout));
}

/**
 * Get all workouts for a specific period
 */
export async function fetchPeriodWorkouts(periodId: string): Promise<ClientWorkout[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('periodId', '==', periodId),
    orderBy('date', 'asc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ClientWorkout));
}

/**
 * Get workouts for a date range
 */
export async function fetchWorkoutsByDateRange(
  clientId: string,
  startDate: Timestamp,
  endDate: Timestamp
): Promise<ClientWorkout[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('clientId', '==', clientId),
    where('date', '>=', startDate),
    where('date', '<=', endDate)
  );

  const querySnapshot = await getDocs(q);
  const workouts = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ClientWorkout));
  
  // Sort in memory to avoid requiring a composite index
  return workouts.sort((a, b) => {
    const dateA = a.date instanceof Timestamp ? a.date.toMillis() : new Date(a.date).getTime();
    const dateB = b.date instanceof Timestamp ? b.date.toMillis() : new Date(b.date).getTime();
    return dateA - dateB;
  });
}

/**
 * Update an existing client workout
 */
export async function updateClientWorkout(
  id: string,
  updates: Partial<ClientWorkout>
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Delete a client workout
 */
export async function deleteClientWorkout(id: string): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, id);
  await deleteDoc(docRef);
}

/**
 * Copy template data to client workout (for hybrid approach)
 * This is called when a user first edits a workout that was linked to a template
 */
export async function copyTemplateToClientWorkout(
  workoutId: string,
  template: WorkoutTemplate
): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, workoutId);
  
  // Convert template rounds to ClientWorkoutRounds
  const rounds: ClientWorkoutRound[] = template.rounds.map((round, roundIndex) => ({
    ordinal: roundIndex + 1,
    sets: 1, // Default, coach can adjust
    movementUsages: round.exercises.map((exercise, exerciseIndex) => ({
      ordinal: exerciseIndex + 1,
      movementId: exercise.movementId,
      categoryId: '', // Need to fetch from movement data
      note: exercise.notes || '',
      targetWorkload: {
        useWeight: !!exercise.weight,
        weight: exercise.weight,
        weightMeasure: 'lbs',
        useReps: !!exercise.reps,
        reps: exercise.reps,
        useTempo: !!exercise.tempo,
        tempo: exercise.tempo,
        useTime: false,
        time: undefined,
        useDistance: false,
        distance: undefined,
        distanceMeasure: 'mi',
        usePace: false,
        pace: undefined,
        paceMeasure: 'mi',
        usePercentage: !!exercise.percentageIncrease,
        percentage: exercise.percentageIncrease ? parseFloat(exercise.percentageIncrease) : undefined,
        useRPE: !!exercise.targetRPE,
        rpe: exercise.targetRPE?.toString(),
        unilateral: false,
      },
    })),
  }));

  await updateDoc(docRef, {
    title: template.name,
    rounds,
    warmups: [], // Templates don't have warmups currently
    isModified: true,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Create a client workout from a template (hybrid approach)
 * Initially just stores the template reference
 */
export async function createClientWorkoutFromTemplate(
  clientId: string,
  periodId: string,
  date: Timestamp,
  dayOfWeek: number,
  categoryName: string,
  templateId: string,
  createdBy: string
): Promise<ClientWorkout> {
  return createClientWorkout({
    clientId,
    periodId,
    date,
    dayOfWeek,
    categoryName,
    workoutTemplateId: templateId,
    isModified: false, // Using template data
    createdBy,
  });
}

/**
 * Bulk create workouts for a period
 */
export async function bulkCreateWorkouts(
  workouts: Omit<ClientWorkout, 'id' | 'createdAt' | 'updatedAt'>[]
): Promise<void> {
  const batch = writeBatch(db);
  const now = Timestamp.now();

  workouts.forEach(workout => {
    const docRef = doc(collection(db, COLLECTION_NAME));
    batch.set(docRef, {
      ...workout,
      createdAt: now,
      updatedAt: now,
    });
  });

  await batch.commit();
}

/**
 * Get the actual workout data (handles hybrid template/embedded approach)
 */
export async function getWorkoutData(
  workout: ClientWorkout,
  getTemplate: (id: string) => Promise<WorkoutTemplate | null>
): Promise<{
  title: string;
  notes?: string;
  time?: string;
  warmups: ClientWorkoutWarmup[];
  rounds: ClientWorkoutRound[];
}> {
  // If modified or no template, use embedded data
  if (workout.isModified || !workout.workoutTemplateId) {
    return {
      title: workout.title || 'Untitled Workout',
      notes: workout.notes,
      time: workout.time,
      warmups: workout.warmups || [],
      rounds: workout.rounds || [],
    };
  }

  // Otherwise, fetch and use template data
  const template = await getTemplate(workout.workoutTemplateId);
  
  if (!template) {
    // Template deleted, fall back to embedded data
    return {
      title: workout.title || 'Untitled Workout',
      notes: workout.notes,
      time: workout.time,
      warmups: workout.warmups || [],
      rounds: workout.rounds || [],
    };
  }

  // Convert template data to workout data format
  const rounds: ClientWorkoutRound[] = template.rounds.map((round, roundIndex) => ({
    ordinal: roundIndex + 1,
    sets: 1,
    movementUsages: round.exercises.map((exercise, exerciseIndex) => ({
      ordinal: exerciseIndex + 1,
      movementId: exercise.movementId,
      categoryId: '',
      note: exercise.notes || '',
      targetWorkload: {
        useWeight: !!exercise.weight,
        weight: exercise.weight,
        weightMeasure: 'lbs',
        useReps: !!exercise.reps,
        reps: exercise.reps,
        useTempo: !!exercise.tempo,
        tempo: exercise.tempo,
        useTime: false,
        useDistance: false,
        distanceMeasure: 'mi',
        usePace: false,
        paceMeasure: 'mi',
        usePercentage: !!exercise.percentageIncrease,
        percentage: exercise.percentageIncrease ? parseFloat(exercise.percentageIncrease) : undefined,
        useRPE: !!exercise.targetRPE,
        rpe: exercise.targetRPE?.toString(),
        unilateral: false,
      },
    })),
  }));

  return {
    title: template.name,
    notes: undefined,
    time: undefined,
    warmups: [],
    rounds,
  };
}

/**
 * Get workouts for a date range across all clients
 */
export async function fetchAllWorkoutsByDateRange(
  startDate: Timestamp,
  endDate: Timestamp
): Promise<ClientWorkout[]> {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  );

  const querySnapshot = await getDocs(q);
  const workouts = querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as ClientWorkout));
  
  return workouts;
}
