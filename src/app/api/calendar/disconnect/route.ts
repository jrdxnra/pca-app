import { NextRequest, NextResponse } from 'next/server';
import { clearStoredTokens } from '@/lib/google-calendar/adapters/token-adapter';

/**
 * POST /api/calendar/disconnect
 * Disconnect Google Calendar by clearing stored tokens
 */
export async function POST(request: NextRequest) {
  try {
    const { getAuthenticatedUser } = await import('@/lib/auth/get-authenticated-user');
    const userId = await getAuthenticatedUser(request);
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    await clearStoredTokens(userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Calendar' },
      { status: 500 }
    );
  }
}
