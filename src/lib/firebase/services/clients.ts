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
import { db, getDb } from '../config';
import { Client, PersonalRecord, SessionCounts, RecentExercisePerformance, ClientRecentPerformance } from '@/lib/types';

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

    const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), {
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
    const docRef = doc(getDb(), COLLECTION_NAME, id);
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
    let q = query(collection(getDb(), COLLECTION_NAME), orderBy('name'));

    if (!includeDeleted) {
      q = query(collection(getDb(), COLLECTION_NAME), where('isDeleted', '==', false), orderBy('name'));
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

    const docRef = doc(getDb(), COLLECTION_NAME, id);
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
    const docRef = doc(getDb(), COLLECTION_NAME, id);
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
    const docRef = doc(getDb(), COLLECTION_NAME, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error permanently deleting client:', error);
    throw error;
  }
}

export async function restoreClient(id: string): Promise<void> {
  try {
    const docRef = doc(getDb(), COLLECTION_NAME, id);
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
 * Recent Exercise Performance Management
 */

export async function updateRecentExercisePerformance(
  clientId: string,
  movementId: string,
  weight: string,
  repRange: string,
  estimatedOneRepMax: number,
  rpe?: number,
  usedRPECalculation?: boolean
): Promise<void> {
  try {
    const client = await getClient(clientId);
    if (!client) throw new Error('Client not found');

    // Get existing performance data for this movement
    const existingPerformance = client.recentExercisePerformance?.[movementId];

    // Parse rep range to get numeric rep count
    let repCount = 0;
    if (typeof repRange === 'string') {
      if (repRange.includes('-')) {
        const [min, max] = repRange.split('-').map(r => parseInt(r.trim()));
        repCount = Math.round((min + max) / 2);
      } else {
        repCount = parseInt(repRange);
      }
    }

    // Check if this is a new PR (highest 1RM for this movement)
    const isPR = !existingPerformance || estimatedOneRepMax > (existingPerformance.estimatedOneRepMax || 0);

    // Create new history entry
    const newHistoryEntry = {
      estimatedOneRepMax,
      weight,
      reps: repCount,
      rpe,
      usedRPECalculation: usedRPECalculation || false,
      date: Timestamp.now(),
      isPR
    };

    // Build the updated performance object
    // Helper to remove undefined fields from a performance record
    const sanitizePerformance = (perf: RecentExercisePerformance): RecentExercisePerformance => {
      const cleanHistory = (perf.history || []).map(entry => {
        return Object.entries(entry).reduce((acc, [key, value]) => {
          if (value !== undefined) (acc as any)[key] = value;
          return acc;
        }, {} as typeof entry);
      });

      const cleanPerf = Object.entries(perf).reduce((acc, [key, value]) => {
        if (key === 'history') {
          (acc as any)[key] = cleanHistory;
          return acc;
        }
        if (value !== undefined) (acc as any)[key] = value;
        return acc;
      }, {} as Partial<RecentExercisePerformance>);

      // Type cast back after cleaning
      return cleanPerf as RecentExercisePerformance;
    };

    // Clean existing performance map to avoid undefined values
    const sanitizedExistingMap: Record<string, RecentExercisePerformance> = {};
    if (client.recentExercisePerformance) {
      for (const [mvId, perf] of Object.entries(client.recentExercisePerformance)) {
        if (perf) {
          sanitizedExistingMap[mvId] = sanitizePerformance(perf as RecentExercisePerformance);
        }
      }
    }

    // Build new entry and sanitize it
    const cleanHistoryEntry = sanitizePerformance({
      ...newHistoryEntry,
      movementId,
      weight,
      repRange,
      estimatedOneRepMax,
      lastUsedDate: Timestamp.now(),
      history: []
    } as unknown as RecentExercisePerformance).history?.[0] || newHistoryEntry;

    const performance: RecentExercisePerformance = {
      movementId,
      weight,
      repRange,
      estimatedOneRepMax,
      lastUsedDate: Timestamp.now(),
      history: [
        cleanHistoryEntry,
        ...(existingPerformance?.history || []).map(entry =>
          Object.entries(entry).reduce((acc, [key, value]) => {
            if (value !== undefined) (acc as any)[key] = value;
            return acc;
          }, {} as typeof entry)
        ).slice(0, 49)
      ]
    };

    const cleanPerformance = sanitizePerformance(performance);

    await updateClient(clientId, {
      recentExercisePerformance: {
        ...sanitizedExistingMap,
        [movementId]: cleanPerformance,
      },
    });
  } catch (error) {
    console.error('Error updating recent exercise performance:', error);
    throw error;
  }
}

export async function getRecentExercisePerformance(
  clientId: string,
  movementId: string
): Promise<RecentExercisePerformance | null> {
  try {
    const client = await getClient(clientId);
    return client?.recentExercisePerformance?.[movementId] || null;
  } catch (error) {
    console.error('Error getting recent exercise performance:', error);
    throw error;
  }
}

export async function getAllRecentExercisePerformance(
  clientId: string
): Promise<ClientRecentPerformance> {
  try {
    const client = await getClient(clientId);
    return client?.recentExercisePerformance || {};
  } catch (error) {
    console.error('Error getting all recent exercise performance:', error);
    throw error;
  }
}

/**
 * Real-time subscription to clients
 */
export function subscribeToClients(callback: (clients: Client[]) => void, includeDeleted = false): () => void {
  let q = query(collection(getDb(), COLLECTION_NAME), orderBy('name'));

  if (!includeDeleted) {
    q = query(collection(getDb(), COLLECTION_NAME), where('isDeleted', '==', false), orderBy('name'));
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

/**
 * Session Counting Functions
 */

// Helper to get period boundaries
function getPeriodBoundaries() {
  const now = new Date();

  // Week start (Sunday)
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);

  // Month start
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  monthStart.setHours(0, 0, 0, 0);

  // Quarter start
  const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
  const quarterStart = new Date(now.getFullYear(), quarterMonth, 1);
  quarterStart.setHours(0, 0, 0, 0);

  // Year start
  const yearStart = new Date(now.getFullYear(), 0, 1);
  yearStart.setHours(0, 0, 0, 0);

  return {
    weekStart: Timestamp.fromDate(weekStart),
    monthStart: Timestamp.fromDate(monthStart),
    quarterStart: Timestamp.fromDate(quarterStart),
    yearStart: Timestamp.fromDate(yearStart),
  };
}

// Check if session counts need to be reset (new period started)
function checkAndResetCounts(existingCounts: SessionCounts | undefined): SessionCounts {
  const boundaries = getPeriodBoundaries();
  const now = Timestamp.now();

  // Default counts
  const defaultCounts: SessionCounts = {
    thisWeek: 0,
    thisMonth: 0,
    thisQuarter: 0,
    thisYear: 0,
    total: 0,
    lastUpdated: now,
    weekStart: boundaries.weekStart,
    monthStart: boundaries.monthStart,
    quarterStart: boundaries.quarterStart,
    yearStart: boundaries.yearStart,
  };

  if (!existingCounts) {
    return defaultCounts;
  }

  // Check if we need to reset any periods
  const counts = { ...existingCounts };

  // Reset week if new week started
  if (!existingCounts.weekStart || existingCounts.weekStart.toMillis() < boundaries.weekStart.toMillis()) {
    counts.thisWeek = 0;
    counts.weekStart = boundaries.weekStart;
  }

  // Reset month if new month started
  if (!existingCounts.monthStart || existingCounts.monthStart.toMillis() < boundaries.monthStart.toMillis()) {
    counts.thisMonth = 0;
    counts.monthStart = boundaries.monthStart;
  }

  // Reset quarter if new quarter started
  if (!existingCounts.quarterStart || existingCounts.quarterStart.toMillis() < boundaries.quarterStart.toMillis()) {
    counts.thisQuarter = 0;
    counts.quarterStart = boundaries.quarterStart;
  }

  // Reset year if new year started
  if (!existingCounts.yearStart || existingCounts.yearStart.toMillis() < boundaries.yearStart.toMillis()) {
    counts.thisYear = 0;
    counts.yearStart = boundaries.yearStart;
  }

  counts.lastUpdated = now;

  return counts;
}

/**
 * Increment session count for a client
 * Called when a session is assigned/created
 */
export async function incrementSessionCount(clientId: string, count: number = 1): Promise<SessionCounts> {
  try {
    const client = await getClient(clientId);
    if (!client) throw new Error('Client not found');

    // Check and reset periods if needed
    const counts = checkAndResetCounts(client.sessionCounts);

    // Increment all counts
    counts.thisWeek += count;
    counts.thisMonth += count;
    counts.thisQuarter += count;
    counts.thisYear += count;
    counts.total += count;
    counts.lastUpdated = Timestamp.now();

    // Update client
    await updateClient(clientId, { sessionCounts: counts });

    return counts;
  } catch (error) {
    console.error('Error incrementing session count:', error);
    throw error;
  }
}

/**
 * Decrement session count for a client
 * Called when a session is unassigned/deleted
 */
export async function decrementSessionCount(clientId: string, count: number = 1): Promise<SessionCounts> {
  try {
    const client = await getClient(clientId);
    if (!client) throw new Error('Client not found');

    // Check and reset periods if needed
    const counts = checkAndResetCounts(client.sessionCounts);

    // Decrement counts (don't go below 0)
    counts.thisWeek = Math.max(0, counts.thisWeek - count);
    counts.thisMonth = Math.max(0, counts.thisMonth - count);
    counts.thisQuarter = Math.max(0, counts.thisQuarter - count);
    counts.thisYear = Math.max(0, counts.thisYear - count);
    counts.total = Math.max(0, counts.total - count);
    counts.lastUpdated = Timestamp.now();

    // Update client
    await updateClient(clientId, { sessionCounts: counts });

    return counts;
  } catch (error) {
    console.error('Error decrementing session count:', error);
    throw error;
  }
}

/**
 * Get session counts for a client (with period reset check)
 */
export async function getSessionCounts(clientId: string): Promise<SessionCounts> {
  try {
    const client = await getClient(clientId);
    if (!client) throw new Error('Client not found');

    // Check and reset periods if needed
    const counts = checkAndResetCounts(client.sessionCounts);

    // If counts were reset, update the client
    if (client.sessionCounts?.weekStart?.toMillis() !== counts.weekStart?.toMillis() ||
      client.sessionCounts?.monthStart?.toMillis() !== counts.monthStart?.toMillis() ||
      client.sessionCounts?.quarterStart?.toMillis() !== counts.quarterStart?.toMillis() ||
      client.sessionCounts?.yearStart?.toMillis() !== counts.yearStart?.toMillis()) {
      await updateClient(clientId, { sessionCounts: counts });
    }

    return counts;
  } catch (error) {
    console.error('Error getting session counts:', error);
    throw error;
  }
}

/**
 * Update target sessions per week for a client
 */
export async function updateTargetSessions(clientId: string, targetPerWeek: number): Promise<void> {
  try {
    await updateClient(clientId, { targetSessionsPerWeek: targetPerWeek });
  } catch (error) {
    console.error('Error updating target sessions:', error);
    throw error;
  }
}
