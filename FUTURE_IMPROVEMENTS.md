# Future Improvements & Notes

This file contains notes and ideas for future improvements to the PCA app. Items can be added, updated, or marked as completed as work progresses.

---

## Schedule Management

### Ongoing Period Workout Category Dropdown
**Date Added:** Current Session  
**Priority:** Medium  
**Status:** Pending

On the schedule management screen, the "Ongoing" period displays a settings icon, but clicking it doesn't open a dropdown menu to change the workout category. 

**Desired Behavior:**
- Clicking the settings icon next to "Ongoing" should open a dropdown menu
- The dropdown should list available workout categories (e.g., "Strength", "Power", "Endurance", "Cardio", etc.)
- User should be able to change the workout category from "Ongoing" to another category from the list

**Location:** Schedule/Programs page - Period indicators in calendar view

### Schedule Modal Save & Create Workout
**Date Added:** Current Session  
**Priority:** High  
**Status:** Completed

The schedule modal doesn't have a save option that allows saving the event and creating it. After saving, the user should be able to click on the workout that was created based on the "workout category" that was selected when the event was created.

**Implementation:**
- Created `CreateScheduleEventDialog` component
- Added "Save & Create Workout" button
- When saved, creates calendar event and corresponding workout
- Links event to workout automatically
- Clicking on event navigates to workout builder

**Location:** Schedule modal/dialog - Event creation workflow (`src/components/programs/CreateScheduleEventDialog.tsx`)

**Note:** Currently uses placeholder periodId ('quick-workouts'). May need to create/find actual Quick Workouts period in production.

### MiniCalendarTooltip Positioning Issue
**Date Added:** Current Session  
**Priority:** Medium  
**Status:** Completed

The `MiniCalendarTooltip` component (the calendar icon in the top right) is great, but it's appearing above the `data-slot="card"` element, which causes layout issues. The tooltip should be positioned so it doesn't overlap with the card content.

**Component Name:** `MiniCalendarTooltip` (located in `src/components/programs/MiniCalendarTooltip.tsx`)

**Implementation:**
- Moved MiniCalendarTooltip and DayEventList inside the Card component
- Positioned them in the top-right of the card, above the navigation controls
- Added border separator between calendar/event list and navigation
- The + icon dropdown is positioned to the left of the calendar icon

**Location:** Schedule/Programs page - Inside Card component, top right section

---

## Smart Calendar Sync
**Date Added:** January 10, 2026  
**Priority:** High  
**Status:** Completed

### Problem
After computer restart, the calendar sync button in the header wasn't working properly because:
1. The store's `isGoogleCalendarConnected` state was stale
2. The sync button checked cached state without re-verifying with Google
3. The `fetchEvents` function had a 30-second cache that the sync button didn't bypass

### Solution Implemented
1. **Smart Connection Check:** The sync button now re-checks Google Calendar connection status if the cached state says "not connected"
2. **Force Refresh:** The sync button passes `force: true` to bypass the 30-second event cache
3. **Better UX:** Users don't need to visit App Config to reconnect after a restart

### Files Modified
- `src/components/Header.tsx` - Added `checkGoogleCalendarConnection` call and `force: true` parameter

---

## Error Recovery Pages
**Date Added:** January 10, 2026  
**Priority:** Medium  
**Status:** Completed

### Problem
Intermittent "async Client Component" errors appearing when navigating between pages (Next.js 16/Turbopack quirk).

### Solution Implemented
Added error recovery pages with "Try Again" buttons:
- `src/app/error.tsx` - Global error handler
- `src/app/programs/error.tsx` - Schedule-specific error handler

---

## Notes

Add additional notes and improvements below this line.

---

*Last Updated: January 10, 2026*
