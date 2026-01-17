# Implementation Plan: Performance & Architecture Improvements

## Overview

This plan breaks down the architectural improvements into manageable, trackable tasks with clear checkpoints. Each phase can be completed independently and tested before moving to the next.

**Status Legend:**
- ⬜ Not Started
- 🟡 In Progress
- ✅ Complete
- ⏸️ Paused
- ❌ Blocked

---

## Phase 1: Quick Wins & Foundation (Week 1-2)

### 1.1 Add React Query Setup ⬜

**Goal:** Install and configure React Query for data fetching

**Tasks:**
- [ ] Install dependencies
  ```bash
  npm install @tanstack/react-query
  ```
- [ ] Create QueryClient provider
  - [ ] Create `src/lib/react-query/QueryProvider.tsx`
  - [ ] Configure default options (staleTime, gcTime, retry)
  - [ ] Add to `src/components/Providers.tsx`
- [ ] Create query key factory
  - [ ] Create `src/lib/react-query/queryKeys.ts`
  - [ ] Define query key structure (e.g., `['movements'], ['clients'], ['workouts', clientId]`)
- [ ] Test setup
  - [ ] Verify QueryClient is available in components
  - [ ] Check React DevTools shows QueryClient

**Files to Create:**
- `src/lib/react-query/QueryProvider.tsx`
- `src/lib/react-query/queryKeys.ts`

**Files to Modify:**
- `src/components/Providers.tsx`
- `package.json`

**Checkpoint:** React Query is installed and provider is working. Can use `useQuery` in components.

**Rollback Point:** Can remove QueryProvider and continue with Zustand if needed.

---

### 1.2 Migrate Movements Store to React Query ⬜

**Goal:** Replace Zustand movements fetching with React Query

**Tasks:**
- [ ] Create movements query hooks
  - [ ] Create `src/hooks/queries/useMovements.ts`
  - [ ] Create `useMovementsByCategory.ts`
  - [ ] Create `useMovement.ts` (single movement)
- [ ] Update WorkoutEditor to use new hooks
  - [ ] Replace `useMovementStore().fetchMovements()` with `useMovements()`
  - [ ] Test that movements load correctly
- [ ] Keep Zustand for mutations only
  - [ ] Keep `addMovement`, `updateMovement`, `deleteMovement` in Zustand
  - [ ] Or migrate to React Query mutations (preferred)
- [ ] Remove unused Zustand code
  - [ ] Remove `fetchMovements` from Zustand store
  - [ ] Keep store for mutations if not migrating

**Files to Create:**
- `src/hooks/queries/useMovements.ts`
- `src/hooks/queries/useMovementsByCategory.ts`
- `src/hooks/queries/useMovement.ts`

**Files to Modify:**
- `src/components/workouts/WorkoutEditor.tsx`
- `src/components/workouts/AddExerciseDialog.tsx`
- `src/components/workouts/ExerciseRow.tsx`
- `src/lib/stores/useMovementStore.ts`

**Testing:**
- [ ] Movements load on WorkoutEditor mount
- [ ] Movements are cached (check network tab - should only fetch once)
- [ ] Movements update when category changes
- [ ] No console errors

**Checkpoint:** Movements are fetched via React Query. Caching works. Can see in React DevTools.

**Rollback Point:** Can revert to Zustand fetching if issues arise.

---

### 1.3 Add Code Splitting ⬜

**Goal:** Reduce initial bundle size by lazy loading routes and heavy components

**Tasks:**
- [ ] Lazy load route pages
  - [ ] Update `src/app/workouts/builder/page.tsx` to use `dynamic()`
  - [ ] Update `src/app/configure/page.tsx` to use `dynamic()`
  - [ ] Update `src/app/programs/page.tsx` to use `dynamic()`
  - [ ] Add loading skeletons for each route
- [ ] Lazy load heavy components
  - [ ] Lazy load `WorkoutEditor` component
  - [ ] Lazy load `ModernCalendarView` component
  - [ ] Add loading skeletons
- [ ] Test bundle size
  - [ ] Run `npm run build`
  - [ ] Check bundle analyzer or build output
  - [ ] Verify chunks are created

**Files to Modify:**
- `src/app/workouts/builder/page.tsx`
- `src/app/configure/page.tsx`
- `src/app/programs/page.tsx`
- `src/components/workouts/WorkoutEditor.tsx` (import location)
- `src/components/programs/ModernCalendarView.tsx` (import location)

**Files to Create:**
- `src/components/ui/PageSkeleton.tsx`
- `src/components/ui/EditorSkeleton.tsx`

**Testing:**
- [ ] Routes load correctly
- [ ] Loading skeletons show during load
- [ ] Bundle size reduced (check build output)
- [ ] No hydration errors

**Checkpoint:** Code splitting is working. Bundle size reduced. Routes lazy load.

**Rollback Point:** Can remove `dynamic()` imports if issues.

---

### 1.4 Add Loading States & Skeletons ⬜

**Goal:** Provide visual feedback during navigation and data loading

**Tasks:**
- [ ] Create skeleton components
  - [ ] Create `src/components/ui/PageSkeleton.tsx`
  - [ ] Create `src/components/ui/EditorSkeleton.tsx`
  - [ ] Create `src/components/ui/WorkoutSkeleton.tsx`
- [ ] Add navigation loading overlay
  - [ ] Create `src/components/NavigationLoader.tsx`
  - [ ] Add to layout or navigation component
  - [ ] Show during route transitions
- [ ] Add loading states to builder page
  - [ ] Show skeleton while initial data loads
  - [ ] Show loading overlay during navigation
- [ ] Add loading states to WorkoutEditor
  - [ ] Show skeleton while movements load
  - [ ] Show loading indicator for save operations

**Files to Create:**
- `src/components/ui/PageSkeleton.tsx`
- `src/components/ui/EditorSkeleton.tsx`
- `src/components/ui/WorkoutSkeleton.tsx`
- `src/components/NavigationLoader.tsx`

**Files to Modify:**
- `src/app/workouts/builder/page.tsx`
- `src/components/workouts/WorkoutEditor.tsx`
- `src/app/layout.tsx` (for navigation loader)

**Testing:**
- [ ] Loading indicators show during navigation
- [ ] Skeletons show while data loads
- [ ] No flickering or layout shifts
- [ ] Loading states clear when data arrives

**Checkpoint:** All loading states are in place. Users see feedback during waits.

**Rollback Point:** Can remove loading states if they cause issues.

---

## Phase 2: Component Refactoring (Week 3-4)

### 2.1 Break Down Builder Page ⬜

**Goal:** Split 2,263-line builder page into manageable components

**Tasks:**
- [ ] Extract BuilderHeader component
  - [ ] Client selector
  - [ ] Date navigation
  - [ ] Quick workout button
  - [ ] Period assignment button
  - [ ] Create `src/components/workouts/builder/BuilderHeader.tsx`
- [ ] Extract BuilderFilters component
  - [ ] Column visibility toggle
  - [ ] Category filter
  - [ ] Week order selector
  - [ ] Create `src/components/workouts/builder/BuilderFilters.tsx`
- [ ] Extract WeekView component
  - [ ] Week rendering logic
  - [ ] Day cells
  - [ ] Workout display
  - [ ] Create `src/components/workouts/builder/WeekView.tsx`
- [ ] Extract WorkoutEditorContainer component
  - [ ] Editor state management
  - [ ] Editor rendering
  - [ ] Create `src/components/workouts/builder/WorkoutEditorContainer.tsx`
- [ ] Extract custom hooks
  - [ ] `useBuilderState.ts` - Main state management
  - [ ] `useWorkoutLoader.ts` - Workout loading logic
  - [ ] `usePeriodDetection.ts` - Period detection logic
  - [ ] Create `src/hooks/useBuilderState.ts`
  - [ ] Create `src/hooks/useWorkoutLoader.ts`
  - [ ] Create `src/hooks/usePeriodDetection.ts`
- [ ] Refactor main page
  - [ ] Use extracted components
  - [ ] Use extracted hooks
  - [ ] Keep only orchestration logic
  - [ ] Target: < 300 lines

**Files to Create:**
- `src/components/workouts/builder/BuilderHeader.tsx`
- `src/components/workouts/builder/BuilderFilters.tsx`
- `src/components/workouts/builder/WeekView.tsx`
- `src/components/workouts/builder/WorkoutEditorContainer.tsx`
- `src/hooks/useBuilderState.ts`
- `src/hooks/useWorkoutLoader.ts`
- `src/hooks/usePeriodDetection.ts`

**Files to Modify:**
- `src/app/workouts/builder/page.tsx` (reduce to < 300 lines)

**Testing:**
- [ ] All functionality works as before
- [ ] No regressions
- [ ] Components are testable
- [ ] Code is easier to understand

**Checkpoint:** Builder page is broken down. Each component < 300 lines. Functionality preserved.

**Rollback Point:** Can revert to single file if needed (keep old version in git).

---

### 2.2 Break Down WorkoutEditor ⬜

**Goal:** Split 1,454-line WorkoutEditor into focused components

**Tasks:**
- [ ] Extract WorkoutHeader component
  - [ ] Title input
  - [ ] Notes textarea
  - [ ] Time input
  - [ ] Create `src/components/workouts/editor/WorkoutHeader.tsx`
- [ ] Extract WarmupSection component
  - [ ] Warmup list
  - [ ] Add warmup button
  - [ ] Create `src/components/workouts/editor/WarmupSection.tsx`
- [ ] Extract RoundsSection component
  - [ ] Rounds list
  - [ ] Round cards
  - [ ] Create `src/components/workouts/editor/RoundsSection.tsx`
- [ ] Extract MovementSelector component
  - [ ] Category filter
  - [ ] Movement search
  - [ ] Movement list
  - [ ] Create `src/components/workouts/editor/MovementSelector.tsx`
- [ ] Extract custom hooks
  - [ ] `useWorkoutForm.ts` - Form state
  - [ ] `useWorkoutDraft.ts` - Draft saving
  - [ ] Create `src/hooks/useWorkoutForm.ts`
  - [ ] Create `src/hooks/useWorkoutDraft.ts`
- [ ] Refactor WorkoutEditor
  - [ ] Use extracted components
  - [ ] Use extracted hooks
  - [ ] Keep only orchestration
  - [ ] Target: < 400 lines

**Files to Create:**
- `src/components/workouts/editor/WorkoutHeader.tsx`
- `src/components/workouts/editor/WarmupSection.tsx`
- `src/components/workouts/editor/RoundsSection.tsx`
- `src/components/workouts/editor/MovementSelector.tsx`
- `src/hooks/useWorkoutForm.ts`
- `src/hooks/useWorkoutDraft.ts`

**Files to Modify:**
- `src/components/workouts/WorkoutEditor.tsx` (reduce to < 400 lines)

**Testing:**
- [ ] All editor functionality works
- [ ] Form validation works
- [ ] Draft saving works
- [ ] No regressions

**Checkpoint:** WorkoutEditor is broken down. Each component focused. Functionality preserved.

**Rollback Point:** Can revert to single file if needed.

---

## Phase 3: Data Layer Improvements (Week 5-6)

### 3.1 Migrate Remaining Stores to React Query ⬜

**Goal:** Replace all Zustand data fetching with React Query

**Tasks:**
- [ ] Migrate Clients store
  - [ ] Create `useClients.ts` hook
  - [ ] Create `useClient.ts` hook
  - [ ] Create mutation hooks for CRUD
  - [ ] Update components using client store
- [ ] Migrate Programs store
  - [ ] Create `usePrograms.ts` hook
  - [ ] Create `useProgram.ts` hook
  - [ ] Create mutation hooks
  - [ ] Update components
- [ ] Migrate Configuration store
  - [ ] Create hooks for periods, templates, categories, types
  - [ ] Create mutation hooks
  - [ ] Update components
- [ ] Migrate Calendar store
  - [ ] Create `useCalendarEvents.ts` hook
  - [ ] Create mutation hooks
  - [ ] Update components
- [ ] Keep Zustand for UI state only
  - [ ] Selected client ID
  - [ ] View mode
  - [ ] UI preferences
  - [ ] Remove all data fetching from Zustand

**Files to Create:**
- `src/hooks/queries/useClients.ts`
- `src/hooks/queries/useClient.ts`
- `src/hooks/queries/usePrograms.ts`
- `src/hooks/queries/useProgram.ts`
- `src/hooks/queries/usePeriods.ts`
- `src/hooks/queries/useWorkoutCategories.ts`
- `src/hooks/queries/useCalendarEvents.ts`
- `src/hooks/mutations/useClientMutations.ts`
- `src/hooks/mutations/useProgramMutations.ts`
- (etc. for each entity)

**Files to Modify:**
- All components using stores
- Store files (remove fetching, keep UI state)

**Testing:**
- [ ] All data loads correctly
- [ ] Caching works (check network tab)
- [ ] Mutations update cache
- [ ] No duplicate requests
- [ ] Background refetch works

**Checkpoint:** All data fetching uses React Query. Zustand only for UI state.

**Rollback Point:** Can revert stores one at a time if issues.

---

### 3.2 Implement Optimistic Updates ⬜

**Goal:** Make UI feel instant with optimistic updates

**Tasks:**
- [ ] Add optimistic updates to workout mutations
  - [ ] Update cache immediately on save
  - [ ] Rollback on error
  - [ ] Update `useWorkoutMutations.ts`
- [ ] Add optimistic updates to client mutations
  - [ ] Update client list immediately
  - [ ] Rollback on error
- [ ] Add optimistic updates to other mutations
  - [ ] Programs
  - [ ] Movements
  - [ ] Calendar events
- [ ] Test error scenarios
  - [ ] Simulate network errors
  - [ ] Verify rollback works
  - [ ] Verify error messages show

**Files to Modify:**
- `src/hooks/mutations/useWorkoutMutations.ts`
- `src/hooks/mutations/useClientMutations.ts`
- (other mutation hooks)

**Testing:**
- [ ] UI updates immediately on save
- [ ] Changes persist after network call
- [ ] Rollback works on error
- [ ] Error messages display correctly

**Checkpoint:** Optimistic updates working. UI feels instant.

**Rollback Point:** Can disable optimistic updates if issues.

---

### 3.3 Create Unified Service Layer ⬜

**Goal:** Consistent patterns across all Firebase services

**Tasks:**
- [ ] Create base service class
  - [ ] Create `src/lib/firebase/services/BaseService.ts`
  - [ ] Implement common CRUD operations
  - [ ] Add error handling
  - [ ] Add logging
- [ ] Refactor one service as example
  - [ ] Refactor `movements.ts` to extend BaseService
  - [ ] Test thoroughly
- [ ] Refactor remaining services
  - [ ] Clients service
  - [ ] Programs service
  - [ ] Workouts service
  - [ ] (others as needed)
- [ ] Update service exports
  - [ ] Ensure backward compatibility
  - [ ] Update imports if needed

**Files to Create:**
- `src/lib/firebase/services/BaseService.ts`

**Files to Modify:**
- `src/lib/firebase/services/movements.ts`
- `src/lib/firebase/services/clients.ts`
- `src/lib/firebase/services/programs.ts`
- (other services)

**Testing:**
- [ ] All services work as before
- [ ] Error handling is consistent
- [ ] Logging works
- [ ] No regressions

**Checkpoint:** Unified service layer in place. Consistent patterns.

**Rollback Point:** Can revert services one at a time.

---

## Phase 4: Type Safety & Quality (Week 7-8)

### 4.1 Improve TypeScript Configuration ⬜

**Goal:** Stricter type checking to catch bugs

**Tasks:**
- [ ] Update tsconfig.json
  - [ ] Enable `noImplicitAny`
  - [ ] Enable `strictNullChecks`
  - [ ] Enable `noUncheckedIndexedAccess`
  - [ ] Enable `noImplicitReturns`
- [ ] Fix immediate type errors
  - [ ] Fix any errors from stricter config
  - [ ] Add proper types where needed
- [ ] Test build
  - [ ] Ensure build still works
  - [ ] Fix any new errors

**Files to Modify:**
- `tsconfig.json`
- Files with type errors (will be discovered)

**Testing:**
- [ ] TypeScript compiles without errors
- [ ] No runtime type errors
- [ ] Build succeeds

**Checkpoint:** Stricter TypeScript config. No type errors.

**Rollback Point:** Can revert tsconfig changes.

---

### 4.2 Remove All `any` Types ⬜

**Goal:** 100% type safety

**Tasks:**
- [ ] Audit all `any` types
  - [ ] Search codebase for `any`
  - [ ] List all occurrences
  - [ ] Prioritize by impact
- [ ] Replace `any` with proper types
  - [ ] Start with high-impact files
  - [ ] Add proper types
  - [ ] Add type guards where needed
- [ ] Add type guards
  - [ ] Create `src/lib/utils/typeGuards.ts`
  - [ ] Add guards for common types
- [ ] Test thoroughly
  - [ ] Ensure no runtime errors
  - [ ] Verify type safety

**Files to Create:**
- `src/lib/utils/typeGuards.ts`

**Files to Modify:**
- All files with `any` types (will be discovered)

**Testing:**
- [ ] No `any` types remain
- [ ] TypeScript compiles
- [ ] No runtime errors

**Checkpoint:** Zero `any` types. Full type safety.

**Rollback Point:** Can revert type changes if issues.

---

## Phase 5: Performance Optimization (Week 9-10)

### 5.1 Implement Virtual Scrolling ⬜

**Goal:** Handle large lists (895 movements) efficiently

**Tasks:**
- [ ] Install virtual scrolling library
  ```bash
  npm install @tanstack/react-virtual
  ```
- [ ] Create VirtualizedMovementList component
  - [ ] Use `useVirtualizer` hook
  - [ ] Handle scrolling
  - [ ] Create `src/components/workouts/VirtualizedMovementList.tsx`
- [ ] Replace movement lists
  - [ ] Update WorkoutEditor
  - [ ] Update AddExerciseDialog
  - [ ] Test performance
- [ ] Optimize item rendering
  - [ ] Memoize items
  - [ ] Optimize item height calculation

**Files to Create:**
- `src/components/workouts/VirtualizedMovementList.tsx`

**Files to Modify:**
- `src/components/workouts/WorkoutEditor.tsx`
- `src/components/workouts/AddExerciseDialog.tsx`

**Testing:**
- [ ] Large lists render smoothly
- [ ] Scrolling is smooth
- [ ] No performance issues
- [ ] All functionality works

**Checkpoint:** Virtual scrolling working. Large lists perform well.

**Rollback Point:** Can revert to regular lists if issues.

---

### 5.2 Add Performance Monitoring ⬜

**Goal:** Track and measure performance improvements

**Tasks:**
- [ ] Install web-vitals
  ```bash
  npm install web-vitals
  ```
- [ ] Add Web Vitals tracking
  - [ ] Create `src/lib/analytics/webVitals.ts`
  - [ ] Track CLS, FID, FCP, LCP, TTFB
  - [ ] Log to console (or analytics service)
- [ ] Add bundle size tracking
  - [ ] Add bundle analyzer script
  - [ ] Document baseline sizes
  - [ ] Track changes
- [ ] Add render performance tracking
  - [ ] Use React DevTools Profiler
  - [ ] Document baseline
  - [ ] Track improvements

**Files to Create:**
- `src/lib/analytics/webVitals.ts`

**Files to Modify:**
- `src/app/layout.tsx` (add web vitals)
- `package.json` (add bundle analyzer script)

**Testing:**
- [ ] Web vitals are tracked
- [ ] Bundle sizes are measured
- [ ] Performance data is available

**Checkpoint:** Performance monitoring in place. Can track improvements.

**Rollback Point:** Can remove monitoring if needed.

---

## Testing & Validation

### After Each Phase:
- [ ] All existing functionality works
- [ ] No console errors
- [ ] No TypeScript errors
- [ ] Build succeeds
- [ ] Manual testing passes
- [ ] Performance improved (measure)

### Final Validation:
- [ ] Full regression test
- [ ] Performance benchmarks
- [ ] Bundle size comparison
- [ ] Type coverage report
- [ ] Code review

---

## Progress Tracking

### Current Status: 🟡 In Progress

**Last Updated:** 2026-01-15

**Current Phase:** Phase 1.3 - Add Code Splitting

**Completed Tasks:** 12 / 50+
- ✅ Phase 1.1: React Query Setup (QueryProvider, queryKeys)
- ✅ Phase 1.2: Movements migrated to React Query (hooks created, WorkoutEditor updated with loading skeleton)
- ✅ Phase 1.3: Code Splitting (lazy load heavy components, page skeletons)
- ✅ Phase 1.4: Navigation Loading States (NavigationLoader component)
- ✅ Deployment: Successfully deployed to Firebase with all Phase 1 improvements

**Blockers:** None

**Notes:**
- ✅ Phase 1 Complete - All quick wins implemented
- ✅ Build fixed - react-query-devtools installed, dynamic imports fixed
- ✅ Deployment permissions fixed - Cloud Run Viewer role granted
- 🟡 Ready for Phase 2 - Component refactoring

---

## Rollback Procedures

### If Issues Arise:

1. **React Query Issues:**
   - Revert to Zustand fetching
   - Keep QueryProvider for future use
   - Document what didn't work

2. **Component Breakdown Issues:**
   - Revert to original large file
   - Keep extracted components for reference
   - Try smaller extraction next time

3. **Type Safety Issues:**
   - Revert tsconfig changes
   - Fix types incrementally
   - Document problematic areas

4. **Performance Issues:**
   - Revert performance changes
   - Measure before/after
   - Try alternative approach

---

## Success Criteria

### Phase 1 Complete When:
- ✅ React Query is set up and working
- ✅ At least one store migrated
- ✅ Code splitting implemented
- ✅ Loading states added
- ✅ No regressions

### Phase 2 Complete When:
- ✅ Builder page < 300 lines
- ✅ WorkoutEditor < 400 lines
- ✅ All functionality preserved
- ✅ Components are testable

### Phase 3 Complete When:
- ✅ All stores migrated to React Query
- ✅ Optimistic updates working
- ✅ Unified service layer in place
- ✅ No duplicate requests

### Phase 4 Complete When:
- ✅ Stricter TypeScript config
- ✅ Zero `any` types
- ✅ Type guards in place
- ✅ Full type safety

### Phase 5 Complete When:
- ✅ Virtual scrolling working
- ✅ Performance monitoring in place
- ✅ Measured improvements
- ✅ Bundle size reduced

---

## Next Steps

1. **Review this plan** - Make sure it makes sense
2. **Prioritize phases** - Decide what's most important
3. **Start Phase 1.1** - Add React Query setup
4. **Update progress** - Mark tasks as complete
5. **Test thoroughly** - After each phase

---

## Questions to Answer Before Starting

- [ ] Which phase should we start with?
- [ ] Are there any tasks we should skip?
- [ ] Are there any additional tasks needed?
- [ ] What's the priority order?
- [ ] Any concerns about the approach?
