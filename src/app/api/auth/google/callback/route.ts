import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-calendar/auth';
import { storeTokens, getStoredTokens } from '@/lib/google-calendar/adapters/token-adapter';

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google, exchanges code for tokens, and stores them
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  console.log('[OAuth Callback] Starting callback handler');

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

    if (envRedirectUri && envRedirectUri.length > 0) {
      callbackUrl = envRedirectUri;
      console.log('[OAuth Callback] Using GOOGLE_REDIRECT_URI:', callbackUrl);
    } else {
      // Fallback to dynamic origin (local development only)
      const origin = request.nextUrl.origin;
      const isCloudRun = origin.includes('0.0.0.0') || origin.includes('127.0.0.1') || process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT;

      if (isCloudRun) {
        console.error('[OAuth Callback] ERROR: Running on Cloud Run but GOOGLE_REDIRECT_URI not set!');
        return NextResponse.redirect(
          new URL('/configure?error=GOOGLE_REDIRECT_URI_not_configured', request.url)
        );
      }

      callbackUrl = `${origin}/api/auth/google/callback`;
      console.warn('[OAuth Callback] WARNING: GOOGLE_REDIRECT_URI not set! Using:', callbackUrl);
    }

    // Exchange code for tokens
    const tokens = await getTokensFromCode(code, callbackUrl);

    // Get userId from state parameter
    const userId = searchParams.get('state') || undefined;
    console.log(`[OAuth Callback] State (userId): ${userId || 'MISSING'}`);

    if (!userId) {
      console.warn('[OAuth Callback] WARNING: No userId in state! Tokens will be stored in global bucket.');
    }

    // Store tokens using ADAPTER (Local file in dev, Firestore in prod)
    const existingTokens = await getStoredTokens(userId);
    const refreshToken = tokens.refresh_token || existingTokens?.refreshToken || null;

    console.log(`[OAuth Callback] Storing tokens for ${userId || 'global'}. Has refreshToken: ${!!refreshToken}`);

    await storeTokens({
      accessToken: tokens.access_token,
      refreshToken,
      expiryDate: tokens.expiry_date,
    }, userId);

    console.log('[OAuth Callback] Tokens stored successfully via adapter');

    // Redirect to configure page with success
    let redirectUrl: string;
    if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      // Cloud Run
      if (envRedirectUri && envRedirectUri.length > 0) {
        const baseUrl = envRedirectUri.replace('/api/auth/google/callback', '');
        redirectUrl = `${baseUrl}/configure?connected=true`;
      } else {
        redirectUrl = 'https://performancecoach.web.app/configure?connected=true';
      }
      return NextResponse.redirect(redirectUrl);
    } else {
      // Local dev
      if (envRedirectUri && envRedirectUri.length > 0) {
        const baseUrl = envRedirectUri.replace('/api/auth/google/callback', '');
        redirectUrl = `${baseUrl}/configure?connected=true`;
      } else {
        const hostname = request.headers.get('host')?.split(':')[0] || 'localhost';
        redirectUrl = `https://${hostname}/configure?connected=true`;
      }
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    const errorMessage = error instanceof Error ? error.message : 'token_exchange_failed';

    // Determine safe base URL for error redirect
    let baseUrl = request.nextUrl.origin;

    if (process.env.GOOGLE_REDIRECT_URI && process.env.GOOGLE_REDIRECT_URI.length > 0) {
      // Use configured production URI base
      baseUrl = process.env.GOOGLE_REDIRECT_URI.replace('/api/auth/google/callback', '');
    } else if (process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT) {
      // Fallback for Cloud Run if env var missing
      baseUrl = 'https://performancecoach.web.app';
    }

    return NextResponse.redirect(`${baseUrl}/configure?error=${encodeURIComponent(errorMessage)}`);
  }
}
