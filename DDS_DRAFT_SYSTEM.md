# DDS System Control Surface

DDS means Deterministic Decision System.

This file is the operator-facing reference for how DDS currently works, which inputs it actually uses, and which levers change behavior.

It is intentionally biased toward live, verified behavior over aspirational design.

## What DDS Is Doing Today

DDS builds workout drafts from a combination of:

1. Imported historical workouts stored in `clientWorkouts`
2. The selected workout category and linked structure template
3. Section configuration from that structure template
4. Movement library metadata
5. Client context such as goals, notes, and training phase text
6. Event or session duration when available

It is deterministic in the sense that it uses ranking, filtering, fallback, and template rules in code. It is not calling an LLM to invent structure.

## Main Control Path

This is the actual path that controls DDS draft generation:

1. `Fill` is triggered in [src/components/workouts/WorkoutEditor.tsx](src/components/workouts/WorkoutEditor.tsx)
2. The editor sends `clientId`, `categoryName`, `structureTemplateId`, `sessionDurationMinutes`, `currentTitle`, and `currentNotes` to [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts)
3. The API fetches recent client workouts, selected structure sections, client context, movement category context, and movement context
4. [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) decides the draft strategy and assembles the result
5. The editor applies the returned draft back into the workout builder

If this file is going to be the main interface, these three code surfaces matter most:

- [src/components/workouts/WorkoutEditor.tsx](src/components/workouts/WorkoutEditor.tsx)
- [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts)
- [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts)

## Draft Strategies

DDS can return three different behaviors depending on available inputs:

| Strategy | When it happens | What it does | Controlled in |
| --- | --- | --- | --- |
| `history-with-structure` | A valid structure template is present | Builds rounds section-by-section from ranked history and template rules | `buildWorkoutDraftFromHistory()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) |
| `history-clone` | No structure template sections, but recent workouts exist | Clones the most recent matching workout rounds | `buildWorkoutDraftFromHistory()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) |
| `fallback` | No usable structure and no usable history | Returns a minimal blank round scaffold | `buildWorkoutDraftFromHistory()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) |

If the goal is controllable draft generation, the priority path is `history-with-structure`.

## Verified Live Levers

These are the levers that currently change DDS output in production code.

| Lever | Where you change it | Current behavior | Why it matters |
| --- | --- | --- | --- |
| Recent workout window | `DDS_RECENT_WORKOUT_LIMIT` in [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts) | Default `24`, capped at `50` | Controls how many recent sessions DDS analyzes |
| Imported workout quality | Import path in [src/lib/workouts/pasteHistoryImport.ts](src/lib/workouts/pasteHistoryImport.ts) | Only matched `movementId`s contribute to ranking | Bad matching weakens DDS memory |
| Category selected for the workout | Fill payload from [src/components/workouts/WorkoutEditor.tsx](src/components/workouts/WorkoutEditor.tsx) | DDS first filters history by normalized category | Category changes which history pool is preferred |
| Linked structure template | Category config in [src/app/configure/page.tsx](src/app/configure/page.tsx) | If present and valid, DDS uses structure-aware generation | This is the highest-value behavior lever |
| Section `defaultDuration` | Structure section config consumed in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) | Changes target movement count and section scaling | Shorter sessions produce smaller sections |
| Section `defaultStructure` | Structure section config consumed in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) | Changes section archetype like `supersets`, `circuits`, `amrap`, `emom` | This strongly changes section assembly |
| Section `focusArea` and workout type text | Structure section config plus names and descriptions in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) | Used as keyword hints for movement selection | Good wording improves movement fit |
| Client notes, goals, event goals, training phases | Fetched in API and merged in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) | Used as global keyword bias, not hard rules | Adds soft context steering |
| Session duration from scheduled event | Computed in [src/components/workouts/WorkoutEditor.tsx](src/components/workouts/WorkoutEditor.tsx) | DDS scales section durations and movement count | Important for short or long sessions |
| Client training frequency | Derived in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) | Low-frequency clients get slightly fuller sections, high-frequency clients slightly narrower ones | Affects section density |

## Important Non-Levers Or Partial Levers

These are easy to overestimate if you only read labels in the UI.

| Item | Status | Notes |
| --- | --- | --- |
| `aiGuidance` or DDS Guidance | Stored, but not currently used in selection logic | It is passed through data structures, but the live generation logic in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) does not currently consume it when picking movements |
| `useRPE`, `usePercentage`, `useTempo` | Secondary formatting and workload hints | These influence generated target workload shape more than movement selection |
| Unmatched imported movement names | Ignored for ranking | If a movement has no `movementId`, DDS will not count it in `buildMovementStats()` |

This distinction matters because the document should separate what feels configurable from what actually changes generation today.

## How DDS Chooses Movements

### 1. Recent history is fetched

`fetchRecentWorkouts()` in [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts) loads recent `clientWorkouts`, sorts by most recent date, and slices to the resolved limit.

Current verified behavior:

- Default recent history window is `24`
- The environment variable `DDS_RECENT_WORKOUT_LIMIT` can override it
- The override is clamped to a maximum of `50`

### 2. Category filtering is applied first

In `buildWorkoutDraftFromHistory()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts), DDS first tries to filter history to the selected workout category.

Important detail:

- If category-filtered history is empty, DDS falls back to all recent workouts

That means category is a preference layer, not a hard failure condition.

### 3. Movement stats are built from matched movement IDs

`buildMovementStats()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) counts only usages with a valid `movementId`.

Ranking behavior:

- Higher `count` ranks first
- Ties are broken by recency
- Latest known target workload is retained for reuse

Practical consequence:

- Matching imported movement names to the library is one of the most important DDS quality controls

### 4. Library fallback is merged in

DDS does not rely only on historical movements. It also builds zero-count movement candidates from the movement library via `buildLibraryMovementStats()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts).

This means:

- History drives ranking
- Library metadata still gives DDS candidates when history is weak or incomplete
- Better movement naming and category metadata improve fallback quality

### 5. Historical round templates are built

`buildHistoricalRoundTemplates()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) looks for recurring round structure from prior sessions.

This gives DDS memory for:

- movement grouping
- section composition
- target workload carryover

### 6. Structure sections control section assembly

When a structure template is present, `buildRoundsFromStructure()` in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) determines:

- section profile such as warmup, strength, accessory, conditioning, or cooldown
- section archetype such as strength, hypertrophy, conditioning, emom, amrap, or cooldown
- target movement count per section
- movement selection bias based on section wording and global context
- target workload defaults when history is thin

This is the core reason structure templates are the primary DDS control surface.

## What Actually Changes Output

If you want to adjust DDS behavior, use this table rather than guessing.

| Desired change | Primary lever | Secondary lever | Notes |
| --- | --- | --- | --- |
| Make DDS react more to recent programming | Lower `DDS_RECENT_WORKOUT_LIMIT` | Keep imports current | Smaller history window increases recency bias |
| Make DDS more stable and pattern-based | Raise `DDS_RECENT_WORKOUT_LIMIT` | Import more complete history | Larger window smooths short-term noise |
| Improve movement relevance in a section | Edit structure template section names, descriptions, `focusArea`, and `defaultStructure` | Clean movement library names and categories | Section text is actively used as keyword bias |
| Get better short-session drafts | Ensure scheduled event duration is present | Set section `defaultDuration` sensibly | Session duration is used to scale density |
| Prevent generic drafts | Link workout categories to structure templates | Verify the template resolves correctly | Without structure, DDS can fall back to clone or blank scaffold |
| Improve strength prescriptions | Import history with valid matched movement IDs and useful target workload | Use movement config fields consistently | DDS reuses latest meaningful workload |
| Reduce weird repeated movement families | Clean movement naming in the library | Review section structure | DDS has some dedupe rules, but naming still matters |
| Bias drafts toward client phase or goals | Update client notes, goals, event goals, and training phases | Use category-specific templates | This is a soft keyword steer, not a hard constraint system |

## Operator Workflow

If this file is your main DDS interface, this is the cleanest mental model.

### Layer 1: Data quality

Check first:

- Was workout history imported cleanly?
- Did movement names match the library?
- Are important movements carrying a valid `movementId`?

Primary code surface: [src/lib/workouts/pasteHistoryImport.ts](src/lib/workouts/pasteHistoryImport.ts)

### Layer 2: Structure control

Check next:

- Is the workout category linked to the right structure template?
- Do section names and section metadata describe the intended training effect?
- Are section durations realistic?

Primary code and UI surfaces:

- [src/app/configure/page.tsx](src/app/configure/page.tsx)
- [src/components/configure/WorkoutTypeConfigurationForm.tsx](src/components/configure/WorkoutTypeConfigurationForm.tsx)

### Layer 3: Context bias

Check next:

- Does client context contain useful goals or phase language?
- Are current workout notes helping or polluting the keyword bias?
- Does the scheduled event have a real duration?

Primary code surfaces:

- [src/components/workouts/WorkoutEditor.tsx](src/components/workouts/WorkoutEditor.tsx)
- [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts)

### Layer 4: Runtime tuning

Check last:

- Is `DDS_RECENT_WORKOUT_LIMIT` set appropriately for the programming style?

Primary code surface: [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts)

## Current Gaps

These are the highest-signal gaps between the current DDS system and the ideal main-interface model.

1. `aiGuidance` is presented as DDS steering, but the live generator does not currently use it when selecting movements.
2. The recent workout window is configurable by environment variable, but there is no first-class UI for changing it.
3. Imported unmatched movements are still a major blind spot because they do not participate in ranking.
4. Category filtering is soft because DDS falls back to all workouts when category-specific history is sparse.
5. This system is still partly keyword-driven, so naming quality in templates and movement metadata matters more than the UI currently communicates.

## Recommended Next Moves For This File

To make this document the true main interface, the next concrete improvements should be:

1. Maintain this file as the canonical map of verified DDS levers and update it whenever code changes behavior.
2. Add a short changelog section whenever DDS logic changes in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) or [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts).
3. Promote the Current Gaps section into implementation tickets, especially for `aiGuidance` actually affecting generation.
4. If you want a stronger operator surface, build a dedicated DDS settings UI around the levers listed in this file rather than around aspirational fields.

## Weekly +Fill Execution Plan (Current Phase)

This section defines the live plan for the weekly rollout of DDS-driven `+Fill` from the Week Split flow.

Scope order:

1. Individual workout Fill (already live in editor)
2. Weekly Fill (this phase)
3. Monthly Fill (next)
4. Period or quarter Fill (later)

### Weekly Phase Objectives

For a 1 to 4 week assignment created from Week Split:

1. Generate a workout shell for every enabled scheduled day.
2. Run DDS Fill only on days marked with `structure-fill:templateId`.
3. Keep deterministic behavior, reduce coach rework, and make failures easy to retry.

### Weekly Phase Decisions (Locked)

1. `sessionDurationMinutes` is fixed to `60` for weekly +Fill.
2. +Fill orchestration lives in `useClientPrograms` assignment flow, not UI components.
3. Error handling is partial-success first, not full rollback.
4. Coaches get easy retry for failed fill days.

### Weekly Runtime Flow

1. Coach configures the split in Week Split dialog and confirms.
2. Assignment creates scheduled workouts for all enabled days.
3. For each scheduled day:
	- If `appliedTemplateId` is `structure:ID`, create the workout shell only.
	- If `appliedTemplateId` is `structure-fill:ID`, call DDS draft endpoint and apply returned rounds.
4. End of run returns one summary:
	- Filled count
	- Failed count
	- Failed date list

### Weekly API Payload Contract

For each +Fill day call [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts) with:

1. `clientId`
2. `categoryName`
3. `structureTemplateId` (from `structure-fill:ID`)
4. `sessionDurationMinutes: 60`
5. Optional `currentTitle`
6. Optional `currentNotes`

### Weekly Error Handling Standard

Partial-success is the default for coach efficiency:

1. Never delete successfully created or filled workouts because one day failed.
2. Keep failed days as workout shells so coach can still edit manually.
3. Persist enough failure context to support one-click retry.
4. Show one summary toast instead of many noisy toasts.

Optional convenience action:

1. `Retry Failed Fill Days`
2. `Redo Week Fill` (regenerate all +Fill days for the current assignment)

### Weekly Optimization Priorities

Use these constraints to improve quality while remaining deterministic:

1. Weekly movement pattern coverage across assigned days.
2. Fatigue spacing to avoid stacking same high-stress patterns on adjacent days.
3. Goal and phase bias from client context, without overriding structure template intent.
4. Recency and continuity from matched historical movement IDs.
5. Stable tie-break behavior so repeated runs are explainable.

### Weekly Acceptance Criteria

Weekly +Fill is considered working when:

1. Week assignment with mixed `structure` and `structure-fill` days completes.
2. All +Fill days receive drafted rounds from DDS using 60-minute duration.
3. Non-fill days remain shells with selected template linkage preserved.
4. Failed +Fill days can be retried without recreating the full week.
5. Coach can finish weekly planning with minimal manual recovery steps.

### Weekly Monitoring Checklist

Track this after each weekly rollout change:

1. Fill success rate per assignment.
2. Average retries per assignment.
3. Most common failure reason categories.
4. Coach edits required after fill (signal of draft quality).
5. Time to complete week planning from confirm click to usable schedule.

If metrics regress, adjust this section before moving to monthly phase.

## Quick Reference

| Question | Answer |
| --- | --- |
| Where does Fill start? | [src/components/workouts/WorkoutEditor.tsx](src/components/workouts/WorkoutEditor.tsx) |
| Where is the recent history limit set? | [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts) |
| Where is the main DDS generation logic? | [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) |
| What is the most important tuning asset? | The linked structure template and its section configuration |
| What most often weakens DDS? | Unmatched imported movements and vague template wording |
| Is `aiGuidance` live today? | Not in the current movement-selection logic |
| End | DDS control surface. |
