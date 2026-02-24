import type { CalendarSyncConfig, LocationAbbreviation } from '@/lib/google-calendar/types';
import { resolveActiveAccountId } from './memberships';

const DOC_ID_PREFIX = 'calendar-config';

type FirestoreCalendarConfig = {
  selectedCalendarId?: string;
  coachingKeywords?: unknown;
  coachingColor?: unknown;
  classKeywords?: unknown;
  classColor?: unknown;
  locationAbbreviations?: unknown;
  lastSyncTime?: unknown;
};

function normalizeLocationKey(input: unknown): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/\s+/g, ' ');
}

function isTruthyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(v => typeof v === 'string');
}

function normalizeIgnoredFlag(value: unknown, abbreviation: string): boolean | undefined {
  if (typeof value === 'boolean') return value;
  return undefined;
}

function normalizeLocationAbbreviations(raw: unknown): LocationAbbreviation[] | undefined {
  if (!raw) return undefined;

  const out: LocationAbbreviation[] = [];

  // Legacy: object map { [original]: abbreviation | { ... } }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const original = normalizeLocationKey(k);
      if (!original) continue;

      if (typeof v === 'string') {
        const abbreviation = v.trim() || original;
        const ignored = normalizeIgnoredFlag(undefined, abbreviation);
        out.push({ original, abbreviation: ignored ? original : abbreviation, ignored });
        continue;
      }

      if (v && typeof v === 'object') {
        const vv = v as Record<string, unknown>;
        const abbreviation = typeof vv.abbreviation === 'string'
          ? vv.abbreviation.trim() || original
          : typeof vv.abbr === 'string'
            ? vv.abbr.trim() || original
            : original;
        const ignored = normalizeIgnoredFlag(vv.ignored ?? vv.isIgnored, abbreviation);
        out.push({ original, abbreviation: ignored ? original : abbreviation, ignored });
      }
    }
  }

  // Current: array of entries
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const original = normalizeLocationKey(e.original ?? e.location ?? e.full ?? e.name);
      if (!original) continue;

      const abbreviation = typeof e.abbreviation === 'string'
        ? e.abbreviation.trim() || original
        : typeof e.abbr === 'string'
          ? e.abbr.trim() || original
          : original;
      const ignored = normalizeIgnoredFlag(e.ignored ?? e.isIgnored, abbreviation);
      out.push({ original, abbreviation: ignored ? original : abbreviation, ignored });
    }
  }

  if (out.length === 0) return undefined;

  // De-dupe by normalized original, keep last write
  const map = new Map<string, LocationAbbreviation>();
  for (const item of out) {
    map.set(normalizeLocationKey(item.original), item);
  }

  return Array.from(map.values());
}

function normalizeKeywordList(value: unknown, fallback: string[]): string[] {
  if (isTruthyStringArray(value)) {
    return value.map(s => s.trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value.split(',').map(s => s.trim()).filter(Boolean);
  }
  return fallback;
}

function normalizeLastSyncTime(value: unknown, TimestampClass: any): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (value && typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? undefined : d;
  }
  return undefined;
}

export async function getCalendarSyncConfig(defaults: CalendarSyncConfig): Promise<CalendarSyncConfig> {
  // SSR Guard
  if (typeof window === 'undefined') {
    return defaults;
  }

  try {
    const { doc, getDoc, setDoc, Timestamp } = await import('firebase/firestore');
    const { getDb } = await import('../config');
    const db = getDb();
    const accountId = await resolveActiveAccountId();

    if (!db || !accountId) {
      console.warn('Firestore/Account not initialized, returning defaults');
      return defaults;
    }
    const docRef = doc(db, 'configuration', `${DOC_ID_PREFIX}-${accountId}`);
    const snap = await getDoc(docRef);

    if (!snap.exists()) {
      // Seed defaults so config exists for all clients.
      const seeded: CalendarSyncConfig = { ...defaults };
      await setDoc(docRef, {
        ownerId: accountId,
        selectedCalendarId: seeded.selectedCalendarId ?? null,
        coachingKeywords: seeded.coachingKeywords,
        coachingColor: seeded.coachingColor ?? null,
        classKeywords: seeded.classKeywords,
        classColor: seeded.classColor ?? null,
        locationAbbreviations: seeded.locationAbbreviations ?? [],
        // Don't include lastSyncTime if undefined - Firestore rejects undefined values
      }, { merge: true });
      return seeded;
    }

    const data = snap.data() as FirestoreCalendarConfig;

    const normalized: CalendarSyncConfig = {
      selectedCalendarId: typeof data.selectedCalendarId === 'string' ? data.selectedCalendarId : defaults.selectedCalendarId,
      coachingKeywords: normalizeKeywordList(data.coachingKeywords, defaults.coachingKeywords),
      coachingColor: typeof data.coachingColor === 'string' ? data.coachingColor : defaults.coachingColor,
      classKeywords: normalizeKeywordList(data.classKeywords, defaults.classKeywords),
      classColor: typeof data.classColor === 'string' ? data.classColor : defaults.classColor,
      locationAbbreviations: normalizeLocationAbbreviations(data.locationAbbreviations),
      lastSyncTime: normalizeLastSyncTime(data.lastSyncTime, Timestamp),
    };

    // If we detected legacy shapes, write back the normalized version.
    await setDoc(docRef, {
      ownerId: accountId,
      selectedCalendarId: normalized.selectedCalendarId ?? null,
      coachingKeywords: normalized.coachingKeywords,
      coachingColor: normalized.coachingColor ?? null,
      classKeywords: normalized.classKeywords,
      classColor: normalized.classColor ?? null,
      locationAbbreviations: normalized.locationAbbreviations ?? [],
      lastSyncTime: normalized.lastSyncTime ? Timestamp.fromDate(normalized.lastSyncTime) : null,
    }, { merge: true });

    return normalized;
  } catch (error) {
    console.error('Error fetching calendar config:', error);
    return defaults;
  }
}

export async function updateCalendarSyncConfig(updates: Partial<CalendarSyncConfig>): Promise<void> {
  // SSR Guard
  if (typeof window === 'undefined') return;

  try {
    const { doc, setDoc, Timestamp } = await import('firebase/firestore');
    const { getDb } = await import('../config');
    const db = getDb();
    const accountId = await resolveActiveAccountId();

    if (!db || !accountId) {
      console.warn('Firestore/Account not initialized, skipping save');
      return;
    }
    const docRef = doc(db, 'configuration', `${DOC_ID_PREFIX}-${accountId}`);

    const payload: Record<string, unknown> = { ownerId: accountId };
    if (updates.selectedCalendarId !== undefined) payload.selectedCalendarId = updates.selectedCalendarId ?? null;
    if (updates.coachingKeywords !== undefined) payload.coachingKeywords = updates.coachingKeywords ?? [];
    if (updates.coachingColor !== undefined) payload.coachingColor = updates.coachingColor ?? null;
    if (updates.classKeywords !== undefined) payload.classKeywords = updates.classKeywords ?? [];
    if (updates.classColor !== undefined) payload.classColor = updates.classColor ?? null;
    if (updates.locationAbbreviations !== undefined) {
      // Clean location abbreviations to remove any undefined values
      const cleanAbbreviations = (updates.locationAbbreviations ?? []).map((abbr: any) => {
        const clean: any = {
          original: abbr.original || '',
          abbreviation: abbr.abbreviation || abbr.original || '',
        };
        // Only include ignored if it's explicitly set (not undefined)
        if (abbr.ignored !== undefined) {
          clean.ignored = abbr.ignored;
        }
        return clean;
      }).filter((abbr: any) => abbr.original && abbr.original.length > 0);
      payload.locationAbbreviations = cleanAbbreviations;
    }
    if (updates.lastSyncTime !== undefined) {
      payload.lastSyncTime = updates.lastSyncTime ? Timestamp.fromDate(updates.lastSyncTime) : null;
    }

    // Deep clean: Remove any undefined values from payload and nested objects (Firestore doesn't allow undefined)
    const cleanPayload = (obj: Record<string, unknown>): Record<string, unknown> => {
      const cleaned: Record<string, unknown> = {};
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value === undefined) {
          // Skip undefined values
          return;
        } else if (Array.isArray(value)) {
          // Clean arrays
          cleaned[key] = value.map(item => {
            if (typeof item === 'object' && item !== null) {
              return cleanPayload(item as Record<string, unknown>);
            }
            return item;
          });
        } else if (typeof value === 'object' && value !== null) {
          // Recursively clean objects
          cleaned[key] = cleanPayload(value as Record<string, unknown>);
        } else {
          cleaned[key] = value;
        }
      });
      return cleaned;
    };

    const finalPayload = cleanPayload(payload);
    await setDoc(docRef, finalPayload, { merge: true });
  } catch (error) {
    console.error('Error updating calendar config:', error);
    throw error;
  }
}
