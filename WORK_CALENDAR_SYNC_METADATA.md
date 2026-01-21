# Work Calendar Sync - Metadata Documentation

## Overview
A script syncs work calendar events to personal calendar (jrdxn.ra@gmail.com) with hidden metadata for API consumption.

## Sync Details

### Source & Destination
- **Source**: Work calendar account
- **Destination**: jrdxn.ra@gmail.com (Personal calendar)
- **Event Color**: Red (Google API colorId: 11)
- **Sync Behavior**: If work event is deleted, personal copy is auto-deleted

### Metadata Storage (Google Calendar API v3)
The script uses `extendedProperties.private` to store sensitive guest data. This information is:
- **NOT visible** in the Google Calendar UI
- **Accessible via API** with proper fields parameter

### Metadata Fields

#### 1. Guest Emails
- **Path**: `event.extendedProperties.private.guest_emails`
- **Format**: Comma-separated string of attendee email addresses
- **Example**: `"john@example.com,jane@example.com"`
- **Purpose**: Identify which client the event is for

#### 2. Original Event ID
- **Path**: `event.extendedProperties.private.originalId`
- **Format**: String (Event ID from source work calendar)
- **Purpose**: Track which work event this was synced from

## API Access Requirements

### Fetching Events with Metadata
To retrieve the guest list, the API request must include `extendedProperties` in the fields parameter:

```javascript
// Endpoint
GET https://www.googleapis.com/calendar/v3/calendars/jrdxn.ra@gmail.com/events

// Required Fields Parameter
fields: 'items(id,summary,description,start,end,location,attendees,creator,htmlLink,extendedProperties,colorId,recurringEventId)'
```

### Example Event Structure
```json
{
  "id": "abc123",
  "summary": "Training Session",
  "start": { "dateTime": "2026-01-20T10:00:00-08:00" },
  "end": { "dateTime": "2026-01-20T11:00:00-08:00" },
  "colorId": "11",
  "extendedProperties": {
    "private": {
      "guest_emails": "client@example.com",
      "originalId": "xyz789_20260120T180000Z"
    }
  }
}
```

## Sync Schedule
- **Work Hours**: 10:00 AM – 7:00 PM (Monday – Friday)
- **Trigger**: Runs every hour
- **Data Residency**: All data remains within Google ecosystem

## Privacy & Security
- Guest emails are stored in private extended properties (not visible in calendar UI)
- No third-party middleware used for sync
- Only accessible via authenticated Google Calendar API requests
- Complies with Google Calendar API data usage policies

## PCA App Integration
The PCA app uses this metadata to:
1. Automatically match calendar events to clients by email
2. Pre-populate client information when creating workouts
3. Track which events have associated workouts
4. Display matching statistics and diagnostics

### Client Matching Algorithm
1. Extract `guest_emails` from `extendedProperties.private`
2. Split comma-separated string into individual emails
3. Normalize emails (lowercase, handle Gmail dot notation)
4. Compare against client database emails
5. Return matched client ID or null

## Implementation Files
- `/src/lib/services/clientMatching.ts` - Matching logic
- `/src/lib/google-calendar/calendar-service.ts` - API calls with extendedProperties
- `/src/lib/google-calendar/types.ts` - Type definitions
- `/src/components/calendar/ClientMatchingDiagnostic.tsx` - UI diagnostic tool
