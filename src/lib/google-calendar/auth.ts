import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Create OAuth2 client for Google Calendar API
 * @param redirectUri - Optional redirect URI. If not provided, will use GOOGLE_REDIRECT_URI env var or default to localhost
 */
export function createOAuth2Client(redirectUri?: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const defaultRedirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';
  const finalRedirectUri = redirectUri || defaultRedirectUri;

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, finalRedirectUri);
}

/**
 * Get authorization URL for OAuth flow
 * @param redirectUri - Optional redirect URI. If not provided, uses default from env or localhost
 */
export function getAuthUrl(redirectUri?: string): string {
  const oauth2Client = createOAuth2Client(redirectUri);
  
  const scopes = [
    'https://www.googleapis.com/auth/calendar', // Full calendar access (read/write)
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 * @param code - Authorization code from OAuth callback
 * @param redirectUri - Optional redirect URI. Must match the one used in getAuthUrl
 */
export async function getTokensFromCode(code: string, redirectUri?: string): Promise<{
  access_token: string;
  refresh_token: string | null;
  expiry_date: number | null;
}> {
  const oauth2Client = createOAuth2Client(redirectUri);
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token || null,
    expiry_date: tokens.expiry_date || null,
  };
}

/**
 * Set credentials on OAuth2 client from stored tokens
 */
export function setCredentials(
  oauth2Client: OAuth2Client,
  accessToken: string,
  refreshToken?: string | null
): void {
  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken || undefined,
  });
}

/**
 * Refresh access token if expired
 */
export async function refreshAccessToken(
  oauth2Client: OAuth2Client,
  refreshToken: string
): Promise<string> {
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (!credentials.access_token) {
    throw new Error('Failed to refresh access token');
  }

  return credentials.access_token;
}


