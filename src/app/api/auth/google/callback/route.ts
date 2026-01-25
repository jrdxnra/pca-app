import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-calendar/auth';
import { storeTokens } from '@/lib/google-calendar/token-storage';

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google, exchanges code for tokens, and stores them
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({ error: 'API temporarily disabled' }, { status: 503 });
}


