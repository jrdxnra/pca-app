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
import { db } from '../config';

export interface Period {
  id: string;
  name: string;
  color: string;
  focus: string;
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export const createPeriod = async (period: Omit<Period, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, 'periods'), {
      ...period,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'current-user' // TODO: Get from auth context
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating period:', error);
    throw error;
  }
};

export const updatePeriod = async (id: string, updates: Partial<Omit<Period, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> => {
  try {
    const periodRef = doc(db, 'periods', id);
    await updateDoc(periodRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating period:', error);
    throw error;
  }
};

export const deletePeriod = async (id: string): Promise<void> => {
  try {
    const periodRef = doc(db, 'periods', id);
    await deleteDoc(periodRef);
  } catch (error) {
    console.error('Error deleting period:', error);
    throw error;
  }
};

export const fetchPeriods = async (): Promise<Period[]> => {
  try {
    const q = query(collection(db, 'periods'), orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Period[];
  } catch (error) {
    console.error('Error fetching periods:', error);
    throw error;
  }
};

