# Google OAuth Verification Checklist

This checklist is for the current PCA App Google OAuth setup.

## Current OAuth client

- Client name: `PCA App`
- Client ID prefix: `63362206075-2lkbi...`

Use this client consistently in all environments.

## Current domains and redirect URIs

### Authorized JavaScript origins

- `http://localhost:3000`
- `https://performancecoach.web.app`
- `https://performancecoach.firebaseapp.com`
- `https://jubilant-goldfish-5gg6gww654r27vgr-3000.app.github.dev`
- Optional local fallback: `http://127.0.0.1:3000`
- Optional local HTTPS fallback: `https://localhost:3000`

### Authorized redirect URIs

- `http://localhost:3000/api/auth/google/callback`
- `http://127.0.0.1:3000/api/auth/google/callback`
- `https://localhost:3000/api/auth/google/callback`
- `https://performancecoach.web.app/api/auth/google/callback`
- `https://performancecoach.firebaseapp.com/api/auth/google/callback`
- `https://jubilant-goldfish-5gg6gww654r27vgr-3000.app.github.dev/api/auth/google/callback`

## Current app behavior

- App login is Google authentication only.
- Google Calendar access is requested separately from Configure.
- Calendar connect should prefer the signed-in Firebase email via `login_hint`.

## Scopes currently requested

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

These are the scopes to justify during verification.

## Consent screen setup

In Google Cloud Console -> APIs & Services -> OAuth consent screen:

1. Set app name to `PCA App`.
2. Set support email.
3. Set developer contact email.
4. Upload app logo.
5. Add homepage URL.
6. Add privacy policy URL.
7. Add terms of service URL.
8. Verify the production domain you control.

Notes:

- `localhost` and `app.github.dev` are fine for development testing, but they are not your verification domain.
- Verification should center on the production domain you control, preferably `performancecoach.web.app` or a custom domain you own.

## Before publishing to Production

1. Confirm the runtime `GOOGLE_CLIENT_ID` is the `PCA App` client in local and production envs.
2. Confirm the matching `GOOGLE_CLIENT_SECRET` is used with that same client.
3. Confirm the production `GOOGLE_REDIRECT_URI` points to `https://performancecoach.web.app/api/auth/google/callback`.
4. Confirm the Google Calendar API is enabled.
5. Test sign-in and separate calendar connect on production.
6. Test disconnect and reconnect flow.

## Publish and verification sequence

1. Move the OAuth consent screen from Testing to Production.
2. Submit verification for the two calendar scopes.
3. Provide a demo video showing:
   - user signs in
   - user opens Configure
   - user clicks Connect Google Calendar
   - Google account chooser / consent screen
   - successful return to the app
   - calendar list access and event sync behavior
4. Provide written scope justification:
   - `calendar.events`: required to create, update, and manage coaching session events
   - `calendar.calendarlist.readonly`: required to let the user choose which calendar to sync
5. Provide privacy policy and terms links in the submission.

## Recommended production cleanup

1. Add a custom domain you control for stronger trust and easier verification.
2. Keep the separate Calendar connect step; do not request Calendar permissions during app login.
3. Show the signed-in account email in Configure so users know which Google account will be connected.

## Manual retest checklist

1. Sign in to the app with the intended Google account.
2. Open Configure.
3. Confirm the signed-in email shown in the Calendar connect card.
4. Click Connect Google Calendar.
5. Confirm Google prefers the same email.
6. Approve access.
7. Confirm return to `/configure?connected=true`.
8. Confirm calendar connection status is healthy.
