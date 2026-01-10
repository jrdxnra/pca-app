// Google Calendar integration types

export interface GoogleCalendar {
  id: string;
  summary: string; // Calendar name
  description?: string;
  timeZone: string;
  primary?: boolean;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string; // Event title
  description?: string;
  start: {
    dateTime: string; // ISO string
    timeZone: string;
  };
  end: {
    dateTime: string; // ISO string
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
  coachingKeywords: string[]; // Keywords to auto-detect coaching sessions
  classKeywords: string[]; // Keywords to auto-detect class sessions
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
