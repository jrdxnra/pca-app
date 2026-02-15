// Google Calendar integration types

export interface GoogleCalendar {
  id: string;
  summary: string; // Calendar name
  description?: string;
  timeZone: string;
  primary?: boolean;
}

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  userId?: string; // For future multi-user support
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string; // Event title
  description?: string;
  start: {
    dateTime: string; // ISO string (timed events)
    date?: string; // YYYY-MM-DD (all-day events)
    timeZone: string;
  };
  end: {
    dateTime: string; // ISO string (timed events)
    date?: string; // YYYY-MM-DD (all-day events)
    timeZone: string;
  };
  location?: string;
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  creator?: {
    email: string;
    displayName?: string;
  };
  htmlLink?: string; // Link to open event in Google Calendar
  // Extended properties for metadata storage (from Google Calendar API)
  extendedProperties?: {
    private?: Record<string, string>;
    shared?: Record<string, string>;
  };
  // Work calendar sync metadata (stored in extendedProperties.private)
  guestEmails?: string; // Comma-separated list of guest emails from work calendar
  originalEventId?: string; // ID of the source event from work calendar
  // App-specific metadata
  isCoachingSession?: boolean; // Detected or manually set
  isClassSession?: boolean; // Detected or manually set
  linkedWorkoutId?: string; // Reference to workout in Firestore
  // Pre-configured workout settings
  preConfiguredClient?: string; // Client ID
  preConfiguredCategory?: string; // Workout category name
  preConfiguredStructure?: string; // Workout structure template ID
}

export interface LocationAbbreviation {
  original: string; // The full location name from Google Calendar
  abbreviation: string; // The shortened version to display
  ignored?: boolean; // If true, this location should not be displayed (marked as N/A)
}

export interface CalendarSyncConfig {
  selectedCalendarId?: string; // If set, sync is enabled. If not set, sync is disabled.
  coachingKeywords: string[]; // Keywords to auto-detect coaching sessions (1-on-1)
  coachingColor?: string; // Color for coaching sessions (e.g. 'blue', 'purple')
  classKeywords: string[]; // Keywords to auto-detect class sessions (group)
  classColor?: string; // Color for class sessions
  exclusionKeywords?: string[]; // Keywords to exclude events from matching (hold, meeting, etc.)
  coachEmailPatterns?: string[]; // Email patterns to filter from attendees (@xwf.google.com, huntjordan@, etc.)
  locationAbbreviations?: LocationAbbreviation[]; // Location abbreviation mappings
  lastSyncTime?: Date;
}

export interface DateRange {
  start: Date;
  end: Date;
}

// For the manual test event input form
export interface TestEventInput {
  summary: string;
  date: string; // YYYY-MM-DD format
  startTime: string; // HH:MM format
  endTime: string; // HH:MM format
  location?: string;
  description?: string;
}
