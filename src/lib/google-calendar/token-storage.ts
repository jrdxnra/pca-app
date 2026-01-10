import { 
  collection, 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc 
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { refreshAccessToken, createOAuth2Client } from './auth';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string | null;
  expiryDate: number | null;
  userId?: string; // For future multi-user support
}

const TOKEN_DOC_ID = 'google-calendar-tokens'; // Single document for now

/**
 * Store Google Calendar OAuth tokens in Firestore
 */
export async function storeTokens(tokens: StoredTokens): Promise<void> {
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
  const now = Date.now();
  const expiryBuffer = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  if (tokens.expiryDate && (now + expiryBuffer) >= tokens.expiryDate) {
    // Token is expired or about to expire, refresh it
    if (!tokens.refreshToken) {
      console.error('Token expired but no refresh token available');
      return null;
    }

    try {
      const oauth2Client = createOAuth2Client();
      const newAccessToken = await refreshAccessToken(oauth2Client, tokens.refreshToken);
      
      // Update stored tokens
      await storeTokens({
        ...tokens,
        accessToken: newAccessToken,
        expiryDate: Date.now() + (60 * 60 * 1000), // Assume 1 hour expiry
      });

      return newAccessToken;
    } catch (error) {
      console.error('Error refreshing access token:', error);
      return null;
    }
  }

  return tokens.accessToken;
}

/**
 * Clear stored tokens (for logout/disconnect)
 */
export async function clearStoredTokens(): Promise<void> {
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


