/**
 * Client Matching Service
 * 
 * Matches Google Calendar events to clients using guest email metadata
 * from work calendar sync.
 */

import { Client } from '@/lib/types';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';

// Default values - only used if user hasn't configured anything
// Default coaching keywords (1-on-1 sessions)
const DEFAULT_COACHING_KEYWORDS = [
  'personal training',
  'pt',
  'training session',
  'workout'
];

// Default class keywords (group sessions)
const DEFAULT_CLASS_KEYWORDS = [
  'class',
  'group class',
  'group training',
  'group session',
  'total',
  'choice'
];

// Default exclusion keywords - can be customized in Event Detection settings
const DEFAULT_EXCLUSION_KEYWORDS = [
  'hold',
  'blocked',
  'meeting',
  'admin'
];

// Default coach email patterns - can be customized in Event Detection settings
const DEFAULT_COACH_PATTERNS = [
  '@xwf.google.com',
  '@teamexos.com'
];

/**
 * Check if an email/name is the coach (should be filtered from attendees)
 */
function isCoachAttendee(nameOrEmail: string, coachPatterns: string[] = []): boolean {
  const lower = nameOrEmail.toLowerCase();
  const patterns = coachPatterns.length > 0 ? coachPatterns : DEFAULT_COACH_PATTERNS;
  return patterns.some(pattern => lower.includes(pattern.toLowerCase()));
}

/**
 * Check if event is a coaching session (1-on-1, PT, etc.)
 */
function isCoachingSession(title: string, coachingKeywords: string[] = []): boolean {
  const lowerTitle = title.toLowerCase();
  const allKeywords = [...coachingKeywords, ...DEFAULT_COACHING_KEYWORDS].map(k => k.toLowerCase());
  return allKeywords.some(keyword => lowerTitle.includes(keyword));
}

/**
 * Check if event is a class session (group class)
 */
function isClassSession(title: string, classKeywords: string[] = []): boolean {
  const lowerTitle = title.toLowerCase();
  const allKeywords = [...classKeywords, ...DEFAULT_CLASS_KEYWORDS].map(k => k.toLowerCase());
  return allKeywords.some(keyword => lowerTitle.includes(keyword));
}

/**
 * Check if an event should be excluded (holds, admin time, etc.)
 */
function shouldExcludeEvent(title: string, exclusionKeywords: string[] = []): boolean {
  const lowerTitle = title.toLowerCase();
  const keywords = exclusionKeywords.length > 0 ? exclusionKeywords : DEFAULT_EXCLUSION_KEYWORDS;
  return keywords.some(keyword => lowerTitle.includes(keyword.toLowerCase()));
}

/**
 * Check if event is a valid session for client matching
 * - Coaching sessions (PT, Training): Must have attendees and not be excluded
 * - Class sessions (Group Class, Total): Always valid (even without named clients)
 * - Returns false for holds, meetings, admin events, etc.
 */
export function isValidSessionEvent(
  event: GoogleCalendarEvent | Record<string, unknown>,
  coachingKeywords: string[] = [],
  classKeywords: string[] = [],
  exclusionKeywords: string[] = [],
  coachPatterns: string[] = []
): boolean {
  if (!('summary' in event) || typeof event.summary !== 'string') {
    return false;
  }

  // First check if it should be excluded (holds, meetings, admin)
  if (shouldExcludeEvent(event.summary, exclusionKeywords)) {
    return false;
  }

  // Check if it's a class session (group class)
  // Class sessions are ALWAYS valid - you teach them whether clients are listed or not
  if (isClassSession(event.summary, classKeywords)) {
    return true;
  }

  // Check if it's a coaching session (1-on-1, PT)
  if (isCoachingSession(event.summary, coachingKeywords)) {
    // Coaching sessions need attendees (clients)
    const attendees = extractAttendeeNames(event, coachPatterns);
    return attendees.length > 0;
  }

  // Not a recognized session type
  return false;
}

export interface ClientMatchResult {
  clientId: string;
  clientName: string;
  matchedName: string; // Attendee display name that matched
  confidence: 'exact' | 'partial' | 'fuzzy';
}

export type SessionType = '1-on-1' | 'buddy' | 'group';

export interface MultiClientMatchResult {
  matches: ClientMatchResult[];
  sessionType: SessionType;
  totalAttendees: number;
}

/**
 * Normalize a name for comparison
 * - Convert to lowercase
 * - Remove extra whitespace
 * - Remove common punctuation
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Check if a client name matches an attendee display name
 * Supports partial matches (e.g., "Devon" matches "Devon McGuire")
 */
// Levenshtein distance for fuzzy matching
function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const d: number[][] = [];

  for (let i = 0; i <= m; i++) d[i] = [i];
  for (let j = 0; j <= n; j++) d[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1, // deletion
        d[i][j - 1] + 1, // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return d[m][n];
}

/**
 * Check if a client name matches an attendee display name
 * Supports partial matches and fuzzy matching for typos
 */
function namesMatch(clientName: string, attendeeName: string): boolean {
  const normalizedClient = normalizeName(clientName);
  const normalizedAttendee = normalizeName(attendeeName);

  // Exact match
  if (normalizedClient === normalizedAttendee) {
    return true;
  }

  // Check if client name is in attendee name ("Devon" in "Devon McGuire")
  if (normalizedAttendee.includes(normalizedClient)) {
    return true;
  }

  // Check if attendee name is in client name ("McGuire" in "Devon McGuire")
  if (normalizedClient.includes(normalizedAttendee)) {
    return true;
  }

  // Check word-by-word match ("Devon McGuire" matches "McGuire, Devon")
  const clientWords = normalizedClient.split(' ');
  const attendeeWords = normalizedAttendee.split(' ');

  if (clientWords.some(cWord =>
    attendeeWords.some(aWord => cWord === aWord && cWord.length > 2)
  )) {
    return true;
  }

  // Fuzzy match using Levenshtein distance
  // Only for names of reasonable length to avoid false positives
  if (normalizedClient.length >= 3 && normalizedAttendee.length >= 3) {
    const distance = levenshteinDistance(normalizedClient, normalizedAttendee);
    // Allow 1 edit for short names (3-5 chars), 2 edits for longer names (6+ chars)
    const maxDistance = normalizedClient.length > 5 ? 2 : 1;
    if (distance <= maxDistance) {
      return true;
    }
  }

  return false;
}

/**
 * Extract attendee names from calendar event, filtering out coach/trainer and room resources
 * 
 * @param event - Google Calendar event
 * @param coachPatterns - Email patterns to filter (coach/trainer emails)
 * @returns Array of attendee display names (or emails as fallback), excluding coach
 */
export function extractAttendeeNames(
  event: GoogleCalendarEvent | Record<string, unknown>,
  coachPatterns: string[] = []
): string[] {
  // Check if event has attendees array
  if ('attendees' in event && Array.isArray(event.attendees)) {
    const names = event.attendees
      .filter(attendee => {
        const email = attendee.email || '';
        const displayName = attendee.displayName || '';

        // Filter out room resources
        if (email.includes('resource.calendar.google.com') || email.includes('[GVC]') || displayName.includes('[GVC]')) {
          return false;
        }

        // Filter out coach/trainer
        const identifier = displayName || email;
        if (isCoachAttendee(identifier, coachPatterns)) {
          return false;
        }

        return true;
      })
      .map(attendee => attendee.displayName || attendee.email || '')
      .filter(name => name.trim() !== '');

    console.log('[extractAttendeeNames] Found client names (after filtering coach):', names);
    return names;
  }

  console.log('[extractAttendeeNames] No attendees found in event');
  return [];
}

/**
 * Extract guest emails from a calendar event's extendedProperties
 */
export function extractGuestEmails(event: GoogleCalendarEvent | Record<string, unknown>): string[] {
  // Check if guestEmails is already populated in the event object
  if (event.guestEmails && typeof event.guestEmails === 'string') {
    console.log('[extractGuestEmails] Found guestEmails in event:', event.guestEmails);
    return event.guestEmails.split(',').map((e: string) => e.trim()).filter(Boolean);
  }

  // Debug: Log what extendedProperties we have
  if ('extendedProperties' in event) {
    console.log('[extractGuestEmails] Event has extendedProperties:', JSON.stringify(event.extendedProperties, null, 2));
  }

  // Check extendedProperties.shared.guest_emails (from work calendar sync script)
  if ('extendedProperties' in event &&
    event.extendedProperties &&
    typeof event.extendedProperties === 'object' &&
    'shared' in event.extendedProperties &&
    event.extendedProperties.shared &&
    typeof event.extendedProperties.shared === 'object' &&
    'guest_emails' in event.extendedProperties.shared) {
    const guestEmailsStr = (event.extendedProperties.shared as Record<string, unknown>).guest_emails;
    console.log('[extractGuestEmails] Found guest_emails in extendedProperties.shared:', guestEmailsStr);
    if (typeof guestEmailsStr === 'string') {
      return guestEmailsStr.split(',').map((e: string) => e.trim()).filter(Boolean);
    }
  }

  // Fallback: Check extendedProperties.private.guest_emails (for PCA-created events)
  if ('extendedProperties' in event &&
    event.extendedProperties &&
    typeof event.extendedProperties === 'object' &&
    'private' in event.extendedProperties &&
    event.extendedProperties.private &&
    typeof event.extendedProperties.private === 'object' &&
    'guest_emails' in event.extendedProperties.private) {
    const guestEmailsStr = (event.extendedProperties.private as Record<string, unknown>).guest_emails;
    console.log('[extractGuestEmails] Found guest_emails in extendedProperties.private:', guestEmailsStr);
    if (typeof guestEmailsStr === 'string') {
      return guestEmailsStr.split(',').map((e: string) => e.trim()).filter(Boolean);
    }
  }

  return [];
}

/**
 * Match a calendar event to a client based on attendee names (returns first match only)
 * 
 * @param event - The Google Calendar event
 * @param clients - Array of all clients
 * @returns Client match result if found, null otherwise
 */
export function matchEventToClient(
  event: GoogleCalendarEvent | Record<string, unknown>,
  clients: Client[]
): ClientMatchResult | null {
  const attendeeNames = extractAttendeeNames(event);

  if (attendeeNames.length === 0) {
    return null;
  }

  console.log('[matchEventToClient] Comparing attendees:', attendeeNames, 'against clients:', clients.map(c => c.name));

  // Try to match each attendee name to a client
  for (const attendeeName of attendeeNames) {
    for (const client of clients) {
      if (namesMatch(client.name, attendeeName)) {
        // Determine confidence based on match type
        const normalizedClient = normalizeName(client.name);
        const normalizedAttendee = normalizeName(attendeeName);
        let confidence: 'exact' | 'partial' | 'fuzzy' = 'partial';

        if (normalizedClient === normalizedAttendee) {
          confidence = 'exact';
        } else if (normalizedAttendee.includes(normalizedClient) || normalizedClient.includes(normalizedAttendee)) {
          confidence = 'partial';
        } else {
          // Word match or fuzzy match
          confidence = 'fuzzy';
        }

        console.log('[matchEventToClient] MATCH FOUND!', client.name, 'matches', attendeeName, 'confidence:', confidence);

        return {
          clientId: client.id,
          clientName: client.name,
          matchedName: attendeeName,
          confidence,
        };
      }
    }
  }

  console.log('[matchEventToClient] No match found');
  return null;
}

/**
 * Match a calendar event to ALL matching clients
 * 
 * @param event - The Google Calendar event
 * @param clients - Array of all clients
 * @param coachingKeywords - Optional coaching session keywords for filtering
 * @param classKeywords - Optional class session keywords for filtering
 * @param exclusionKeywords - Optional exclusion keywords
 * @param coachPatterns - Optional coach email patterns
 * @param skipValidation - Skip session validation (useful for testing)
 * @returns Multi-client match result with all matches and session type
 */
export function matchEventToAllClients(
  event: GoogleCalendarEvent | Record<string, unknown>,
  clients: Client[],
  coachingKeywords: string[] = [],
  classKeywords: string[] = [],
  exclusionKeywords: string[] = [],
  coachPatterns: string[] = [],
  skipValidation = false
): MultiClientMatchResult | null {
  // Filter out non-session events unless skipValidation is true
  if (!skipValidation && !isValidSessionEvent(event, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns)) {
    return null;
  }
  const attendeeNames = extractAttendeeNames(event, coachPatterns);

  if (attendeeNames.length === 0) {
    return null;
  }

  const matches: ClientMatchResult[] = [];
  const matchedClientIds = new Set<string>();

  // Try to match each attendee name to a client
  for (const attendeeName of attendeeNames) {
    for (const client of clients) {
      // Skip if we already matched this client
      if (matchedClientIds.has(client.id)) {
        continue;
      }

      if (namesMatch(client.name, attendeeName)) {
        const normalizedClient = normalizeName(client.name);
        const normalizedAttendee = normalizeName(attendeeName);
        let confidence: 'exact' | 'partial' | 'fuzzy' = 'partial';

        if (normalizedClient === normalizedAttendee) {
          confidence = 'exact';
        } else if (normalizedAttendee.includes(normalizedClient) || normalizedClient.includes(normalizedAttendee)) {
          confidence = 'partial';
        } else {
          // Word match or fuzzy match
          confidence = 'fuzzy';
        }

        matches.push({
          clientId: client.id,
          clientName: client.name,
          matchedName: attendeeName,
          confidence,
        });

        matchedClientIds.add(client.id);
        break; // Move to next attendee
      }
    }
  }

  if (matches.length === 0) {
    return null;
  }

  // Determine session type
  const sessionType: SessionType =
    attendeeNames.length === 1 ? '1-on-1' :
      attendeeNames.length === 2 ? 'buddy' : 'group';

  return {
    matches,
    sessionType,
    totalAttendees: attendeeNames.length,
  };
}

/**
 * Batch match multiple events to clients (single match per event)
 * 
 * @param events - Array of Google Calendar events
 * @param clients - Array of all clients
 * @returns Map of event ID to client match result
 */
export function matchEventsToClients(
  events: (GoogleCalendarEvent | Record<string, unknown>)[],
  clients: Client[]
): Map<string, ClientMatchResult> {
  const matches = new Map<string, ClientMatchResult>();

  for (const event of events) {
    const match = matchEventToClient(event, clients);
    if (match && 'id' in event && typeof event.id === 'string') {
      matches.set(event.id, match);
    }
  }

  return matches;
}

/**
 * Batch match multiple events to ALL matching clients
 * 
 * @param events - Array of Google Calendar events
 * @param clients - Array of all clients
 * @param coachingKeywords - Optional coaching session keywords for filtering
 * @param classKeywords - Optional class session keywords for filtering
 * @param skipValidation - Skip session validation
 * @returns Map of event ID to multi-client match result
 */
export function matchEventsToAllClients(
  events: (GoogleCalendarEvent | Record<string, unknown>)[],
  clients: Client[],
  coachingKeywords: string[] = [],
  classKeywords: string[] = [],
  exclusionKeywords: string[] = [],
  coachPatterns: string[] = [],
  skipValidation = false
): Map<string, MultiClientMatchResult> {
  const matches = new Map<string, MultiClientMatchResult>();

  for (const event of events) {
    const match = matchEventToAllClients(event, clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns, skipValidation);
    if (match && 'id' in event && typeof event.id === 'string') {
      matches.set(event.id, match);
    }
  }

  return matches;
}

/**
 * Get unmatched events (events with attendees but no client match)
 * Only includes valid session events (filters out holds, meetings, etc.)
 * 
 * @param events - Array of Google Calendar events
 * @param clients - Array of all clients
 * @param coachingKeywords - Coaching session keywords for filtering
 * @param classKeywords - Class session keywords for filtering
 * @returns Array of valid session events that have attendees but no matching client
 */
export function getUnmatchedEvents(
  events: (GoogleCalendarEvent | Record<string, unknown>)[],
  clients: Client[],
  coachingKeywords: string[] = [],
  classKeywords: string[] = [],
  exclusionKeywords: string[] = [],
  coachPatterns: string[] = []
): Array<{ event: GoogleCalendarEvent | Record<string, unknown>; attendeeNames: string[] }> {
  const unmatched: Array<{ event: GoogleCalendarEvent | Record<string, unknown>; attendeeNames: string[] }> = [];

  for (const event of events) {
    const attendeeNames = extractAttendeeNames(event, coachPatterns);
    if (attendeeNames.length > 0) {
      // Filter out invalid sessions (holds, meetings, etc.)
      if (!isValidSessionEvent(event, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns)) {
        continue;
      }

      const match = matchEventToClient(event, clients);
      if (!match) {
        unmatched.push({ event, attendeeNames });
      }
    }
  }

  return unmatched;
}

/**
 * Get events that were excluded from matching
 * 
 * @param events - Array of Google Calendar events
 * @param coachingKeywords - Coaching session keywords
 * @param classKeywords - Class session keywords
 * @returns Array of excluded events with reason
 */
export function getExcludedEvents(
  events: (GoogleCalendarEvent | Record<string, unknown>)[],
  coachingKeywords: string[] = [],
  classKeywords: string[] = [],
  exclusionKeywords: string[] = [],
  coachPatterns: string[] = []
): Array<{ event: GoogleCalendarEvent | Record<string, unknown>; reason: string }> {
  const excluded: Array<{ event: GoogleCalendarEvent | Record<string, unknown>; reason: string }> = [];

  for (const event of events) {
    if (!('summary' in event) || typeof event.summary !== 'string') {
      continue;
    }

    const title = event.summary;
    const allAttendees = 'attendees' in event && Array.isArray(event.attendees) ? event.attendees : [];
    const clientAttendees = extractAttendeeNames(event, coachPatterns);

    // Only check events that have ANY attendees
    if (allAttendees.length === 0) {
      continue;
    }

    // Check if excluded by keyword (holds, meetings, admin)
    if (shouldExcludeEvent(title, exclusionKeywords)) {
      excluded.push({
        event,
        reason: 'Excluded keyword (hold, meeting, admin, etc.)'
      });
      continue;
    }

    // Check if it's a coaching session with no clients
    if (isCoachingSession(title, coachingKeywords) && !isClassSession(title, classKeywords)) {
      if (clientAttendees.length === 0) {
        excluded.push({
          event,
          reason: 'Coaching session with no clients listed'
        });
        continue;
      }
    }

    // Check if it's not a recognized session type at all
    if (!isCoachingSession(title, coachingKeywords) && !isClassSession(title, classKeywords)) {
      excluded.push({
        event,
        reason: 'Missing session keywords (PT, Training, Class, etc.)'
      });
    }
  }

  return excluded;
}

/**
 * Get statistics about client matching
 * 
 * @param events - Array of Google Calendar events
 * @param clients - Array of all clients
 */
export function getMatchingStats(
  events: (GoogleCalendarEvent | Record<string, unknown>)[],
  clients: Client[]
): {
  totalEvents: number;
  eventsWithAttendees: number;
  matchedEvents: number;
  unmatchedEvents: number;
  matchRate: number;
} {
  const eventsWithAttendees = events.filter(e => extractAttendeeNames(e).length > 0);
  const matches = matchEventsToClients(events, clients);

  return {
    totalEvents: events.length,
    eventsWithAttendees: eventsWithAttendees.length,
    matchedEvents: matches.size,
    unmatchedEvents: eventsWithAttendees.length - matches.size,
    matchRate: eventsWithAttendees.length > 0
      ? (matches.size / eventsWithAttendees.length) * 100
      : 0,
  };
}
