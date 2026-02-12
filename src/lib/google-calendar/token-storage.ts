import { adminDb } from '@/lib/firebase/admin';
import { refreshAccessToken, createOAuth2Client } from './auth';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  userId?: string; // For future multi-user support
}

const TOKEN_DOC_ID = 'google-calendar-tokens'; // Single document for now

/**
 * Store Google Calendar OAuth tokens in Firestore (using Admin SDK)
 */
export async function storeTokens(tokens: StoredTokens): Promise<void> {
  console.log('[storeTokens] Starting token storage (Admin SDK)');

  const tokensRef = adminDb.collection('googleCalendarTokens').doc(TOKEN_DOC_ID);

  try {
    await tokensRef.set({
      ...tokens,
      updatedAt: new Date(),
    }, { merge: true });
    console.log('[storeTokens] Tokens stored successfully');
  } catch (error) {
    console.error('[storeTokens] ERROR storing tokens:', error);
    throw error;
  }
}

/**
 * Retrieve stored tokens from Firestore (using Admin SDK)
 */
export async function getStoredTokens(): Promise<StoredTokens | null> {
  const tokensRef = adminDb.collection('googleCalendarTokens').doc(TOKEN_DOC_ID);
  const tokensDoc = await tokensRef.get();

  if (!tokensDoc.exists) {
    return null;
  }

  const data = tokensDoc.data();
  if (!data) return null;

  return {
    accessToken: data.accessToken,
    refreshToken: data.refreshToken || null,
    expiryDate: data.expiryDate || null,
    userId: data.userId,
  };
}

/**
 * Get a valid access token, refreshing if necessary
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();

  if (!tokens || !tokens.accessToken) {
    return null;
  }

  // Check if token is expired (with 10 minute buffer for proactive refresh)
  const now = Date.now();
  const expiryBuffer = 10 * 60 * 1000; // 10 minutes in milliseconds
  const isExpired = tokens.expiryDate && (now + expiryBuffer) >= tokens.expiryDate;

  // If token is expired or no expiry date (might be invalid), try to refresh
  if (isExpired || !tokens.expiryDate) {
    if (!tokens.refreshToken) {
      console.error('Token expired but no refresh token available');
      return null;
    }

    try {
      const oauth2Client = createOAuth2Client();
      const newAccessToken = await refreshAccessToken(oauth2Client, tokens.refreshToken);
      const newExpiryDate = Date.now() + (60 * 60 * 1000); // 1 hour from now

      // Update stored tokens
      await storeTokens({
        ...tokens,
        accessToken: newAccessToken,
        expiryDate: newExpiryDate,
      });

      return newAccessToken;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[Token Storage] Error refreshing access token:', errorMessage);

      if (errorMessage.includes('invalid_grant') ||
        errorMessage.includes('Token has been expired') ||
        errorMessage.includes('invalid_token') ||
        errorMessage.includes('Refresh token is invalid')) {
        console.error('[Token Storage] Refresh token is invalid, clearing stored tokens');
        await clearStoredTokens();
      }
      return null;
    }
  }

  return tokens.accessToken;
}

/**
 * Clear stored tokens (for logout/disconnect)
 */
export async function clearStoredTokens(): Promise<void> {
  const tokensRef = adminDb.collection('googleCalendarTokens').doc(TOKEN_DOC_ID);
  await tokensRef.delete();
}

/**
 * Check if user is authenticated with Google Calendar
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return tokens !== null && tokens.accessToken !== null;
}



