import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-calendar/auth';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google's authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Get the origin from the request URL (more reliable than headers)
    // Use the request URL's origin, or fall back to env var, or localhost
    const origin = request.nextUrl.origin;
    const callbackUrl = `${origin}/api/auth/google/callback`;
    
    console.log('[OAuth] Generating auth URL with callback:', callbackUrl);
    console.log('[OAuth] Request origin:', origin);
    console.log('[OAuth] Environment GOOGLE_REDIRECT_URI:', process.env.GOOGLE_REDIRECT_URI);
    
    // Generate auth URL with the correct redirect URI
    const authUrl = getAuthUrl(callbackUrl);
    console.log('[OAuth] Generated auth URL:', authUrl.substring(0, 100) + '...');
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error generating auth URL:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to initiate OAuth flow';
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined
      },
      { status: 500 }
    );
  }
}


