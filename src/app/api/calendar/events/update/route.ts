import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials, getValidAccessToken } from '@/lib/google-calendar/auth';
import { 
  updateSingleInstance,
  updateAllOccurrences,
  updateThisAndFollowing 
} from '@/lib/google-calendar/calendar-service';
import { getStoredTokens } from '@/lib/google-calendar/token-storage';

/**
 * POST /api/calendar/events/update
 * Update a calendar event (single instance, all occurrences, or this and following)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      eventId,
      instanceDate,
      updateType = 'single', // 'single' | 'all' | 'thisAndFollowing'
      updates,
      clearExtendedProperties = false, // If true, clear PCA metadata from extendedProperties
      calendarId = 'primary',
    } = body;

    if (!eventId || !updates) {
      return NextResponse.json(
        { error: 'eventId and updates are required' },
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
    setCredentials(oauth2Client, tokens.accessToken, tokens.refreshToken);

    // Convert updates to Google Calendar format
    const calendarUpdates: any = {};
    if (updates.summary) calendarUpdates.summary = updates.summary;
    if (updates.description !== undefined) calendarUpdates.description = updates.description;
    if (updates.location) calendarUpdates.location = updates.location;
    
    // Clear extended properties if requested (for unassigning clients)
    if (clearExtendedProperties) {
      calendarUpdates.extendedProperties = {
        private: {
          pcaClientId: '',
          pcaCategory: '',
          pcaWorkoutId: '',
          pcaPeriodId: '',
        }
      };
    }
    
    if (updates.startTime || updates.endTime) {
      // This is simplified - you'd need to get the original event first
      // to preserve the date and only update the time
      // For now, we'll require the full datetime
      console.warn('Time updates require full datetime - this is a simplified implementation');
    }

    let result;

    switch (updateType) {
      case 'single':
        if (!instanceDate) {
          return NextResponse.json(
            { error: 'instanceDate is required for single instance updates' },
            { status: 400 }
          );
        }
        result = await updateSingleInstance(
          oauth2Client,
          calendarId,
          eventId,
          new Date(instanceDate),
          calendarUpdates
        );
        break;

      case 'all':
        result = await updateAllOccurrences(
          oauth2Client,
          calendarId,
          eventId,
          calendarUpdates
        );
        break;

      case 'thisAndFollowing':
        if (!instanceDate) {
          return NextResponse.json(
            { error: 'instanceDate is required for thisAndFollowing updates' },
            { status: 400 }
          );
        }
        result = await updateThisAndFollowing(
          oauth2Client,
          calendarId,
          eventId,
          new Date(instanceDate),
          calendarUpdates
        );
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid updateType. Must be "single", "all", or "thisAndFollowing"' },
          { status: 400 }
        );
    }

    return NextResponse.json({ event: result });
  } catch (error) {
    console.error('Error updating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar event' },
      { status: 500 }
    );
  }
}


