# Google OAuth Submission Notes

Use this when filling out the Google OAuth consent screen and verification request.

## App identity

- App name: `Performance Coach +`
- Support email: `huntjordan@google.com`
- Developer contact email: `huntjordan@google.com`
- Homepage: `https://performancecoach.web.app/`
- Privacy Policy: `https://performancecoach.web.app/privacy`
- Terms of Service: `https://performancecoach.web.app/terms`
- OAuth client: `PCA App`
- Client ID prefix: `63362206075-2lkbi...`

## Logo asset

- Upload this file in Google Cloud Console if PNG is needed:
  - `public/performance-coach-plus-logo.png`
- SVG source:
  - `public/performance-coach-plus-logo.svg`

## Current scopes requested

- `https://www.googleapis.com/auth/calendar.events`
- `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

## Scope justification text

### Google Calendar Events scope

`Performance Coach + uses the Google Calendar Events scope so coaches can create, update, and manage coaching session events directly from the application. Users explicitly connect Google Calendar from the Configure page after signing in. The app uses this access only to support scheduling workflows initiated by the signed-in user.`

### Google Calendar List Readonly scope

`Performance Coach + uses the Google Calendar List Readonly scope so the signed-in user can choose which of their calendars should be used for scheduling and sync. This is required to let the user select the correct calendar inside the app before events are created or updated.`

## Sensitive data handling summary

`Performance Coach + stores OAuth tokens only to maintain the user’s calendar connection and perform the requested calendar operations. Users can disconnect Google Calendar inside the app to remove the connection, and they can also revoke access from their Google Account permissions page.`

## Demo video outline

Record a short video, ideally 2 to 5 minutes, showing the full real user flow:

1. Open `https://performancecoach.web.app/`
2. Click sign in and authenticate with Google
3. Show that login succeeds without requesting Calendar access
4. Open Configure
5. Show the Calendar section and the signed-in account email
6. Click `Connect Google Calendar`
7. Show the Google consent screen
8. Explain why the app needs:
   - calendar list access
   - event create/update access
9. Approve the request
10. Show the app returning to Configure with a successful connection
11. Show the calendar selector or connected status
12. Show a scheduling action that creates or updates a calendar event
13. Show the disconnect flow

## Notes for Google reviewer

- Calendar permission is requested separately from app login.
- The app does not ask for full Google account access beyond what is required for the scheduling workflow.
- The app is intended for coaches managing session scheduling and related planning.
