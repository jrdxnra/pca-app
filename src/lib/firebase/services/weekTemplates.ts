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

export interface WeekTemplateDay {
  day: string;
  workoutCategory: string;
}

export interface WeekTemplate {
  id: string;
  name: string;
  color: string;
  days: WeekTemplateDay[];
  order: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
}

export const createWeekTemplate = async (template: Omit<WeekTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(getDb(), 'weekTemplates'), {
      ...template,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: 'current-user' // TODO: Get from auth context
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating week template:', error);
    throw error;
  }
};

export const updateWeekTemplate = async (id: string, updates: Partial<Omit<WeekTemplate, 'id' | 'createdAt' | 'createdBy'>>): Promise<void> => {
  try {
    const templateRef = doc(getDb(), 'weekTemplates', id);
    await updateDoc(templateRef, {
      ...updates,
      updatedAt: Timestamp.now()
    });
  } catch (error) {
    console.error('Error updating week template:', error);
    throw error;
  }
};

export const deleteWeekTemplate = async (id: string): Promise<void> => {
  try {
    const templateRef = doc(getDb(), 'weekTemplates', id);
    await deleteDoc(templateRef);
  } catch (error) {
    console.error('Error deleting week template:', error);
    throw error;
  }
};

export const fetchWeekTemplates = async (): Promise<WeekTemplate[]> => {
  try {
    const q = query(collection(getDb(), 'weekTemplates'), orderBy('order', 'asc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as WeekTemplate[];
  } catch (error) {
    console.error('Error fetching week templates:', error);
    throw error;
  }
};

