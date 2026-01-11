# PC+ App - Troubleshooting

## Calendar Sync Issues

### Calendar Sync Button Not Working After Computer Restart

**Problem**: After restarting your computer, clicking the calendar sync button in the header doesn't refresh the calendar. The icon might appear grayed out.

**Cause**: The app's connection status can become stale after a restart. The sync button was checking a cached "connected" state instead of re-verifying with Google.

**Solution** (Fixed Jan 2026):
- The sync button now automatically re-checks your Google Calendar connection before syncing
- If the cached state says "not connected," it will verify with Google first
- If you're actually connected, it will proceed with the sync
- No need to visit App Config to reconnect anymore

**If it still doesn't work**:
1. Go to **Configure** → **App Config**
2. Disconnect and reconnect Google Calendar
3. Return to the schedule and try syncing again

---

### Calendar Not Refreshing (Cached Data)

**Problem**: Clicking the sync button shows "Calendar synced successfully!" but you don't see new events.

**Cause**: The calendar store has a 30-second cache to prevent excessive API calls.

**Solution** (Fixed Jan 2026):
- The header sync button now forces a refresh, bypassing the cache
- Automatic fetches (page load, navigation) still use the cache
- Manual sync always fetches fresh data

---

## Next.js / Turbopack Issues

### "Async Client Component" Error

**Problem**: Intermittent error saying something about "async Client Component" when navigating between pages (especially Settings → Schedule).

**Cause**: This is a known Next.js 16 / Turbopack bundler quirk - a race condition during navigation or hot module reload. It's not caused by actual async client components in the code.

**Solution**:
- Error recovery pages have been added (`/src/app/error.tsx` and `/src/app/programs/error.tsx`)
- When the error occurs, you'll see a friendly "Try Again" button
- Clicking "Try Again" should load the page properly

**If it keeps happening frequently**:
1. Consider disabling Turbopack: Change `npm run dev` to use `next dev` without `--turbopack`
2. Or downgrade from Next.js 16 to 15 for more stability

---

## Google Calendar Integration Issues

### Error 403: access_denied - "App has not completed Google verification process"

**Problem**: You're trying to sign in with an email that isn't in the test users list.

**Solution**:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** > **OAuth consent screen**
3. Scroll down to **Test users** section
4. Click **+ ADD USERS**
5. Add your email address (`jrdxn.ra@gmail.com`)
6. Click **SAVE**
7. Try the OAuth flow again

**Note**: If your app is in "Testing" mode (which it is by default for External apps), only test users can sign in. Once you add your email, you'll be able to authenticate.

---

### "Redirect URI mismatch" Error

**Problem**: The redirect URI in your `.env.local` doesn't match what's configured in Google Cloud Console.

**Solution**:
1. Check your `.env.local` file:
   ```bash
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```

2. Go to Google Cloud Console > **APIs & Services** > **Credentials**
3. Click on your OAuth 2.0 Client ID
4. Under **Authorized redirect URIs**, make sure you have:
   - `http://localhost:3000/api/auth/google/callback` (for development)
   - `https://yourdomain.com/api/auth/google/callback` (for production)

5. Make sure there are no trailing slashes or typos

---

### "Invalid client secret" Error

**Problem**: The client secret in `.env.local` is incorrect or outdated.

**Solution**:
1. Go to Google Cloud Console > **APIs & Services** > **Credentials**
2. Click on your OAuth 2.0 Client ID
3. Copy the **Client secret** (if you can still see it)
4. Update `.env.local`:
   ```bash
   GOOGLE_CLIENT_SECRET=GOCSPX-your-actual-secret-here
   ```
5. Restart your Next.js dev server

**Note**: If you closed the dialog when creating the credentials, you can't view the secret again. You'll need to create new credentials.

---

### Events Not Appearing After Connection

**Problem**: Connected successfully but events don't show up.

**Solution**:
1. Check browser console for errors
2. Verify events exist in your Google Calendar for the date range you're viewing
3. Check that the calendar ID is correct (default is `'primary'`)
4. Try refreshing the page
5. Check that `fetchEvents()` is being called with the correct date range

---

### Token Refresh Errors

**Problem**: Getting errors about expired tokens.

**Solution**:
1. The app should auto-refresh tokens, but if it fails:
2. Disconnect and reconnect Google Calendar
3. Check that `GOOGLE_CLIENT_SECRET` is set correctly
4. Verify the refresh token was saved in Firestore

---

### "Failed to fetch calendar events" Error

**Problem**: API call to Google Calendar is failing.

**Possible Causes**:
1. **Not authenticated**: Make sure you've completed OAuth flow
2. **Token expired**: Try disconnecting and reconnecting
3. **Calendar API not enabled**: Go to Google Cloud Console > **APIs & Services** > **Library** > Search "Google Calendar API" > Click **Enable**
4. **Wrong calendar ID**: Check that `selectedCalendarId` in config is correct (usually `'primary'`)

---

## Debugging Tips

### Check Authentication Status

1. Open browser DevTools (F12)
2. Go to **Application** tab > **Local Storage**
3. Look for `calendar-config` - should show your calendar settings
4. Check **Network** tab when clicking "Connect Google Calendar" to see OAuth flow

### Check Firestore for Tokens

1. Go to Firebase Console
2. Navigate to **Firestore Database**
3. Look for collection `googleCalendarTokens`
4. Should have a document with `accessToken` and `refreshToken`

### Test API Endpoints Directly

You can test the API endpoints directly:

```bash
# Check auth status
curl http://localhost:3000/api/calendar/auth/status

# Should return: {"authenticated": true} or {"authenticated": false}
```

---

## Still Having Issues?

1. **Check the browser console** for detailed error messages
2. **Check the Next.js server logs** for API route errors
3. **Verify all environment variables** are set correctly
4. **Make sure Google Calendar API is enabled** in Google Cloud Console
5. **Ensure your email is in the test users list** (for testing mode apps)

---*Last Updated: January 10, 2026*