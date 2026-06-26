# DDS Workflow

This file documents how DDS currently consumes imported workout history and how to tune it.

## What DDS Uses Today

- Source data: `clientWorkouts` for the selected client.
- History window: recent sessions only (default 24, configurable via `DDS_RECENT_WORKOUT_LIMIT`).
- Context inputs:
  - workout history rounds/movement usages
  - client notes/goals/training phases
  - movement category and configuration context

## Import Pipeline Behavior

1. Paste text is parsed into sessions by `Date` blocks and section headers.
2. Movement names are matched to the movement library.
3. If no match is found, movement text is kept as a note.
4. Imported sessions are stored in `clientWorkouts` with `createdBy = history-import`.

## Movement Matching Rules

- First pass: exact normalized name match.
- Second pass: substring fuzzy fallback.
- Alias learning: coach can manually map unmatched names to a movement.
- Learned aliases are reused for future imports.

## Why Matching Quality Matters

DDS ranking logic primarily relies on movement IDs from historical sessions.
If a row stays unmatched, it carries informational notes but contributes less to deterministic movement-frequency signals.

## Tuning Knobs

- `DDS_RECENT_WORKOUT_LIMIT` (env): number of recent sessions considered.
  - Lower values increase recency bias.
  - Higher values increase stability and long-term pattern memory.
  - Practical range: 24 to 32 before returns usually diminish.
- Movement alias coverage: more mapped aliases means better deterministic continuity.

## Recommended Best Practices

- Keep movement names consistent with your movement library.
- After each import, resolve unmatched names where possible.
- Avoid duplicate-date imports unless intentionally preserving alternate references.
- Review imported sessions and correct obvious parsing anomalies before large backfills.

## Future Improvements

- Persist alias mappings in Firestore per account (instead of local storage only).
- Add per-alias confidence and approval workflow.
- Add import dry-run diff view before writing.
- Add duplicate handling modes (`keep`, `reference`, `replace`).
