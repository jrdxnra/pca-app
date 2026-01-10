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
import { db } from '../config';
import { Client, PersonalRecord } from '@/lib/types';

const COLLECTION_NAME = 'clients';

/**
 * Client CRUD Operations
 */

export async function createClient(clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'personalRecords'>): Promise<string> {
  try {
    // Remove undefined fields to avoid Firebase errors
    const cleanData = Object.entries(clientData).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    const docRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...cleanData,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      isDeleted: false,
      personalRecords: {},
    });
    return docRef.id;
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
}

export async function getClient(id: string): Promise<Client | null> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Client;
    }
    return null;
  } catch (error) {
    console.error('Error getting client:', error);
    throw error;
  }
}

export async function getAllClients(includeDeleted = false): Promise<Client[]> {
  try {
    let q = query(collection(db, COLLECTION_NAME), orderBy('name'));
    
    if (!includeDeleted) {
      q = query(collection(db, COLLECTION_NAME), where('isDeleted', '==', false), orderBy('name'));
    }
    
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Client[];
  } catch (error) {
    console.error('Error getting clients:', error);
    throw error;
  }
}

export async function updateClient(id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>): Promise<void> {
  try {
    // Remove undefined fields to avoid Firebase errors
    const cleanUpdates = Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as Record<string, any>);

    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error updating client:', error);
    throw error;
  }
}

export async function softDeleteClient(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isDeleted: true,
      deletedAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error soft deleting client:', error);
    throw error;
  }
}

export async function permanentDeleteClient(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error permanently deleting client:', error);
    throw error;
  }
}

export async function restoreClient(id: string): Promise<void> {
  try {
    const docRef = doc(db, COLLECTION_NAME, id);
    await updateDoc(docRef, {
      isDeleted: false,
      deletedAt: null,
      updatedAt: Timestamp.now(),
    });
  } catch (error) {
    console.error('Error restoring client:', error);
    throw error;
  }
}

/**
 * Personal Records Management
 */

export async function updatePersonalRecord(
  clientId: string, 
  movementId: string, 
  oneRepMax: number, 
  method: 'tested' | 'estimated' = 'estimated'
): Promise<void> {
  try {
    const client = await getClient(clientId);
    if (!client) throw new Error('Client not found');

    const currentPR = client.personalRecords[movementId];
    const newRecord = {
      oneRepMax,
      date: Timestamp.now(),
      method,
    };

    // Update history
    const history = currentPR?.history || [];
    if (currentPR) {
      history.push({
        value: currentPR.oneRepMax,
        date: currentPR.date,
        method: currentPR.method,
      });
    }

    const updatedPR: PersonalRecord = {
      ...newRecord,
      history,
    };

    await updateClient(clientId, {
      personalRecords: {
        ...client.personalRecords,
        [movementId]: updatedPR,
      },
    });
  } catch (error) {
    console.error('Error updating personal record:', error);
    throw error;
  }
}

export async function getPersonalRecord(clientId: string, movementId: string): Promise<PersonalRecord | null> {
  try {
    const client = await getClient(clientId);
    return client?.personalRecords[movementId] || null;
  } catch (error) {
    console.error('Error getting personal record:', error);
    throw error;
  }
}

export async function getAllPersonalRecords(clientId: string): Promise<Record<string, PersonalRecord>> {
  try {
    const client = await getClient(clientId);
    return client?.personalRecords || {};
  } catch (error) {
    console.error('Error getting all personal records:', error);
    throw error;
  }
}

/**
 * Real-time subscription to clients
 */
export function subscribeToClients(callback: (clients: Client[]) => void, includeDeleted = false): () => void {
  let q = query(collection(db, COLLECTION_NAME), orderBy('name'));
  
  if (!includeDeleted) {
    q = query(collection(db, COLLECTION_NAME), where('isDeleted', '==', false), orderBy('name'));
  }
  
  return onSnapshot(q, (querySnapshot) => {
    const clients = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Client[];
    
    callback(clients);
  }, (error) => {
    console.error('Error in clients subscription:', error);
  });
}

/**
 * Search clients by name or email
 */
export async function searchClients(searchTerm: string, includeDeleted = false): Promise<Client[]> {
  try {
    const clients = await getAllClients(includeDeleted);
    const lowercaseSearch = searchTerm.toLowerCase();
    
    return clients.filter(client => 
      client.name.toLowerCase().includes(lowercaseSearch) ||
      (client.email && client.email.toLowerCase().includes(lowercaseSearch))
    );
  } catch (error) {
    console.error('Error searching clients:', error);
    throw error;
  }
}
