import { NextRequest, NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/google-calendar/adapters/token-adapter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/calendar/auth/status
 * Check if user is authenticated with Google Calendar
 */
export async function GET(request: NextRequest) {
  let timeoutId: NodeJS.Timeout | undefined;

  try {
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Auth check timed out'));
      }, 5000);
    });

    // Handle timeout error to prevent unhandled rejection
    timeoutPromise.catch((e) => { });

    // Check tokens using the abstraction adapter
    // This avoids Firebase imports in dev mode
    // Check tokens using the abstraction adapter
    // This avoids Firebase imports in dev mode
    const checkAuth = async () => {
      let userId: string | undefined;

      // Extract and verify ID token if present
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const idToken = authHeader.split('Bearer ')[1];
        try {
          // Import verifyIdToken dynamically to avoid build issues
          // Note: We need to use the admin SDK to verify
          const { getFirebaseAdminApp } = await import('@/lib/firebase/admin');
          const admin = getFirebaseAdminApp();
          const decodedToken = await admin.auth().verifyIdToken(idToken);
          userId = decodedToken.uid;
        } catch (e) {
          console.warn('Invalid ID token provided to auth status check:', e);
          return false;
        }
      }

      // If we required auth and didn't get it, or it failed, userId is undefined.
      // We MUST NOT fall back to global tokens for the status check, because actual API calls
      // (like /api/calendar/events) will fail without a valid userId.
      // This ensures the UI properly reflects the "Disconnected" state if the user's specific
      // auth context is missing or invalid.
      if (!userId) {
        return false;
      }

      const tokens = await getStoredTokens(userId);
      const isAuth = !!tokens?.accessToken;
      return isAuth;
    };

    const authenticated = await Promise.race([
      checkAuth(),
      timeoutPromise
    ]);

    return NextResponse.json({ isAuthenticated: authenticated });
  } catch (error) {
    console.error('Error checking auth status:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication status' },
      { status: 500 }
    );
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}
