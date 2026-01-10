import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials } from '@/lib/google-calendar/auth';
import { createRecurringEvent, getEvents } from '@/lib/google-calendar/calendar-service';
import { weekTemplateToRRULE } from '@/lib/google-calendar/rrule-utils';
import { getStoredTokens, getValidAccessToken } from '@/lib/google-calendar/token-storage';

/**
 * GET /api/calendar/events
 * Fetch events from Google Calendar for a date range
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const timeMin = searchParams.get('timeMin');
  const timeMax = searchParams.get('timeMax');
  const calendarId = searchParams.get('calendarId') || 'primary';

  if (!timeMin || !timeMax) {
    return NextResponse.json(
      { error: 'timeMin and timeMax are required' },
      { status: 400 }
    );
  }

  try {
    // Get stored tokens
    const tokens = await getStoredTokens();
    
    if (!tokens || !tokens.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuth2Client();
    setCredentials(oauth2Client, tokens.accessToken, tokens.refreshToken);

    const events = await getEvents(
      oauth2Client,
      calendarId,
      new Date(timeMin),
      new Date(timeMax)
    );

    return NextResponse.json({ events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
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

    // Get stored tokens
    const tokens = await getStoredTokens();
    
    if (!tokens || !tokens.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuth2Client();
    
    // Try to refresh token if needed
    const validToken = await getValidAccessToken();
    
    if (!validToken) {
      return NextResponse.json(
        { error: 'Failed to get valid access token. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }
    
    setCredentials(oauth2Client, validToken, tokens.refreshToken);

    // If weekTemplateId is provided, convert it to RRULE
    // Note: weekTemplate data should be passed in the request body
    // or fetched from Firebase here
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
        console.log('RRULE map generated:', Array.from(rruleMap.entries()));
        // Get RRULE for this specific category
        const categoryRRULE = rruleMap.get(categoryName);
        if (categoryRRULE) {
          recurrence = categoryRRULE;
          console.log('Using RRULE for category:', categoryName, recurrence);
        } else {
          console.warn(`No RRULE found for category: ${categoryName}. Available categories:`, Array.from(rruleMap.keys()));
        }
      } catch (rruleError) {
        console.error('Error generating RRULE:', rruleError);
      }
    }

    // If no RRULE from template, create one for a single day
    if (recurrence.length === 0) {
      // This is a fallback - ideally you'd know which day of week this is
      // For now, we'll create a weekly recurrence until end date
      const untilDate = formatDateForRRULE(new Date(endDate));
      recurrence = [`RRULE:FREQ=WEEKLY;UNTIL=${untilDate}`];
      console.log('Using fallback RRULE:', recurrence);
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
    console.error('Error details:', errorDetails);
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


