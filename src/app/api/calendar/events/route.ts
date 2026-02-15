import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials } from '@/lib/google-calendar/auth';
import { createRecurringEvent, getEvents, deleteRecurringEvent } from '@/lib/google-calendar/calendar-service';
import { weekTemplateToRRULE } from '@/lib/google-calendar/rrule-utils';
import { getStoredTokens } from '@/lib/google-calendar/adapters/token-adapter';
import { getValidAccessToken } from '@/lib/google-calendar/auth-service';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';

/**
 * GET /api/calendar/events
 * Fetch events from Google Calendar for a date range
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get('start');
    const endDateParam = searchParams.get('end');
    const calendarId = searchParams.get('calendarId') || 'primary';

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'Missing required parameters: start, end' },
        { status: 400 }
      );
    }

    const startDate = new Date(startDateParam);
    const endDate = new Date(endDateParam);

    // Validate dates
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    // Authenticate user
    const userId = await getAuthenticatedUser(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stored tokens via ADAPTER
    const tokens = await getStoredTokens(userId);

    if (!tokens || !tokens.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuth2Client();

    // Try to refresh token if needed via SERVICE
    const validToken = await getValidAccessToken(userId);

    if (!validToken) {
      return NextResponse.json(
        { error: 'Failed to get valid access token. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    setCredentials(oauth2Client, validToken, tokens.refreshToken);

    const events = await getEvents(
      oauth2Client,
      calendarId,
      startDate,
      endDate
    );

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch calendar events';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/calendar/events
 * Create a recurring calendar event from a period assignment
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      summary,
      startDate,
      endDate,
      startTime,
      duration,
      clientId,
      periodId,
      categoryName,
      weekTemplateId,
      calendarId = 'primary',
    } = body;

    // Validate required fields
    if (!summary || !startDate || !endDate || !startTime || !clientId || !periodId || !categoryName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Authenticate user
    const userId = await getAuthenticatedUser(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stored tokens via ADAPTER
    const tokens = await getStoredTokens(userId);

    if (!tokens || !tokens.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuth2Client();

    // Try to refresh token if needed via SERVICE
    const validToken = await getValidAccessToken(userId);

    if (!validToken) {
      return NextResponse.json(
        { error: 'Failed to get valid access token. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    setCredentials(oauth2Client, validToken, tokens.refreshToken);

    // If weekTemplateId is provided, convert it to RRULE
    let recurrence: string[] = [];

    console.log('Creating recurring event with params:', {
      weekTemplateId,
      hasWeekTemplate: !!body.weekTemplate,
      categoryName,
      startDate,
      endDate,
      startTime
    });

    if (weekTemplateId && body.weekTemplate) {
      try {
        const weekTemplate = body.weekTemplate;
        const rruleMap = weekTemplateToRRULE(weekTemplate, new Date(endDate));
        // Get RRULE for this specific category
        const categoryRRULE = rruleMap.get(categoryName);
        if (categoryRRULE) {
          recurrence = categoryRRULE;
        } else {
          console.warn(`No RRULE found for category: ${categoryName}`);
        }
      } catch (rruleError) {
        console.error('Error generating RRULE:', rruleError);
      }
    }

    // If no RRULE from template, create one for a single day (fallback)
    if (recurrence.length === 0) {
      const untilDate = formatDateForRRULE(new Date(endDate));
      recurrence = [`RRULE:FREQ=WEEKLY;UNTIL=${untilDate}`];
    }

    const event = await createRecurringEvent(
      oauth2Client,
      calendarId,
      {
        summary,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        recurrence,
        startTime,
        duration: duration || 60,
        clientId,
        periodId,
        categoryName,
      }
    );

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to create calendar event';
    const errorDetails = error instanceof Error ? error.stack : String(error);
    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}

// Helper function for date formatting
function formatDateForRRULE(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * DELETE /api/calendar/events
 * Delete a calendar event by its ID
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const eventId = searchParams.get('eventId');
    const calendarId = searchParams.get('calendarId') || 'primary';

    if (!eventId) {
      return NextResponse.json(
        { error: 'Missing required parameter: eventId' },
        { status: 400 }
      );
    }

    // Authenticate user
    const userId = await getAuthenticatedUser(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get stored tokens via ADAPTER
    const tokens = await getStoredTokens(userId);

    if (!tokens || !tokens.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuth2Client();

    // Try to refresh token if needed via SERVICE
    const validToken = await getValidAccessToken(userId);

    if (!validToken) {
      return NextResponse.json(
        { error: 'Failed to get valid access token. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    setCredentials(oauth2Client, validToken, tokens.refreshToken);

    await deleteRecurringEvent(oauth2Client, calendarId, eventId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete calendar event';
    const errorDetails = error instanceof Error ? error.stack : String(error);

    return NextResponse.json(
      {
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? errorDetails : undefined
      },
      { status: 500 }
    );
  }
}
