import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-calendar/auth';
import { storeTokens, getStoredTokens } from '@/lib/google-calendar/token-storage';

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google, exchanges code for tokens, and stores them
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  console.log('[OAuth Callback] Starting callback handler');
  console.log('[OAuth Callback] Code present:', !!code);
  console.log('[OAuth Callback] Error:', error);
  console.log('[OAuth Callback] Request URL:', request.url);
  console.log('[OAuth Callback] Request origin:', request.nextUrl.origin);

  if (error) {
    console.error('OAuth error:', error);
    // Determine base URL for redirect
    let baseUrl = request.nextUrl.origin;
    if (process.env.GOOGLE_REDIRECT_URI) {
      baseUrl = process.env.GOOGLE_REDIRECT_URI.replace('/api/auth/google/callback', '');
    } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      baseUrl = 'https://performancecoach.web.app';
    }

    return NextResponse.redirect(`${baseUrl}/configure?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('[OAuth Callback] No code received');
    return NextResponse.redirect(
      new URL('/configure?error=no_code', request.url)
    );
  }

  try {
    // Use GOOGLE_REDIRECT_URI from environment if set (must match what was used in auth)
    // Otherwise, build from request origin (for local development)
    let callbackUrl: string;
    const envRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();

    console.log('[OAuth Callback] Environment check:', {
      hasGOOGLE_REDIRECT_URI: !!process.env.GOOGLE_REDIRECT_URI,
      GOOGLE_REDIRECT_URI_length: process.env.GOOGLE_REDIRECT_URI?.length || 0,
      GOOGLE_REDIRECT_URI_value: envRedirectUri,
      VERCEL_ENV: process.env.VERCEL_ENV,
      NODE_ENV: process.env.NODE_ENV
    });

    if (envRedirectUri && envRedirectUri.length > 0) {
      callbackUrl = envRedirectUri;
      console.log('[OAuth Callback] Using GOOGLE_REDIRECT_URI from environment:', callbackUrl);
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
        console.error('[OAuth Callback] ERROR: Running on Cloud Run but GOOGLE_REDIRECT_URI not set!');
        console.error('[OAuth Callback] Request origin:', origin, '(this is internal Cloud Run URL, not public)');
        return NextResponse.redirect(
          new URL('/configure?error=GOOGLE_REDIRECT_URI_not_configured', request.url)
        );
      }

      // Local development fallback
      callbackUrl = `${origin}/api/auth/google/callback`;
      console.warn('[OAuth Callback] WARNING: GOOGLE_REDIRECT_URI not set! Building callback URL from request origin:', callbackUrl);
    }

    console.log('[OAuth Callback] Request origin:', request.nextUrl.origin);
    console.log('[OAuth Callback] Final callback URL:', callbackUrl);

    // Exchange code for tokens (use same redirect URI that was used in auth)
    const tokens = await getTokensFromCode(code, callbackUrl);

    // Store tokens in Firestore
    // Get existing tokens to preserve refresh token if not provided
    const existingTokens = await getStoredTokens();
    const refreshToken = tokens.refresh_token || existingTokens?.refreshToken || null;

    console.log('Storing tokens:', {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!refreshToken,
      expiryDate: tokens.expiry_date,
    });

    await storeTokens({
      accessToken: tokens.access_token,
      refreshToken,
      expiryDate: tokens.expiry_date,
      // TODO: Add userId when authentication is implemented
    });

    // Redirect to configure page with success
    // Use the Firebase hosting URL if we're on Cloud Run, otherwise use request origin
    let redirectUrl: string;
    if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      // On Cloud Run, derive Firebase hosting URL from GOOGLE_REDIRECT_URI
      // GOOGLE_REDIRECT_URI is like: https://performancecoach.web.app/api/auth/google/callback
      // We need: https://performancecoach.web.app/configure?connected=true
      if (envRedirectUri && envRedirectUri.length > 0) {
        const baseUrl = envRedirectUri.replace('/api/auth/google/callback', '');
        redirectUrl = `${baseUrl}/configure?connected=true`;
      } else {
        // Fallback to known Firebase hosting URL
        redirectUrl = 'https://performancecoach.web.app/configure?connected=true';
      }
      console.log('[OAuth Callback] Redirecting to Firebase URL:', redirectUrl);
      return NextResponse.redirect(redirectUrl);
    } else {
      // Local development - derive from GOOGLE_REDIRECT_URI or use request URL without port
      // GOOGLE_REDIRECT_URI is like: https://jubilant-goldfish-5gg6gww654r27vgr-3000.app.github.dev/api/auth/google/callback
      if (envRedirectUri && envRedirectUri.length > 0) {
        const baseUrl = envRedirectUri.replace('/api/auth/google/callback', '');
        redirectUrl = `${baseUrl}/configure?connected=true`;
        console.log('[OAuth Callback] Local dev: Using GOOGLE_REDIRECT_URI base:', redirectUrl);
      } else {
        // Fallback: reconstruct from request hostname without port
        const hostname = request.headers.get('host')?.split(':')[0] || 'localhost';
        redirectUrl = `https://${hostname}/configure?connected=true`;
        console.log('[OAuth Callback] Local dev: Using hostname:', redirectUrl);
      }
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    const errorMessage = error instanceof Error ? error.message : 'token_exchange_failed';
    return NextResponse.redirect(
      new URL(`/configure?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}


