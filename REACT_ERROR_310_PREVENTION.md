# React Error #310 Prevention Guide

## What is React Error #310?

React error #310 occurs when hooks are called in different orders between renders. This typically happens during rapid re-renders when:
- useMemo/useCallback dependencies are unstable
- Hooks are called conditionally
- State updates cause re-renders that trigger more state updates (infinite loops)

## Root Cause of Our Issue

The schedule page was crashing due to:
1. **useMemo with unstable dependencies**: Using `array.length` in useMemo dependencies caused React to see hooks being called in different orders during rapid re-renders
2. **Infinite render loops**: State updates in useEffect → re-render → useMemo recalculates → triggers more updates → loop
3. **Multiple conflicting useEffects**: Two useEffects setting the same state caused conflicts

## Prevention Rules

### ✅ DO:
1. **Calculate simple values directly** - If a calculation is cheap (array filter/find), don't use useMemo
2. **Use refs for tracking** - Use refs to track previous values instead of including them in dependency arrays
3. **Combine related useEffects** - Don't have multiple useEffects setting the same state
4. **Remove unnecessary dependencies** - Don't include stable callbacks in useEffect dependency arrays
5. **Trust React Query's caching** - React Query already handles memoization, don't try to "improve" it

### ❌ DON'T:
1. **NEVER use useMemo with array.length dependencies** - This causes React error #310 during rapid re-renders because React sees hooks being called in different orders
2. **NEVER use useMemo for simple array operations** - filter, find, map are fast enough without memoization
3. **Don't include state in its own useEffect dependency** - This creates infinite loops
4. **Don't have duplicate useEffects** - Multiple effects setting the same state will conflict
5. **Don't calculate hashes during render** - This creates new objects/strings on every render
6. **Don't include stable callbacks in deps** - useCallback results are stable, don't need to be in dependency arrays
7. **Don't try to "stabilize" React Query arrays** - React Query already handles this, trying to stabilize causes more problems

## Example: What We Fixed

### ❌ BAD (Causes React Error #310):
```typescript
// This causes React error #310 during rapid re-renders!
const periods = React.useMemo(() => {
  // calculation
}, [selectedClient, clientPrograms.length, dialogPeriods.length]);
```

### ✅ GOOD (No useMemo needed):
```typescript
// Simple calculation - no memoization needed
// This is fast enough and doesn't cause hook order issues
const periods = (() => {
  if (!selectedClient) return [];
  return clientPrograms.find(...);
})();
```

## What We Learned (The Hard Way)

**The Root Cause:**
- React error #310 happens when hooks are called in different orders between renders
- useMemo with `array.length` dependencies causes this because:
  1. During rapid re-renders, the array reference changes
  2. useMemo recalculates, but React sees it as a different hook call
  3. React detects hooks being called in different orders → error #310

**The Solution:**
- **NEVER use useMemo for simple array operations** (filter, find, map)
- These operations are fast enough (< 1ms for hundreds of items)
- The performance gain from memoization is negligible
- The risk of breaking the app is HIGH

**What We Did Wrong:**
1. Tried to "optimize" with useMemo when it wasn't needed
2. Used array.length as dependency, which is unstable during rapid re-renders
3. Tried to "stabilize" React Query arrays, which already handle caching
4. Added complexity that caused more problems than it solved

## When to Use useMemo

Only use useMemo when:
- The calculation is expensive (complex computations, large data transformations)
- The dependencies are truly stable (primitives, not array references)
- You've measured that it actually improves performance

For simple array operations (filter, find, map), direct calculation is better than useMemo.

## Checklist Before Using useMemo

- [ ] Is this calculation expensive? (If no, don't use useMemo)
- [ ] Are all dependencies stable primitives? (If no, don't use useMemo)
- [ ] Have I tested that useMemo actually improves performance? (If no, don't use useMemo)
- [ ] Could this cause hook order issues during rapid re-renders? (If yes, don't use useMemo)

## Related Files

- `src/app/programs/page.tsx` - Main component where we fixed the issue
- `src/components/programs/TwoColumnWeekView.tsx` - Removed all useMemo calls
- `src/components/programs/PeriodListDialog.tsx` - Removed useMemo calls
- `src/hooks/useClientPrograms.ts` - Hook where we fixed useEffect dependencies

## The Golden Rule

**NEVER use useMemo in schedule/schedule-related components for ANY calculations, no matter how "optimized" it seems.**

Simple array operations (filter, find, map) are fast enough (< 1ms for hundreds of items) and don't need memoization. The risk of breaking the app with React error #310 is MUCH higher than any performance gain.

## What We Did Wrong (Summary)

1. ✅ **Fixed**: Removed useMemo from periods calculation
2. ✅ **Fixed**: Removed useMemo from calendarEventsCount calculation  
3. ✅ **Fixed**: Removed useMemo from calendarDateRange calculation
4. ✅ **Fixed**: Removed ALL useMemo from TwoColumnWeekView
5. ✅ **Fixed**: Removed useMemo from PeriodListDialog

**The working solution:** Calculate everything directly. No useMemo. Period.
