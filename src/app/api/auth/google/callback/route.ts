import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/google-calendar/auth';
import { storeTokens } from '@/lib/google-calendar/token-storage';

/**
 * GET /api/auth/google/callback
 * Handles OAuth callback from Google, exchanges code for tokens, and stores them
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('OAuth error:', error);
    return NextResponse.redirect(
      new URL(`/configure?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL('/configure?error=no_code', request.url)
    );
  }

  try {
    // Get the origin from the request URL (must match what was used in auth)
    const origin = request.nextUrl.origin;
    const callbackUrl = `${origin}/api/auth/google/callback`;
    
    console.log('[OAuth Callback] Exchanging code with callback URL:', callbackUrl);
    console.log('[OAuth Callback] Request origin:', origin);
    
    // Exchange code for tokens (use same redirect URI that was used in auth)
    const tokens = await getTokensFromCode(code, callbackUrl);

    // Store tokens in Firestore
    await storeTokens({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiryDate: tokens.expiry_date,
      // TODO: Add userId when authentication is implemented
    });

    // Redirect to configure page with success
    return NextResponse.redirect(
      new URL('/configure?connected=true', request.url)
    );
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    const errorMessage = error instanceof Error ? error.message : 'token_exchange_failed';
    return NextResponse.redirect(
      new URL(`/configure?error=${encodeURIComponent(errorMessage)}`, request.url)
    );
  }
}


