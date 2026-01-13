import { create } from 'zustand';
import { GoogleCalendar, GoogleCalendarEvent, CalendarSyncConfig, DateRange, TestEventInput } from '@/lib/google-calendar/types';
import { 
  createCalendarEvent, 
  getCalendarEventsByDateRange, 
  updateCalendarEvent, 
  deleteCalendarEvent 
} from '@/lib/firebase/services/calendarEvents';
import { createClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { Timestamp } from 'firebase/firestore';
import { 
  fetchCalendarEvents, 
  checkGoogleCalendarAuth,
  addWorkoutLinksToEvent
} from '@/lib/google-calendar/api-client';

// Cache duration in milliseconds (30 seconds)
const CACHE_DURATION = 30 * 1000;

interface CalendarStore {
  // State
  calendars: GoogleCalendar[];
  events: GoogleCalendarEvent[];
  config: CalendarSyncConfig;
  loading: boolean;
  error: string | null;
  isGoogleCalendarConnected: boolean;
  
  // Cache tracking
  _eventsFetchTime: number | null;
  _eventsFetchKey: string | null;

  // Actions
  fetchCalendars: () => Promise<void>;
  fetchEvents: (dateRange: DateRange, force?: boolean) => Promise<void>;
  createTestEvent: (eventInput: TestEventInput) => Promise<GoogleCalendarEvent>;
  markAsCoachingSession: (eventId: string, isCoaching: boolean) => Promise<void>;
  linkToWorkout: (eventId: string, workoutId: string) => Promise<void>;
  updateEvent: (eventId: string, updates: Partial<GoogleCalendarEvent>) => Promise<void>;
  deleteEvent: (eventId: string) => Promise<void>;
  updateConfig: (updates: Partial<CalendarSyncConfig>) => void;
  clearAllTestEvents: () => Promise<void>;
  clearError: () => void;
  checkGoogleCalendarConnection: () => Promise<void>;

  // Utility functions
  getCoachingEvents: () => GoogleCalendarEvent[];
  getPersonalEvents: () => GoogleCalendarEvent[];
  getLinkedEvents: () => GoogleCalendarEvent[];
  getUnlinkedCoachingEvents: () => GoogleCalendarEvent[];
  getLocationDisplay: (location: string) => string;
}

const defaultConfig: CalendarSyncConfig = {
  selectedCalendarId: 'primary', // Default to primary calendar in Phase 1 (mock mode)
  coachingKeywords: ['Personal Training', 'PT', 'Training Session', 'Workout'],
  classKeywords: ['Class', 'Group Class', 'Group Training', 'Group Session'],
};

export const useCalendarStore = create<CalendarStore>((set, get) => ({
  // Initial state
  calendars: [],
  events: [],
  config: defaultConfig,
  loading: false,
  error: null,
  isGoogleCalendarConnected: false,
  _eventsFetchTime: null,
  _eventsFetchKey: null,

  // Actions
  fetchCalendars: async () => {
    set({ loading: true, error: null });
    try {
      // For now, use a simple calendar list
      // In the future, this could fetch from Google Calendar API
      const calendars: GoogleCalendar[] = [
        {
          id: 'primary',
          summary: 'Primary Calendar',
          timeZone: 'America/Los_Angeles',
          primary: true,
        },
      ];
      set({ calendars, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch calendars',
        loading: false 
      });
    }
  },

  fetchEvents: async (dateRange: DateRange, force = false) => {
    const { config, isGoogleCalendarConnected, _eventsFetchTime, _eventsFetchKey, events: existingEvents } = get();
    const cacheKey = `${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;
    
    // Skip if cache is fresh and for same date range (unless forced)
    if (!force && existingEvents.length > 0 && _eventsFetchTime && _eventsFetchKey === cacheKey && Date.now() - _eventsFetchTime < CACHE_DURATION) {
      return;
    }
    
    // Sync is enabled if a calendar is selected
    if (!config.selectedCalendarId) {
      set({ events: [], loading: false });
      return;
    }
    
    set({ loading: true, error: null });
    try {
      let newEvents: GoogleCalendarEvent[] = [];

      // Try Google Calendar API first if connected
      if (isGoogleCalendarConnected) {
        try {
          const googleEvents = await fetchCalendarEvents(
            dateRange.start,
            dateRange.end,
            config.selectedCalendarId || 'primary'
          );
          
          // Convert Google Calendar API format to our format
          newEvents = googleEvents.map((event: any) => {
            const clientId = event.extendedProperties?.private?.pcaClientId;
            const category = event.extendedProperties?.private?.pcaCategory;
            
            // DEBUG: Log attendee info for events (remove after testing)
            if (event.attendees && event.attendees.length > 0) {
              console.log('📅 Event with attendees:', {
                summary: event.summary,
                time: event.start?.dateTime,
                attendees: event.attendees.map((a: any) => ({
                  email: a.email,
                  displayName: a.displayName,
                  responseStatus: a.responseStatus
                }))
              });
            }
            
            return {
              id: event.id,
              summary: event.summary || '',
              description: event.description || '',
              start: {
                dateTime: event.start?.dateTime || event.start?.date || '',
                timeZone: event.start?.timeZone || 'America/Los_Angeles',
              },
              end: {
                dateTime: event.end?.dateTime || event.end?.date || '',
                timeZone: event.end?.timeZone || 'America/Los_Angeles',
              },
              location: event.location,
              htmlLink: event.htmlLink,
              creator: event.creator,
              attendees: event.attendees, // Capture attendees for client matching
              // Extract metadata from extended properties
              preConfiguredClient: clientId,
              preConfiguredCategory: category,
              linkedWorkoutId: event.extendedProperties?.private?.pcaWorkoutId,
              // Mark as coaching session if it has a client ID (from our app)
              isCoachingSession: clientId ? true : undefined,
            };
          });
        } catch (googleError) {
          console.warn('Failed to fetch from Google Calendar, falling back to Firebase:', googleError);
          // Fall through to Firebase
        }
      }

      // Fallback to Firebase if Google Calendar not connected or failed
      if (newEvents.length === 0) {
        newEvents = await getCalendarEventsByDateRange(dateRange.start, dateRange.end);
      }
      
      // Auto-detect coaching sessions and class sessions based on keywords
      const eventsWithDetection = newEvents.map(event => ({
        ...event,
        isCoachingSession: event.isCoachingSession ?? isCoachingEvent(event, config.coachingKeywords),
        isClassSession: event.isClassSession ?? isClassEvent(event, config.classKeywords || []),
      }));

      // Merge with existing events instead of replacing them
      // Remove events that fall within the new date range (they'll be replaced with fresh data)
      // Keep events outside the new date range
      const eventsOutsideRange = existingEvents.filter(existingEvent => {
        if (!existingEvent.start?.dateTime) return true; // Keep events without dates
        
        const eventDate = new Date(existingEvent.start.dateTime);
        return eventDate < dateRange.start || eventDate > dateRange.end;
      });
      
      // Combine: events outside range + new events from this fetch
      // Deduplicate by event ID (in case there's overlap)
      const eventMap = new Map<string, GoogleCalendarEvent>();
      
      // Add existing events outside range first
      eventsOutsideRange.forEach(event => {
        eventMap.set(event.id, event);
      });
      
      // Add/update with new events (will overwrite if ID matches)
      eventsWithDetection.forEach(event => {
        eventMap.set(event.id, event);
      });
      
      const mergedEvents = Array.from(eventMap.values());

      set({ events: mergedEvents, loading: false, _eventsFetchTime: Date.now(), _eventsFetchKey: cacheKey });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch events',
        loading: false 
      });
    }
  },

  createTestEvent: async (eventInput: TestEventInput) => {
    set({ loading: true, error: null });
    try {
      const { config } = get();
      // Create start and end datetime strings
      const startDateTime = `${eventInput.date}T${eventInput.startTime}:00`;
      const endDateTime = `${eventInput.date}T${eventInput.endTime}:00`;

      // Parse client and category from description if present
      let clientId: string | null = null;
      let categoryName: string | null = null;
      
      if (eventInput.description) {
        const clientMatch = eventInput.description.match(/\[Metadata:.*client=([^,}]+)/);
        if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
          clientId = clientMatch[1].trim();
        }
        
        const categoryMatch = eventInput.description.match(/Workout Category:\s*([^\n]+)/);
        if (categoryMatch) {
          categoryName = categoryMatch[1].trim();
        }
      }

      // Create calendar event in Firebase
      const eventData: Omit<GoogleCalendarEvent, 'id'> = {
        summary: eventInput.summary,
        description: eventInput.description || '',
        start: {
          dateTime: startDateTime,
          timeZone: 'America/Los_Angeles',
        },
        end: {
          dateTime: endDateTime,
          timeZone: 'America/Los_Angeles',
        },
        location: eventInput.location || '',
        htmlLink: '',
        creator: {
          email: 'system@example.com',
          displayName: 'System',
        },
        isCoachingSession: eventInput.summary.toLowerCase().includes('personal training') || 
                          eventInput.summary.toLowerCase().includes('training') ||
                          eventInput.summary.toLowerCase().includes('workout') ||
                          eventInput.summary.toLowerCase().includes('pt'),
        isClassSession: isClassEvent({ summary: eventInput.summary } as GoogleCalendarEvent, config.classKeywords || []),
        preConfiguredClient: clientId || undefined,
        preConfiguredCategory: categoryName || undefined,
      };

      const newEvent = await createCalendarEvent(eventData);
      
      // Auto-create workout if client is specified AND workoutId is not already in metadata
      // (If workoutId is present, the workout was already created and we just need to link)
      if (clientId) {
        // Check if workoutId is already in the description (meaning workout was created first)
        const workoutIdMatch = eventInput.description?.match(/workoutId=([^,\s}]+)/);
        const existingWorkoutId = workoutIdMatch && workoutIdMatch[1] && workoutIdMatch[1] !== 'none' 
          ? workoutIdMatch[1].trim() 
          : null;

        if (existingWorkoutId) {
          // Workout already exists, just link the event to it
          await updateCalendarEvent(newEvent.id, { linkedWorkoutId: existingWorkoutId });
          newEvent.linkedWorkoutId = existingWorkoutId;
          console.log('✅ Linked calendar event to existing workout:', existingWorkoutId);
        } else {
          // No workout exists yet, create one
          try {
            const eventDate = new Date(startDateTime);
            
            // Extract periodId from description if provided
            let periodId: string | null = null;
            if (eventInput.description) {
              const periodMatch = eventInput.description.match(/periodId=([^,\s}]+)/);
              if (periodMatch && periodMatch[1] && periodMatch[1] !== 'none') {
                periodId = periodMatch[1].trim();
              }
            }
            
            // If no periodId found, use placeholder (system should handle finding/creating period)
            const workout = await createClientWorkout({
              clientId,
              periodId: periodId || 'quick-workouts', // Use placeholder if not found
              date: Timestamp.fromDate(eventDate),
              dayOfWeek: eventDate.getDay(),
              categoryName: categoryName || '',
              time: eventInput.startTime,
              title: eventInput.summary,
              rounds: [],
              warmups: [],
              isModified: false,
              createdBy: 'system',
            });

            // Link event to workout
            await updateCalendarEvent(newEvent.id, { linkedWorkoutId: workout.id });
            newEvent.linkedWorkoutId = workout.id;
            
            console.log('✅ Auto-created workout for calendar event:', workout.id);
          } catch (workoutError) {
            console.error('❌ Error creating workout for calendar event:', workoutError);
            // Don't fail the event creation if workout creation fails
          }
        }
      }
      
      // Add to current events
      const { events } = get();
      const updatedEvent = {
        ...newEvent,
        isCoachingSession: newEvent.isCoachingSession ?? isCoachingEvent(newEvent, config.coachingKeywords),
        isClassSession: newEvent.isClassSession ?? isClassEvent(newEvent, config.classKeywords || []),
      };
      
      set({ 
        events: [...events, updatedEvent],
        loading: false 
      });
      
      return updatedEvent;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to create test event',
        loading: false 
      });
      throw error;
    }
  },

  markAsCoachingSession: async (eventId: string, isCoaching: boolean) => {
    set({ loading: true, error: null });
    try {
      await updateCalendarEvent(eventId, { isCoachingSession: isCoaching });
      
      // Update in local state
      const { events } = get();
      const updatedEvents = events.map(event => 
        event.id === eventId ? { ...event, isCoachingSession: isCoaching } : event
      );
      
      set({ events: updatedEvents, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update event',
        loading: false 
      });
    }
  },

  linkToWorkout: async (eventId: string, workoutId: string) => {
    console.log('[linkToWorkout] Called with eventId:', eventId, 'workoutId:', workoutId);
    set({ loading: true, error: null });
    try {
      const { events, isGoogleCalendarConnected, config } = get();
      console.log('[linkToWorkout] isGoogleCalendarConnected:', isGoogleCalendarConnected);
      console.log('[linkToWorkout] events count:', events.length);
      
      // Find the event to get clientId and date
      const event = events.find(e => e.id === eventId);
      if (!event) {
        console.error('[linkToWorkout] Event not found for id:', eventId);
        throw new Error('Event not found');
      }
      console.log('[linkToWorkout] Found event:', event.summary, 'description:', event.description?.substring(0, 100));

      // Get clientId from event metadata
      const clientId = event.preConfiguredClient || 
                       (event as any).extendedProperties?.private?.pcaClientId ||
                       event.description?.match(/client=([^,\s}\]]+)/)?.[1];
      
      console.log('[linkToWorkout] clientId:', clientId);
      
      if (!clientId) {
        console.warn('[linkToWorkout] No clientId found for event, skipping Google Calendar description update');
      } else {
        // If Google Calendar is connected, update the event description with workout links
        if (isGoogleCalendarConnected && event.start?.dateTime) {
          console.log('[linkToWorkout] Attempting to add workout links to Google Calendar...');
          try {
            const eventDate = new Date(event.start.dateTime);
            await addWorkoutLinksToEvent(
              eventId,
              workoutId,
              clientId,
              eventDate,
              event.description,
              'single', // Update only this instance
              event.start.dateTime,
              config.selectedCalendarId || 'primary'
            );
            console.log('✅ [linkToWorkout] Added workout links to Google Calendar event description');
          } catch (googleError) {
            console.error('[linkToWorkout] Failed to update Google Calendar event description:', googleError);
            // Don't fail the whole operation if Google Calendar update fails
          }
        } else {
          console.log('[linkToWorkout] Skipping Google Calendar update - connected:', isGoogleCalendarConnected, 'has dateTime:', !!event.start?.dateTime);
        }
      }
      
      // Update Firebase/local state
      await updateCalendarEvent(eventId, { linkedWorkoutId: workoutId });
      
      // Update in local state
      const updatedEvents = events.map(e => 
        e.id === eventId ? { ...e, linkedWorkoutId: workoutId } : e
      );
      
      set({ events: updatedEvents, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to link workout',
        loading: false 
      });
    }
  },

  updateEvent: async (eventId: string, updates: Partial<GoogleCalendarEvent>) => {
    set({ loading: true, error: null });
    try {
      const { events, isGoogleCalendarConnected } = get();
      const existingEvent = events.find(e => e.id === eventId);
      
      // If connected to Google Calendar, update the event there first
      if (isGoogleCalendarConnected && existingEvent) {
        try {
          // Build updates for Google Calendar API
          const googleUpdates: Record<string, unknown> = {};
          
          if (updates.summary) googleUpdates.summary = updates.summary;
          if (updates.description !== undefined) googleUpdates.description = updates.description;
          if (updates.location) googleUpdates.location = updates.location;
          
          // Handle time updates
          if (updates.start?.dateTime || updates.end?.dateTime) {
            googleUpdates.start = updates.start || existingEvent.start;
            googleUpdates.end = updates.end || existingEvent.end;
          }
          
          // Get the event date for the API call
          const eventDate = existingEvent.start.dateTime 
            ? new Date(existingEvent.start.dateTime).toISOString()
            : new Date().toISOString();
          
          const response = await fetch('/api/calendar/events/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              eventId,
              instanceDate: eventDate,
              updateType: 'single',
              updates: googleUpdates,
            }),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            console.error('Google Calendar update failed:', errorData);
            // Continue with local update even if Google fails
          }
        } catch (googleError) {
          console.error('Failed to update Google Calendar event:', googleError);
          // Continue with local update
        }
      }
      
      // Also update Firebase (for local caching)
      await updateCalendarEvent(eventId, updates);
      
      // Update in local state
      const updatedEvents = events.map(event => 
        event.id === eventId ? { ...event, ...updates } : event
      );
      
      set({ events: updatedEvents, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update event',
        loading: false 
      });
    }
  },

  deleteEvent: async (eventId: string) => {
    set({ loading: true, error: null });
    try {
      await deleteCalendarEvent(eventId);
      
      // Remove from local state
      const { events } = get();
      const updatedEvents = events.filter(event => event.id !== eventId);
      
      set({ events: updatedEvents, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete event',
        loading: false 
      });
      throw error;
    }
  },

  updateConfig: (updates: Partial<CalendarSyncConfig>) => {
    const { config } = get();
    const newConfig = { ...config, ...updates };
    set({ config: newConfig });
    
    // Save to localStorage for now (will be Firestore in Phase 2)
    localStorage.setItem('calendar-config', JSON.stringify(newConfig));
  },

  clearAllTestEvents: async () => {
    set({ loading: true, error: null });
    try {
      // Delete all events from Firebase
      const { events } = get();
      await Promise.all(events.map(event => deleteCalendarEvent(event.id)));
      set({ events: [], loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to clear events',
        loading: false 
      });
    }
  },

  clearError: () => set({ error: null }),

  checkGoogleCalendarConnection: async () => {
    try {
      const connected = await checkGoogleCalendarAuth();
      set({ isGoogleCalendarConnected: connected });
    } catch (error) {
      console.error('Error checking Google Calendar connection:', error);
      set({ isGoogleCalendarConnected: false });
    }
  },

  // Utility functions
  getCoachingEvents: () => {
    const { events } = get();
    return events.filter(event => event.isCoachingSession);
  },

  getPersonalEvents: () => {
    const { events } = get();
    return events.filter(event => !event.isCoachingSession);
  },

  getLinkedEvents: () => {
    const { events } = get();
    return events.filter(event => event.linkedWorkoutId);
  },

  getUnlinkedCoachingEvents: () => {
    const { events } = get();
    return events.filter(event => event.isCoachingSession && !event.linkedWorkoutId);
  },

  getLocationDisplay: (location: string) => {
    const { config } = get();
    if (!location) return '';
    const abbreviations = config.locationAbbreviations || [];
    const abbr = abbreviations.find(a => a.original === location);
    // If location is ignored, return empty string (don't display)
    if (abbr?.ignored) return '';
    return abbr ? abbr.abbreviation : location;
  },
}));

// Helper function to detect coaching events based on keywords
function isCoachingEvent(event: GoogleCalendarEvent, keywords: string[]): boolean {
  const title = event.summary.toLowerCase();
  return keywords.some(keyword => title.includes(keyword.toLowerCase()));
}

// Helper function to detect class events based on keywords
function isClassEvent(event: GoogleCalendarEvent, keywords: string[]): boolean {
  const title = event.summary.toLowerCase();
  return keywords.some(keyword => title.includes(keyword.toLowerCase()));
}

// Load config from localStorage on initialization and check Google Calendar connection
if (typeof window !== 'undefined') {
  const savedConfig = localStorage.getItem('calendar-config');
  if (savedConfig) {
    try {
      const parsedConfig = JSON.parse(savedConfig);
      // Remove syncEnabled if it exists (legacy field)
      const { syncEnabled, ...cleanConfig } = parsedConfig;
      // Ensure classKeywords exists (for backward compatibility)
      if (!cleanConfig.classKeywords) {
        cleanConfig.classKeywords = defaultConfig.classKeywords;
      }
      useCalendarStore.setState({ config: { ...defaultConfig, ...cleanConfig } });
    } catch (error) {
      console.error('Failed to load calendar config from localStorage:', error);
    }
  }

  // Check Google Calendar connection status on initialization
  checkGoogleCalendarAuth().then(connected => {
    useCalendarStore.setState({ isGoogleCalendarConnected: connected });
  }).catch(() => {
    useCalendarStore.setState({ isGoogleCalendarConnected: false });
  });
}
