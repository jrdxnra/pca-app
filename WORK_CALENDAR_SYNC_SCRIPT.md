# Work Calendar Sync Script

**Last Updated**: January 20, 2026

## Overview
Google Apps Script that syncs events from work calendar to personal calendar (`jrdxn.ra@gmail.com`) with automatic tracking, updates, and deletion.

## Key Features
- ✅ **Auto-Sync**: Runs hourly during work hours (10 AM - 7 PM, Mon-Fri)
- ✅ **Auto-Delete**: Removes synced events when source is deleted
- ✅ **Auto-Update**: Updates synced events when source changes
- ✅ **Privacy-First**: No email extraction, uses native attendees array
- ✅ **Visual Identifier**: Red color (colorId: 11) for all synced events
- ✅ **30-Day Window**: Syncs events up to 30 days in advance

## Metadata Structure

### Extended Properties
Stored in `event.extendedProperties.shared`:
```javascript
{
  "originalId": "abc123xyz" // Work calendar event ID for tracking
}
```

### Attendee Information
Native Google Calendar attendees array (automatically transferred):
```javascript
event.attendees = [
  {
    "email": "devonmcg@google.com",
    "displayName": "Devon McGuire",
    "responseStatus": "accepted"
  }
]
```

## PCA App Integration

The PCA app matches calendar events to clients using **attendee display names**:

### Matching Logic
1. Reads `event.attendees[].displayName` from synced events
2. Compares to client names using fuzzy matching:
   - Exact: "Devon McGuire" = "Devon McGuire"
   - Partial: "Devon" matches "Devon McGuire"
   - Word: "McGuire" matches "Devon McGuire"
3. No email storage required on client records

### Benefits
- 🔒 Privacy-friendly (no email extraction)
- 🎯 More reliable (names visible to users)
- 🚀 Simpler script (uses native fields)
- 💾 Less data storage needed

## Script Source

```javascript
function masterCalendarSync() {
  // --- SETTINGS ---
  var MANUAL_OVERRIDE = true; // Set to 'true' to sync now. Set to 'false' for 10am-7pm schedule.
  var personalCalId = 'jrdxn.ra@gmail.com';
  var syncDaysLead = 30; 
  // ----------------

  var now = new Date();
  var hour = now.getHours();
  var day = now.getDay(); 

  // 1. PRIVACY & WEEKEND GUARD
  if (!MANUAL_OVERRIDE) {
    if (hour < 10 || hour >= 19 || day === 0 || day === 6) {
      console.log("Outside work hours. Sync skipped.");
      return;
    }
  } else {
    console.log("Manual Override Active: Syncing immediately.");
  }

  var startSync = now.toISOString();
  var endSync = new Date(now.getTime() + (syncDaysLead * 24 * 60 * 60 * 1000)).toISOString();

  // 2. FETCH EVENTS
  var personalEvents = Calendar.Events.list(personalCalId, {
    timeMin: startSync,
    timeMax: endSync,
    singleEvents: true
  }).items || [];

  var workEvents = Calendar.Events.list('primary', {
    timeMin: startSync,
    timeMax: endSync,
    singleEvents: true
  }).items || [];

  var workEventIds = workEvents.map(e => e.id);

  // 3. AUTO-DELETE LOGIC
  personalEvents.forEach(function(pEvent) {
    if (pEvent.extendedProperties && pEvent.extendedProperties.shared && pEvent.extendedProperties.shared.originalId) {
      var originalId = pEvent.extendedProperties.shared.originalId;
      if (workEventIds.indexOf(originalId) === -1) {
        Calendar.Events.remove(personalCalId, pEvent.id);
        console.log("Auto-Deleted (Work event removed): " + pEvent.summary);
      }
    }
  });

  // 4. SYNC & UPDATE LOGIC
  workEvents.forEach(function(workEvent) {
    if (!workEvent.start.dateTime) return; 

    // Find existing match via shared originalId
    var existing = personalEvents.filter(function(p) {
      return p.extendedProperties && 
             p.extendedProperties.shared && 
             p.extendedProperties.shared.originalId === workEvent.id;
    })[0];

    var eventResource = {
      summary: workEvent.summary,
      location: workEvent.location,
      description: workEvent.description,
      start: workEvent.start,
      end: workEvent.end,
      attendees: workEvent.attendees, // Pass the native attendees array directly
      colorId: '11', // Red
      extendedProperties: {
        shared: {
          'originalId': workEvent.id // Keeping the ID for tracking
        }
      }
    };

    if (existing) {
      // Check for changes to avoid hitting rate limits
      var hasChanged = (existing.summary !== workEvent.summary || 
                        existing.location !== workEvent.location ||
                        existing.start.dateTime !== workEvent.start.dateTime ||
                        existing.end.dateTime !== workEvent.end.dateTime ||
                        existing.description !== workEvent.description);
      
      if (hasChanged) {
        Calendar.Events.update(eventResource, personalCalId, existing.id);
        console.log("Updated: " + workEvent.summary);
      }
    } else {
      Calendar.Events.insert(eventResource, personalCalId);
      console.log("Created Red Event: " + workEvent.summary);
    }
  });
  console.log("Sync Complete.");
}

function wipeSyncedEvents() {
  var personalCalId = 'jrdxn.ra@gmail.com';
  var now = new Date();
  var future = new Date(now.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  // 1. Fetch all events in the next 30 days
  var events = Calendar.Events.list(personalCalId, {
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: true
  }).items;

  if (!events || events.length === 0) {
    Logger.log("No events found to check.");
    return;
  }

  var count = 0;
  events.forEach(function(e) {
    // 2. Check if the event has our 'originalId' tag
    if (e.extendedProperties && e.extendedProperties.private && e.extendedProperties.private.originalId) {
      try {
        Calendar.Events.remove(personalCalId, e.id);
        Logger.log("Deleted: " + e.summary);
        count++;
      } catch (err) {
        Logger.log("Error deleting " + e.summary + ": " + err);
      }
    }
  });
  
  Logger.log("Success! Deleted " + count + " synced events.");
}
```

## Setup Instructions

1. **Create Script**: Go to https://script.google.com
2. **Paste Code**: Copy both functions above
3. **Enable Calendar API**: Resources → Advanced Google Services → Calendar API (ON)
4. **Set Trigger**: Triggers → Add Trigger → masterCalendarSync → Time-driven → Hour timer → Every hour
5. **Test**: Set `MANUAL_OVERRIDE = true` and run masterCalendarSync() manually
6. **Deploy**: Set `MANUAL_OVERRIDE = false` for scheduled sync

## Troubleshooting

### No Events Syncing
- Check MANUAL_OVERRIDE setting
- Verify time is between 10 AM - 7 PM, Monday-Friday
- Check script execution logs

### Events Not Deleting
- Verify originalId exists in extendedProperties.shared
- Check wipeSyncedEvents() is looking for correct calendar ID

### Rate Limits
- Script checks for changes before updating
- Runs maximum once per hour
- Only processes next 30 days
