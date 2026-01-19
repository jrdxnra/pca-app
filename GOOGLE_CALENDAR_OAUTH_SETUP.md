# Google Calendar OAuth Setup Guide

## Step 1: Create OAuth 2.0 Client ID

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project (or create one if needed)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **+ CREATE CREDENTIALS** → **OAuth client ID**

## Step 2: Configure OAuth Consent Screen (if not done)

If you see a warning about OAuth consent screen:
1. Click **CONFIGURE CONSENT SCREEN**
2. Choose **External** (unless you have a Google Workspace)
3. Fill in required fields:
   - App name: "PCA App" (or your app name)
   - User support email: Your email
   - Developer contact: Your email
4. Click **SAVE AND CONTINUE**
5. Skip Scopes (click **SAVE AND CONTINUE**)
6. Add test users if needed (click **SAVE AND CONTINUE**)
7. Review and go back to Credentials

## Step 3: Create OAuth Client ID

1. In **Credentials** page, click **+ CREATE CREDENTIALS** → **OAuth client ID**
2. Choose **Application type**: **Web application**
3. Name it: "PCA App Web Client" (or similar)
4. **Authorized JavaScript origins**:
   - `http://localhost:3000` (for local dev)
   - `https://your-domain.vercel.app` (your production domain)
5. **Authorized redirect URIs**:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://your-domain.vercel.app/api/auth/google/callback`
6. Click **CREATE**

## Step 4: Copy Credentials

After creating, you'll see:
- **Client ID** (looks like: `123456789-abc...xyz.apps.googleusercontent.com`)
- **Client secret** (looks like: `GOCSPX-abc...xyz`)

## Step 5: Add to Environment Variables

Add these to your Vercel project (or `.env.local` for local):

```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=https://your-domain.vercel.app/api/auth/google/callback
```

### For Vercel:
1. Go to your Vercel project
2. Settings → Environment Variables
3. Add the three variables above
4. Redeploy your app

### For Local Development:
Add to `.env.local`:
```
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

## Step 6: Enable Google Calendar API

1. Go to **APIs & Services** → **Library**
2. Search for "Google Calendar API"
3. Click **ENABLE**

## Step 7: Test

1. Go to your app → Configure → App Config
2. Click "Connect Google Calendar"
3. You should be redirected to Google's consent screen
4. After authorizing, you'll be redirected back to your app
5. Calendar events should now load!

## Troubleshooting

### "redirect_uri_mismatch" error
- Make sure the redirect URI in Google Cloud Console **exactly matches** what's in your code
- Check for trailing slashes, http vs https, etc.

### "access_denied" error
- Make sure you clicked "Allow" on the consent screen
- Check that Google Calendar API is enabled

### Still getting 401 errors
- Check that environment variables are set correctly
- Verify tokens are being stored in Firestore (`googleCalendarTokens` collection)
- Try disconnecting and reconnecting

## Important Notes

- The redirect URI must **exactly match** what's configured in Google Cloud Console
- For production, use your actual Vercel domain
- Never commit `.env.local` to git (it's in `.gitignore`)
- The OAuth client ID is safe to expose (it's public), but keep the secret secure
