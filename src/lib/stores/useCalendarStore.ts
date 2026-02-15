import { create } from 'zustand';
import { GoogleCalendar, GoogleCalendarEvent, CalendarSyncConfig, DateRange, TestEventInput } from '@/lib/google-calendar/types';
import {
  fetchCalendarEvents,
  checkGoogleCalendarAuth,
  addWorkoutLinksToEvent,
  createSingleCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent
} from '@/lib/google-calendar/api-client';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { getGlobalQueryClient } from '@/lib/react-query/queryClientInstance';

// Cache duration in milliseconds (5 minutes - matches React Query staleTime)
// Note: Calendar events are now primarily fetched via React Query, this is for backward compatibility
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (increased from 30 seconds)

function normalizeLocationKey(input: string): string {
  // Normalize for comparison: lowercase, trim, collapse spaces
  return (input || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

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
  markAsClassSession: (eventId: string, isClass: boolean) => Promise<void>;
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

// Helper to get ID token with auth state wait
async function getFirebaseIdToken(): Promise<string | undefined> {
  // Import dynamically to avoid side effects
  const { auth } = await import('@/lib/firebase/config');

  // If user is already available, return token
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn('Failed to get ID token:', e);
      return undefined;
    }
  }

  // If no user, wait for initial auth state resolution
  // This prevents race conditions where the store checks for connection before auth is ready
  return new Promise((resolve) => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      unsubscribe();
      if (user) {
        try {
          const token = await user.getIdToken();
          resolve(token);
        } catch (e) {
          console.warn('Failed to get ID token after auth state change:', e);
          resolve(undefined);
        }
      } else {
        resolve(undefined);
      }
    });
  });
}

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
          // Dynamic import to avoid static dependency issues if needed, otherwise rely on imported api-client
          // api-client is safe (no firebase imports)
          // Dynamic import to avoid static dependency issues if needed, otherwise rely on imported api-client
          // api-client is safe (no firebase imports)
          const idToken = await getFirebaseIdToken();

          const googleEvents = await fetchCalendarEvents(
            dateRange.start,
            dateRange.end,
            config.selectedCalendarId || 'primary',
            idToken
          );

          // Convert Google Calendar API format to our format
          newEvents = googleEvents.map((event: any) => {
            const clientId = event.extendedProperties?.private?.pcaClientId;
            const category = event.extendedProperties?.private?.pcaCategory;
            // Check shared first (from work calendar sync), then private (from PCA app)
            const guestEmails = event.extendedProperties?.shared?.guest_emails || event.extendedProperties?.private?.guest_emails;
            const originalEventId = event.extendedProperties?.shared?.originalId || event.extendedProperties?.private?.originalId;

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
              // Work calendar sync metadata
              guestEmails: guestEmails,
              originalEventId: originalEventId,
              // Preserve full extendedProperties for client matching service
              extendedProperties: event.extendedProperties,
              // Extract metadata from extended properties
              preConfiguredClient: clientId,
              preConfiguredCategory: category,
              linkedWorkoutId: event.extendedProperties?.private?.pcaWorkoutId,
              // Mark as coaching session if it has a client ID (from our app)
              isCoachingSession: clientId ? true : undefined,
            };
          });
        } catch (googleError) {
          console.error('Failed to fetch from Google Calendar:', googleError);

          // Check if it's an authentication error (401)
          const errorMessage = googleError instanceof Error ? googleError.message : String(googleError);
          if (errorMessage.includes('401') ||
            errorMessage.includes('Failed to get valid access token') ||
            errorMessage.includes('Not authenticated')) {
            // Update connection status - tokens are invalid/expired
            set({ isGoogleCalendarConnected: false });
          }

          // Don't fallback to Firebase - Google Calendar is the only source of truth
          // Return empty array if Google Calendar fails
          // Don't update state if we already have events (prevents re-render loops)
          const { events: currentEvents } = get();
          if (currentEvents.length === 0) {
            set({ events: [], loading: false, error: 'Failed to fetch calendar events from Google Calendar' });
          } else {
            // Keep existing events, just stop loading
            set({ loading: false });
          }
          return;
        }
      } else {
        // Google Calendar not connected - return empty array
        console.warn('⚠️ Google Calendar is not connected. Calendar events will not be available.');
        set({ events: [], loading: false });
        return;
      }

      // Auto-detect coaching sessions and class sessions based on keywords
      const eventsWithDetection = newEvents.map(event => ({
        ...event,
        isCoachingSession: event.isCoachingSession ?? isCoachingEvent(event, config.coachingKeywords || []),
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

      // Only update state if events actually changed (prevent unnecessary re-renders)
      const { events: currentEvents } = get();
      const currentEventIds = new Set(currentEvents.map(e => e.id));
      const newEventIds = new Set(mergedEvents.map(e => e.id));
      const eventsChanged = currentEventIds.size !== newEventIds.size ||
        !Array.from(currentEventIds).every(id => newEventIds.has(id));

      if (eventsChanged) {
        set({ events: mergedEvents, loading: false, _eventsFetchTime: Date.now(), _eventsFetchKey: cacheKey });
      } else {
        // Events didn't change, just update loading state
        set({ loading: false, _eventsFetchTime: Date.now(), _eventsFetchKey: cacheKey });
      }
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
      const idToken = await getFirebaseIdToken();

      const { config, isGoogleCalendarConnected } = get();
      // Create start and end datetime strings
      const startDateTime = `${eventInput.date}T${eventInput.startTime}:00`;
      const endDateTime = `${eventInput.date}T${eventInput.endTime}:00`;

      // Parse client and category from description if present
      let clientId: string | null = null;
      let categoryName: string | null = null;
      let workoutId: string | null = null;

      if (eventInput.description) {
        const clientMatch = eventInput.description.match(/\[Metadata:.*client=([^,}]+)/);
        if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
          clientId = clientMatch[1].trim();
        }

        const categoryMatch = eventInput.description.match(/Workout Category:\s*([^\n]+)/);
        if (categoryMatch) {
          categoryName = categoryMatch[1].trim();
        }

        const workoutIdMatch = eventInput.description.match(/workoutId=([^,\s}]+)/);
        if (workoutIdMatch && workoutIdMatch[1] && workoutIdMatch[1] !== 'none') {
          workoutId = workoutIdMatch[1].trim();
        }
      }

      // FIRST: Create calendar event in Google Calendar API (primary source)
      let googleCalendarEvent: any = null;
      if (isGoogleCalendarConnected && config.selectedCalendarId) {
        try {
          const eventResponse = await createSingleCalendarEvent({
            summary: eventInput.summary,
            startDateTime: new Date(startDateTime).toISOString(),
            endDateTime: new Date(endDateTime).toISOString(),
            clientId: clientId || undefined,
            categoryName: categoryName || undefined,
            workoutId: workoutId || undefined,
            description: eventInput.description || undefined,
            location: eventInput.location || undefined,
            timeZone: 'America/Los_Angeles',
            calendarId: config.selectedCalendarId,
          }, idToken);
          googleCalendarEvent = eventResponse.event;
          console.log('✅ Created calendar event in Google Calendar:', googleCalendarEvent.id);
        } catch (googleError) {
          console.error('❌ Failed to create event in Google Calendar:', googleError);
          const status = (googleError as any)?.status;
          const message = googleError instanceof Error ? googleError.message : 'Unknown error';

          // If auth is broken, mark disconnected so UI can prompt a reconnect
          if (status === 401 || message.includes('valid access token') || message.includes('Not authenticated')) {
            set({ isGoogleCalendarConnected: false });
            throw new Error('Google Calendar connection expired. Please reconnect Google Calendar and try again.');
          }

          // Continue to create in Firebase as fallback, but warn the user
          throw new Error(`Failed to create event in Google Calendar: ${message}. Please check your Google Calendar connection.`);
        }
      } else {
        throw new Error('Google Calendar is not connected. Please connect Google Calendar to create events.');
      }

      // Convert Google Calendar event to our format
      const eventData: GoogleCalendarEvent = {
        id: googleCalendarEvent.id || '',
        summary: googleCalendarEvent.summary || eventInput.summary,
        description: googleCalendarEvent.description || eventInput.description || '',
        start: {
          dateTime: googleCalendarEvent.start?.dateTime || startDateTime,
          timeZone: googleCalendarEvent.start?.timeZone || 'America/Los_Angeles',
        },
        end: {
          dateTime: googleCalendarEvent.end?.dateTime || endDateTime,
          timeZone: googleCalendarEvent.end?.timeZone || 'America/Los_Angeles',
        },
        location: googleCalendarEvent.location || eventInput.location || '',
        htmlLink: googleCalendarEvent.htmlLink || '',
        creator: googleCalendarEvent.creator || {
          email: 'system@example.com',
          displayName: 'System',
        },
        isCoachingSession: eventInput.summary.toLowerCase().includes('personal training') ||
          eventInput.summary.toLowerCase().includes('training') ||
          eventInput.summary.toLowerCase().includes('workout') ||
          eventInput.summary.toLowerCase().includes('pt'),
        isClassSession: isClassEvent({ summary: eventInput.summary } as GoogleCalendarEvent, config.classKeywords || []),
        preConfiguredClient: clientId || googleCalendarEvent.extendedProperties?.private?.pcaClientId || undefined,
        preConfiguredCategory: categoryName || googleCalendarEvent.extendedProperties?.private?.pcaCategory || undefined,
        linkedWorkoutId: workoutId || googleCalendarEvent.extendedProperties?.private?.pcaWorkoutId || undefined,
      };

      const newEvent = eventData;

      // Auto-create workout if client is specified AND workoutId is not already in metadata
      // (If workoutId is present, the workout was already created and we just need to link)
      if (clientId) {
        // Check if workoutId is already in the description (meaning workout was created first)
        const workoutIdMatch = eventInput.description?.match(/workoutId=([^,\s}]+)/);
        const existingWorkoutId = workoutIdMatch && workoutIdMatch[1] && workoutIdMatch[1] !== 'none'
          ? workoutIdMatch[1].trim()
          : null;

        if (workoutId) {
          // Workout already exists, just update the Google Calendar event to link it
          newEvent.linkedWorkoutId = workoutId;
          console.log('✅ Calendar event linked to existing workout:', workoutId);
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

            // DYNAMIC IMPORT to avoid static Firebase dependency
            const { createClientWorkout } = await import('@/lib/firebase/services/clientWorkouts');
            const { Timestamp } = await import('firebase/firestore');

            // Create workout in Firebase
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

            // Update Google Calendar event to link to workout
            if (isGoogleCalendarConnected && config.selectedCalendarId && googleCalendarEvent?.id) {
              try {
                // Update the event description to include workout link
                await addWorkoutLinksToEvent(
                  googleCalendarEvent.id,
                  workout.id,
                  clientId!,
                  eventDate,
                  eventInput.description || '',
                  'single',
                  undefined,
                  config.selectedCalendarId,
                  idToken
                );
                console.log('✅ Updated Google Calendar event with workout link:', workout.id);
              } catch (updateError) {
                console.warn('⚠️ Could not update Google Calendar event with workout link:', updateError);
                // Don't fail - the workout is created, just the link update failed
              }
            }

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
        isCoachingSession: newEvent.isCoachingSession ?? isCoachingEvent(newEvent, config.coachingKeywords || []),
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
      const idToken = await getFirebaseIdToken();

      const { events, isGoogleCalendarConnected, config } = get();
      const existingEvent = events.find(e => e.id === eventId);

      if (!existingEvent) {
        throw new Error('Event not found');
      }

      // Update in Google Calendar API if connected
      if (isGoogleCalendarConnected) {
        try {
          const instanceDate = existingEvent.start.dateTime || new Date().toISOString();
          await updateCalendarEvent({
            eventId,
            instanceDate,
            updateType: 'single',
            updates: {
              // Note: isCoachingSession is not a Google Calendar field, it's our metadata
              // We store it in extendedProperties or description metadata
            },
            calendarId: config.selectedCalendarId || 'primary',
          }, idToken);
        } catch (googleError) {
          console.error('Failed to update Google Calendar event:', googleError);
          // Continue with local update
        }
      }

      // Update in local state (isCoachingSession is a local property)
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

  markAsClassSession: async (eventId: string, isClass: boolean) => {
    set({ loading: true, error: null });
    try {
      const idToken = await getFirebaseIdToken();

      const { events, isGoogleCalendarConnected, config } = get();
      const existingEvent = events.find(e => e.id === eventId);

      if (!existingEvent) {
        throw new Error('Event not found');
      }

      // Update in Google Calendar API if connected
      if (isGoogleCalendarConnected) {
        try {
          const instanceDate = existingEvent.start.dateTime || new Date().toISOString();
          await updateCalendarEvent({
            eventId,
            instanceDate,
            updateType: 'single',
            updates: {
              // Note: isClassSession is not a Google Calendar field, it's our metadata
              // We store it in extendedProperties or description metadata
            },
            calendarId: config.selectedCalendarId || 'primary',
          }, idToken);
        } catch (googleError) {
          console.error('Failed to update Google Calendar event:', googleError);
          // Continue with local update
        }
      }

      // Update in local state (isClassSession is a local property)
      const updatedEvents = events.map(event =>
        event.id === eventId ? { ...event, isClassSession: isClass } : event
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
      const idToken = await getFirebaseIdToken();

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
              config.selectedCalendarId || 'primary',
              idToken
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

      // Note: linkedWorkoutId is already updated in Google Calendar via addWorkoutLinksToEvent above
      // No need to update Firebase - Google Calendar is the source of truth

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
      const idToken = await getFirebaseIdToken();

      const { events, isGoogleCalendarConnected, config } = get();
      const existingEvent = events.find(e => e.id === eventId);

      if (!existingEvent) {
        throw new Error('Event not found');
      }

      // If connected to Google Calendar, update the event there first
      if (isGoogleCalendarConnected) {
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
          const instanceDate = existingEvent.start.dateTime || new Date().toISOString();

          await updateCalendarEvent({
            eventId,
            instanceDate,
            updateType: 'single',
            updates: googleUpdates,
            calendarId: config.selectedCalendarId || 'primary',
          }, idToken);
        } catch (googleError) {
          console.error('Failed to update Google Calendar event:', googleError);
          throw googleError; // Fail if Google Calendar update fails
        }
      } else {
        throw new Error('Google Calendar is not connected. Cannot update events.');
      }

      // Note: Event is already updated in Google Calendar above
      // No need to update Firebase - Google Calendar is the source of truth

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
      const idToken = await getFirebaseIdToken();

      const { events, isGoogleCalendarConnected, config } = get();
      const existingEvent = events.find(e => e.id === eventId);

      // Delete from Google Calendar API if connected
      if (isGoogleCalendarConnected && existingEvent) {
        try {
          const instanceDate = existingEvent.start.dateTime;
          await deleteCalendarEvent(
            eventId,
            instanceDate,
            config.selectedCalendarId || 'primary',
            idToken
          );
        } catch (googleError) {
          console.error('Failed to delete from Google Calendar:', googleError);
          throw googleError; // Fail if Google Calendar delete fails
        }
      } else if (!isGoogleCalendarConnected) {
        throw new Error('Google Calendar is not connected. Cannot delete events.');
      }

      // Remove from local state
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

  updateConfig: async (updates: Partial<CalendarSyncConfig>) => {
    const { config } = get();
    // Normalize location abbreviations to make matching robust across whitespace differences
    const nextLocationAbbreviations = updates.locationAbbreviations
      ? (() => {
        // Preserve original casing but normalize for deduplication
        const processed = updates.locationAbbreviations
          .map(a => {
            // Preserve original casing for display
            const originalDisplay = (a.original || '').trim().replace(/\s+/g, ' ');
            const normalizedKey = normalizeLocationKey(a.original);

            return {
              ...a,
              original: originalDisplay, // Keep original casing
              abbreviation: (a.abbreviation || '').trim() || originalDisplay,
              _normalizedKey: normalizedKey // For deduplication
            };
          })
          .filter(a => a.original.length > 0);

        // Deduplicate by normalized key (keep last one)
        const deduplicatedMap = new Map<string, typeof processed[0]>();
        for (const abbr of processed) {
          deduplicatedMap.set(abbr._normalizedKey, abbr);
        }
        // Remove the temporary _normalizedKey before returning
        return Array.from(deduplicatedMap.values()).map(({ _normalizedKey, ...abbr }) => abbr);
      })()
      : undefined;

    const newConfig = { ...config, ...updates, ...(nextLocationAbbreviations ? { locationAbbreviations: nextLocationAbbreviations } : {}) };
    set({ config: newConfig });

    // Save locally for fast startup, and persist to Firestore for cross-device reliability
    try {
      localStorage.setItem('calendar-config', JSON.stringify(newConfig));
    } catch (e) {
      console.warn('Failed to write calendar config to localStorage:', e);
    }

    // Fire-and-forget persistence; if it fails, surface an error but keep local changes.
    try {
      // Dynamic import to avoid static dependency
      // @ts-ignore
      const { updateCalendarSyncConfig } = await import('@/lib/firebase/services/calendarConfig');

      await updateCalendarSyncConfig({
        ...updates,
        ...(nextLocationAbbreviations ? { locationAbbreviations: nextLocationAbbreviations } : {}),
      });

      // Invalidate React Query caches so components using React Query see the new config
      // Calendar events need to be re-evaluated with new keywords/colors
      const queryClient = getGlobalQueryClient();
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
      }
    } catch (err) {
      console.error('Failed to save calendar setting to Firestore:', err);
      // set({ error: err instanceof Error ? err.message : 'Failed to save calendar settings' });
      // Don't set error state for background save failure to avoid disrupting UI
    }
  },

  clearAllTestEvents: async () => {
    set({ loading: true, error: null });
    try {
      const { events, isGoogleCalendarConnected, config } = get();

      if (!isGoogleCalendarConnected) {
        throw new Error('Google Calendar is not connected. Cannot delete events.');
      }

      // Delete all events from Google Calendar
      await Promise.all(events.map(event =>
        deleteCalendarEvent(
          event.id,
          event.start.dateTime,
          config.selectedCalendarId || 'primary'
        )
      ));
      set({ events: [], loading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to clear events',
        loading: false
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),

  checkGoogleCalendarConnection: async () => {
    try {
      console.log('[CalendarStore] Starting checkGoogleCalendarConnection...');

      // Use helper to get token with auth wait
      const idToken = await getFirebaseIdToken();
      console.log('[CalendarStore] ID Token retrieved:', !!idToken, idToken ? '(length: ' + idToken.length + ')' : '(undefined)');

      // First check if tokens exist
      console.log('[CalendarStore] Calling checkGoogleCalendarAuth...');
      const hasTokens = await checkGoogleCalendarAuth(idToken);
      console.log('[CalendarStore] checkGoogleCalendarAuth result:', hasTokens);

      if (!hasTokens) {
        console.warn('[CalendarStore] Connection check failed: No tokens found.');
        set({ isGoogleCalendarConnected: false });
        return;
      }

      // Then actually test the connection by trying to fetch events
      // (This verifies the tokens are valid and not revoked)
      try {
        const now = new Date();
        const start = new Date(now);
        const end = new Date(now);
        end.setDate(end.getDate() + 1); // 1 day range for quick check

        console.log('[CalendarStore] Tokens exist, attempting to fetch events to verify scopes...');
        await fetchCalendarEvents(start, end, 'primary', idToken);
        console.log('[CalendarStore] Event fetch successful. Connection verified.');
        set({ isGoogleCalendarConnected: true });
      } catch (error) {
        console.warn('[CalendarStore] Google Calendar token check failed (Event Fetch Error):', error);
        set({ isGoogleCalendarConnected: false });
      }
    } catch (error) {
      console.error('[CalendarStore] Error checking Google Calendar connection:', error);
      set({ isGoogleCalendarConnected: false });
    }
  },

  // Getters
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
    const key = normalizeLocationKey(location);
    const abbreviations = config.locationAbbreviations || [];
    const abbr = abbreviations.find(a => normalizeLocationKey(a.original) === key);
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

// Load config from localStorage on initialization
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

  // Load config from Firestore (source of truth) and migrate any legacy shapes (e.g., "N/A" markers).
  try {
    // Dynamic import to avoid static dependency
    import('@/lib/firebase/services/calendarConfig').then(({ getCalendarSyncConfig }) => {
      void getCalendarSyncConfig(defaultConfig).then(remoteConfig => {
        // Keep any local-only keys, but prefer Firestore values.
        const current = useCalendarStore.getState().config;
        const merged = { ...defaultConfig, ...current, ...remoteConfig };
        useCalendarStore.setState({ config: merged });
        try {
          localStorage.setItem('calendar-config', JSON.stringify(merged));
        } catch (e) {
          console.warn('Failed to cache calendar config to localStorage:', e);
        }
      }).catch(error => {
        console.error('Failed to load calendar config from Firestore:', error);
      });
    }).catch(err => {
      console.warn('Could not load calendar config service (likely SSR safe error):', err);
    });
  } catch (error) {
    console.error('Failed to start Firestore calendar config load:', error);
  }

  // Removed automatic checkGoogleCalendarAuth() call here.
  // It is better to let components (like Dashboard or Configure) call it when they are ready and auth is loaded.
}
