import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials } from '@/lib/google-calendar/auth';
import { listCalendars } from '@/lib/google-calendar/calendar-service';
import { getStoredTokens } from '@/lib/google-calendar/adapters/token-adapter';
import { getValidAccessToken } from '@/lib/google-calendar/auth-service';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';

export async function GET(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await getStoredTokens(userId);
    if (!tokens || !tokens.accessToken) {
      return NextResponse.json(
        { error: 'Not authenticated with Google Calendar' },
        { status: 401 }
      );
    }

    const oauth2Client = createOAuth2Client();
    const validToken = await getValidAccessToken(userId);

    if (!validToken) {
      return NextResponse.json(
        { error: 'Failed to get valid access token. Please reconnect Google Calendar.' },
        { status: 401 }
      );
    }

    setCredentials(oauth2Client, validToken, tokens.refreshToken);

    const calendars = await listCalendars(oauth2Client);

    const normalizedCalendars = (calendars || [])
      .filter((calendar) => Boolean(calendar.id))
      .map((calendar) => ({
        id: calendar.id as string,
        summary: calendar.summary || (calendar.id as string),
        description: calendar.description || undefined,
        timeZone: calendar.timeZone || 'UTC',
        primary: Boolean(calendar.primary),
      }));

    return NextResponse.json({ calendars: normalizedCalendars });
  } catch (error) {
    console.error('[GET /api/calendar/calendars] Failed to list calendars', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}
