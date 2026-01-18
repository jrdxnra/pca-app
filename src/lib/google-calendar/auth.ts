import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

/**
 * Create OAuth2 client for Google Calendar API
 * @param redirectUri - Optional redirect URI. If not provided, will use GOOGLE_REDIRECT_URI env var or default to localhost
 */
export function createOAuth2Client(redirectUri?: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  // If redirectUri is provided, use it. Otherwise use env var, or throw error in production
  let finalRedirectUri: string;
  if (redirectUri) {
    finalRedirectUri = redirectUri;
  } else if (process.env.GOOGLE_REDIRECT_URI) {
    finalRedirectUri = process.env.GOOGLE_REDIRECT_URI;
  } else if (process.env.NODE_ENV === 'development' || process.env.VERCEL_ENV === undefined) {
    // Only allow localhost fallback in local development
    finalRedirectUri = 'http://localhost:3000/api/auth/google/callback';
  } else {
    // In production, we must have a redirect URI
    throw new Error('GOOGLE_REDIRECT_URI environment variable is required in production. Please set it in Vercel environment variables.');
  }

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables.');
  }

  console.log('[OAuth] Using redirect URI:', finalRedirectUri);
  console.log('[OAuth] Client ID:', clientId?.substring(0, 20) + '...');
  console.log('[OAuth] Has client secret:', !!clientSecret);
  
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, finalRedirectUri);
  
  // Verify the redirect URI is set correctly
  const clientRedirectUri = (oauth2Client as any).redirectUri_;
  console.log('[OAuth] OAuth2Client redirectUri:', clientRedirectUri);
  
  return oauth2Client;
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

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent', // Force consent screen to get refresh token
  });
  
  // Extract and decode the redirect_uri from the generated URL for debugging
  const redirectUriMatch = authUrl.match(/redirect_uri=([^&]+)/);
  if (redirectUriMatch) {
    const encodedRedirectUri = redirectUriMatch[1];
    const decodedRedirectUri = decodeURIComponent(encodedRedirectUri);
    console.log('[OAuth] Encoded redirect_uri in auth URL:', encodedRedirectUri);
    console.log('[OAuth] Decoded redirect_uri in auth URL:', decodedRedirectUri);
    console.log('[OAuth] Expected redirect_uri:', redirectUri || 'using default');
    
    // Check for common mismatches
    if (decodedRedirectUri !== (redirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback')) {
      console.error('[OAuth] MISMATCH DETECTED!');
      console.error('[OAuth] Expected:', redirectUri || process.env.GOOGLE_REDIRECT_URI);
      console.error('[OAuth] Actual in URL:', decodedRedirectUri);
    }
  }
  
  return authUrl;
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

  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token - no access token in response');
    }

    // Get actual expiry date from Google (if provided)
    const expiryDate = credentials.expiry_date 
      ? credentials.expiry_date 
      : Date.now() + (60 * 60 * 1000); // Default to 1 hour if not provided

    return credentials.access_token;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OAuth] Refresh token error:', errorMessage);
    
    // Check for specific error types
    if (errorMessage.includes('invalid_grant') || 
        errorMessage.includes('Token has been expired') ||
        errorMessage.includes('invalid_token')) {
      throw new Error('Refresh token is invalid or expired. Please reconnect Google Calendar.');
    }
    
    throw new Error(`Failed to refresh access token: ${errorMessage}`);
  }
}


