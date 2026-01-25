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
  return NextResponse.json({ error: 'API temporarily disabled' }, { status: 503 });
}


