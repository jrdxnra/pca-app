# DDS Implementation Todo

This file tracks execution for the DDS refactor so progress does not get lost.

## Status Keys

- [ ] Not started
- [~] In progress
- [x] Done

## Phase 0: Alignment

- [x] Confirm goals should drive intent/structure first.
- [x] Add month goal chips and pass goals to +Fill request.
- [x] Implement starter goal profile mapping in DDS.
- [x] Expand goal-intent mapping to the full target taxonomy.

## Phase 1: Data Model (Client Movement Profile)

- [x] Add `ClientMovementProfile` core type scaffold.
- [x] Add firestore service module for movement profile CRUD.
- [x] Add API read path in draft route to load movement profile by client.
- [x] Define default profile bootstrap when no profile exists.

## Phase 2: Scoring Refactor

Target weighting model:

- Goal-intent fit: 35-40%
- Session structure fit: 20-25%
- Client movement profile fit: 20-25%
- Progression continuity: 10-15%
- Raw recent history frequency: 5-10%

Tasks:

- [x] Add explicit scoring components (`G`, `S`, `C`, `P`, `H`) in DDS.
- [x] Move recent history to low-weight tie-breaker role.
- [x] Add profile-gated filters before ranking.
- [x] Add planned-repeat logic (repeat allowed when progression-justified).

## Phase 3: Coach Feedback Loop

- [x] Define note-to-signal mapping for coach feedback.
- [x] Persist feedback signals on completed sessions.
- [x] Feed feedback signals into profile fit and progression continuity.
- [x] Add safety guardrails for pain/poor tolerance signals.

## Phase 4: Evaluation (A/B)

- [x] Build A/B runner for 20-30 generated sessions.
- [x] Compare current vs refactored pipeline with same inputs.
- [x] Track metrics:
  - manual edits per session
  - unsafe/unsuitable picks
  - progression coherence
  - time to approve
  - coach confidence (1-5)
- [x] Define go/no-go threshold and rollout decision.

Latest decision note (2026-06-28):

- Result: `no-go` (0/4 threshold checks passed on 24 evaluated samples).
- Follow-up: calibrate A/B metrics/proxies to improve sensitivity, then re-run before enabling weekly flow.

## Phase 5: Rollout

- [x] Add decision-trace output for applied goal profile and score breakdown.
- [x] Add feature flag to switch DDS engines.
- [~] Roll out to month flow first, then weekly flow.
- [x] Update DDS docs with final operator guidance.

Rollout execution note (2026-06-28):

- Weekly flow is enabled by default unless `DDS_ENABLE_WEEKLY_FILL=false` is set.
- Added `npm run dds:canary` for weekly telemetry pass/fail summary.
- Rollout remains in progress until weekly canary has sufficient live sample volume.
