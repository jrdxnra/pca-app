import { NextRequest, NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/google-calendar/token-storage';

/**
 * GET /api/calendar/auth/status
 * Check if user is authenticated with Google Calendar
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'API temporarily disabled' }, { status: 503 });
}


