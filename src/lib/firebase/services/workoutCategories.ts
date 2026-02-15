import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { db, getDb } from '../config';
import { WorkoutCategory } from '../../types';

export type { WorkoutCategory };

export const createWorkoutCategory = async (category: Omit<WorkoutCategory, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(getDb(), 'workoutCategories'), {
      ...category,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'current-user' // TODO: Get from auth context
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating workout category:', error);
    throw error;
  }
};

export const updateWorkoutCategory = async (id: string, updates: Partial<Omit<WorkoutCategory, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> => {
  try {
    const categoryRef = doc(getDb(), 'workoutCategories', id);
    await updateDoc(categoryRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating workout category:', error);
    throw error;
  }
};

export const deleteWorkoutCategory = async (id: string): Promise<void> => {
  try {
    const categoryRef = doc(getDb(), 'workoutCategories', id);
    await deleteDoc(categoryRef);
  } catch (error) {
    console.error('Error deleting workout category:', error);
    throw error;
  }
};

export const fetchWorkoutCategories = async (): Promise<WorkoutCategory[]> => {
  try {
    const q = query(collection(getDb(), 'workoutCategories'), orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WorkoutCategory[];
  } catch (error) {
    console.error('Error fetching workout categories:', error);
    throw error;
  }
};

