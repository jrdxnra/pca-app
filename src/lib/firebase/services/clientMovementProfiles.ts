import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { getDb } from '../config';
import { resolveActiveAccountId } from './memberships';
import { ClientMovementProfile } from '@/lib/types';
import type { FeedbackSignalInput } from '@/lib/ai/workoutFeedbackSignals';

const COLLECTION_NAME = 'clientMovementProfiles';

async function getAccountId(): Promise<string> {
  const accountId = await resolveActiveAccountId();
  if (!accountId) throw new Error('Unauthorized or No Active Account');
  return accountId;
}

function buildEmptyProfile(clientId: string, ownerId: string): Omit<ClientMovementProfile, 'id'> {
  return {
    clientId,
    ownerId,
    equipmentAccess: [],
    restrictions: [],
    preferences: [],
    familyProfiles: [],
    feedbackLog: [],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export async function getOrCreateClientMovementProfile(clientId: string): Promise<ClientMovementProfile> {
  const ownerId = await getAccountId();
  const ref = doc(getDb(), COLLECTION_NAME, clientId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    const payload = buildEmptyProfile(clientId, ownerId);
    await setDoc(ref, payload);
    return { id: clientId, ...payload };
  }

  const data = snap.data() as Omit<ClientMovementProfile, 'id'>;
  if (data.ownerId && data.ownerId !== ownerId) {
    throw new Error('Forbidden');
  }

  return {
    id: snap.id,
    ...data,
    ownerId,
    preferences: Array.isArray(data.preferences) ? data.preferences : [],
    familyProfiles: Array.isArray(data.familyProfiles) ? data.familyProfiles : [],
    feedbackLog: Array.isArray(data.feedbackLog) ? data.feedbackLog : [],
  };
}

export async function updateClientMovementProfile(
  clientId: string,
  updates: Partial<Omit<ClientMovementProfile, 'id' | 'clientId' | 'createdAt' | 'ownerId'>>
): Promise<void> {
  const ownerId = await getAccountId();
  const ref = doc(getDb(), COLLECTION_NAME, clientId);

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const payload = {
      ...buildEmptyProfile(clientId, ownerId),
      ...updates,
      updatedAt: Timestamp.now(),
    };
    await setDoc(ref, payload);
    return;
  }

  const data = snap.data() as { ownerId?: string };
  if (data.ownerId && data.ownerId !== ownerId) {
    throw new Error('Forbidden');
  }

  await updateDoc(ref, {
    ...updates,
    ownerId,
    updatedAt: Timestamp.now(),
  });
}

export async function appendFeedbackSignalsToClientMovementProfile(
  clientId: string,
  signals: FeedbackSignalInput[]
): Promise<void> {
  if (!Array.isArray(signals) || signals.length === 0) return;

  const profile = await getOrCreateClientMovementProfile(clientId);
  const now = Timestamp.now();

  const existingLog = Array.isArray(profile.feedbackLog) ? profile.feedbackLog : [];
  const existingKeys = new Set(
    existingLog.map((entry) =>
      [
        entry.workoutId || '',
        entry.movementId || '',
        entry.familyKey || '',
        entry.signal,
        (entry.note || '').toLowerCase(),
      ].join('|')
    )
  );

  const appended = signals
    .filter((signal) => {
      const key = [
        signal.workoutId || '',
        signal.movementId || '',
        signal.familyKey || '',
        signal.signal,
        (signal.note || '').toLowerCase(),
      ].join('|');
      if (existingKeys.has(key)) return false;
      existingKeys.add(key);
      return true;
    })
    .map((signal, index) => ({
      id: `${now.toMillis()}-${index}`,
      workoutId: signal.workoutId,
      movementId: signal.movementId,
      familyKey: signal.familyKey,
      signal: signal.signal,
      note: signal.note,
      score: signal.score,
      createdAt: now,
      createdBy: signal.createdBy,
    }));

  if (appended.length === 0) return;

  const nextFeedbackLog = [...appended, ...existingLog].slice(0, 300);
  const nextPreferences = [...(profile.preferences || [])];
  const preferenceByMovementId = new Map(nextPreferences.map((pref) => [pref.movementId, pref]));

  for (const entry of appended) {
    if (!entry.movementId) continue;

    const current = preferenceByMovementId.get(entry.movementId);

    if (entry.signal === 'pain' || entry.signal === 'poor_tolerance') {
      const next = {
        movementId: entry.movementId,
        status: 'avoid' as const,
        reason: `Auto-flagged from workout feedback: ${entry.signal}`,
        source: 'inferred' as const,
        updatedAt: now,
      };
      preferenceByMovementId.set(entry.movementId, next);
      continue;
    }

    if (!current && (entry.signal === 'good_tolerance' || entry.signal === 'great_quality')) {
      preferenceByMovementId.set(entry.movementId, {
        movementId: entry.movementId,
        status: 'allow',
        reason: `Auto-inferred from workout feedback: ${entry.signal}`,
        source: 'inferred',
        updatedAt: now,
      });
    }
  }

  await updateClientMovementProfile(clientId, {
    feedbackLog: nextFeedbackLog,
    preferences: Array.from(preferenceByMovementId.values()),
  });
}
