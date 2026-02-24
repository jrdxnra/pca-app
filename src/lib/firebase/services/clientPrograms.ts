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
  Timestamp
} from 'firebase/firestore';
import { db, getDb, auth } from '../config';
import { resolveActiveAccountId } from './memberships';
import { ClientProgram, ClientProgramPeriod } from '@/lib/types';

const COLLECTION_NAME = 'client-programs';

// Helper function to remove undefined values for Firebase
function cleanForFirebase(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (Array.isArray(obj)) {
    return obj.map(cleanForFirebase);
  }

  if (typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      if (obj[key] !== undefined) {
        cleaned[key] = cleanForFirebase(obj[key]);
      }
    });
    return cleaned;
  }

  return obj;
}

// Helper to get current account ID
async function getAccountId(): Promise<string> {
  const accountId = await resolveActiveAccountId();
  if (!accountId) {
    throw new Error('Unauthorized or No Active Account');
  }
  return accountId;
}

/**
 * Client Program CRUD Operations
 */

export async function createClientProgram(
  clientProgramData: Omit<ClientProgram, 'id' | 'createdAt' | 'updatedAt'>
): Promise<ClientProgram> {
  try {
    const accountId = await getAccountId();
    const now = Timestamp.now();
    const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), {
      ...clientProgramData,
      ownerId: accountId,
      createdAt: now,
      updatedAt: now,
    });

    // Return the full program object
    return {
      id: docRef.id,
      ...clientProgramData,
      createdAt: now,
      updatedAt: now,
    };
  } catch (error) {
    console.error('Error creating client program:', error);
    throw error;
  }
}

export async function getClientProgram(id: string): Promise<ClientProgram | null> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return {
        id: docSnap.id,
        ...docSnap.data()
      } as ClientProgram;
    }
    return null;
  } catch (error) {
    console.error('Error getting client program:', error);
    throw error;
  }
}

export async function getClientProgramsByClient(clientId: string): Promise<ClientProgram[]> {
  try {
    const accountId = await getAccountId();
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', accountId),
      where('clientId', '==', clientId),
      orderBy('startDate', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ClientProgram[];
  } catch (error) {
    console.error('Error getting client programs by client:', error);
    throw error;
  }
}

export async function getAllClientPrograms(): Promise<ClientProgram[]> {
  try {
    const accountId = await getAccountId();
    const q = query(
      collection(getDb(), COLLECTION_NAME),
      where('ownerId', '==', accountId),
      orderBy('startDate', 'desc')
    );
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as ClientProgram[];
  } catch (error) {
    console.error('Error getting all client programs:', error);
    throw error;
  }
}

export async function updateClientProgram(
  id: string,
  updates: Partial<Omit<ClientProgram, 'id' | 'createdAt'>>
): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    const cleanedUpdates = cleanForFirebase({
      ...updates,
      updatedAt: Timestamp.now(),
    });
    await updateDoc(docRef, cleanedUpdates);
  } catch (error) {
    console.error('Error updating client program:', error);
    throw error;
  }
}

export async function deleteClientProgram(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting client program:', error);
    throw error;
  }
}

/**
 * Period-specific operations within client programs
 */

export async function addPeriodToClientProgram(
  clientProgramId: string,
  period: Omit<ClientProgramPeriod, 'id'>
): Promise<void> {
  try {
    const clientProgram = await getClientProgram(clientProgramId);
    if (!clientProgram) {
      throw new Error('Client program not found');
    }

    const newPeriod: ClientProgramPeriod = {
      id: `period_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...period
    };

    const updatedPeriods = [...clientProgram.periods, newPeriod];

    // Log with raw date values (no conversion)
    console.log('Saving period to Firebase:', {
      clientProgramId,
      periodId: newPeriod.id,
      periodName: newPeriod.periodName,
      startDateRaw: newPeriod.startDate,
      endDateRaw: newPeriod.endDate,
      daysCount: newPeriod.days?.length || 0,
      totalPeriodsInProgram: updatedPeriods.length,
      collection: 'client-programs',
      documentId: clientProgramId
    });

    console.log('Updating client program document with periods:', {
      documentId: clientProgramId,
      collection: COLLECTION_NAME,
      periodsCount: updatedPeriods.length,
      periodIds: updatedPeriods.map(p => p.id)
    });

    await updateClientProgram(clientProgramId, {
      periods: updatedPeriods
    });

    // Verify the save by reading it back
    const verifyProgram = await getClientProgram(clientProgramId);
    console.log('Verification - Period saved successfully to Firebase:', {
      documentId: clientProgramId,
      periodsInDocument: verifyProgram?.periods?.length || 0,
      savedPeriodId: newPeriod.id,
      savedPeriodFound: verifyProgram?.periods?.some(p => p.id === newPeriod.id) || false
    });
  } catch (error) {
    console.error('Error adding period to client program:', error);
    throw error;
  }
}

export async function updatePeriodInClientProgram(
  clientProgramId: string,
  periodId: string,
  updates: Partial<Omit<ClientProgramPeriod, 'id'>>
): Promise<void> {
  try {
    const clientProgram = await getClientProgram(clientProgramId);
    if (!clientProgram) {
      throw new Error('Client program not found');
    }

    const updatedPeriods = clientProgram.periods.map(period =>
      period.id === periodId ? { ...period, ...updates } : period
    );

    await updateClientProgram(clientProgramId, {
      periods: updatedPeriods
    });
  } catch (error) {
    console.error('Error updating period in client program:', error);
    throw error;
  }
}

export async function deletePeriodFromClientProgram(
  clientProgramId: string,
  periodId: string
): Promise<void> {
  try {
    const clientProgram = await getClientProgram(clientProgramId);
    if (!clientProgram) {
      throw new Error('Client program not found');
    }

    const updatedPeriods = clientProgram.periods.filter(period => period.id !== periodId);

    await updateClientProgram(clientProgramId, {
      periods: updatedPeriods
    });
  } catch (error) {
    console.error('Error deleting period from client program:', error);
    throw error;
  }
}

export async function deleteAllPeriodsFromClientProgram(
  clientProgramId: string
): Promise<void> {
  try {
    const clientProgram = await getClientProgram(clientProgramId);
    if (!clientProgram) {
      throw new Error('Client program not found');
    }

    // Clear all periods in a single update
    await updateClientProgram(clientProgramId, {
      periods: []
    });

    console.log('Successfully deleted all periods from client program:', clientProgramId);
  } catch (error) {
    console.error('Error deleting all periods from client program:', error);
    throw error;
  }
}

/**
 * Program template assignment operations
 */

export async function assignProgramTemplateToClient(
  assignment: {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
  }
): Promise<ClientProgram> {
  try {
    const accountId = await getAccountId();
    // Create a new client program for this assignment
    const clientProgramData = {
      clientId: assignment.clientId,
      programTemplateId: assignment.programId,
      startDate: Timestamp.fromDate(assignment.startDate),
      endDate: Timestamp.fromDate(assignment.endDate),
      status: 'active' as const,
      periods: [],
      notes: assignment.notes || '',
      createdBy: auth.currentUser!.uid,
      ownerId: accountId,
    };

    return await createClientProgram(clientProgramData);
  } catch (error) {
    console.error('Error assigning program template to client:', error);
    throw error;
  }
}
