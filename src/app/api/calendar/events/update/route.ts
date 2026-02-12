import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials } from '@/lib/google-calendar/auth';
import {
  updateSingleInstance,
  updateAllOccurrences,
  updateThisAndFollowing
} from '@/lib/google-calendar/calendar-service';
import { getStoredTokens, getValidAccessToken } from '@/lib/google-calendar/token-storage';

/**
 * POST /api/calendar/events/update
 * Update a calendar event (single instance, all occurrences, or this and following)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventId,
      mode, // 'single', 'all', 'future'
      instanceDate,
      updates,
      calendarId = 'primary',
      // For delete operations
      action
    } = body;

    if (!eventId || !mode) {
      return NextResponse.json(
        { error: 'Missing required fields: eventId, mode' },
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

    let result;

    // Handle Delete Actions
    if (action === 'delete') {
      // Import delete functions dynamically or assume they are exported from calendar-service
      const { deleteSingleInstance, deleteRecurringEvent } = await import('@/lib/google-calendar/calendar-service');

      if (mode === 'single') {
        if (!instanceDate) {
          throw new Error('instanceDate is required for single instance deletion');
        }
        await deleteSingleInstance(oauth2Client, calendarId, eventId, new Date(instanceDate));
        result = { success: true, deleted: true, mode: 'single' };
      } else if (mode === 'all') {
        await deleteRecurringEvent(oauth2Client, calendarId, eventId);
        result = { success: true, deleted: true, mode: 'all' };
      } else if (mode === 'future') {
        // Future deletion is tricky, usually implemented as updating recurrence with UNTIL
        // For now, allow it to fall through or implement if service supports it
        throw new Error('Delete future instances not fully implemented yet');
      }
    } else {
      // Handle Update Actions
      if (mode === 'single') {
        if (!instanceDate) {
          throw new Error('instanceDate is required for single instance update');
        }
        result = await updateSingleInstance(
          oauth2Client,
          calendarId,
          eventId,
          new Date(instanceDate),
          updates
        );
      } else if (mode === 'all') {
        result = await updateAllOccurrences(
          oauth2Client,
          calendarId,
          eventId,
          updates
        );
      } else if (mode === 'future') {
        if (!instanceDate) {
          throw new Error('instanceDate is required for future instances update');
        }
        result = await updateThisAndFollowing(
          oauth2Client,
          calendarId,
          eventId,
          new Date(instanceDate),
          updates
        );
      } else {
        throw new Error(`Invalid update mode: ${mode}`);
      }
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to update calendar event';
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


