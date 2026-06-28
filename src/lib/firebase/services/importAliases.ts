import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { resolveActiveAccountId } from './memberships';

const COLLECTION_NAME = 'configuration';
const DOC_ID_PREFIX = 'import-aliases';

export type MovementAliasMap = Record<string, string>;

function normalizeAliasMap(input: unknown): MovementAliasMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const out: MovementAliasMap = {};
  Object.entries(input as Record<string, unknown>).forEach(([key, value]) => {
    if (!key || typeof value !== 'string' || !value.trim()) return;
    out[key] = value;
  });
  return out;
}

export async function getImportMovementAliases(): Promise<MovementAliasMap> {
  if (typeof window === 'undefined') return {};

  try {
    const db = getDb();
    const accountId = await resolveActiveAccountId();
    if (!db || !accountId) return {};

    const docRef = doc(db, COLLECTION_NAME, `${DOC_ID_PREFIX}-${accountId}`);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return {};

    const data = snap.data() as { aliases?: unknown };
    return normalizeAliasMap(data.aliases);
  } catch (error) {
    console.error('Error fetching import movement aliases:', error);
    return {};
  }
}

export async function setImportMovementAliases(aliases: MovementAliasMap): Promise<void> {
  if (typeof window === 'undefined') return;

  const normalized = normalizeAliasMap(aliases);

  try {
    const db = getDb();
    const accountId = await resolveActiveAccountId();
    if (!db || !accountId) return;

    const docRef = doc(db, COLLECTION_NAME, `${DOC_ID_PREFIX}-${accountId}`);
    await setDoc(
      docRef,
      {
        ownerId: accountId,
        aliases: normalized,
        updatedAt: Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving import movement aliases:', error);
    throw error;
  }
}
