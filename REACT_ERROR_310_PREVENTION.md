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
2. **Use stable dependencies** - If you must use useMemo, use primitives (numbers, strings, booleans) not array references
3. **Use refs for tracking** - Use refs to track previous values instead of including them in dependency arrays
4. **Combine related useEffects** - Don't have multiple useEffects setting the same state
5. **Remove unnecessary dependencies** - Don't include stable callbacks in useEffect dependency arrays

### ❌ DON'T:
1. **Don't use useMemo with array.length** - Array references change even if length is the same, causing unstable dependencies
2. **Don't include state in its own useEffect dependency** - This creates infinite loops
3. **Don't have duplicate useEffects** - Multiple effects setting the same state will conflict
4. **Don't calculate hashes during render** - This creates new objects/strings on every render
5. **Don't include stable callbacks in deps** - useCallback results are stable, don't need to be in dependency arrays

## Example: What We Fixed

### ❌ BAD (Causes React Error #310):
```typescript
const periods = React.useMemo(() => {
  // calculation
}, [selectedClient, clientPrograms.length, dialogPeriods.length]);
```

### ✅ GOOD (No useMemo needed):
```typescript
const periods = (() => {
  // Simple calculation - no memoization needed
  if (!selectedClient) return [];
  return clientPrograms.find(...);
})();
```

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
- `src/hooks/useClientPrograms.ts` - Hook where we fixed useEffect dependencies
