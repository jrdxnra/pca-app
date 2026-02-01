# Branch Changes Notes (For Manual Application)

**Date Created**: January 19, 2026  
**Purpose**: Document changes from cursor branches for manual application if needed, rather than merging old branches that may conflict with current main.

---

## Branch Analysis

### Branch Ages:
- **Branch 2** (`firebase-project-deployment-262e`): **Jan 13, 2026** (6 days old)
- **Branch 3** (`schedule-loading-issue-7d2c`): **Jan 12, 2026** (7 days old)  
- **Branch 1** (`abbreviation-box-styling-2857`): **Most recent Jan 17, 2026** (2 days old)

**Note**: Main has been updated since these branches were created. Current main is working fine without these changes merged.

---

## Branch 2: Location Abbreviations UI Improvements

### Changes Made (Jan 13, 2026):
**File**: `src/app/configure/page.tsx`

### What It Does:
1. Shows complete location list (includes saved abbreviations, not just discovered ones)
2. Simplified N/A locations section (removed switch, just chevron header)
3. Extended event fetch range from 3 months to 12 months (back and forward)
4. Include all events with locations (not just coaching sessions) to discover more locations

### Code Changes:

#### 1. Add location aggregation logic (around line 290):
```typescript
// Display locations should include:
// - locations discovered from calendar events
// - locations already saved in config (so older/rare locations remain editable)
const savedLocations = (calendarConfig.locationAbbreviations ?? [])
  .map(a => normalizeLocationKey(a.original))
  .filter(Boolean);
const allLocationsForDisplay = Array.from(new Set([
  ...uniqueLocations.map(normalizeLocationKey),
  ...savedLocations
])).sort();
```

#### 2. Extend event fetch range (around line 360):
```typescript
// Change from:
startDate.setMonth(today.getMonth() - 3); // 3 months back
endDate.setMonth(today.getMonth() + 3); // 3 months forward

// To:
startDate.setMonth(today.getMonth() - 12); // 12 months back
endDate.setMonth(today.getMonth() + 12); // 12 months forward
```

#### 3. Include all events with locations (around line 375):
```typescript
// Extract locations from coaching events + any event with a location
const allEventsWithLocations = events.filter(e => !!e.location && e.location.trim() !== '');
const locations = [...coachingEvents, ...allEventsWithLocations]
  .map(event => (event.location ? normalizeLocationKey(event.location) : ''))
  .filter((location): location is string => !!location && location.trim() !== '');
```

#### 4. Use allLocationsForDisplay instead of uniqueLocations (around line 1890):
```typescript
// Change from:
{uniqueLocations.filter(...)}

// To:
{allLocationsForDisplay.filter(...)}
```

#### 5. Simplify N/A locations section (around line 1975):
- Remove the toggle switch
- Just use a chevron header that expands/collapses
- Always show the section if there are ignored locations

### Status:
- ✅ **Confirmed NOT in main** (checked Jan 19, 2026)
- **Impact**: Low - UI improvement, not critical
- **Apply if**: You want to see older/rare locations in the list and extend the discovery range
- **Current main works fine without it** - this is an enhancement, not a fix

---

## Branch 3: Date Validation Bug Fixes

### Changes Made (Jan 12, 2026):
**Files**: 
- `src/lib/stores/useCalendarStore.ts`
- `src/lib/stores/useProgramStore.ts`

### What It Does:
Prevents crashes from invalid dates by validating before using `toISOString()` or persisting to localStorage.

### Code Changes:

#### 1. Add isValidDate helper function (add to both files):
```typescript
function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !Number.isNaN(d.getTime());
}
```

#### 2. Validate dateRange in useCalendarStore.fetchEvents (around line 101):
```typescript
fetchEvents: async (dateRange: DateRange, force = false) => {
  const { config, isGoogleCalendarConnected, _eventsFetchTime, _eventsFetchKey, events } = get();

  // Guard against invalid date inputs (can crash via toISOString())
  if (!isValidDate(dateRange?.start) || !isValidDate(dateRange?.end)) {
    console.warn('Invalid dateRange passed to fetchEvents:', dateRange);
    set({
      error: 'Invalid date range for calendar events',
      loading: false,
    });
    return;
  }

  const cacheKey = `${dateRange.start.toISOString()}:${dateRange.end.toISOString()}`;
  // ... rest of function
}
```

#### 3. Validate calendarDate in useProgramStore.getInitialCalendarDate (around line 108):
```typescript
const getInitialCalendarDate = (): Date => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('calendarDate');
    if (saved) {
      try {
        const parsed = new Date(saved);
        if (isValidDate(parsed)) return parsed;
        console.warn('Invalid saved calendarDate, resetting:', saved);
        localStorage.removeItem('calendarDate');
      } catch (e) {
        console.warn('Failed to parse saved calendarDate:', e);
        localStorage.removeItem('calendarDate');
      }
    }
  }
  return new Date();
};
```

#### 4. Validate before persisting in setCalendarDate (around line 499):
```typescript
setCalendarDate: (date: Date) => {
  set({ calendarDate: date });
  // Persist to localStorage for true state sharing between pages
  if (typeof window !== 'undefined') {
    if (isValidDate(date)) {
      localStorage.setItem('calendarDate', date.toISOString());
    } else {
      console.warn('Refusing to persist invalid calendarDate:', date);
      localStorage.removeItem('calendarDate');
    }
  }
},
```

### Status:
- ✅ **Confirmed NOT in main** (checked Jan 19, 2026)
- **Impact**: Medium - Prevents potential crashes, but if you're not experiencing date-related crashes, may not be needed
- **Apply if**: You're seeing crashes related to invalid dates or want defensive programming
- **Current main works fine without it** - this is defensive programming, not fixing an active bug

---

## Branch 1: Builder Refactoring & Optimistic Updates

### Changes Made (Most recent Jan 17, 2026):
**Size**: Large (1,935 additions, 1,004 deletions)

### What It Does:
1. Extracts builder page into smaller components
2. Adds optimistic updates to Zustand stores
3. Adds mutation and subscription helpers

### New Files (NOT in main):
1. `src/components/workouts/builder/BuilderWeekCard.tsx` (460 lines)
2. `src/components/workouts/builder/BuilderDeleteDialog.tsx` (186 lines)
3. `src/components/workouts/WorkoutEditorForm.tsx` (124 lines)
4. `src/lib/stores/mutationHelpers.ts` (158 lines)
5. `src/lib/stores/subscriptionHelpers.ts` (100 lines)

### Modified Files:
- `src/app/workouts/builder/page.tsx` (major refactor - 765 lines reduced)
- `src/lib/stores/useCalendarStore.ts` (optimistic updates)
- `src/lib/stores/useClientStore.ts` (optimistic updates)
- `src/lib/stores/useMovementStore.ts` (retry logic)
- `src/lib/stores/useProgramStore.ts` (optimistic updates)

### Key Features:
1. **Component Extraction**: Breaks down 2,263-line builder page into smaller components
2. **Optimistic Updates**: Adds Zustand-level optimistic updates (may conflict with React Query)
3. **Mutation Helpers**: Unified pattern for mutations with rollback
4. **Subscription Optimization**: Reduces re-renders from store subscriptions

### Status:
- ✅ **Confirmed NOT in main** (checked Jan 19, 2026)
- **Impact**: High - Large refactoring, but may conflict with current React Query setup
- **Apply if**: 
  - You want the component extractions (good for maintainability)
  - You want Zustand optimistic updates (but React Query already handles this)
  - **Warning**: Optimistic updates may be redundant with React Query
- **Current main works fine without it** - this is a refactoring/optimization, not a fix

### Recommendation:
- **Component extractions**: Good idea, can apply manually
- **Optimistic updates**: Probably redundant since you're using React Query
- **Mutation helpers**: May be useful if you want a unified pattern

---

## Summary & Recommendations

### Safe to Apply (Low Risk):
1. **Branch 2** - Location UI improvements (if you want them)
2. **Branch 3** - Date validation (if you're experiencing date-related issues)

### Needs Review:
3. **Branch 1** - Large refactoring, check if optimistic updates conflict with React Query

### Current Status:
- Main is working fine without these changes
- These are improvements/optimizations, not critical fixes
- You can apply manually if/when needed

### Action Plan:
1. ✅ Document changes (this file)
2. ⏳ Review if you need any of these improvements
3. ⏳ Apply manually if needed (don't merge old branches)
4. ⏳ Delete branches after confirming changes aren't needed
