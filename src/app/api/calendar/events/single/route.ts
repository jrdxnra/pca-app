import { NextRequest, NextResponse } from 'next/server';
import { createOAuth2Client, setCredentials } from '@/lib/google-calendar/auth';
import { createSingleEvent } from '@/lib/google-calendar/calendar-service';
import { getStoredTokens, getValidAccessToken } from '@/lib/google-calendar/token-storage';

/**
 * POST /api/calendar/events/single
 * Create a single (non-recurring) calendar event
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'API temporarily disabled' }, { status: 503 });
}
