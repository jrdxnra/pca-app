import { refreshAccessToken, createOAuth2Client } from './auth';
import type { StoredTokens } from './types';
import * as fs from 'fs';
import * as path from 'path';

const TOKEN_DOC_ID = 'google-calendar-tokens'; // Legacy single doc
const getLocalTokenFile = (userId?: string) =>
  userId
    ? path.join(process.cwd(), `.google-calendar-tokens-${userId}.json`)
    : path.join(process.cwd(), '.google-calendar-tokens.json');

// Helper to check if we should fall back to local storage
const isDev = process.env.NODE_ENV === 'development';

/**
 * Helper: Read tokens from local file (Dev Fallback)
 */
function readLocalTokens(userId?: string): StoredTokens | null {
  const filePath = getLocalTokenFile(userId);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const tokens = JSON.parse(data);
    return tokens as StoredTokens;
  } catch (error) {
    console.error('[Token Storage] Error reading local token file:', error);
    return null;
  }
}

/**
 * Helper: Write tokens to local file (Dev Fallback)
 */
function writeLocalTokens(tokens: StoredTokens, userId?: string): void {
  try {
    fs.writeFileSync(getLocalTokenFile(userId), JSON.stringify(tokens, null, 2), 'utf-8');
    console.log('[Token Storage] Tokens saved to local file (Dev Fallback)');
  } catch (error) {
    console.error('[Token Storage] Error writing local token file:', error);
  }
}

/**
 * Store Google Calendar OAuth tokens in Firestore
 */
export async function storeTokens(tokens: StoredTokens, userId?: string): Promise<void> {
  // Dev Fallback: Write to local file to avoid Firebase Client SDK issues in API routes
  if (isDev) {
    console.warn(`[storeTokens] Dev environment detected. Using local file storage for user ${userId || 'global'}.`);
    writeLocalTokens(tokens, userId);
    return;
  }

  try {
    // Check if we are on the server (Node.js) to use Admin SDK
    // This bypasses Firestore Rules which is required for backend operations
    if (typeof window === 'undefined') {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const db = getAdminDb();

      console.log(`[storeTokens] Server-side detected. Storing tokens for ${userId || 'global'}`);

      const docPath = userId
        ? `users/${userId}/tokens/google-calendar`
        : `googleCalendarTokens/${TOKEN_DOC_ID}`;

      const dataToStore: Record<string, unknown> = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiryDate: tokens.expiryDate,
        updatedAt: new Date(),
      };

      if (tokens.userId !== undefined) {
        dataToStore.userId = tokens.userId;
      }

      await db.doc(docPath).set(dataToStore, { merge: true });
      return;
    }

    // Client-side fallback (should rarely happen for this file)
    const { doc, setDoc } = await import('firebase/firestore');
    const { getDbAsync } = await import('@/lib/firebase/config');

    const db = await getDbAsync();
    if (!db) {
      console.error('[storeTokens] ERROR: Database not initialized!');
      return;
    }

    const tokensRef = userId
      ? doc(db, 'users', userId, 'tokens', 'google-calendar')
      : doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);

    const dataToStore: Record<string, unknown> = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiryDate: tokens.expiryDate,
      updatedAt: new Date(),
    };

    if (tokens.userId !== undefined) {
      dataToStore.userId = tokens.userId;
    }

    await setDoc(tokensRef, dataToStore, { merge: true });
  } catch (error) {
    console.error('[storeTokens] ERROR storing tokens:', error);
    throw error;
  }
}

/**
 * Retrieve stored tokens from Firestore
 */
export async function getStoredTokens(userId?: string): Promise<StoredTokens | null> {
  // Dev Fallback: Read from local file
  if (isDev) {
    return readLocalTokens(userId);
  }

  try {
    // ALWAYS use Admin SDK on the server to bypass Firestore Rules
    if (typeof window === 'undefined') {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const db = getAdminDb();

      const docPath = userId
        ? `users/${userId}/tokens/google-calendar`
        : `googleCalendarTokens/${TOKEN_DOC_ID}`;

      const tokensDoc = await db.doc(docPath).get();

      if (!tokensDoc.exists) {
        return null;
      }

      const data = tokensDoc.data();
      if (!data) {
        return null;
      }

      return {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken || null,
        expiryDate: data.expiryDate || null,
        userId: data.userId,
      };
    }

    // Client-side fallback (fallback for client-side components if they really need it)
    console.warn('[Token Storage] Client-side token retrieval is restricted. Use server-side API routes instead.');

    // Attempting client-side fetch (this will likely fail with permissions but we keep it for backward compatibility)
    const { doc, getDoc } = await import('firebase/firestore');
    const { getDbAsync } = await import('@/lib/firebase/config');

    const db = await getDbAsync();
    if (!db) return null;

    const tokensRef = userId
      ? doc(db, 'users', userId, 'tokens', 'google-calendar')
      : doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);

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
  } catch (error) {
    console.error('[Token Storage] Error retrieving tokens:', error);
    // Be more specific if it's a permission error
    if (String(error).includes('permissions')) {
      console.warn('[Token Storage] Permission error detected. If this is on the server, ensure Firebase Admin SDK is initialized correctly.');
    }
    return null;
  }
}

/**
 * Get a valid access token, refreshing if necessary
 * 
 * NOTE: This only runs when user is actively using the site (API requests).
 * No background token refresh - tokens only refresh when needed during active use.
 * When user is off the site, tokens remain stored but no refresh happens.
 */
export async function getValidAccessToken(userId?: string): Promise<string | null> {
  const tokens = await getStoredTokens(userId);

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
      }, userId);

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
        await clearStoredTokens(userId); // Local function call, not imported
      }

      return null;
    }
  }

  return tokens.accessToken;
}

/**
 * Clear stored tokens (for logout/disconnect)
 */
export async function clearStoredTokens(userId?: string): Promise<void> {
  // Dev Fallback: Clear local file
  if (isDev) {
    try {
      const filePath = getLocalTokenFile(userId);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Token Storage] Local token file cleared for ${userId || 'global'}`);
      }
    } catch (e) {
      console.error('[Token Storage] Error clearing local token file', e);
    }
    return;
  }

  try {
    if (typeof window === 'undefined') {
      const { getAdminDb } = await import('@/lib/firebase/admin');
      const db = getAdminDb();

      const docPath = userId
        ? `users/${userId}/tokens/google-calendar`
        : `googleCalendarTokens/${TOKEN_DOC_ID}`;

      await db.doc(docPath).delete();
      return;
    }

    const { doc, deleteDoc } = await import('firebase/firestore');
    const { getDbAsync } = await import('@/lib/firebase/config');

    const db = await getDbAsync();
    if (!db) return;

    const tokensRef = userId
      ? doc(db, 'users', userId, 'tokens', 'google-calendar')
      : doc(db, 'googleCalendarTokens', TOKEN_DOC_ID);

    await deleteDoc(tokensRef);
  } catch (error) {
    console.error('[Token Storage] Error clearing tokens:', error);
  }
}

/**
 * Check if user is authenticated with Google Calendar
 */
export async function isAuthenticated(userId?: string): Promise<boolean> {
  const tokens = await getStoredTokens(userId);
  return tokens !== null && tokens.accessToken !== null;
}
