import { format } from 'date-fns';
import { WeekTemplate } from '@/lib/firebase/services/weekTemplates';

/**
 * Convert day name to Google Calendar RRULE day abbreviation
 */
const DAY_NAME_TO_RRULE: Record<string, string> = {
  'Monday': 'MO',
  'Tuesday': 'TU',
  'Wednesday': 'WE',
  'Thursday': 'TH',
  'Friday': 'FR',
  'Saturday': 'SA',
  'Sunday': 'SU',
};

/**
 * Format date for RRULE UNTIL clause (YYYYMMDD format)
 */
function formatDateForRRULE(date: Date): string {
  return format(date, 'yyyyMMdd');
}

/**
 * Convert week template to Google Calendar RRULE format
 * Groups days by workout category and creates separate RRULE for each category
 * 
 * Example:
 * - Monday: Upper, Wednesday: Upper, Friday: Upper
 * - Tuesday: Lower, Thursday: Lower
 * 
 * Creates:
 * - "RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20260315" for Upper
 * - "RRULE:FREQ=WEEKLY;BYDAY=TU,TH;UNTIL=20260315" for Lower
 */
export function weekTemplateToRRULE(
  weekTemplate: WeekTemplate,
  periodEndDate: Date
): Map<string, string[]> {
  const categoryToDays = new Map<string, string[]>();
  const untilDate = formatDateForRRULE(periodEndDate);

  // Group days by workout category
  for (const day of weekTemplate.days) {
    const category = day.workoutCategory;
    
    // Skip rest days
    if (category.toLowerCase().includes('rest day')) {
      continue;
    }

    const rruleDay = DAY_NAME_TO_RRULE[day.day];
    if (!rruleDay) {
      console.warn(`Unknown day name: ${day.day}`);
      continue;
    }

    const existingDays = categoryToDays.get(category) || [];
    existingDays.push(rruleDay);
    categoryToDays.set(category, existingDays);
  }

  // Convert to RRULE strings
  const result = new Map<string, string[]>();
  for (const [category, days] of categoryToDays) {
    if (days.length > 0) {
      const rrule = `RRULE:FREQ=WEEKLY;BYDAY=${days.join(',')};UNTIL=${untilDate}`;
      result.set(category, [rrule]);
    }
  }

  return result;
}

/**
 * Create RRULE for a single day of week
 */
export function createSingleDayRRULE(
  dayOfWeek: string, // "Monday", "Tuesday", etc.
  untilDate: Date
): string {
  const rruleDay = DAY_NAME_TO_RRULE[dayOfWeek];
  if (!rruleDay) {
    throw new Error(`Invalid day of week: ${dayOfWeek}`);
  }

  const until = formatDateForRRULE(untilDate);
  return `RRULE:FREQ=WEEKLY;BYDAY=${rruleDay};UNTIL=${until}`;
}

/**
 * Parse RRULE to extract day information
 */
export function parseRRULE(rrule: string): {
  frequency: string;
  byDay: string[];
  until?: Date;
} {
  const parts = rrule.split(';');
  const result: {
    frequency: string;
    byDay: string[];
    until?: Date;
  } = {
    frequency: 'WEEKLY',
    byDay: [],
  };

  for (const part of parts) {
    if (part.startsWith('FREQ=')) {
      result.frequency = part.split('=')[1];
    } else if (part.startsWith('BYDAY=')) {
      result.byDay = part.split('=')[1].split(',');
    } else if (part.startsWith('UNTIL=')) {
      const untilStr = part.split('=')[1];
      // Parse YYYYMMDD format
      const year = parseInt(untilStr.substring(0, 4));
      const month = parseInt(untilStr.substring(4, 6)) - 1; // Month is 0-indexed
      const day = parseInt(untilStr.substring(6, 8));
      result.until = new Date(year, month, day);
    }
  }

  return result;
}


