# DDS System Control Surface

DDS means Deterministic Decision System.

This file is the operator-facing reference for how DDS currently works, which inputs it actually uses, and which levers change behavior.

It is intentionally biased toward live, verified behavior over aspirational design.

Execution tracker: [DDS_IMPLEMENTATION_TODO.md](DDS_IMPLEMENTATION_TODO.md)

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

## Implemented Updates (2026-06-28)

This section captures what was actually implemented in this codebase during the current DDS/configuration pass.

### 1. Workout intent taxonomy was expanded and reconfigured

Updated default intent seeding and intent sync behavior in [src/lib/firebase/services/workoutIntents.ts](src/lib/firebase/services/workoutIntents.ts):

- Added new intent keys:
	- `aerobic-base`
	- `threshold-intervals`
	- `prehab`
	- `mobility-flow`
- Clarified existing intent definitions:
	- `conditioning` now describes mixed metabolic work-capacity sessions
	- `recovery` is explicitly standalone low-intensity restoration
	- `cooldown` is explicitly end-of-session downregulation
	- `strength` and `hypertrophy` descriptions were tightened for progression intent
- Added default-sync logic so existing default intents are auto-reconciled to canonical seed values (name, color, description, order) without manual re-entry.

### 2. Configure-page intent inference and section defaults were upgraded

Updated intent inference, alias resolution, and default section config in [src/app/configure/page.tsx](src/app/configure/page.tsx):

- Inference now recognizes additional patterns and routes to new keys (`aerobic-base`, `threshold-intervals`, `prehab`, `mobility-flow`).
- Alias map expanded for backward compatibility and migration safety.
- Section defaults were extended for new intents across:
	- `defaultStructure`
	- `focusArea`
	- `defaultDuration`
	- `defaultRepRange`
	- `defaultRestPeriod`
	- `workRestRatio`
	- `useTime`

### 3. DDS intent normalization was made backward-compatible

Updated intent key normalization in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) so new keys map safely into current draft archetypes without breaking generation behavior.

### 4. Configure page UX updates completed

Updated layout and completion-notification behavior in [src/app/configure/page.tsx](src/app/configure/page.tsx):

- Removed the setup-completion celebration overlay (`All setup tasks complete` popup/confetti).
- Reordered workout config layout:
	- `Workout Structure Templates` moved to the left column under `Week Templates`.
	- `Workout Categories` moved to the left column above `Workout Structure Templates`.

### 5. Validation

- TypeScript compile checks were run successfully using `npx tsc --noEmit -p tsconfig.json --pretty false` after these changes.

### 6. DDS scoring and repeat control was refactored

Updated section movement scoring and repeat control in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts):

- Ranking now uses explicit weighted components:
	- goal-intent fit (`G`)
	- session structure fit (`S`)
	- client movement profile fit (`C`)
	- progression continuity (`P`)
	- raw history frequency (`H`, low-weight tie-breaker)
- Added profile-gated filtering before ranking so low-readiness movement families are blocked in high-load archetypes unless explicitly allowed/preferred.
- Added planned-repeat logic so recent movement-family repeats are allowed when progression is justified (progressive archetypes/goals plus continuity signals like prior loading or favorable progression stage), rather than only via last-resort fallback.

### 7. Coach feedback loop signals were wired into DDS

Updated feedback ingestion and DDS signal usage across:

- [src/lib/ai/workoutFeedbackSignals.ts](src/lib/ai/workoutFeedbackSignals.ts)
- [src/lib/firebase/services/workoutLogs.ts](src/lib/firebase/services/workoutLogs.ts)
- [src/lib/firebase/services/clientMovementProfiles.ts](src/lib/firebase/services/clientMovementProfiles.ts)
- [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts)
- [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts)

Implemented behavior:

- Completed workout log notes and session RPE now map to deterministic feedback signals (`pain`, `poor_tolerance`, `too_hard`, `too_easy`, `great_quality`, `good_tolerance`, `time_overrun`).
- Extracted signals are persisted to `clientMovementProfiles.feedbackLog` during workout log upsert.
- Severe movement-level signals (`pain`, `poor_tolerance`) auto-infer movement preference safeguards and are blocked during DDS movement selection.
- Feedback signals are also folded into profile-fit and progression-continuity scoring, so recent tolerance quality can nudge ranking.

### 8. Phase 4 A/B runner was added

Added executable evaluation runner in [scripts/dds_ab_runner.ts](scripts/dds_ab_runner.ts) with npm command in [package.json](package.json):

- Run command: `npm run dds:ab`
- Required env: `DDS_AB_ACCOUNT_ID`
- Optional env:
	- `DDS_AB_SAMPLE_SIZE` (default `24`, intended range `20-30`)
	- `DDS_AB_OUTPUT` (default `scripts/dds_ab_results.json`)

Runner behavior:

- Samples recent account workouts that used `structure-fill:*` and have linked structure templates.
- Replays the same input context through two variants:
	- baseline variant (minimal profile/context features)
	- current refactored variant (goal/profile/feedback-aware)
- Produces per-sample and aggregate metrics JSON including:
	- manual edits proxy
	- unsafe pick count proxy
	- progression coherence ratio
	- coach confidence proxy (1-5)
	- comparative win counts by metric

## External Source Review: wger + Kaggle

This section summarizes what was verified from external reference sources and how those findings map to DDS planning.

### wger routine API (official docs)

Source reviewed: [https://wger.readthedocs.io/en/latest/api/routines.html](https://wger.readthedocs.io/en/latest/api/routines.html)

Verified model shape:

- `Routine` -> `Day` -> `Slot` -> `SlotEntry`
- Progression configs are first-class (`WeightConfig`, `RepetitionsConfig`, `SetsConfig`, `RirConfig`, `RestConfig`, with max variants)
- Iterations are explicit and drive progression timing
- Day sequencing supports control flags like `need_logs_to_advance` and `fit_in_week`
- Computed views are exposed (`structure`, `date-sequence-display`, `date-sequence-gym`, `logs`, `stats`)

Interpretation for DDS:

- wger treats intent/config/progression as explicit data objects, not only labels.
- This is a useful north-star for future DDS evolution (especially for progression-rule clarity and iteration-aware analytics).

### Kaggle workout program dataset page

Dataset page reviewed: `adnanelouardi/600k-fitness-exercise-and-workout-program-dataset` on Kaggle.

Verified from page metadata/data-dictionary content:

- Two files are described:
	- `fitness_exercises.csv` (exercise-level rows)
	- `program_summary.csv` (program-level aggregates)
- `program_summary.csv` includes fields such as:
	- `title`, `description`, `level`, `goal`, `equipment`, `program_length`, `time_per_workout`, `total_exercises`, timestamps
- `fitness_exercises.csv` includes workout-positioning context (`week/day`) and prescription-like columns (`sets/reps`, `intensity`, etc.)

Important constraint observed during review:

- Kaggle page/API endpoints in this environment were partially gated (anti-forgery/auth/subscription), so a full raw CSV value-enum extraction was not available from direct download.
- We can verify field presence and dataset structure from page metadata, but not guarantee a complete closed list of all real-world `goal` values without authenticated CSV access.

Interpretation for DDS:

- Kaggle’s useful signal is that `goal` is program-level context, while workout details live at exercise/week/day granularity.
- This supports the current DDS direction:
	- goals as macro-level bias
	- intents/templates as session/section-level execution controls

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
7. Optional `goals` (comma-separated macro goal context)

Notes:

- `goals` is now supported by the request schema and consumed in DDS global context.
- Month +Fill currently sends both `currentNotes` and `goals` derived from selected goal chips.

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

## Go Or No-Go Rule (Phase 4)

Use this fixed threshold gate after each A/B run from [scripts/dds_ab_runner.ts](scripts/dds_ab_runner.ts):

1. `manualEditsProxy.delta <= -0.20`
2. `unsafePicks.delta <= -0.10`
3. `progressionCoherence.delta >= +0.05`
4. `coachConfidenceProxy.delta >= +0.20`

Decision rule:

1. If at least 3 of 4 checks pass, mark `go`.
2. If fewer than 3 pass, mark `no-go`, tune DDS weights/filters, then re-run A/B.

### Latest run outcome (2026-06-28)

Using [scripts/dds_ab_runner.ts](scripts/dds_ab_runner.ts) with `DDS_AB_ACCOUNT_ID=master` and `DDS_AB_SAMPLE_SIZE=24`:

1. `sampleSizeEvaluated = 24`
2. `manualEditsProxy.delta = 0.00` (threshold: `<= -0.20`, fail)
3. `unsafePicks.delta = 0.00` (threshold: `<= -0.10`, fail)
4. `progressionCoherence.delta = 0.00` (threshold: `>= +0.05`, fail)
5. `coachConfidenceProxy.delta = 0.00` (threshold: `>= +0.20`, fail)

Decision:

1. `no-go` for promotion based on the current threshold gate (0/4 checks passed).
2. Next action is metric calibration in the A/B runner so baseline/current variants produce differentiable quality signals before another rollout decision.

## Phase 5 Rollout Controls

### Feature flag: engine switching

Fill Draft API now supports environment-level engine selection in [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts):

1. `DDS_ENGINE_MODE=current` (default): full goal/profile/feedback-aware DDS
2. `DDS_ENGINE_MODE=baseline`: reduced-context baseline mode for controlled comparisons

### Feature flag: month-first flow rollout

Fill Draft API now enforces flow-level rollout gating in [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts) via `X-DDS-Flow` headers sent by callers:

1. Monthly +Fill caller ([src/components/programs/QuickWorkoutBuilderDialog.tsx](src/components/programs/QuickWorkoutBuilderDialog.tsx)) sends `X-DDS-Flow: monthly`.
2. Weekly +Fill caller ([src/hooks/useClientPrograms.ts](src/hooks/useClientPrograms.ts)) sends `X-DDS-Flow: weekly`.

Environment flags:

1. `DDS_ENABLE_MONTHLY_FILL` (default `true`)
2. `DDS_ENABLE_WEEKLY_FILL` (default `false`)
3. `DDS_ENABLE_SINGLE_FILL` (default `true`)

Operational rollout sequence:

1. Keep weekly disabled while validating month flow behavior and A/B outcomes.
2. Enable weekly by setting `DDS_ENABLE_WEEKLY_FILL=true` after month stability criteria are met.

### Runtime telemetry surfaces

Added structured rollout telemetry in [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts):

1. Per-request `success`/`error` telemetry events with:
	- `flow` (`single|monthly|weekly`)
	- `engineMode` (`current|baseline`)
	- `status`
	- `latencyMs`
	- `templateId`
	- `categoryName`
	- `strategy` and `recentWorkoutsAnalyzed` on success
	- normalized `errorCode`/`errorMessage` on failure

Added weekly preflight summary capture in [src/hooks/useClientPrograms.ts](src/hooks/useClientPrograms.ts):

1. `apiDrafts`
2. `fallbackDrafts`
3. `failedDrafts`
4. categorized `failureCategories`
5. `preflightMs`

This is emitted through existing `debugFlow('preflight_end', ...)` so weekly rollout quality can be monitored per assignment.

### Weekly canary script

Run canary summary from backend telemetry:

1. `npm run dds:canary`

Optional env:

1. `DDS_CANARY_LOOKBACK_HOURS` (default `24`)
2. `DDS_CANARY_MIN_REQUESTS` (default `8`)

Current status note (2026-06-28):

1. Weekly flow defaults to enabled unless `DDS_ENABLE_WEEKLY_FILL=false` is set.
2. Canary output currently has `total=0` for weekly telemetry in the last 24h, so verdict is expected to be `fail` until real weekly +Fill traffic is generated.

### Decision trace: score/profile breakdown

Decision trace payload in [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts) now includes:

1. `engineMode`
2. `appliedGoalProfile` (intent priority, preferred structures, bias keywords)
3. `scoringBreakdown` (current G/S/C/P/H component weights)
4. `safetyBreakdown` (avoid preferences, low-readiness families, pain/poor-tolerance feedback block count)

## Checkpoint Note (2026-06-28)

This note captures the latest save-state so we can resume later without context loss.

### Config hardening saves completed

Applied in [src/app/configure/page.tsx](src/app/configure/page.tsx):

1. Category saves now auto-fill canonical description when blank.
2. Category saves now auto-link the best matching workout structure template when no link is set.
3. Workout Structure Template dialog saves now normalize sections by:
	- auto-inferencing missing workout intent fields
	- applying missing section defaults (structure/focus/duration)
	- generating `aiGuidance` when missing

### +Fill DDS check run (post-change)

Canary command run with explicit project env:

1. `GOOGLE_CLOUD_PROJECT=performancecoachapp-26bd1 GCLOUD_PROJECT=performancecoachapp-26bd1 npm run dds:canary`

Result snapshot:

1. `accountId: master`
2. `lookbackHours: 24`
3. `summary.total: 0`
4. `verdict: fail` (no weekly sample yet in lookback window)

Interpretation:

1. DDS rollout logic is running, but this specific telemetry window still has no weekly events to score.
2. Next check should be re-run after more weekly +Fill traffic lands in the last 24h window.
