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
  console.log('[storeTokens] Starting token storage');
  const db = await getDb();
  if (!db) {
    console.error('[storeTokens] ERROR: Database not initialized!');
    return;
  }
  
  console.log('[storeTokens] Database connected');
  const tokensRef = doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);
  console.log('[storeTokens] Token reference:', TOKEN_DOC_ID);
  
  try {
    // Build object, excluding undefined userId to prevent Firebase errors
    const dataToStore: Record<string, unknown> = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiryDate: tokens.expiryDate,
      updatedAt: new Date(),
    };
    
    // Only include userId if it's defined
    if (tokens.userId !== undefined) {
      dataToStore.userId = tokens.userId;
    }
    
    await setDoc(tokensRef, dataToStore, { merge: true });
    console.log('[storeTokens] Tokens stored successfully in Firestore');
  } catch (error) {
    console.error('[storeTokens] ERROR storing tokens:', error);
    throw error;
  }
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
 * 
 * NOTE: This only runs when user is actively using the site (API requests).
 * No background token refresh - tokens only refresh when needed during active use.
 * When user is off the site, tokens remain stored but no refresh happens.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getStoredTokens();
  
  if (!tokens || !tokens.accessToken) {
    return null;
  }

  // Check if token is expired (with 10 minute buffer for proactive refresh)
  // This ensures tokens are refreshed before they expire, keeping the session active longer
  const now = Date.now();
  const expiryBuffer = 10 * 60 * 1000; // 10 minutes in milliseconds (increased from 5)
  const isExpired = tokens.expiryDate && (now + expiryBuffer) >= tokens.expiryDate;
  
  // If token is expired or no expiry date (might be invalid), try to refresh
  // Refresh tokens don't expire (unless revoked), so we can keep refreshing indefinitely
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
      // Note: refreshAccessToken doesn't return expiry_date, so we'll use 1 hour
      // Google access tokens typically last 1 hour
      // The refresh token itself doesn't expire (unless revoked), so we can keep refreshing
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


