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
          error: 'Google Calendar OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.',
          hint: 'For Vercel: Go to Vercel → Settings → Environment Variables. For Firebase: Set in Cloud Run service environment variables.'
        },
        { status: 500 }
      );
    }

    // Use GOOGLE_REDIRECT_URI from environment if set (for Vercel deployments)
    // Otherwise, build from request origin (for local development)
    let callbackUrl: string;
    const envRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    
    console.log('[OAuth] Environment check:', {
      hasGOOGLE_REDIRECT_URI: !!process.env.GOOGLE_REDIRECT_URI,
      GOOGLE_REDIRECT_URI_length: process.env.GOOGLE_REDIRECT_URI?.length || 0,
      GOOGLE_REDIRECT_URI_value: process.env.GOOGLE_REDIRECT_URI ? '***set***' : 'undefined',
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV
    });
    
    if (envRedirectUri && envRedirectUri.length > 0) {
      callbackUrl = envRedirectUri;
      console.log('[OAuth] Using GOOGLE_REDIRECT_URI from environment:', callbackUrl);
    } else {
      // Fallback to dynamic origin (local development only)
      const origin = request.nextUrl.origin;
      
      // Check if we're on Cloud Run (Firebase) - origin will be 0.0.0.0 or internal
      const isCloudRun = origin.includes('0.0.0.0') || 
                        origin.includes('127.0.0.1') || 
                        process.env.K_SERVICE || // Cloud Run sets this
                        process.env.GOOGLE_CLOUD_PROJECT; // GCP sets this
      
      if (isCloudRun) {
        // On Cloud Run, we MUST use the Firebase hosting URL from env var
        // If not set, this is a configuration error
        console.error('[OAuth] ERROR: Running on Cloud Run but GOOGLE_REDIRECT_URI not set!');
        console.error('[OAuth] Request origin:', origin, '(this is internal Cloud Run URL, not public)');
        console.error('[OAuth] Set GOOGLE_REDIRECT_URI in Cloud Run environment variables to: https://performancecoach.web.app/api/auth/google/callback');
        return NextResponse.json(
          { 
            error: 'GOOGLE_REDIRECT_URI must be set in Cloud Run environment variables for Firebase deployments.',
            hint: 'Set GOOGLE_REDIRECT_URI=https://performancecoach.web.app/api/auth/google/callback in Cloud Run service environment variables.'
          },
          { status: 500 }
        );
      }
      
      // Local development fallback
      const cleanOrigin = origin.replace(/\/$/, '');
      callbackUrl = `${cleanOrigin}/api/auth/google/callback`;
      console.warn('[OAuth] WARNING: GOOGLE_REDIRECT_URI not set! Building callback URL from request origin:', callbackUrl);
      console.warn('[OAuth] This should only happen in local development. For Vercel/Firebase, set GOOGLE_REDIRECT_URI in environment variables.');
    }
    
    console.log('[OAuth] Request origin:', request.nextUrl.origin);
    console.log('[OAuth] Final callback URL:', callbackUrl);
    
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


