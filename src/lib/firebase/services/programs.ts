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
import { Program, ScheduledWorkout } from '@/lib/types';

const PROGRAMS_COLLECTION = 'programs';
const SCHEDULED_WORKOUTS_COLLECTION = 'scheduled-workouts';

// Helper to get current user ID
function getOwnerId(): string {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  return currentUser.uid;
}

/**
 * Program CRUD Operations
 */

export async function createProgram(
  programData: Omit<Program, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const docRef = await addDoc(collection(getDb(), PROGRAMS_COLLECTION), {
      ...programData,
      ownerId: getOwnerId(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating program:', error);
    throw error;
  }
}

export async function getProgram(id: string): Promise<Program | null> {
  try {
    const docRef = doc(getDb(), PROGRAMS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Program;
    }
    return null;
  } catch (error) {
    console.error('Error getting program:', error);
    throw error;
  }
}

export async function getAllPrograms(): Promise<Program[]> {
  try {
    const q = query(
      collection(getDb(), PROGRAMS_COLLECTION),
      where('ownerId', '==', getOwnerId())
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => {
        const dateA = a.startDate?.toMillis() || 0;
        const dateB = b.startDate?.toMillis() || 0;
        return dateB - dateA;
      }) as Program[];
  } catch (error) {
    console.error('Error getting programs:', error);
    throw error;
  }
}

export async function getProgramsByClient(clientId: string): Promise<Program[]> {
  try {
    const q = query(
      collection(getDb(), PROGRAMS_COLLECTION),
      where('clientId', '==', clientId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => {
        const dateA = a.startDate?.toMillis() || 0;
        const dateB = b.startDate?.toMillis() || 0;
        return dateB - dateA;
      }) as Program[];
  } catch (error) {
    console.error('Error getting programs by client:', error);
    throw error;
  }
}

export async function updateProgram(
  id: string,
  updates: Partial<Omit<Program, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(getDb(), PROGRAMS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating program:', error);
    throw error;
  }
}

export async function deleteProgram(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), PROGRAMS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting program:', error);
    throw error;
  }
}

/**
 * Scheduled Workout CRUD Operations
 */

export async function createScheduledWorkout(
  workoutData: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  try {
    const docRef = await addDoc(collection(getDb(), SCHEDULED_WORKOUTS_COLLECTION), {
      ...workoutData,
      ownerId: getOwnerId(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating scheduled workout:', error);
    throw error;
  }
}

export async function getScheduledWorkout(id: string): Promise<ScheduledWorkout | null> {
  try {
    const docRef = doc(getDb(), SCHEDULED_WORKOUTS_COLLECTION, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as ScheduledWorkout;
    }
    return null;
  } catch (error) {
    console.error('Error getting scheduled workout:', error);
    throw error;
  }
}

export async function getScheduledWorkoutsByProgram(programId: string): Promise<ScheduledWorkout[]> {
  try {
    const q = query(
      collection(getDb(), SCHEDULED_WORKOUTS_COLLECTION),
      where('programId', '==', programId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.date.toMillis() - b.date.toMillis()) as ScheduledWorkout[];
  } catch (error) {
    console.error('Error getting scheduled workouts by program:', error);
    throw error;
  }
}

export async function getScheduledWorkoutsByClient(clientId: string): Promise<ScheduledWorkout[]> {
  try {
    const q = query(
      collection(getDb(), SCHEDULED_WORKOUTS_COLLECTION),
      where('clientId', '==', clientId)
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.date.toMillis() - b.date.toMillis()) as ScheduledWorkout[];
  } catch (error) {
    console.error('Error getting scheduled workouts by client:', error);
    throw error;
  }
}

export async function getAllScheduledWorkouts(): Promise<ScheduledWorkout[]> {
  try {
    const q = query(
      collection(getDb(), SCHEDULED_WORKOUTS_COLLECTION),
      where('ownerId', '==', getOwnerId())
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.date.toMillis() - b.date.toMillis()) as ScheduledWorkout[];
  } catch (error) {
    console.error('Error getting all scheduled workouts:', error);
    throw error;
  }
}

export async function getScheduledWorkoutsByDateRange(
  clientId: string,
  startDate: Date,
  endDate: Date
): Promise<ScheduledWorkout[]> {
  try {
    const q = query(
      collection(getDb(), SCHEDULED_WORKOUTS_COLLECTION),
      where('clientId', '==', clientId),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate))
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.date.toMillis() - b.date.toMillis()) as ScheduledWorkout[];

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ScheduledWorkout[];
  } catch (error) {
    console.error('Error getting scheduled workouts by date range:', error);
    throw error;
  }
}

export async function updateScheduledWorkout(
  id: string,
  updates: Partial<Omit<ScheduledWorkout, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(getDb(), SCHEDULED_WORKOUTS_COLLECTION, id);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating scheduled workout:', error);
    throw error;
  }
}

export async function deleteScheduledWorkout(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), SCHEDULED_WORKOUTS_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting scheduled workout:', error);
    throw error;
  }
}

/**
 * Bulk Operations for Program Management
 */

export async function scheduleWorkoutFromTemplate(
  programId: string,
  clientId: string,
  date: Date,
  workoutTemplateId: string,
  sessionType: string,
  keepLinked: boolean = true
): Promise<string> {
  try {
    // Get the workout template
    const templateDoc = await getDoc(doc(getDb(), 'workout-templates', workoutTemplateId));
    if (!templateDoc.exists()) {
      throw new Error('Workout template not found');
    }

    const template = templateDoc.data();

    const scheduledWorkout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'> = {
      programId,
      clientId,
      date: Timestamp.fromDate(date),
      weekNumber: 1, // Calculate based on program start date
      dayNumber: date.getDay(),
      workoutTemplateId: keepLinked ? workoutTemplateId : undefined,
      isTemplate: keepLinked,
      sessionType,
      duration: 60, // Default 60 minutes - can be made configurable later
      rounds: template.rounds,
      status: 'scheduled',
    };

    return await createScheduledWorkout(scheduledWorkout);
  } catch (error) {
    console.error('Error scheduling workout from template:', error);
    throw error;
  }
}

export async function duplicateWeek(
  programId: string,
  clientId: string,
  sourceWeekStart: Date,
  targetWeekStart: Date
): Promise<void> {
  try {
    // Get workouts from source week
    const sourceWeekEnd = new Date(sourceWeekStart);
    sourceWeekEnd.setDate(sourceWeekEnd.getDate() + 6);

    const sourceWorkouts = await getScheduledWorkoutsByDateRange(
      clientId,
      sourceWeekStart,
      sourceWeekEnd
    );

    // Create workouts for target week
    const daysDiff = Math.floor(
      (targetWeekStart.getTime() - sourceWeekStart.getTime()) / (1000 * 60 * 60 * 24)
    );

    for (const sourceWorkout of sourceWorkouts) {
      const targetDate = new Date(sourceWorkout.date.toDate());
      targetDate.setDate(targetDate.getDate() + daysDiff);

      const newWorkout: Omit<ScheduledWorkout, 'id' | 'createdAt' | 'updatedAt'> = {
        ...sourceWorkout,
        date: Timestamp.fromDate(targetDate),
        status: 'scheduled',
      };

      // Remove the id field
      delete (newWorkout as any).id;
      delete (newWorkout as any).createdAt;
      delete (newWorkout as any).updatedAt;

      await createScheduledWorkout(newWorkout);
    }
  } catch (error) {
    console.error('Error duplicating week:', error);
    throw error;
  }
}

/**
 * Real-time subscriptions
 */

export function subscribeToPrograms(callback: (programs: Program[]) => void): () => void {
  const q = query(
    collection(getDb(), PROGRAMS_COLLECTION),
    where('ownerId', '==', getOwnerId())
  );

  return onSnapshot(q, (querySnapshot) => {
    const programs = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => {
        const dateA = a.startDate?.toMillis() || 0;
        const dateB = b.startDate?.toMillis() || 0;
        return dateB - dateA;
      }) as Program[];

    callback(programs);
  }, (error) => {
    console.error('Error in programs subscription:', error);
  });
}

export function subscribeToScheduledWorkouts(
  programId: string,
  callback: (workouts: ScheduledWorkout[]) => void
): () => void {
  const q = query(
    collection(getDb(), SCHEDULED_WORKOUTS_COLLECTION),
    where('programId', '==', programId)
  );

  return onSnapshot(q, (querySnapshot) => {
    const workouts = querySnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .sort((a: any, b: any) => a.date.toMillis() - b.date.toMillis()) as ScheduledWorkout[];

    callback(workouts);
  }, (error) => {
    console.error('Error in scheduled workouts subscription:', error);
  });
}

/**
 * Utility functions
 */

export function calculateWeekNumber(programStartDate: Date, workoutDate: Date): number {
  const diffTime = workoutDate.getTime() - programStartDate.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.ceil(diffDays / 7);
}

export function getWeekStartDate(date: Date): Date {
  const weekStart = new Date(date);
  weekStart.setDate(date.getDate() - date.getDay());
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

export function getWeekEndDate(date: Date): Date {
  const weekEnd = new Date(date);
  weekEnd.setDate(date.getDate() - date.getDay() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return weekEnd;
}
