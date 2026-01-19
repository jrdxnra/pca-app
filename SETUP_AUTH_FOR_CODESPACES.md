# Setup Authentication for Codespaces

## Problem
When logging in, you get authentication URL and permission issues because the OAuth redirect URI doesn't match your Codespaces URL.

## Quick Fix

### Step 1: Get Your Codespaces URL

1. Look at the browser address bar - it should be something like:
   ```
   https://jubilant-goldfish-5gg6gww654r27vgr-3000.app.github.dev/
   ```

2. Copy the base URL (everything before the path)

### Step 2: Update `.env.local`

Update your `.env.local` file with the correct redirect URI. Replace `YOUR_CODESPACES_URL`:

```bash
# Current (WRONG for Codespaces)
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback

# Change to (CORRECT for Codespaces)
GOOGLE_REDIRECT_URI=https://jubilant-goldfish-5gg6gww654r27vgr-3000.app.github.dev/api/auth/google/callback
```

### Step 3: Update Google Cloud Console

1. Go to [Google Cloud Console - Credentials](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID: `220447477156-i7mis4i6nfqa5ag8ud2c0943t11ns98m.apps.googleusercontent.com`
3. Click the edit (pencil) icon
4. Under "Authorized redirect URIs", add your new Codespaces URL:
   ```
   https://jubilant-goldfish-5gg6gww654r27vgr-3000.app.github.dev/api/auth/google/callback
   ```
5. Keep the existing ones:
   - `http://localhost:3000/api/auth/google/callback`
   - `https://performancecoach.web.app/api/auth/google/callback`
6. Click **SAVE**

### Step 4: Refresh and Test

1. Refresh your browser
2. Try logging in / connecting Google Calendar again
3. Should redirect to Google OAuth page successfully

## Troubleshooting

### Error: "redirect_uri_mismatch"
- This means the redirect URI in your `.env.local` doesn't match what's registered in Google Cloud
- Check both the `.env.local` file and Google Cloud Console
- Make sure there are no trailing slashes or typos

### Error: "Missing credentials"
- Your `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is not set
- Check `.env.local` has both values
- Restart the dev server after updating `.env.local`

### Still not working?
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check the browser console (F12) for any error messages
- Check the terminal where `npm run dev` is running for auth logs

## Environment Variables Reference

Current values in `.env.local`:

```
# Firebase Configuration - Performance Coach App
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=performancecoachapp-26bd1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=performancecoachapp-26bd1.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=63362206075
NEXT_PUBLIC_FIREBASE_APP_ID=1:63362206075:web:1a35b23242b06fd56f15de

# Google OAuth Configuration (UPDATE REDIRECT_URI FOR YOUR ENVIRONMENT)
GOOGLE_CLIENT_ID=220447477156-i7mis4i6nfqa5ag8ud2c0943t11ns98m.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://YOUR_CODESPACES_URL/api/auth/google/callback
```

## More Info

- See [GOOGLE_CALENDAR_OAUTH_SETUP.md](GOOGLE_CALENDAR_OAUTH_SETUP.md) for full OAuth setup
- See [src/app/api/auth/google/route.ts](src/app/api/auth/google/route.ts) for debugging logs
