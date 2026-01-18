import { 
  collection, 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc 
} from 'firebase/firestore';
import { refreshAccessToken, createOAuth2Client } from './auth';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  userId?: string; // For future multi-user support
}

const TOKEN_DOC_ID = 'google-calendar-tokens'; // Single document for now

function hasFirebaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
      process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );
}

async function getDb() {
  if (!hasFirebaseConfig()) return null;
  try {
    const { getDbAsync } = await import('@/lib/firebase/config');
    return await getDbAsync();
  } catch (error) {
    console.error('Error initializing Firestore in token-storage:', error);
    return null;
  }
}

/**
 * Store Google Calendar OAuth tokens in Firestore
 */
export async function storeTokens(tokens: StoredTokens): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const tokensRef = doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);
  await setDoc(tokensRef, {
    ...tokens,
    updatedAt: new Date(),
  }, { merge: true });
}

/**
 * Retrieve stored tokens from Firestore
 */
export async function getStoredTokens(): Promise<StoredTokens | null> {
  const db = await getDb();
  if (!db) return null;
  const tokensRef = doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);
  const tokensDoc = await getDoc(tokensRef);
  
  if (!tokensDoc.exists()) {
    return null;
  }

  const data = tokensDoc.data();
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

  // Check if token is expired (with 5 minute buffer)
  // Also check if token might be invalid even if not expired (try-catch on actual API call)
  const now = Date.now();
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  const isExpired = tokens.expiryDate && (now + expiryBuffer) >= tokens.expiryDate;
  
  // If token is expired or no expiry date (might be invalid), try to refresh
  if (isExpired || !tokens.expiryDate) {
    // Token is expired or about to expire, refresh it
    if (!tokens.refreshToken) {
      console.error('Token expired but no refresh token available');
      return null;
    }

    try {
      const oauth2Client = createOAuth2Client();
      const newAccessToken = await refreshAccessToken(oauth2Client, tokens.refreshToken);
      
      // Get the actual expiry from Google's response
      // We need to get it from the OAuth2 client after refresh
      // For now, assume 1 hour (Google's default)
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
      
      // If refresh fails, the refresh token might be invalid
      // Clear tokens so user can reconnect
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
  const db = await getDb();
  if (!db) return;
  const tokensRef = doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);
  await deleteDoc(tokensRef);
}

/**
 * Check if user is authenticated with Google Calendar
 */
export async function isAuthenticated(): Promise<boolean> {
  const tokens = await getStoredTokens();
  return tokens !== null && tokens.accessToken !== null;
}


