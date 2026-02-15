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
export async function initiateGoogleAuth(idToken?: string): Promise<void> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  // We use POST now to securely pass the idToken in headers
  const response = await fetch('/api/auth/google', {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to initiate Google Calendar connection');
  }

  const { authUrl } = await response.json();
  if (authUrl) {
    window.location.href = authUrl;
  } else {
    throw new Error('No authorization URL returned from server');
  }
}

/**
 * Create a single (non-recurring) calendar event
 */
export async function createSingleCalendarEvent(
  params: CreateSingleEventParams,
  idToken?: string
): Promise<any> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/calendar/events/single', {
    method: 'POST',
    headers,
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
  params: CreateRecurringEventParams,
  idToken?: string
): Promise<any> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/calendar/events', {
    method: 'POST',
    headers,
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
  calendarId: string = 'primary',
  idToken?: string
): Promise<any[]> {
  /* 
   * Note: The API route expects 'start' and 'end' parameters, 
   * even though Google API uses timeMin/timeMax.
   * We map them here to match the server-side route.d.ts.
   */
  const params = new URLSearchParams({
    start: timeMin.toISOString(),
    end: timeMax.toISOString(),
    calendarId,
  });

  const headers: HeadersInit = {};
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(`/api/calendar/events?${params.toString()}`, {
    method: 'GET',
    headers,
  });

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
  params: UpdateEventParams,
  idToken?: string
): Promise<any> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch('/api/calendar/events/update', {
    method: 'POST',
    headers,
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
  calendarId: string = 'primary',
  idToken?: string
): Promise<void> {
  const params = new URLSearchParams({
    eventId,
    calendarId,
  });

  if (instanceDate) {
    params.append('instanceDate', instanceDate);
  }

  const headers: HeadersInit = {};
  if (idToken) {
    headers['Authorization'] = `Bearer ${idToken}`;
  }

  const response = await fetch(`/api/calendar/events?${params.toString()}`, {
    method: 'DELETE',
    headers,
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
/**
 * Check if user is authenticated with Google Calendar
 */
export async function checkGoogleCalendarAuth(idToken?: string): Promise<boolean> {
  try {
    const headers: HeadersInit = {
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    };

    if (idToken) {
      headers['Authorization'] = `Bearer ${idToken}`;
    }

    const response = await fetch('/api/calendar/auth/status', {
      cache: 'no-store',
      headers
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data.isAuthenticated === true;
  } catch (error) {
    console.error('Error checking auth status:', error);
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
  calendarId: string = 'primary',
  idToken?: string
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
  }, idToken);

  console.log('[addWorkoutLinksToEvent] API result:', result);
  return result;
}


