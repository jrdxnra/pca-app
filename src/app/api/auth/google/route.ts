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
    // Remove trailing slash if present
    const cleanOrigin = origin.replace(/\/$/, '');
    const callbackUrl = `${cleanOrigin}/api/auth/google/callback`;
    
    console.log('[OAuth] Generating auth URL with callback:', callbackUrl);
    console.log('[OAuth] Request origin:', origin);
    console.log('[OAuth] Clean origin:', cleanOrigin);
    console.log('[OAuth] Full callback URL:', callbackUrl);
    
    // Generate auth URL with the correct redirect URI
    const authUrl = getAuthUrl(callbackUrl);
    
    // Extract and log the redirect_uri from the generated URL for debugging
    const redirectUriMatch = authUrl.match(/redirect_uri=([^&]+)/);
    if (redirectUriMatch) {
      const actualRedirectUri = decodeURIComponent(redirectUriMatch[1]);
      console.log('[OAuth] Actual redirect_uri in auth URL:', actualRedirectUri);
      console.log('[OAuth] Expected redirect_uri:', callbackUrl);
      if (actualRedirectUri !== callbackUrl) {
        console.error('[OAuth] MISMATCH! redirect_uri in URL does not match callbackUrl');
      }
    }
    
    console.log('[OAuth] Generated auth URL (first 200 chars):', authUrl.substring(0, 200) + '...');
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


