import { NextRequest, NextResponse } from 'next/server';
import { getAuthUrl } from '@/lib/google-calendar/auth';
import { getAuthenticatedUser } from '@/lib/auth/get-authenticated-user';

/**
 * GET /api/auth/google
 * Initiates Google OAuth flow by redirecting to Google's authorization page
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get('redirectUri') || undefined;
    const idToken = searchParams.get('idToken');
    console.log('[OAuth Init] Received request. idToken present:', !!idToken);

    let userId: string | null = null;

    if (idToken) {
      try {
        const { getFirebaseAdminApp } = await import('@/lib/firebase/admin');
        const admin = getFirebaseAdminApp();
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        userId = decodedToken.uid;
        console.log('[OAuth Init] verified idToken, userId:', userId);
      } catch (e) {
        console.warn('[OAuth Init] Invalid idToken in query params:', e);
      }
    }

    if (!userId) {
      // Fallback to Authorization header
      userId = await getAuthenticatedUser(request);
      console.log('[OAuth Init] Fallback auth check, userId:', userId);
    }

    if (!userId) {
      console.error('[OAuth Init] Connection initiation failed: No authenticated user found.');
      return NextResponse.json(
        { error: 'You must be signed in to connect Google Calendar.' },
        { status: 401 }
      );
    }

    console.log('[OAuth Init] Final userId for state:', userId);

    const authUrl = getAuthUrl(redirectUri, userId);
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Error initiating Google OAuth:', error);
    return NextResponse.json(
      { error: 'Failed to initiate authentication' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/google
 * Returns the authorization URL instead of redirecting (for safer header passing)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthenticatedUser(request);
    console.log('[OAuth POST] Initiating OAuth for userId:', userId);

    const searchParams = request.nextUrl.searchParams;
    const redirectUri = searchParams.get('redirectUri') || undefined;

    const authUrl = getAuthUrl(redirectUri, userId || undefined);
    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
}


