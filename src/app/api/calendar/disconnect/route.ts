import { NextRequest, NextResponse } from 'next/server';
import { clearStoredTokens } from '@/lib/google-calendar/token-storage';

/**
 * POST /api/calendar/disconnect
 * Disconnect Google Calendar by clearing stored tokens
 */
export async function POST(request: NextRequest) {
  try {
    await clearStoredTokens();
    return NextResponse.json({ success: true, message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Calendar' },
      { status: 500 }
    );
  }
}

