import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-calendar/auth';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google's authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Get the origin from the request to build the correct callback URL
    const origin = request.headers.get('origin') || request.nextUrl.origin;
    const callbackUrl = `${origin}/api/auth/google/callback`;
    
    // Generate auth URL with the correct redirect URI
    const authUrl = getAuthUrl(callbackUrl);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}


