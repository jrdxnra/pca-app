# Future Improvements & Notes

This file contains notes and ideas for future improvements to the PCA app. Items can be added, updated, or marked as completed as work progresses.

---

## System-Wide Native Interaction Audit
**Date Added:** Current Session  
**Priority:** Medium  
**Status:** Planned

- Replace custom drag/scroll pickers with native scroll + snap (momentum-friendly) where possible (pattern proven in Category wheel picker).
- Audit other components for heavy per-frame state updates; favor native behavior, throttling/debouncing, and minimal re-renders.
- Target areas: workout editor pickers/lists, calendars, and any custom gesture handling that could use browser-native interactions.
- Aim: smoother UX, fewer render stalls, simpler codepaths.

## Automated Client Matching (Paused)

**Date Added:** January 2026  
**Priority:** Low (Manual workflow working well)  
**Status:** Built but Hidden - Re-enable when needed

### What's Already Built

**Client Matching Service** (`/src/lib/services/clientMatching.ts`)
- Fuzzy name matching (exact, partial, word-based)
- Filters out coach emails and room resources
- Multi-client event detection
- Session type classification (1-on-1, Buddy, Group)
- Configurable via Event Detection settings

**Event Detection Configuration** (Configure page)
- Coaching Keywords - identify 1-on-1 sessions
- Class Keywords - identify group sessions
- Exclusion Keywords - filter out holds, meetings, admin events
- Coach Email Patterns - remove coach from attendee matching

**Client Matching Diagnostic** (`/src/components/calendar/ClientMatchingDiagnostic.tsx`)
- Shows match statistics (X% match rate)
- Matched events tab - events successfully linked to clients
- Unmatched events tab - valid sessions needing client setup
- Excluded events tab - filtered holds/meetings/admin
- Session type badges (1-on-1, Buddy, Group)

**Session Type Badge Component** (`/src/components/calendar/SessionTypeBadge.tsx`)
- Visual indicators for session size
- Color-coded: Blue (1-on-1), Purple (Buddy), Green (Group)

### When to Re-enable

**Trigger Points:**
- Client base grows beyond manual management
- Need to track group session attendance
- Want automated workout duplication for multi-client sessions
- Need analytics on session types and client frequency

**How to Re-enable:**
1. Uncomment `ClientMatchingDiagnostic` import and usage in `/src/app/configure/page.tsx`
2. Test with your Event Detection settings
3. Review match accuracy before relying on automation

### Future Enhancements (When Re-enabled)

**Phase 1: Basic Automation**
- One-click "Create Workout" from matched events
- Auto-populate client dropdown based on matches
- Bulk workout creation for multiple matched events

**Phase 2: Multi-Client Sessions**
- Duplicate workout creation for Buddy/Group sessions
- Session type selection in workout builder
- Individual client variations within shared sessions

**Phase 3: Shared Group Workouts**
- Single workout record with multiple client participations
- Individual performance tracking per client
- Group session history and analytics
- Shared programming, individual inputs (sets, reps, weight)
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

### Update Left Side Panel with 30-Minute Increments
**Date Added:** January 2026  
**Priority:** Medium  
**Status:** Pending

The left side panel (time slot column) in the calendar view currently shows hour increments. Update it to show 30-minute increments for better granularity in scheduling.

**Desired Behavior:**
- Change time slot display from hourly (7:00 AM, 8:00 AM, etc.) to 30-minute intervals (7:00 AM, 7:30 AM, 8:00 AM, 8:30 AM, etc.)
- Maintain the same visual layout and spacing
- Ensure events align correctly with their 30-minute time slots

**Location:** Schedule/Programs page - Left time column in calendar view (`src/components/programs/TwoColumnWeekView.tsx`)

### Add "Today" Button to Header
**Date Added:** January 2026  
**Priority:** Medium  
**Status:** Pending

Add a "Today" button to the header that quickly navigates the calendar view back to the current week/day.

**Desired Behavior:**
- Add a "Today" button to the header/navigation
- When clicked, scrolls/navigates the calendar to show today's date
- Should be visible and easily accessible
- Consider placing it near date navigation controls

**Location:** Header component or Schedule/Programs page navigation (`src/components/Header.tsx` or calendar navigation component)

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

---*Last Updated: January 2026*
