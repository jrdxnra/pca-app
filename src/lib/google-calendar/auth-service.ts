import { getStoredTokens, storeTokens, clearStoredTokens } from './adapters/token-adapter';
import { createOAuth2Client, refreshAccessToken } from './auth';

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
    const expiryBuffer = 10 * 60 * 1000; // 10 minutes
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

            // Get the actual expiry from Google's response
            // Default to 1 hour if not provided
            const newExpiryDate = Date.now() + (60 * 60 * 1000);

            // Update stored tokens using ADAPTER
            await storeTokens({
                ...tokens,
                accessToken: newAccessToken,
                expiryDate: newExpiryDate,
            }, userId);

            return newAccessToken;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            console.error('[AuthService] Error refreshing access token:', errorMessage);

            // If refresh fails, the refresh token might be invalid
            if (errorMessage.includes('invalid_grant') ||
                errorMessage.includes('Token has been expired') ||
                errorMessage.includes('invalid_token') ||
                errorMessage.includes('Refresh token is invalid')) {
                console.error('[AuthService] Refresh token is invalid, clearing stored tokens');
                await clearStoredTokens(userId);
            }

            return null;
        }
    }

    return tokens.accessToken;
}

export async function isAuthenticated(userId?: string): Promise<boolean> {
    const tokens = await getStoredTokens(userId);
    return tokens !== null && tokens.accessToken !== null;
}
