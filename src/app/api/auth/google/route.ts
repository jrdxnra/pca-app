import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-calendar/auth';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google's authorization page
 */
export async function GET(request: NextRequest) {
  try {
    // Check if credentials are configured
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error('[OAuth] Missing credentials:', {
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
      });
      return NextResponse.json(
        { 
          error: 'Google Calendar OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel environment variables.',
          hint: 'Go to Vercel → Settings → Environment Variables and add the credentials.'
        },
        { status: 500 }
      );
    }

    // Get the origin from the request URL (more reliable than headers)
    const origin = request.nextUrl.origin;
    const callbackUrl = `${origin}/api/auth/google/callback`;
    
    console.log('[OAuth] Generating auth URL with callback:', callbackUrl);
    console.log('[OAuth] Request origin:', origin);
    
    // Generate auth URL with the correct redirect URI
    const authUrl = getAuthUrl(callbackUrl);
    console.log('[OAuth] Generated auth URL (first 100 chars):', authUrl.substring(0, 100) + '...');
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


