/**
 * Base Service Class
 * 
 * Provides common CRUD operations and error handling patterns
 * for all Firebase services. Services can extend this class
 * to get consistent behavior.
 */

import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  query,
  orderBy,
  Timestamp 
} from 'firebase/firestore';
import { getDb } from '../config';

export interface BaseEntity {
  id: string;
  createdAt: Date | any;
  updatedAt: Date | any;
}

export abstract class BaseService<T extends BaseEntity> {
  protected abstract collectionName: string;
  protected abstract defaultOrderBy: string;

  /**
   * Create a new document
   */
  protected async create(
    data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>,
    additionalFields?: Record<string, unknown>
  ): Promise<string> {
    try {
      const cleanData = this.cleanData(data);
      const docRef = await addDoc(collection(getDb(), this.collectionName), {
        ...cleanData,
        ...additionalFields,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      return docRef.id;
    } catch (error) {
      console.error(`Error creating ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get a single document by ID
   */
  protected async get(id: string): Promise<T | null> {
    try {
      const docRef = doc(getDb(), this.collectionName, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      console.error(`Error getting ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get all documents
   */
  protected async getAll(filters?: { orderBy?: string }): Promise<T[]> {
    try {
      const orderByField = filters?.orderBy || this.defaultOrderBy;
      const q = query(collection(getDb(), this.collectionName), orderBy(orderByField));
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as T[];
    } catch (error) {
      console.error(`Error getting all ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Update a document
   */
  protected async update(
    id: string, 
    updates: Partial<Omit<T, 'id' | 'createdAt'>>
  ): Promise<void> {
    try {
      const cleanUpdates = this.cleanData(updates);
      const docRef = doc(getDb(), this.collectionName, id);
      await updateDoc(docRef, {
        ...cleanUpdates,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error(`Error updating ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  protected async delete(id: string): Promise<void> {
    try {
      const docRef = doc(getDb(), this.collectionName, id);
      await deleteDoc(docRef);
    } catch (error) {
      console.error(`Error deleting ${this.collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Clean data by removing undefined values
   * Firebase doesn't allow undefined values
   */
  protected cleanData(data: Record<string, unknown>): Record<string, unknown> {
    return Object.entries(data).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, unknown>);
  }

  /**
   * Log errors consistently
   */
  protected logError(operation: string, error: unknown): void {
    console.error(`Error ${operation} ${this.collectionName}:`, error);
  }
}
