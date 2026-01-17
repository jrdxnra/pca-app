# Performance Optimization Plan

## Current Issues Identified

### 1. **No Loading States During Navigation**
- When navigating from Schedule → Builder, there's a long delay with no visual feedback
- Users see a blank screen while data loads
- No loading spinners or skeletons

### 2. **Excessive Data Fetching**
- **WorkoutEditor fetches ALL 895 movements on mount** - this is the biggest bottleneck
- Movements are fetched even when not needed (e.g., when just viewing)
- No caching or lazy loading strategy
- Multiple components fetch the same data independently

### 3. **Cascading Re-renders**
- Multiple `useEffect` hooks trigger each other in a chain
- Period detection runs multiple times unnecessarily
- Client programs loading causes multiple effect re-runs
- Console logs show: "Period detection effect running" multiple times

### 4. **No Progressive Loading**
- All data must load before UI appears
- No skeleton states for better perceived performance
- Structure appears only after all data is fetched

### 5. **Inefficient State Management**
- Multiple state updates causing re-renders
- No memoization of expensive computations
- Components re-render even when props haven't changed

## Optimization Strategy

### Phase 1: Immediate UX Improvements (High Impact, Low Effort)

#### 1.1 Add Loading States for Navigation
**Priority: CRITICAL**
- Add a loading overlay/spinner when navigating to builder page
- Show skeleton UI for workout editor while movements load
- Add loading indicator in navigation/routing

**Files to modify:**
- `src/app/workouts/builder/page.tsx` - Add loading state check
- `src/components/workouts/WorkoutEditor.tsx` - Add skeleton while movements load
- `src/components/ui/skeleton.tsx` - Ensure skeleton component exists

**Implementation:**
```tsx
// In builder page.tsx
{loading && (
  <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      <p className="text-sm text-gray-600">Loading workout builder...</p>
    </div>
  </div>
)}
```

#### 1.2 Add Skeleton UI for WorkoutEditor
**Priority: HIGH**
- Show skeleton while movements are loading
- Progressive reveal: structure first, then data

**Implementation:**
```tsx
// In WorkoutEditor.tsx
{loading && (
  <div className="space-y-4">
    <Skeleton className="h-10 w-full" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
)}
```

### Phase 2: Data Fetching Optimization (High Impact, Medium Effort)

#### 2.1 Lazy Load Movements
**Priority: CRITICAL**
- Don't fetch all 895 movements on WorkoutEditor mount
- Only fetch movements when user opens a movement selector
- Cache movements per category
- Use virtual scrolling if needed

**Current Problem:**
```tsx
// WorkoutEditor.tsx line 308
useEffect(() => {
  fetchMovements(); // Fetches ALL 895 movements!
}, []);
```

**Solution:**
```tsx
// Only fetch when needed
const [movementsLoaded, setMovementsLoaded] = useState(false);

// Lazy load on first interaction
const handleMovementSelectOpen = async () => {
  if (!movementsLoaded) {
    await fetchMovements();
    setMovementsLoaded(true);
  }
};
```

#### 2.2 Implement Movement Caching
**Priority: HIGH**
- Cache movements in store with TTL
- Only refetch if cache is stale (> 5 minutes)
- Share cache across components

**Implementation:**
```tsx
// In useMovementStore.ts
interface MovementStore {
  movements: Movement[];
  movementsCacheTime: number | null;
  // ...
  fetchMovements: (force?: boolean) => Promise<void>;
}

fetchMovements: async (force = false) => {
  const { movementsCacheTime } = get();
  const now = Date.now();
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  if (!force && movementsCacheTime && (now - movementsCacheTime) < CACHE_TTL) {
    return; // Use cached data
  }
  
  set({ loading: true });
  const movements = await getAllMovements(true);
  set({ movements, loading: false, movementsCacheTime: now });
}
```

#### 2.3 Optimize Period Detection
**Priority: MEDIUM**
- Debounce period detection effect
- Only run when clientId actually changes
- Cache period results

**Current Problem:**
```tsx
// Runs multiple times unnecessarily
useEffect(() => {
  // Period detection logic
}, [clientId, clientPrograms, clientProgramsLoading]);
```

**Solution:**
```tsx
// Debounce and memoize
const detectedPeriod = useMemo(() => {
  if (!clientId || clientProgramsLoading) return null;
  // ... detection logic
}, [clientId, clientPrograms]);

useEffect(() => {
  if (detectedPeriod) {
    setSelectedPeriod(detectedPeriod);
  }
}, [detectedPeriod]);
```

### Phase 3: Render Optimization (Medium Impact, Medium Effort)

#### 3.1 Memoize Expensive Components
**Priority: MEDIUM**
- Wrap WorkoutEditor with React.memo
- Memoize ModernCalendarView
- Memoize expensive computations

**Implementation:**
```tsx
// WorkoutEditor.tsx
export const WorkoutEditor = React.memo(WorkoutEditorComponent, (prevProps, nextProps) => {
  // Only re-render if these props change
  return (
    prevProps.workout?.id === nextProps.workout?.id &&
    prevProps.isOpen === nextProps.isOpen &&
    prevProps.isCreating === nextProps.isCreating
  );
});
```

#### 3.2 Consolidate useEffect Hooks
**Priority: MEDIUM**
- Combine related effects
- Reduce dependency arrays
- Use refs for values that shouldn't trigger re-renders

**Current Problem:**
- Multiple effects watching the same dependencies
- Effects triggering each other

**Solution:**
```tsx
// Combine related effects
useEffect(() => {
  // All period-related logic in one effect
  if (clientId && !clientProgramsLoading) {
    // Detect period
    // Set period
    // Calculate weeks
  }
}, [clientId, clientPrograms, clientProgramsLoading]);
```

#### 3.3 Use useDeferredValue for Non-Critical Updates
**Priority: LOW**
- Already using for clientId (good!)
- Apply to other non-critical state updates

### Phase 4: Progressive Loading (Medium Impact, High Effort)

#### 4.1 Show Structure First
**Priority: MEDIUM**
- Render calendar structure immediately
- Load workout data progressively
- Show placeholders for loading workouts

**Implementation:**
```tsx
// Show structure immediately
{weeks.map(week => (
  <WeekCard key={week.id}>
    {/* Structure renders immediately */}
    {workoutsLoading ? (
      <Skeleton className="h-20" />
    ) : (
      <WorkoutContent workout={workout} />
    )}
  </WeekCard>
))}
```

#### 4.2 Implement Virtual Scrolling
**Priority: LOW**
- Only render visible weeks/days
- Use react-window or similar for large lists

## Implementation Priority

### Week 1: Critical Fixes
1. ✅ Add loading states for navigation
2. ✅ Add skeleton UI for WorkoutEditor
3. ✅ Lazy load movements (don't fetch all 895 upfront)

### Week 2: High Impact
4. ✅ Implement movement caching
5. ✅ Optimize period detection
6. ✅ Memoize expensive components

### Week 3: Polish
7. ✅ Consolidate useEffect hooks
8. ✅ Progressive loading for structure
9. ✅ Performance monitoring

## Expected Improvements

### Before:
- Navigation delay: **3-5 seconds** (no feedback)
- Initial load: **5-8 seconds** (fetching 895 movements)
- Re-renders: **15-20** on page load
- User experience: **Feels broken**

### After:
- Navigation delay: **< 1 second** (with loading indicator)
- Initial load: **< 2 seconds** (lazy load movements)
- Re-renders: **5-8** on page load
- User experience: **Feels responsive**

## Metrics to Track

1. **Time to Interactive (TTI)**
2. **First Contentful Paint (FCP)**
3. **Number of re-renders** (React DevTools Profiler)
4. **Network requests** (Chrome DevTools)
5. **Bundle size** (especially movements data)

## Testing Checklist

- [ ] Navigation from Schedule → Builder shows loading indicator
- [ ] WorkoutEditor shows skeleton while loading
- [ ] Movements only load when needed
- [ ] Period detection doesn't run multiple times
- [ ] No console errors or warnings
- [ ] Smooth scrolling and interactions
- [ ] Works on slow 3G connection
- [ ] No memory leaks (check React DevTools)

## Notes

- Keep console.log statements for debugging but remove excessive ones in production
- Consider using React Query or SWR for better data fetching/caching
- Monitor bundle size - movements data might be large
- Consider pagination for movements if list grows
