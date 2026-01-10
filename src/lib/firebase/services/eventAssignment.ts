import { Timestamp } from 'firebase/firestore';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientProgram, ClientProgramPeriod } from '@/lib/types';
import { updateCalendarEvent as updateFirestoreCalendarEvent } from './calendarEvents';
import { createClientWorkout, deleteClientWorkout } from './clientWorkouts';
import { safeToDate, isDateInRange } from '@/lib/utils/dateHelpers';
import { getEventCategory, hasLinkedWorkout, getLinkedWorkoutId } from '@/lib/utils/event-patterns';
import { updateCalendarEvent as updateGoogleCalendarEvent, checkGoogleCalendarAuth } from '@/lib/google-calendar/api-client';

export interface AssignmentResult {
  eventId: string;
  workoutId?: string;
  success: boolean;
  error?: string;
}

export interface BulkAssignmentResult {
  successful: number;
  failed: number;
  total: number;
  results: AssignmentResult[];
}

/**
 * Check if an event is from Google Calendar (vs locally created in Firestore)
 * Google Calendar event IDs are typically alphanumeric strings like "3vr8ddfjchsh4dshr21to5l36b"
 * Firestore event IDs are typically longer random strings
 */
function isGoogleCalendarEvent(event: GoogleCalendarEvent): boolean {
  // If event has htmlLink to Google Calendar, it's from Google Calendar
  if (event.htmlLink && event.htmlLink.includes('google.com/calendar')) {
    return true;
  }
  // Google Calendar IDs are typically 26 character base32 strings
  // Firestore IDs are typically 20 character alphanumeric strings
  // This is a heuristic - the htmlLink check above is more reliable
  return false;
}

/**
 * Find the period for a specific date for a client
 */
function findPeriodForDate(
  date: Date,
  clientId: string,
  clientPrograms: ClientProgram[]
): ClientProgramPeriod | null {
  const clientProgram = clientPrograms.find(
    cp => cp.clientId === clientId && cp.status === 'active'
  );
  
  if (!clientProgram) return null;
  
  return clientProgram.periods.find(period => {
    const start = safeToDate(period.startDate);
    const end = safeToDate(period.endDate);
    return isDateInRange(date, start, end);
  }) || null;
}

/**
 * Build the updated description with client metadata
 */
function buildUpdatedDescription(
  event: GoogleCalendarEvent,
  clientId: string,
  workoutId?: string,
  periodId?: string,
  categoryName?: string
): string {
  const existingDescription = event.description || '';
  
  // Check if description already has metadata
  const hasMetadata = existingDescription.includes('[Metadata:');
  
  if (hasMetadata) {
    // Update existing metadata
    let updated = existingDescription;
    
    // Update or add client
    if (updated.match(/client=[^,}\]]+/)) {
      updated = updated.replace(/client=[^,}\]]+/, `client=${clientId}`);
    } else {
      updated = updated.replace(/\[Metadata:/, `[Metadata: client=${clientId},`);
    }
    
    // Update or add workoutId
    if (workoutId) {
      if (updated.match(/workoutId=[^,}\]]+/)) {
        updated = updated.replace(/workoutId=[^,}\]]+/, `workoutId=${workoutId}`);
      } else {
        updated = updated.replace(/\]$/, `, workoutId=${workoutId}]`);
      }
    }
    
    // Update or add periodId
    if (periodId) {
      if (updated.match(/periodId=[^,}\]]+/)) {
        updated = updated.replace(/periodId=[^,}\]]+/, `periodId=${periodId}`);
      } else {
        updated = updated.replace(/\]$/, `, periodId=${periodId}]`);
      }
    }
    
    return updated;
  } else {
    // Add new metadata
    const category = categoryName || getEventCategory(event) || 'General';
    const metadataParts = [`client=${clientId}`];
    if (categoryName) metadataParts.push(`category=${categoryName}`);
    if (workoutId) metadataParts.push(`workoutId=${workoutId}`);
    if (periodId) metadataParts.push(`periodId=${periodId}`);
    
    const metadata = `[Metadata: ${metadataParts.join(', ')}]`;
    
    // Add category line if not present
    let newDescription = existingDescription;
    if (!newDescription.includes('Workout Category:')) {
      newDescription = `Workout Category: ${category}\n${newDescription}`;
    }
    newDescription = newDescription.trim() + '\n' + metadata;
    
    return newDescription;
  }
}

/**
 * Assign a client to a single event and create a workout
 */
export async function assignClientToEvent(
  event: GoogleCalendarEvent,
  clientId: string,
  clientPrograms: ClientProgram[],
  clientName?: string,
  selectedCategory?: string
): Promise<AssignmentResult> {
  try {
    // Skip if event already has a linked workout
    if (hasLinkedWorkout(event)) {
      return {
        eventId: event.id,
        success: false,
        error: 'Event already has a linked workout'
      };
    }
    
    // Get event date and time
    const eventDate = new Date(event.start.dateTime);
    const hours = eventDate.getHours();
    const minutes = eventDate.getMinutes();
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    // Find period for this date
    const period = findPeriodForDate(eventDate, clientId, clientPrograms);
    const periodId = period?.id || 'quick-workouts';
    
    // Get category - use selected category first, then event category, then default
    const categoryName = selectedCategory || getEventCategory(event) || 'General';
    
    // Create workout
    const workout = await createClientWorkout({
      clientId,
      periodId,
      date: Timestamp.fromDate(eventDate),
      dayOfWeek: eventDate.getDay(),
      categoryName,
      time: timeStr,
      title: event.summary || `Session with ${clientName || 'Client'}`,
      rounds: [],
      warmups: [],
      isModified: false,
      createdBy: 'system'
    });
    
    // Build updated description with metadata
    const updatedDescription = buildUpdatedDescription(
      event,
      clientId,
      workout.id,
      periodId,
      categoryName
    );
    
    // Check if this is a Google Calendar event and if Google Calendar is connected
    const isGoogleEvent = isGoogleCalendarEvent(event);
    const isGoogleConnected = await checkGoogleCalendarAuth();
    
    if (isGoogleEvent && isGoogleConnected) {
      // Update via Google Calendar API
      try {
        await updateGoogleCalendarEvent({
          eventId: event.id,
          instanceDate: event.start.dateTime, // Required for single instance updates
          updateType: 'single',
          updates: {
            description: updatedDescription
          },
          calendarId: 'primary'
        });
        console.log(`✅ Updated Google Calendar event ${event.id} with client assignment`);
      } catch (googleError) {
        console.error(`Failed to update Google Calendar event ${event.id}:`, googleError);
        // Don't fail the whole operation - workout was created successfully
        // The metadata will be in the workout, just not synced to Google Calendar
      }
    } else {
      // Update via Firestore
      try {
        await updateFirestoreCalendarEvent(event.id, {
          description: updatedDescription,
          preConfiguredClient: clientId,
          preConfiguredCategory: categoryName,
          linkedWorkoutId: workout.id
        });
      } catch (firestoreError) {
        console.error(`Failed to update Firestore event ${event.id}:`, firestoreError);
        // Don't fail - workout was created, which is the important part
      }
    }
    
    return {
      eventId: event.id,
      workoutId: workout.id,
      success: true
    };
  } catch (error) {
    console.error(`Error assigning client to event ${event.id}:`, error);
    return {
      eventId: event.id,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Assign a client to multiple events and create workouts for each
 * Uses Promise.all for parallel processing
 */
export async function assignClientToEvents(
  events: GoogleCalendarEvent[],
  clientId: string,
  clientPrograms: ClientProgram[],
  clientName?: string,
  selectedCategory?: string
): Promise<BulkAssignmentResult> {
  const results = await Promise.all(
    events.map(event => assignClientToEvent(event, clientId, clientPrograms, clientName, selectedCategory))
  );
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  return {
    successful,
    failed,
    total: events.length,
    results
  };
}

/**
 * Remove client assignment metadata from event description
 */
function removeAssignmentFromDescription(description: string): string {
  let cleaned = description;
  
  // Remove the [Metadata: ...] block entirely
  cleaned = cleaned.replace(/\n?\[Metadata:[^\]]*\]/g, '');
  
  // Remove "Workout Category: ..." line if it was added by us
  cleaned = cleaned.replace(/^Workout Category:[^\n]*\n?/gm, '');
  
  // Clean up extra whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Unassign a client from a calendar event
 * Removes the metadata and deletes the associated workout
 */
export async function unassignClientFromEvent(
  event: GoogleCalendarEvent,
  shouldDeleteWorkout: boolean = true
): Promise<{ success: boolean; error?: string }> {
  console.log('🔄 [unassignClientFromEvent] Starting unassign for event:', event.id, event.summary);
  
  try {
    // Get the linked workout ID before we clear the metadata
    const linkedWorkoutId = getLinkedWorkoutId(event);
    console.log('🔄 [unassignClientFromEvent] Linked workout ID:', linkedWorkoutId);
    
    // Build cleaned description without metadata
    const cleanedDescription = removeAssignmentFromDescription(event.description || '');
    console.log('🔄 [unassignClientFromEvent] Original description:', event.description?.substring(0, 200));
    console.log('🔄 [unassignClientFromEvent] Cleaned description:', cleanedDescription?.substring(0, 200));
    
    // Check if this is a Google Calendar event
    const isGoogleEvent = isGoogleCalendarEvent(event);
    console.log('🔄 [unassignClientFromEvent] Is Google Calendar event:', isGoogleEvent);
    
    if (isGoogleEvent) {
      // Check if Google Calendar is connected
      const isAuthenticated = await checkGoogleCalendarAuth();
      
      console.log('🔄 [unassignClientFromEvent] Is authenticated:', isAuthenticated);
      
      if (isAuthenticated) {
        // Update Google Calendar event - clear description and extended properties
        console.log('🔄 [unassignClientFromEvent] Calling Google Calendar API to update event...');
        const requestBody = {
          eventId: event.id,
          instanceDate: event.start.dateTime,
          updateType: 'single',
          updates: {
            description: cleanedDescription || ' ',
          },
          clearExtendedProperties: true,
          calendarId: 'primary',
        };
        console.log('🔄 [unassignClientFromEvent] Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch('/api/calendar/events/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        });
        
        const responseData = await response.json();
        console.log('🔄 [unassignClientFromEvent] API response:', response.status, responseData);
        
        if (!response.ok) {
          throw new Error(responseData.error || 'Failed to update Google Calendar event');
        }
        
        console.log('✅ [unassignClientFromEvent] Removed client assignment from Google Calendar event');
      } else {
        console.warn('⚠️ [unassignClientFromEvent] Google Calendar not connected, updating Firestore only');
      }
    }
    
    // Update Firestore calendar event (if it exists - Google Calendar events may not have Firestore records)
    try {
      await updateFirestoreCalendarEvent(event.id, {
        description: cleanedDescription,
        linkedWorkoutId: undefined,
        preConfiguredClient: undefined,
        preConfiguredCategory: undefined,
      });
      console.log('✅ Cleared Firestore calendar event metadata');
    } catch (firestoreError) {
      // Firestore document may not exist for pure Google Calendar events - that's OK
      console.log('Firestore event not found (Google Calendar event), skipping Firestore update');
    }
    
    // Delete the associated client workout if it exists
    if (shouldDeleteWorkout && linkedWorkoutId) {
      try {
        console.log('🔄 [unassignClientFromEvent] Deleting client workout:', linkedWorkoutId);
        await deleteClientWorkout(linkedWorkoutId);
        console.log('✅ [unassignClientFromEvent] Deleted associated client workout:', linkedWorkoutId);
      } catch (workoutError) {
        // Workout might not exist or already deleted
        console.log('⚠️ [unassignClientFromEvent] Could not delete workout (may not exist):', linkedWorkoutId, workoutError);
      }
    } else {
      console.log('🔄 [unassignClientFromEvent] No workout to delete (shouldDeleteWorkout:', shouldDeleteWorkout, ', linkedWorkoutId:', linkedWorkoutId, ')');
    }
    
    console.log('✅ [unassignClientFromEvent] Unassign completed successfully');
    return { success: true };
  } catch (error) {
    console.error('Failed to unassign client from event:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to unassign client'
    };
  }
}

























