# Day Split In Workout Type: File-Mapped Build Checklist

This checklist maps the V1 decision (Day Split nested under Workout Type) to exact files in this repo.

## Scope
- Keep Day Split inside Workout Type.
- No new top-level settings entity.
- Add simple coach UX first, advanced UX optional.

## Phase 1: Schema And Data Contract

### 1) Add nested Day Split types
File: src/lib/types/index.ts

Tasks
- Add DayAssignment interface.
- Add DaySplit interface.
- Extend WorkoutType interface with:
  - daySplits
  - defaultDaySplitId
  - optional schemaVersion

Suggested shape
- DayAssignment
  - dayIndex: number
  - focusKey: string
  - structureTemplateIds: string[]
  - optionalTags: string[] (optional)
- DaySplit
  - id: string
  - label: string
  - daysPerWeek: number
  - dayAssignments: DayAssignment[]
  - notes: string (optional)
  - active: boolean
- WorkoutType additions
  - daySplits: DaySplit[]
  - defaultDaySplitId: string
  - schemaVersion: number (optional)

Acceptance
- Project typechecks after interface changes.

### 2) Keep service layer compatible
File: src/lib/firebase/services/workoutTypes.ts

Tasks
- No API method rename required.
- Confirm create and update pass through new WorkoutType fields.
- Add optional guards in create/update to ensure daySplits is always an array when provided.

Acceptance
- Create and update persist daySplits and defaultDaySplitId.

### 3) Keep store type-safe with new fields
File: src/lib/stores/useConfigurationStore.ts

Tasks
- Confirm addWorkoutType and updateWorkoutType compile with updated WorkoutType.
- Ensure optimistic store updates preserve daySplits/defaultDaySplitId.

Acceptance
- Workout types in store include new fields after create/update.

## Phase 2: Configure Screen (Simple First)

### 4) Normalize WorkoutType shape in configure page
File: src/app/configure/page.tsx

Tasks
- Replace local WorkoutType interface with imported WorkoutType from src/lib/types/index.ts.
- If local type must remain, include daySplits and defaultDaySplitId so editor can handle new fields.

Acceptance
- Editing a workout type does not lose nested fields.

### 5) Add Basic tab in Workout Type editor card
File: src/app/configure/page.tsx

Tasks
- In add/edit workout type form, keep current fields:
  - name
  - description
  - color
- Add simple day split controls:
  - daysPerWeek selector
  - default split selector
  - split summary preview (read-only cards)

Acceptance
- Coach can create a workout type and choose one default split.

### 6) Add Advanced section (collapsed by default)
File: src/app/configure/page.tsx

Tasks
- Add collapsible section inside workout type editor:
  - split variants list
  - add split variant button
  - duplicate variant action
  - archive variant action
- Add per-day assignment editor in each split:
  - focusKey
  - structureTemplateIds multi-select

Acceptance
- Advanced controls are hidden unless expanded.
- New coach can complete setup without opening advanced controls.

## Phase 3: Runtime Resolution

### 7) Resolve split for generation inputs
Primary files
- src/hooks/useClientPrograms.ts
- src/app/api/fill/workouts/draft/route.ts
- src/lib/ai/workoutDraft.ts

Tasks
- In weekly assignment flow, resolve active split:
  - period override splitId if present
  - else workoutType.defaultDaySplitId
- Resolve assignment by weekly sequence index/day index.
- Pass resolved focus and structureTemplateIds through draft request payload.

Acceptance
- DDS receives split-constrained inputs.
- Same type can behave differently under different split variants.

### 8) Keep safe fallback behavior
Primary files
- src/hooks/useClientPrograms.ts
- src/lib/ai/workoutDraft.ts

Tasks
- If split not found, fallback to existing behavior.
- Log warning once per flow for observability.

Acceptance
- No hard failure for legacy records without daySplits.

## Phase 4: Migration

### 9) Backfill old workout types
Options
- Reuse admin backfill route patterns in src/app/api/admin/backfill-master/route.ts
- Or add one temporary script in scripts folder

Tasks
- For each existing workout type:
  - add one generated default split variant
  - set defaultDaySplitId
  - set schemaVersion to 1

Acceptance
- All workout types have valid daySplits and defaultDaySplitId.

## UX Guardrails For First-Time Coaches

### 10) Minimize cognitive load
File: src/app/configure/page.tsx

Tasks
- Keep one-screen quick flow in workout type editor:
  1) Name
  2) Color
  3) Training days per week
  4) Choose recommended split
- Move complex controls into Advanced accordion.
- Add inline helper text under split selector:
  - This controls weekly day focus assignment for this workout type.

Acceptance
- New coach can save a valid workout type in under 2 minutes.

## Validation Rules

File targets
- src/app/configure/page.tsx
- src/lib/ai/workoutDraft.ts

Rules
- daySplits length must be at least 1.
- defaultDaySplitId must match an active split.
- dayAssignments length must equal daysPerWeek.
- each dayAssignment must include at least one structureTemplateId.

## Suggested Build Order
1. src/lib/types/index.ts
2. src/lib/firebase/services/workoutTypes.ts
3. src/lib/stores/useConfigurationStore.ts
4. src/app/configure/page.tsx (Basic tab only)
5. src/app/configure/page.tsx (Advanced controls)
6. src/hooks/useClientPrograms.ts
7. src/app/api/fill/workouts/draft/route.ts
8. src/lib/ai/workoutDraft.ts
9. backfill script/route

## Done Criteria
- Coaches configure day split variants inside workout type only.
- No new top-level settings section introduced.
- Current records still work.
- DDS generation honors chosen split variant.
- First-time setup remains simple.
