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
  Timestamp,
  onSnapshot,
  Unsubscribe
} from 'firebase/firestore';
import { db, getDb } from '../config';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';

const COLLECTION_NAME = 'calendarEvents';

/**
 * Convert GoogleCalendarEvent to Firestore document
 */
function eventToFirestore(event: GoogleCalendarEvent): any {
  return {
    summary: event.summary,
    description: event.description || '',
    startDateTime: Timestamp.fromDate(new Date(event.start.dateTime)),
    endDateTime: Timestamp.fromDate(new Date(event.end.dateTime)),
    timeZone: event.start.timeZone || 'America/Los_Angeles',
    location: event.location || '',
    htmlLink: event.htmlLink || '',
    creatorEmail: event.creator?.email || '',
    creatorDisplayName: event.creator?.displayName || '',
    isCoachingSession: event.isCoachingSession || false,
    isClassSession: event.isClassSession || false,
    linkedWorkoutId: event.linkedWorkoutId || null,
    preConfiguredClient: event.preConfiguredClient || null,
    preConfiguredCategory: event.preConfiguredCategory || null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Convert Firestore document to GoogleCalendarEvent
 */
function firestoreToEvent(docId: string, data: any): GoogleCalendarEvent {
  const startDate = data.startDateTime instanceof Timestamp 
    ? data.startDateTime.toDate() 
    : new Date(data.startDateTime);
  const endDate = data.endDateTime instanceof Timestamp 
    ? data.endDateTime.toDate() 
    : new Date(data.endDateTime);

  return {
    id: docId,
    summary: data.summary || '',
    description: data.description || '',
    start: {
      dateTime: startDate.toISOString(),
      timeZone: data.timeZone || 'America/Los_Angeles',
    },
    end: {
      dateTime: endDate.toISOString(),
      timeZone: data.timeZone || 'America/Los_Angeles',
    },
    location: data.location || '',
    htmlLink: data.htmlLink || '',
    creator: {
      email: data.creatorEmail || '',
      displayName: data.creatorDisplayName || '',
    },
    isCoachingSession: data.isCoachingSession || false,
    isClassSession: data.isClassSession || false,
    linkedWorkoutId: data.linkedWorkoutId || null,
    preConfiguredClient: data.preConfiguredClient || null,
    preConfiguredCategory: data.preConfiguredCategory || null,
  };
}

/**
 * Create a new calendar event
 */
export async function createCalendarEvent(
  event: Omit<GoogleCalendarEvent, 'id'>
): Promise<GoogleCalendarEvent> {
  const eventData = eventToFirestore(event as GoogleCalendarEvent);
  const docRef = await addDoc(collection(getDb(), COLLECTION_NAME), eventData);

  return firestoreToEvent(docRef.id, eventData);
}

/**
 * Get calendar events for a date range
 */
export async function getCalendarEventsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<GoogleCalendarEvent[]> {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('startDateTime', '>=', startTimestamp),
    where('startDateTime', '<=', endTimestamp),
    orderBy('startDateTime', 'asc')
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => firestoreToEvent(doc.id, doc.data()));
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  eventId: string,
  updates: Partial<GoogleCalendarEvent>
): Promise<void> {
  const eventRef = doc(getDb(), COLLECTION_NAME, eventId);
  
  // Convert updates to Firestore format
  const firestoreUpdates: any = {
    updatedAt: Timestamp.now(),
  };

  if (updates.summary !== undefined) firestoreUpdates.summary = updates.summary;
  if (updates.description !== undefined) firestoreUpdates.description = updates.description;
  if (updates.location !== undefined) firestoreUpdates.location = updates.location;
  if (updates.isCoachingSession !== undefined) firestoreUpdates.isCoachingSession = updates.isCoachingSession;
  if (updates.isClassSession !== undefined) firestoreUpdates.isClassSession = updates.isClassSession;
  if (updates.linkedWorkoutId !== undefined) firestoreUpdates.linkedWorkoutId = updates.linkedWorkoutId;
  if (updates.preConfiguredClient !== undefined) firestoreUpdates.preConfiguredClient = updates.preConfiguredClient;
  if (updates.preConfiguredCategory !== undefined) firestoreUpdates.preConfiguredCategory = updates.preConfiguredCategory;

  if (updates.start?.dateTime) {
    firestoreUpdates.startDateTime = Timestamp.fromDate(new Date(updates.start.dateTime));
  }
  if (updates.end?.dateTime) {
    firestoreUpdates.endDateTime = Timestamp.fromDate(new Date(updates.end.dateTime));
  }

  await updateDoc(eventRef, firestoreUpdates);
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const eventRef = doc(getDb(), COLLECTION_NAME, eventId);
  await deleteDoc(eventRef);
}

/**
 * Subscribe to calendar events for a date range
 */
export function subscribeToCalendarEvents(
  startDate: Date,
  endDate: Date,
  callback: (events: GoogleCalendarEvent[]) => void
): Unsubscribe {
  const startTimestamp = Timestamp.fromDate(startDate);
  const endTimestamp = Timestamp.fromDate(endDate);

  const q = query(
    collection(getDb(), COLLECTION_NAME),
    where('startDateTime', '>=', startTimestamp),
    where('startDateTime', '<=', endTimestamp),
    orderBy('startDateTime', 'asc')
  );

  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => firestoreToEvent(doc.id, doc.data()));
    callback(events);
  });
}


































