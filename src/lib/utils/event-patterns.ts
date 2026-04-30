import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientProgram } from '@/lib/types';
import { safeToDate } from '@/lib/utils/dateHelpers';

/**
 * Represents a day+time pattern for recurring events
 */
export interface EventPattern {
  dayOfWeek: number; // 0-6 (Sunday-Saturday)
  time: string; // "HH:mm" format
  dayName: string; // "Monday", "Tuesday", etc.
}

/**
 * Pattern match result with events grouped by pattern
 */
export interface PatternMatchResult {
  pattern: EventPattern;
  events: GoogleCalendarEvent[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function cleanMetadataValue(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === 'none') return null;
  try {
    return decodeURIComponent(trimmed);
  } catch {
    return trimmed;
  }
}

function extractParamFromDescriptionUrls(description: string, paramName: string): string | null {
  if (!description) return null;

  const urls = new Set<string>();

  const hrefMatches = description.matchAll(/href=["']([^"']+)["']/gi);
  for (const match of hrefMatches) {
    if (match[1]) {
      urls.add(match[1]);
    }
  }

  const rawUrlMatches = description.matchAll(/https?:\/\/[^\s"'<>]+/gi);
  for (const match of rawUrlMatches) {
    if (match[0]) {
      urls.add(match[0]);
    }
  }

  for (const urlText of urls) {
    const normalizedUrlText = urlText
      .replace(/&amp;/gi, '&')
      .replace(/&#38;/gi, '&');

    try {
      const url = new URL(normalizedUrlText);
      const value = cleanMetadataValue(url.searchParams.get(paramName) || undefined);
      if (value) return value;
    } catch {
      const looseMatch = normalizedUrlText.match(new RegExp(`(?:\\?|&|\\b)${paramName}=([^&#,\\s\\]}]+)`));
      const looseValue = cleanMetadataValue(looseMatch?.[1]);
      if (looseValue) return looseValue;
    }
  }

  return null;
}

/**
 * Get client ID from event metadata
 */
export function getEventClientId(event: GoogleCalendarEvent): string | null {
  // Check preConfiguredClient first (highest priority)
  if (event.preConfiguredClient) {
    return event.preConfiguredClient;
  }
  
  // Check extended properties (from Google Calendar API)
  if ((event as any).extendedProperties?.private?.pcaClientId) {
    return (event as any).extendedProperties.private.pcaClientId;
  }
  
  // Check description metadata - try multiple patterns
  if (event.description) {
    // Pattern 1: [Metadata: ... client=...]
    let clientMatch = event.description.match(/\[Metadata:.*client=([^,\s}\]&]+)/);
    const metadataClientId = cleanMetadataValue(clientMatch?.[1]);
    if (metadataClientId) {
      return metadataClientId;
    }
    
    // Pattern 2: client=... (without Metadata wrapper)
    clientMatch = event.description.match(/(?:\?|&|\b)client=([^&#,\s\n}\]]+)/);
    const fallbackClientId = cleanMetadataValue(clientMatch?.[1]);
    if (fallbackClientId) {
      return fallbackClientId;
    }

    const urlClientId = extractParamFromDescriptionUrls(event.description, 'client');
    if (urlClientId) {
      return urlClientId;
    }
  }
  
  return null;
}

/**
 * Check if event already has a linked workout
 */
export function hasLinkedWorkout(event: GoogleCalendarEvent): boolean {
  return !!getLinkedWorkoutId(event);
}

/**
 * Get the linked workout ID from event (checks both direct property and description metadata)
 */
export function getLinkedWorkoutId(event: GoogleCalendarEvent): string | null {
  // Check direct property first
  const directWorkoutId = cleanMetadataValue(event.linkedWorkoutId);
  if (directWorkoutId) {
    return directWorkoutId;
  }
  
  // Check description for workoutId metadata
  if (event.description) {
    const workoutMatch = event.description.match(/(?:\?|&|\b)workoutId=([^&#,\s}\]]+)/);
    const parsedWorkoutId = cleanMetadataValue(workoutMatch?.[1]);
    if (parsedWorkoutId) {
      return parsedWorkoutId;
    }

    const urlWorkoutId = extractParamFromDescriptionUrls(event.description, 'workoutId');
    if (urlWorkoutId) {
      return urlWorkoutId;
    }
  }
  
  return null;
}

/**
 * Detect the day+time pattern from a calendar event
 */
export function detectEventPattern(event: GoogleCalendarEvent): EventPattern | null {
  if (!event.start?.dateTime) return null;
  
  const date = new Date(event.start.dateTime);
  const dayOfWeek = date.getDay(); // 0-6 (Sunday-Saturday)
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  
  return {
    dayOfWeek,
    time,
    dayName: DAY_NAMES[dayOfWeek]
  };
}

/**
 * Format time for display (e.g., "7:00 AM")
 */
export function formatTimeForDisplay(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

/**
 * Find all events matching a specific pattern that don't have a client assigned
 */
export function findMatchingEvents(
  events: GoogleCalendarEvent[],
  pattern: EventPattern,
  excludeEventIds?: string[]
): GoogleCalendarEvent[] {
  const excludeSet = new Set(excludeEventIds || []);
  
  return events.filter(event => {
    // Skip if already has client assigned
    if (getEventClientId(event)) return false;
    
    // Skip excluded events
    if (excludeSet.has(event.id)) return false;
    
    if (!event.start?.dateTime) return false;
    
    const date = new Date(event.start.dateTime);
    const dayOfWeek = date.getDay();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    return dayOfWeek === pattern.dayOfWeek && time === pattern.time;
  });
}

/**
 * Get all scheduled patterns (day+time) for a client from their active periods
 * Returns array of patterns like [{ dayOfWeek: 1, time: "07:00" }, { dayOfWeek: 3, time: "07:00" }]
 */
export function getClientScheduledPatterns(
  clientId: string,
  clientPrograms: ClientProgram[]
): EventPattern[] {
  const patternMap = new Map<string, EventPattern>(); // Use Map to deduplicate
  
  const activeProgram = clientPrograms.find(
    program => program.clientId === clientId && program.status === 'active'
  );
  
  if (!activeProgram) return [];
  
  const now = new Date();
  
  // Extract patterns from all active periods
  for (const period of activeProgram.periods) {
    const periodStart = safeToDate(period.startDate);
    const periodEnd = safeToDate(period.endDate);
    
    // Only consider active/future periods
    if (periodEnd < now) continue;
    
    // Extract patterns from period days
    for (const day of period.days) {
      if (day.time && !day.isAllDay) {
        const dayDate = safeToDate(day.date);
        const dayOfWeek = dayDate.getDay();
        const patternKey = `${dayOfWeek}-${day.time}`;
        
        if (!patternMap.has(patternKey)) {
          patternMap.set(patternKey, {
            dayOfWeek,
            time: day.time,
            dayName: DAY_NAMES[dayOfWeek]
          });
        }
      }
    }
  }
  
  return Array.from(patternMap.values());
}

/**
 * Find all patterns and their matching events for bulk assignment
 * Includes the clicked event's pattern plus any additional patterns from client's schedule
 */
export function findAllPatternsWithEvents(
  clickedEvent: GoogleCalendarEvent,
  allEvents: GoogleCalendarEvent[],
  clientId: string,
  clientPrograms: ClientProgram[]
): PatternMatchResult[] {
  const results: PatternMatchResult[] = [];
  const processedPatterns = new Set<string>();
  
  // 1. Start with the clicked event's pattern
  const clickedPattern = detectEventPattern(clickedEvent);
  if (clickedPattern) {
    const patternKey = `${clickedPattern.dayOfWeek}-${clickedPattern.time}`;
    processedPatterns.add(patternKey);
    
    // Find matching events (including the clicked event)
    const matchingEvents = findMatchingEvents(allEvents, clickedPattern);
    
    // Add the clicked event if it wasn't already included
    const hasClickedEvent = matchingEvents.some(e => e.id === clickedEvent.id);
    const allMatchingEvents = hasClickedEvent 
      ? matchingEvents 
      : [clickedEvent, ...matchingEvents];
    
    if (allMatchingEvents.length > 0) {
      results.push({
        pattern: clickedPattern,
        events: allMatchingEvents
      });
    }
  }
  
  // 2. Get client's scheduled patterns and find additional matches
  const clientPatterns = getClientScheduledPatterns(clientId, clientPrograms);
  
  for (const pattern of clientPatterns) {
    const patternKey = `${pattern.dayOfWeek}-${pattern.time}`;
    
    // Skip if we already processed this pattern
    if (processedPatterns.has(patternKey)) continue;
    processedPatterns.add(patternKey);
    
    const matchingEvents = findMatchingEvents(allEvents, pattern);
    
    if (matchingEvents.length > 0) {
      results.push({
        pattern,
        events: matchingEvents
      });
    }
  }
  
  return results;
}

/**
 * Get total event count from pattern results
 */
export function getTotalEventCount(patternResults: PatternMatchResult[]): number {
  return patternResults.reduce((total, result) => total + result.events.length, 0);
}

/**
 * Extract category from event
 */
export function getEventCategory(event: GoogleCalendarEvent): string | null {
  // Check preConfiguredCategory first
  if (event.preConfiguredCategory) {
    return event.preConfiguredCategory;
  }
  
  // Check description for category
  if (event.description) {
    const categoryMatch = event.description.match(/Workout Category:\s*([^\n]+)/);
    if (categoryMatch) {
      return categoryMatch[1].trim();
    }
    
    // Alternative pattern: category=...
    const altMatch = event.description.match(/category=([^,\s}\]]+)/);
    if (altMatch && altMatch[1] && altMatch[1] !== 'none') {
      return altMatch[1].trim();
    }
  }
  
  return null;
}






















