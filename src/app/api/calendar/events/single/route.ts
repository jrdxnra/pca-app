import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials } from '@/lib/google-calendar/auth';
import { createSingleEvent } from '@/lib/google-calendar/calendar-service';
import { getStoredTokens, getValidAccessToken } from '@/lib/google-calendar/token-storage';

/**
 * POST /api/calendar/events/single
 * Create a single (non-recurring) calendar event
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      summary,
      startDateTime,
      endDateTime,
      clientId,
      periodId,
      categoryName,
      workoutId,
      description,
      location,
      timeZone = 'America/Los_Angeles',
      calendarId = 'primary',
    } = body;

    // Validate required fields
    if (!summary || !startDateTime || !endDateTime) {
      return NextResponse.json(
        { error: 'Missing required fields: summary, startDateTime, endDateTime' },
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

    const event = await createSingleEvent(
      oauth2Client,
      calendarId,
      {
        summary,
        startDateTime: new Date(startDateTime),
        endDateTime: new Date(endDateTime),
        clientId,
        periodId,
        categoryName,
        workoutId,
        description,
        location,
        timeZone,
      }
    );

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Error creating single calendar event:', error);
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
