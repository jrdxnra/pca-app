import { Timestamp } from 'firebase/firestore';
import { getDb } from '../config';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { fetchCalendarEvents as fetchGoogleCalendarEvents, checkGoogleCalendarAuth } from '@/lib/google-calendar/api-client';
import { getCalendarSyncConfig } from './calendarConfig';

/**
 * Calendar Events Service
 * 
 * NOTE: This file now only provides getCalendarEventsByDateRange which reads from Google Calendar API.
 * All calendar events are stored in Google Calendar - Firebase calendarEvents collection is deprecated.
 * 
 * Removed functions (no longer used):
 * - createCalendarEvent (use Google Calendar API instead)
 * - updateCalendarEvent (use Google Calendar API instead)
 * - deleteCalendarEvent (use Google Calendar API instead)
 * - subscribeToCalendarEvents (not used)
 */

/**
 * Get calendar events for a date range
 * 
 * Reads ONLY from Google Calendar API (single source of truth).
 * Returns empty array if Google Calendar is not connected.
 */
export async function getCalendarEventsByDateRange(
  startDate: Date,
  endDate: Date
): Promise<GoogleCalendarEvent[]> {
  // ONLY use Google Calendar API - no Firebase fallback
  // This ensures all calendar events come from Google Calendar as the single source of truth
  
  try {
    console.log('[getCalendarEventsByDateRange] Fetching events for:', { start: startDate.toISOString(), end: endDate.toISOString() });
    
    const isGoogleCalendarConnected = await checkGoogleCalendarAuth();
    console.log('[getCalendarEventsByDateRange] Google Calendar connected:', isGoogleCalendarConnected);
    
    if (!isGoogleCalendarConnected) {
      console.warn('⚠️ Google Calendar is not connected. Calendar events will not be available.');
      console.warn('💡 To fix: Go to Configure → App Config → Connect Google Calendar');
      return [];
    }

    // Get calendar config to know which calendar to use
    const config = await getCalendarSyncConfig({
      selectedCalendarId: 'primary',
      coachingKeywords: [],
      classKeywords: [],
    });
    
    const calendarId = config.selectedCalendarId || 'primary';
    console.log('[getCalendarEventsByDateRange] Using calendar ID:', calendarId);
    
    // Fetch from Google Calendar API (ONLY source)
    const googleEvents = await fetchGoogleCalendarEvents(
      startDate,
      endDate,
      calendarId
    );
    console.log('[getCalendarEventsByDateRange] Fetched events from Google:', googleEvents.length);
    
    // Helper functions to detect event types based on keywords
    const isCoachingEvent = (event: any, keywords: string[]): boolean => {
      const title = event.summary?.toLowerCase() || '';
      return keywords.some(keyword => title.includes(keyword.toLowerCase()));
    };
    
    const isClassEvent = (event: any, keywords: string[]): boolean => {
      const title = event.summary?.toLowerCase() || '';
      return keywords.some(keyword => title.includes(keyword.toLowerCase()));
    };
    
    // Convert Google Calendar API format to our format
    const events: GoogleCalendarEvent[] = googleEvents.map((event: any) => {
      // Check shared first (from work calendar sync), then private (from PCA app)
      const clientId = event.extendedProperties?.private?.pcaClientId;
      const category = event.extendedProperties?.private?.pcaCategory;
      const workoutId = event.extendedProperties?.private?.pcaWorkoutId;
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
        attendees: event.attendees,
        // Work calendar sync metadata
        guestEmails: guestEmails,
        originalEventId: originalEventId,
        // Extract metadata from extended properties
        preConfiguredClient: clientId,
        preConfiguredCategory: category,
        linkedWorkoutId: workoutId,
        // Mark as coaching session if it has a client ID (from our app) OR matches coaching keywords
        isCoachingSession: clientId ? true : isCoachingEvent(event, config.coachingKeywords || []),
        // Mark as class session if it matches class keywords
        isClassSession: isClassEvent(event, config.classKeywords || []),
      };
    });
    
    console.log('[getCalendarEventsByDateRange] Returning events:', events.length);
    return events;
  } catch (error) {
    console.error('❌ Error fetching calendar events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', {
      message: errorMessage,
      error: error
    });
    
    // Check if it's an authentication error
    if (errorMessage.includes('Authentication') || errorMessage.includes('401') || errorMessage.includes('Not authenticated')) {
      console.warn('💡 Google Calendar authentication failed. Please reconnect: Configure → App Config → Connect Google Calendar');
    } else if (errorMessage.includes('Permission') || errorMessage.includes('403')) {
      console.warn('💡 Google Calendar permission denied. Please reconnect with proper permissions: Configure → App Config → Connect Google Calendar');
    }
    
    // Return empty array instead of throwing to prevent React Query retry loops
    // The error is already logged, and returning empty array allows the UI to render
    // Users will see no events, which is better than an infinite loading state
    return [];
  }
}



































