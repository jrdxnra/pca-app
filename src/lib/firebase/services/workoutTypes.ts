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
  Timestamp
} from 'firebase/firestore';
import { db, getDb } from '../config';
import { resolveActiveAccountId } from './memberships';
import { WorkoutType } from '../../types';

export type { WorkoutType };

const normalizeDaySplitFields = <T extends Partial<WorkoutType>>(payload: T): T => {
  const normalized: T = { ...payload };

  if ('daySplits' in normalized) {
    normalized.daySplits = Array.isArray(normalized.daySplits) ? normalized.daySplits : [];
  }

  if ('defaultDaySplitId' in normalized) {
    const value = typeof normalized.defaultDaySplitId === 'string' ? normalized.defaultDaySplitId.trim() : '';
    normalized.defaultDaySplitId = value || undefined;
  }

  if (normalized.daySplits && normalized.daySplits.length > 0 && !normalized.defaultDaySplitId) {
    normalized.defaultDaySplitId = normalized.daySplits[0].id;
  }

  return normalized;
};

export const createWorkoutType = async (workoutType: Omit<WorkoutType, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  try {
    const normalizedWorkoutType = normalizeDaySplitFields(workoutType);
    const docRef = await addDoc(collection(getDb(), 'workoutTypes'), {
      ...normalizedWorkoutType,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      ownerId: await resolveActiveAccountId()
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating workout type:', error);
    throw error;
  }
};

export const updateWorkoutType = async (id: string, updates: Partial<Omit<WorkoutType, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> => {
  try {
    const normalizedUpdates = normalizeDaySplitFields(updates);
    const workoutTypeRef = doc(getDb(), 'workoutTypes', id);
    await updateDoc(workoutTypeRef, {
      ...normalizedUpdates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating workout type:', error);
    throw error;
  }
};

export const deleteWorkoutType = async (id: string): Promise<void> => {
  try {
    const workoutTypeRef = doc(getDb(), 'workoutTypes', id);
    await deleteDoc(workoutTypeRef);
  } catch (error) {
    console.error('Error deleting workout type:', error);
    throw error;
  }
};

export const fetchWorkoutTypes = async (): Promise<WorkoutType[]> => {
  try {
    const accountId = await resolveActiveAccountId();
    const q = query(
      collection(getDb(), 'workoutTypes'),
      where('ownerId', '==', accountId),
      orderBy('order', 'asc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WorkoutType[];
  } catch (error) {
    console.error('Error fetching workout types:', error);
    throw error;
  }
};

