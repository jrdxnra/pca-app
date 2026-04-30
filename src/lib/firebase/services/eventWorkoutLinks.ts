import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDb } from '../config';
import { resolveActiveAccountId } from './memberships';

const COLLECTION_NAME = 'eventWorkoutLinks';

export interface EventWorkoutLink {
  id: string;
  ownerId: string;
  eventId: string;
  workoutId: string;
  clientId?: string;
  categoryName?: string;
  calendarId?: string;
  eventDate?: Timestamp;
  status: 'linked' | 'unlinked';
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface UpsertEventWorkoutLinkInput {
  eventId: string;
  workoutId: string;
  clientId?: string | null;
  categoryName?: string | null;
  eventDate?: Date;
  calendarId?: string;
}

function buildDocId(accountId: string, eventId: string): string {
  return `${accountId}__${encodeURIComponent(eventId)}`;
}

async function getRequiredAccountId(): Promise<string> {
  const accountId = await resolveActiveAccountId();
  if (!accountId) {
    throw new Error('Unauthorized or No Active Account');
  }
  return accountId;
}

export async function upsertEventWorkoutLink(input: UpsertEventWorkoutLinkInput): Promise<void> {
  const accountId = await getRequiredAccountId();
  const now = Timestamp.now();
  const ref = doc(getDb(), COLLECTION_NAME, buildDocId(accountId, input.eventId));

  const existing = await getDoc(ref);
  const createdAt = existing.exists()
    ? ((existing.data() as Partial<EventWorkoutLink>).createdAt || now)
    : now;

  await setDoc(ref, {
    ownerId: accountId,
    eventId: input.eventId,
    workoutId: input.workoutId,
    clientId: input.clientId || null,
    categoryName: input.categoryName || null,
    calendarId: input.calendarId || null,
    eventDate: input.eventDate ? Timestamp.fromDate(input.eventDate) : null,
    status: 'linked',
    createdAt,
    updatedAt: now,
  });
}

export async function getEventWorkoutLinkByEventId(eventId: string): Promise<EventWorkoutLink | null> {
  const accountId = await getRequiredAccountId();
  const ref = doc(getDb(), COLLECTION_NAME, buildDocId(accountId, eventId));
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return null;
  }

  const data = snapshot.data() as Omit<EventWorkoutLink, 'id'>;
  if (data.status !== 'linked' || !data.workoutId) {
    return null;
  }

  return {
    id: snapshot.id,
    ...data,
  };
}

export async function getEventWorkoutLinksByEventIds(eventIds: string[]): Promise<Record<string, EventWorkoutLink>> {
  const uniqueIds = Array.from(new Set(eventIds.filter(Boolean)));
  if (uniqueIds.length === 0) {
    return {};
  }

  const links = await Promise.all(uniqueIds.map(eventId => getEventWorkoutLinkByEventId(eventId)));
  const map: Record<string, EventWorkoutLink> = {};

  for (const link of links) {
    if (link && link.eventId) {
      map[link.eventId] = link;
    }
  }

  return map;
}

export async function removeEventWorkoutLink(eventId: string): Promise<void> {
  const accountId = await getRequiredAccountId();
  const now = Timestamp.now();
  const ref = doc(getDb(), COLLECTION_NAME, buildDocId(accountId, eventId));
  const snapshot = await getDoc(ref);

  if (!snapshot.exists()) {
    return;
  }

  await setDoc(ref, {
    ...(snapshot.data() || {}),
    status: 'unlinked',
    updatedAt: now,
  });
}

export async function removeEventWorkoutLinksByWorkoutId(workoutId: string): Promise<void> {
  const accountId = await getRequiredAccountId();
  const q = query(collection(getDb(), COLLECTION_NAME), where('workoutId', '==', workoutId));
  const snapshot = await getDocs(q);

  if (snapshot.empty) {
    return;
  }

  const now = Timestamp.now();
  const batch = writeBatch(getDb());
  for (const linkDoc of snapshot.docs) {
    const data = linkDoc.data() as Partial<EventWorkoutLink>;
    if (data.ownerId !== accountId) {
      continue;
    }

    batch.set(linkDoc.ref, {
      ...data,
      status: 'unlinked',
      updatedAt: now,
    });
  }

  await batch.commit();
}
