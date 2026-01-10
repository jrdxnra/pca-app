import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/google-calendar/token-storage';

/**
 * GET /api/calendar/auth/status
 * Check if user is authenticated with Google Calendar
 */
export async function GET(request: NextRequest) {
  try {
    const authenticated = await isAuthenticated();
    return NextResponse.json({ authenticated });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json({ authenticated: false });
  }
}


