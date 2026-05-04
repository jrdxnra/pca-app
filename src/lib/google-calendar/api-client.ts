import type { GoogleCalendar } from '@/lib/google-calendar/types';

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
    extendedProperties?: {
      private?: Record<string, string>;
      shared?: Record<string, string>;
    };
  };
  calendarId?: string;
}

async function resolveIdToken(idToken?: string): Promise<string> {
  if (idToken) {
    return idToken;
  }

  if (typeof window === 'undefined') {
    throw new Error('Authentication token required when running outside of the browser context.');
  }

  const { auth } = await import('@/lib/firebase/config');

  const waitForAuthUser = (): Promise<any | null> => {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });

      setTimeout(() => {
        unsubscribe();
        resolve(null);
      }, 3000);
    });
  };

  let user = auth.currentUser;
  if (!user) {
    user = await waitForAuthUser();
  }

  if (!user) {
    throw new Error('Not authenticated — please sign in again.');
  }

  try {
    return await user.getIdToken();
  } catch (error) {
    console.error('[google-calendar/api-client] Failed to get ID token', error);
    throw new Error('Failed to fetch authentication token. Please refresh and try again.');
  }
}

async function buildAuthHeaders(base: HeadersInit = {}, idToken?: string): Promise<HeadersInit> {
  const token = await resolveIdToken(idToken);
  return {
    ...base,
    Authorization: `Bearer ${token}`,
  };
}

function getOAuthRedirectOrigin(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  try {
    const url = new URL(window.location.href);

    // GitHub forwarded dev URLs already encode the port in the hostname.
    // Dropping an explicit :3000 avoids malformed origins like
    // https://<codespace>-3000.app.github.dev:3000.
    if (url.hostname.endsWith('.app.github.dev') || url.hostname.endsWith('.preview.app.github.dev')) {
      url.port = '';
    }

    return url.origin;
  } catch {
    return window.location.origin;
  }
}

/**
 * Initiate Google OAuth flow
 */
export async function initiateGoogleAuth(idToken?: string): Promise<void> {
  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' }, idToken);

  let authEndpoint = '/api/auth/google';
  if (typeof window !== 'undefined') {
    const { auth } = await import('@/lib/firebase/config');
    const redirectUri = `${getOAuthRedirectOrigin()}/api/auth/google/callback`;
    const loginHint = auth.currentUser?.email || auth.currentUser?.providerData?.find((provider) => provider?.email)?.email;
    const params = new URLSearchParams({
      redirectUri,
    });

    if (loginHint) {
      params.set('loginHint', loginHint);
    }

    authEndpoint = `/api/auth/google?${params.toString()}`;
  }

  // We use POST now to securely pass the idToken in headers
  const response = await fetch(authEndpoint, {
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
  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' }, idToken);

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
  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' }, idToken);

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
 * Fetch the list of calendars accessible to the user
 */
export async function fetchUserCalendars(idToken?: string): Promise<GoogleCalendar[]> {
  const headers = await buildAuthHeaders({}, idToken);

  const response = await fetch('/api/calendar/calendars', {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!response.ok) {
    let error: any = {};
    try {
      error = await response.json();
    } catch {
      // ignore parse errors
    }
    const err = new Error(error.error || 'Failed to fetch calendars');
    (err as any).status = response.status;
    throw err;
  }

  const data = await response.json();
  return data.calendars || [];
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

  const headers = await buildAuthHeaders({}, idToken);

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
  const headers = await buildAuthHeaders({ 'Content-Type': 'application/json' }, idToken);

  // API route expects `mode`, while callers use `updateType`.
  const mode =
    params.updateType === 'thisAndFollowing'
      ? 'future'
      : params.updateType || 'single';

  const response = await fetch('/api/calendar/events/update', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      eventId: params.eventId,
      mode,
      instanceDate: params.instanceDate,
      updates: params.updates,
      calendarId: params.calendarId,
    }),
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

  const headers = await buildAuthHeaders({}, idToken);

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
    const headers = await buildAuthHeaders({
      'Pragma': 'no-cache',
      'Cache-Control': 'no-cache'
    }, idToken);

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
export async function disconnectGoogleCalendar(idToken?: string): Promise<void> {
  const headers = await buildAuthHeaders({}, idToken);
  const response = await fetch('/api/calendar/disconnect', {
    method: 'POST',
    headers,
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
  categoryName?: string,
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
      extendedProperties: {
        private: {
          pcaClientId: clientId,
          pcaWorkoutId: workoutId,
          ...(categoryName ? { pcaCategory: categoryName } : {}),
        },
      },
    },
    calendarId,
  }, idToken);

  console.log('[addWorkoutLinksToEvent] API result:', result);
  return result;
}


