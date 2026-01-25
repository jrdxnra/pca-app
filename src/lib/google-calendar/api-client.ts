/**
 * Client-side API wrapper for Google Calendar operations
 * This makes it easy to call the Next.js API routes from React components
 */

export interface CreateRecurringEventParams {
  summary: string;
  startDate: string; // ISO date string
  endDate: string; // ISO date string
  startTime: string; // HH:mm format
  duration?: number; // minutes, default 60
  clientId: string;
  periodId: string;
  categoryName: string;
  weekTemplateId?: string;
  weekTemplate?: any; // WeekTemplate type
  calendarId?: string;
  description?: string;
  location?: string;
}

export interface CreateSingleEventParams {
  summary: string;
  startDateTime: string; // ISO date string
  endDateTime: string; // ISO date string
  clientId?: string;
  periodId?: string;
  categoryName?: string;
  workoutId?: string;
  description?: string;
  location?: string;
  timeZone?: string;
  calendarId?: string;
}

export interface UpdateEventParams {
  eventId: string;
  instanceDate?: string; // ISO date string - if provided, updates single instance
  updateType?: 'single' | 'all' | 'thisAndFollowing';
  updates: {
    summary?: string;
    description?: string;
    startTime?: string;
    endTime?: string;
    location?: string;
  };
  calendarId?: string;
}

/**
 * Initiate Google OAuth flow
 */
export async function initiateGoogleAuth(): Promise<void> {
  window.location.href = '/api/auth/google';
}

/**
 * Create a single (non-recurring) calendar event
 */
export async function createSingleCalendarEvent(
  params: CreateSingleEventParams
): Promise<any> {
  const response = await fetch('/api/calendar/events/single', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let error: any = {};
    try {
      error = await response.json();
    } catch {
      // ignore parse errors
    }
    const err = new Error(error.error || 'Failed to create calendar event');
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Create a recurring calendar event
 */
export async function createRecurringCalendarEvent(
  params: CreateRecurringEventParams
): Promise<any> {
  const response = await fetch('/api/calendar/events', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let error: any = {};
    try {
      error = await response.json();
    } catch {
      // ignore parse errors
    }
    const err = new Error(error.error || 'Failed to create calendar event');
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Fetch calendar events for a date range
 */
export async function fetchCalendarEvents(
  timeMin: Date,
  timeMax: Date,
  calendarId: string = 'primary'
): Promise<any[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    calendarId,
  });

  const response = await fetch(`/api/calendar/events?${params.toString()}`);

  if (!response.ok) {
    let error: any = {};
    try {
      error = await response.json();
    } catch {
      // ignore parse errors
    }
    const err = new Error(error.error || 'Failed to fetch calendar events');
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.events || [];
}

/**
 * Update a calendar event
 */
export async function updateCalendarEvent(
  params: UpdateEventParams
): Promise<any> {
  const response = await fetch('/api/calendar/events/update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let error: any = {};
    try {
      error = await response.json();
    } catch {
      // ignore parse errors
    }
    const err = new Error(error.error || 'Failed to update calendar event');
    (err as any).status = response.status;
    throw err;
  }

  return response.json();
}

/**
 * Delete a calendar event
 */
export async function deleteCalendarEvent(
  eventId: string,
  instanceDate?: string,
  calendarId: string = 'primary'
): Promise<void> {
  const params = new URLSearchParams({
    eventId,
    calendarId,
  });

  if (instanceDate) {
    params.append('instanceDate', instanceDate);
  }

  const response = await fetch(`/api/calendar/events?${params.toString()}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    let error: any = {};
    try {
      error = await response.json();
    } catch {
      // ignore parse errors
    }
    const err = new Error(error.error || 'Failed to delete calendar event');
    (err as any).status = response.status;
    throw err;
  }
}

/**
 * Check if user is authenticated with Google Calendar
 */
export async function checkGoogleCalendarAuth(): Promise<boolean> {
  try {
    const response = await fetch('/api/calendar/auth/status');
    if (!response.ok) return false;
    const data = await response.json();
    return data.authenticated === true;
  } catch {
    return false;
  }
}

/**
 * Disconnect Google Calendar
 */
export async function disconnectGoogleCalendar(): Promise<void> {
  const response = await fetch('/api/calendar/disconnect', {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to disconnect Google Calendar');
  }
}

/**
 * Add workout links to a calendar event description
 */
export async function addWorkoutLinksToEvent(
  eventId: string,
  workoutId: string,
  clientId: string,
  eventDate: string | Date,
  existingDescription?: string,
  updateType: 'single' | 'all' = 'single',
  instanceDate?: string,
  calendarId: string = 'primary'
): Promise<any> {
  console.log('[addWorkoutLinksToEvent] Called with:', {
    eventId,
    workoutId,
    clientId,
    eventDate,
    updateType,
    instanceDate,
    calendarId,
    existingDescriptionLength: existingDescription?.length
  });
  
  // Import the utility function
  const { addWorkoutLinksToDescription } = await import('./workout-links');
  
  // Generate updated description with workout links
  const updatedDescription = addWorkoutLinksToDescription(
    existingDescription || '',
    workoutId,
    clientId,
    eventDate
  );
  
  console.log('[addWorkoutLinksToEvent] Updated description:', updatedDescription);

  // Update the event via API
  const result = await updateCalendarEvent({
    eventId,
    instanceDate,
    updateType,
    updates: {
      description: updatedDescription,
    },
    calendarId,
  });
  
  console.log('[addWorkoutLinksToEvent] API result:', result);
  return result;
}


