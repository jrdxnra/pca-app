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
import { db, getDb, auth } from '../config';
import { WeekTemplate, WeekTemplateDay } from '../../types';

export type { WeekTemplate, WeekTemplateDay };

// Helper to get current user ID
function getOwnerId(): string {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Unauthorized');
  }
  return currentUser.uid;
}

export const createWeekTemplate = async (template: Omit<WeekTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(getDb(), 'weekTemplates'), {
      ...template,
      // Ensure variations are saved if present
      days: template.days.map(d => ({
        ...d,
        variations: d.variations || []
      })),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: getOwnerId(),
      ownerId: getOwnerId()
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

    const cleanUpdates = { ...updates };
    if (cleanUpdates.days) {
      cleanUpdates.days = cleanUpdates.days.map(d => ({
        ...d,
        variations: d.variations || []
      }));
    }

    await updateDoc(templateRef, {
      ...cleanUpdates,
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
    const q = query(
      collection(getDb(), 'weekTemplates'),
      where('ownerId', '==', getOwnerId()),
      orderBy('order', 'asc')
    );
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

