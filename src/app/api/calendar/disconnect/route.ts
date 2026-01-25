import { NextRequest, NextResponse } from 'next/server';
import { clearStoredTokens } from '@/lib/google-calendar/token-storage';

/**
 * POST /api/calendar/disconnect
 * Disconnect Google Calendar by clearing stored tokens
 */
export async function POST(request: NextRequest) {
  return NextResponse.json({ error: 'API temporarily disabled' }, { status: 503 });
}

