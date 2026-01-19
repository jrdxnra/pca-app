# Calendar Events Migration Status

## ✅ Completed Migrations

### 1. Quick Workouts Create in Google Calendar ✅
- **Status:** FIXED
- **Location:** `src/lib/stores/useCalendarStore.ts` - `createTestEvent` function
- **Details:** 
  - Creates calendar event in Google Calendar API first (lines 241-266)
  - Auto-creates workout in Firebase if clientId provided (lines 327-339)
  - **Answer to question:** YES, when a quick workout event is created, a workout IS also created in Firebase

### 2. Reading Events - Google Calendar Only ✅
- **Status:** FIXED
- **Location:** `src/lib/firebase/services/calendarEvents.ts` - `getCalendarEventsByDateRange`
- **Details:**
  - Only reads from Google Calendar API
  - Returns empty array if not connected (no Firebase fallback)
  - **Answer to question:** YES, workouts are still accessible when Google Calendar isn't connected because:
    - Workouts are stored separately in Firebase `clientWorkouts` collection
    - Calendar events and workouts are separate entities
    - Components fetch workouts independently (e.g., `ModernCalendarView` uses `fetchWorkoutsByDateRange`)

### 3. React Query Mutations ✅
- **Status:** FIXED
- **Location:** `src/hooks/mutations/useCalendarMutations.ts`
- **Changes:**
  - `useCreateCalendarEvent` - Now uses `createSingleCalendarEvent` from Google Calendar API
  - `useUpdateCalendarEvent` - Now uses `updateCalendarEvent` from Google Calendar API
  - `useDeleteCalendarEvent` - Now uses `deleteCalendarEvent` from Google Calendar API
  - **Removed:** All Firebase `calendarEvents` collection usage

### 4. Zustand Store Updates ✅
- **Status:** FIXED
- **Location:** `src/lib/stores/useCalendarStore.ts`
- **Changes:**
  - `markAsCoachingSession` - Now updates Google Calendar API (if connected)
  - `linkToWorkout` - Already updates Google Calendar API (no Firebase fallback)
  - `updateEvent` - Now only uses Google Calendar API (removed Firebase fallback)
  - `deleteEvent` - Now only uses Google Calendar API (removed Firebase fallback)
  - `clearAllTestEvents` - Now only uses Google Calendar API
  - `fetchEvents` - Removed Firebase fallback, only reads from Google Calendar API

## 📋 Firebase calendarEvents Collection Usage Analysis

### Functions Still Defined (But Usage Checked)

#### `createCalendarEvent` (Firebase)
- **Location:** `src/lib/firebase/services/calendarEvents.ts:86`
- **Status:** ⚠️ NOT USED ANYMORE
- **Previous Usage:** Was used by `useCalendarMutations.ts` - NOW FIXED to use Google Calendar API
- **Can Remove:** ✅ YES (after verification)

#### `updateCalendarEvent` (Firebase)
- **Location:** `src/lib/firebase/services/calendarEvents.ts:171`
- **Status:** ⚠️ STILL USED (but only as fallback)
- **Current Usage:**
  - `src/lib/firebase/services/eventAssignment.ts:210` - Used as fallback when Google Calendar not connected
  - This is for legacy events that might exist in Firebase
- **Action:** Keep for now, but mark as deprecated

#### `deleteCalendarEvent` (Firebase)
- **Location:** `src/lib/firebase/services/calendarEvents.ts:204`
- **Status:** ⚠️ NOT USED ANYMORE
- **Previous Usage:** Was used by `useCalendarStore.ts` and `useCalendarMutations.ts` - NOW FIXED
- **Can Remove:** ✅ YES (after verification)

#### `subscribeToCalendarEvents` (Firebase)
- **Location:** `src/lib/firebase/services/calendarEvents.ts:212`
- **Status:** ❌ NOT USED
- **Can Remove:** ✅ YES

#### `getCalendarEventsByDateRange` (Firebase service)
- **Location:** `src/lib/firebase/services/calendarEvents.ts:99`
- **Status:** ✅ CORRECT - Only reads from Google Calendar API
- **Usage:** Used by React Query hook `useCalendarEvents`
- **Action:** Keep - this is the correct implementation

## 🎯 Components Using Zustand vs React Query

### Using React Query (Correct) ✅
- `src/app/programs/page.tsx` - Uses `useCalendarEvents()`
- `src/app/page.tsx` (Dashboard) - Uses `useCalendarEvents()`

### Using Zustand Store (Should Stay) ✅
These components use Zustand for UI state and actions, which is correct:
- `src/components/programs/TwoColumnWeekView.tsx` - Only uses `config` (UI state) ✅
- `src/components/Header.tsx` - Uses `fetchEvents` action and connection checking ✅
- `src/components/programs/ModernCalendarView.tsx` - Uses `events`, `config`, and actions (fetchEvents, markAsCoachingSession, linkToWorkout, updateEvent)
  - **Note:** This could potentially migrate to React Query for `events`, but actions should stay in Zustand

### Using Zustand Store (Could Migrate) ⚠️
- `src/components/programs/QuickWorkoutBuilderDialog.tsx` - Uses `events` from store
- `src/components/workouts/WorkoutEditor.tsx` - Uses `events` from store
- `src/app/workouts/builder/page.tsx` - Uses `events` from store

## 🔍 Remaining Questions

### Q: Can we remove Firebase calendarEvents collection entirely?
**Answer:** Not yet. Here's why:
1. `updateCalendarEvent` (Firebase) is still used in `eventAssignment.ts` as a fallback for legacy events
2. There may be existing events in Firebase that need to be migrated
3. Need to verify no other code paths use it

### Q: Should components migrate from Zustand to React Query?
**Answer:** It depends:
- **UI State** (config, selectedClient, calendarDate) → Keep in Zustand ✅
- **Data Fetching** (events) → Should use React Query ✅
- **Actions** (fetchEvents, updateEvent, deleteEvent) → Can stay in Zustand or move to mutations ✅

## 📝 Recommendations

1. **Keep Firebase calendarEvents functions for now** - They're used as fallbacks for legacy events
2. **Mark Firebase functions as deprecated** - Add comments indicating they're only for legacy support
3. **Consider migrating ModernCalendarView** - Could use React Query for events, but keep actions in Zustand
4. **Monitor usage** - Check if `updateCalendarEvent` (Firebase) in `eventAssignment.ts` is ever actually called

## ✅ Summary

- ✅ Quick workouts create in Google Calendar AND create workouts in Firebase
- ✅ Workouts are accessible even when Google Calendar isn't connected (separate data source)
- ✅ All mutations now use Google Calendar API
- ✅ Zustand store no longer has Firebase fallback for reading
- ⚠️ Firebase calendarEvents collection still has some functions used as fallbacks (legacy support)
- ✅ React Query is being used correctly where implemented
