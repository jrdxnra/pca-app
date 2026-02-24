import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db, getDb, auth } from '../config';
import { resolveActiveAccountId } from './memberships';
import type { WorkoutLog } from '@/lib/types';

const COLLECTION_NAME = 'workoutLogs';

// Helper to get current account ID
async function getAccountId(): Promise<string> {
  const accountId = await resolveActiveAccountId();
  if (!accountId) {
    throw new Error('Unauthorized or No Active Account');
  }
  return accountId;
}

/**
 * Create a new workout log
 */
export async function createWorkoutLog(
  workoutLog: Omit<WorkoutLog, 'id' | 'createdAt'>
): Promise<WorkoutLog> {
  const accountId = await getAccountId();
  const now = Timestamp.now();

  const logData = {
    ...workoutLog,
    ownerId: accountId,
    createdAt: now,
  };

  const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), logData);

  return {
    id: docRef.id,
    ...logData,
  };
}

/**
 * Get a workout log by ID
 */
export async function getWorkoutLog(id: string): Promise<WorkoutLog | null> {
  const docRef = doc(getDb(), COLLECTION_NAME, id);
  const docSnap = await getDoc(docRef);

  if (!docSnap.exists()) {
    return null;
  }

  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as WorkoutLog;
}

/**
 * Get workout log for a specific scheduled workout
 */
export async function getWorkoutLogByScheduledWorkout(
  scheduledWorkoutId: string
): Promise<WorkoutLog | null> {
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('scheduledWorkoutId', '==', scheduledWorkoutId)
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  // Return the first (and should be only) log for this workout
  const doc = querySnapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
  } as WorkoutLog;
}

/**
 * Get all workout logs for a specific client
 */
export async function fetchClientWorkoutLogs(clientId: string): Promise<WorkoutLog[]> {
  const accountId = await getAccountId();
  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('ownerId', '==', accountId),
    where('clientId', '==', clientId),
    orderBy('completedDate', 'desc')
  );

  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  } as WorkoutLog));
}

/**
 * Update an existing workout log
 */
export async function updateWorkoutLog(
  id: string,
  updates: Partial<WorkoutLog>
): Promise<void> {
  const docRef = doc(getDb(), COLLECTION_NAME, id);
  await updateDoc(docRef, updates);
}

/**
 * Create or update a workout log for a scheduled workout
 * If a log already exists, it will be updated; otherwise, a new one will be created
 */
export async function upsertWorkoutLog(
  scheduledWorkoutId: string,
  workoutLogData: Omit<WorkoutLog, 'id' | 'scheduledWorkoutId' | 'createdAt'>
): Promise<WorkoutLog> {
  // Check if log already exists
  const existingLog = await getWorkoutLogByScheduledWorkout(scheduledWorkoutId);

  if (existingLog) {
    // Update existing log
    await updateWorkoutLog(existingLog.id, workoutLogData);
    return {
      ...existingLog,
      ...workoutLogData,
    };
  } else {
    // Create new log
    return createWorkoutLog({
      ...workoutLogData,
      scheduledWorkoutId,
    });
  }
}




























