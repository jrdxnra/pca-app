import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-calendar/auth';
import { storeTokens, getStoredTokens } from '@/lib/google-calendar/adapters/token-adapter';

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google, exchanges code for tokens, and stores them
 */
export async function GET(request: NextRequest) {
  const isCloudEnvironment = Boolean(process.env.K_SERVICE || process.env.GOOGLE_CLOUD_PROJECT);

  const getSafeOrigin = () => {
    const origin = request.nextUrl.origin;
    try {
      const url = new URL(origin);
      if (url.hostname === '0.0.0.0' || url.hostname === '::' || url.hostname === '[::]') {
        url.hostname = 'localhost';
      }
      return url.origin;
    } catch {
      return 'http://localhost:3000';
    }
  };

  const getBaseUrl = () => {
    if (!isCloudEnvironment) {
      return getSafeOrigin();
    }

    const envRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    if (envRedirectUri) {
      return envRedirectUri.replace('/api/auth/google/callback', '');
    }

    return 'https://performancecoach.web.app';
  };

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  console.log('[OAuth Callback] Starting callback handler');

  if (error) {
    console.error('OAuth error:', error);
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(`${baseUrl}/configure?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('[OAuth Callback] No code received');
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(`${baseUrl}/configure?error=no_code`);
  }

  try {
    const envRedirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
    const callbackUrl = isCloudEnvironment
      ? (envRedirectUri || 'https://performancecoach.web.app/api/auth/google/callback')
      : `${getSafeOrigin()}/api/auth/google/callback`;

    console.log('[OAuth Callback] callbackUrl used for token exchange:', callbackUrl);

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
    const baseUrl = getBaseUrl();
    return NextResponse.redirect(`${baseUrl}/configure?connected=true`);
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    const errorMessage = error instanceof Error ? error.message : 'token_exchange_failed';

    const baseUrl = getBaseUrl();
    return NextResponse.redirect(`${baseUrl}/configure?error=${encodeURIComponent(errorMessage)}`);
  }
}
