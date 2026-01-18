import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { format, addMinutes, parse } from 'date-fns';
import { weekTemplateToRRULE } from './rrule-utils';

export interface RecurringEventParams {
  summary: string;
  startDate: Date;
  endDate: Date;
  recurrence: string[]; // RRULE strings
  startTime: string; // HH:mm format
  duration: number; // minutes
  clientId: string;
  periodId: string;
  categoryName: string;
  description?: string;
  location?: string;
}

export interface SingleEventParams {
  summary: string;
  startDateTime: Date; // Full datetime
  endDateTime: Date; // Full datetime
  clientId?: string;
  periodId?: string;
  categoryName?: string;
  workoutId?: string;
  description?: string;
  location?: string;
  timeZone?: string;
}

export interface EventUpdateParams {
  summary?: string;
  description?: string;
  start?: { dateTime: string; timeZone: string };
  end?: { dateTime: string; timeZone: string };
  location?: string;
}

/**
 * Create a single (non-recurring) calendar event using Google Calendar API
 */
export async function createSingleEvent(
  oauth2Client: OAuth2Client,
  calendarId: string,
  params: SingleEventParams
): Promise<calendar_v3.Schema$Event> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const timeZone = params.timeZone || 'America/Los_Angeles';

  const event: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description || '',
    start: {
      dateTime: params.startDateTime.toISOString(),
      timeZone: timeZone,
    },
    end: {
      dateTime: params.endDateTime.toISOString(),
      timeZone: timeZone,
    },
    location: params.location,
    extendedProperties: {
      private: {
        ...(params.clientId && { pcaClientId: params.clientId }),
        ...(params.periodId && { pcaPeriodId: params.periodId }),
        ...(params.categoryName && { pcaCategory: params.categoryName }),
        ...(params.workoutId && { pcaWorkoutId: params.workoutId }),
      },
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    if (!response.data) {
      throw new Error('Failed to create event - no data returned');
    }

    return response.data;
  } catch (error: any) {
    console.error('Google Calendar API error:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    if (error.code === 401 || error.response?.status === 401) {
      throw new Error('Authentication failed. Please disconnect and reconnect Google Calendar.');
    } else if (error.code === 403 || error.response?.status === 403) {
      const errorDetails = error.errors?.[0]?.message || error.message || 'Unknown permission error';
      throw new Error(`Permission denied: ${errorDetails}. Please disconnect and reconnect Google Calendar to grant write permissions.`);
    } else if (error.message) {
      throw new Error(`Google Calendar API error: ${error.message}`);
    } else {
      throw new Error('Failed to create event. Please check the console for details.');
    }
  }
}

/**
 * Create a recurring calendar event using Google Calendar API
 */
export async function createRecurringEvent(
  oauth2Client: OAuth2Client,
  calendarId: string,
  params: RecurringEventParams
): Promise<calendar_v3.Schema$Event> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Parse start time
  const [hours, minutes] = params.startTime.split(':').map(Number);
  const startDateTime = new Date(params.startDate);
  startDateTime.setHours(hours, minutes, 0, 0);

  const endDateTime = addMinutes(startDateTime, params.duration);

  const event: calendar_v3.Schema$Event = {
    summary: params.summary,
    description: params.description || '',
    start: {
      dateTime: startDateTime.toISOString(),
      timeZone: 'America/Los_Angeles', // TODO: Make configurable
    },
    end: {
      dateTime: endDateTime.toISOString(),
      timeZone: 'America/Los_Angeles',
    },
    recurrence: params.recurrence,
    location: params.location,
    extendedProperties: {
      private: {
        pcaClientId: params.clientId,
        pcaPeriodId: params.periodId,
        pcaCategory: params.categoryName,
      },
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: event,
    });

    if (!response.data) {
      throw new Error('Failed to create recurring event - no data returned');
    }

    return response.data;
  } catch (error: any) {
    // Log the full error from Google API
    console.error('Google Calendar API error:', {
      message: error.message,
      code: error.code,
      errors: error.errors,
      response: error.response?.data,
      status: error.response?.status,
    });
    
    // Provide a more helpful error message
    if (error.code === 401 || error.response?.status === 401) {
      throw new Error('Authentication failed. Please disconnect and reconnect Google Calendar.');
    } else if (error.code === 403 || error.response?.status === 403) {
      const errorDetails = error.errors?.[0]?.message || error.message || 'Unknown permission error';
      throw new Error(`Permission denied: ${errorDetails}. Please disconnect and reconnect Google Calendar to grant write permissions.`);
    } else if (error.message) {
      throw new Error(`Google Calendar API error: ${error.message}`);
    } else {
      throw new Error('Failed to create recurring event. Please check the console for details.');
    }
  }
}

/**
 * Update a single instance of a recurring event
 * This creates an exception to the recurring series
 */
export async function updateSingleInstance(
  oauth2Client: OAuth2Client,
  calendarId: string,
  recurringEventId: string,
  instanceDate: Date,
  updates: EventUpdateParams
): Promise<calendar_v3.Schema$Event> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Find the specific instance
  const startOfDay = new Date(instanceDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(instanceDate);
  endOfDay.setHours(23, 59, 59, 999);

  const instances = await calendar.events.instances({
    calendarId,
    eventId: recurringEventId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
  });

  const instance = instances.data.items?.[0];
  if (!instance || !instance.id) {
    throw new Error('Instance not found for the specified date');
  }

  // Update the instance (this automatically creates an exception)
  const response = await calendar.events.patch({
    calendarId,
    eventId: instance.id,
    requestBody: updates,
  });

  if (!response.data) {
    throw new Error('Failed to update event instance');
  }

  return response.data;
}

/**
 * Update all occurrences of a recurring event
 */
export async function updateAllOccurrences(
  oauth2Client: OAuth2Client,
  calendarId: string,
  recurringEventId: string,
  updates: EventUpdateParams
): Promise<calendar_v3.Schema$Event> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Get the parent recurring event
  const parentEvent = await calendar.events.get({
    calendarId,
    eventId: recurringEventId,
  });

  if (!parentEvent.data) {
    throw new Error('Recurring event not found');
  }

  // Merge updates with existing event data
  const updatedEvent: calendar_v3.Schema$Event = {
    ...parentEvent.data,
    ...updates,
  };

  const response = await calendar.events.update({
    calendarId,
    eventId: recurringEventId,
    requestBody: updatedEvent,
  });

  if (!response.data) {
    throw new Error('Failed to update recurring event');
  }

  return response.data;
}

/**
 * Update this occurrence and all following occurrences
 * This splits the recurring series into two: one ending before the split date,
 * and a new series starting from the split date
 */
export async function updateThisAndFollowing(
  oauth2Client: OAuth2Client,
  calendarId: string,
  recurringEventId: string,
  fromDate: Date,
  updates: EventUpdateParams
): Promise<{
  updatedSeries: calendar_v3.Schema$Event;
  newSeries: calendar_v3.Schema$Event;
}> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Get the parent recurring event
  const parentEvent = await calendar.events.get({
    calendarId,
    eventId: recurringEventId,
  });

  if (!parentEvent.data || !parentEvent.data.recurrence) {
    throw new Error('Recurring event not found or has no recurrence rules');
  }

  // Parse existing RRULE to get the pattern
  const existingRRULE = parentEvent.data.recurrence.find(r => r.startsWith('RRULE:'));
  if (!existingRRULE) {
    throw new Error('No RRULE found in recurring event');
  }

  // Calculate the day before the split date for the UNTIL clause
  const dayBeforeSplit = new Date(fromDate);
  dayBeforeSplit.setDate(dayBeforeSplit.getDate() - 1);
  const untilDate = format(dayBeforeSplit, 'yyyyMMdd');

  // Update the original series to end before the split date
  const updatedRRULE = existingRRULE.replace(/UNTIL=\d{8}/, `UNTIL=${untilDate}`);
  const updatedRecurrence = parentEvent.data.recurrence.map(r => 
    r.startsWith('RRULE:') ? updatedRRULE : r
  );

  const updatedSeries = await calendar.events.update({
    calendarId,
    eventId: recurringEventId,
    requestBody: {
      ...parentEvent.data,
      recurrence: updatedRecurrence,
    },
  });

  if (!updatedSeries.data) {
    throw new Error('Failed to update original series');
  }

  // Create a new recurring series starting from the split date
  const newSeriesStart = new Date(fromDate);
  const originalStart = parentEvent.data.start?.dateTime 
    ? parse(parentEvent.data.start.dateTime, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date())
    : new Date();

  newSeriesStart.setHours(originalStart.getHours(), originalStart.getMinutes(), 0, 0);

  const originalEnd = parentEvent.data.end?.dateTime
    ? parse(parentEvent.data.end.dateTime, "yyyy-MM-dd'T'HH:mm:ssXXX", new Date())
    : addMinutes(originalStart, 60);

  const newSeriesEnd = addMinutes(newSeriesStart, 
    (originalEnd.getTime() - originalStart.getTime()) / 1000 / 60
  );

  // Extract the original UNTIL date from the original RRULE
  const originalUntilMatch = existingRRULE.match(/UNTIL=(\d{8})/);
  const originalUntil = originalUntilMatch ? originalUntilMatch[1] : null;

  // Create new RRULE with original pattern but new start date
  const newRRULE = existingRRULE.replace(/UNTIL=\d{8}/, originalUntil ? `UNTIL=${originalUntil}` : '');

  const newSeries = await calendar.events.insert({
    calendarId,
    requestBody: {
      summary: parentEvent.data.summary,
      description: parentEvent.data.description || '',
      start: {
        dateTime: newSeriesStart.toISOString(),
        timeZone: parentEvent.data.start?.timeZone || 'America/Los_Angeles',
      },
      end: {
        dateTime: newSeriesEnd.toISOString(),
        timeZone: parentEvent.data.end?.timeZone || 'America/Los_Angeles',
      },
      recurrence: [newRRULE],
      location: parentEvent.data.location,
      extendedProperties: parentEvent.data.extendedProperties,
      ...updates, // Apply the updates to the new series
    },
  });

  if (!newSeries.data) {
    throw new Error('Failed to create new recurring series');
  }

  return {
    updatedSeries: updatedSeries.data,
    newSeries: newSeries.data,
  };
}

/**
 * Delete a recurring event (all occurrences)
 */
export async function deleteRecurringEvent(
  oauth2Client: OAuth2Client,
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  await calendar.events.delete({
    calendarId,
    eventId,
  });
}

/**
 * Delete a single instance of a recurring event
 */
export async function deleteSingleInstance(
  oauth2Client: OAuth2Client,
  calendarId: string,
  recurringEventId: string,
  instanceDate: Date
): Promise<void> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  // Find the specific instance
  const startOfDay = new Date(instanceDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(instanceDate);
  endOfDay.setHours(23, 59, 59, 999);

  const instances = await calendar.events.instances({
    calendarId,
    eventId: recurringEventId,
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
  });

  const instance = instances.data.items?.[0];
  if (!instance || !instance.id) {
    throw new Error('Instance not found for the specified date');
  }

  await calendar.events.delete({
    calendarId,
    eventId: instance.id,
  });
}

/**
 * List calendars available to the user
 */
export async function listCalendars(
  oauth2Client: OAuth2Client
): Promise<calendar_v3.Schema$CalendarListEntry[]> {
  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

/**
 * Get events for a date range
 */
export async function getEvents(
  oauth2Client: OAuth2Client,
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<calendar_v3.Schema$Event[]> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const response = await calendar.events.list({
      calendarId,
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      singleEvents: true, // Expand recurring events into individual instances
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error: any) {
    console.error('Google Calendar API error in getEvents:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
    });
    
    // Provide more specific error messages
    if (error.code === 401 || error.response?.status === 401) {
      throw new Error('Authentication failed. Please disconnect and reconnect Google Calendar.');
    }
    if (error.code === 403 || error.response?.status === 403) {
      const errorDetails = error.response?.data?.error?.message || error.message;
      throw new Error(`Permission denied: ${errorDetails}. Please disconnect and reconnect Google Calendar to grant write permissions.`);
    }
    throw new Error(`Google Calendar API error: ${error.message}`);
  }
}


