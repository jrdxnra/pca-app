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

export interface WorkoutType {
  id: string;
  name: string;
  color: string;
  description: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export const createWorkoutType = async (workoutType: Omit<WorkoutType, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(getDb(), 'workoutTypes'), {
      ...workoutType,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'current-user' // TODO: Get from auth context
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating workout type:', error);
    throw error;
  }
};

export const updateWorkoutType = async (id: string, updates: Partial<Omit<WorkoutType, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> => {
  try {
    const workoutTypeRef = doc(getDb(), 'workoutTypes', id);
    await updateDoc(workoutTypeRef, {
      ...updates,
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
    const q = query(collection(getDb(), 'workoutTypes'), orderBy('order', 'asc'));
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

