# DDS Draft System - How It Works

**DDS = Deterministic Decision System**

This document explains how imported workout history informs future DDS draft generation.

## Overview

The DDS system analyzes your client's recent workout history to make deterministic (rule-based, not AI) recommendations for structuring new workouts. It does NOT replace creativity or coaching judgment—it surfaces patterns and preferences.

## The Flow

### 1. Import Workouts
When you paste historical workouts into the import dialog:
- Parser extracts dates, movement names, sets, reps, loads, and sections (WARM UP, STRENGTH, AUXILIARY, CARDIO).
- Each movement name is matched against your movement library:
  - **Exact match**: `"Lat Pull Down"` → finds movement ID `mov_xyz123`
  - **Fuzzy match**: `"Lat Pull"` → finds `"Lat Pull Down"` (substring match)
  - **No match**: `"Mystery Custom Move"` → stored with empty ID + note for future reference

Code: [src/lib/workouts/pasteHistoryImport.ts](src/lib/workouts/pasteHistoryImport.ts)

### 2. Storage
Imported workouts are saved to Firestore (`clientWorkouts` collection) with:
- `movementId` (if matched) or empty string (if unmatched)
- `targetWorkload` (reps, weight, tempo, etc.)
- `categoryName` (e.g., "STRENGTH", "CARDIO")
- Notes marking import batch, source date, and any unmatched movement names

### 3. DDS Analysis (When Generating a Draft)
When you click "Fill Draft" for a workout:

**Step A: Fetch recent history**
- Grabs the **12 most recent** imported workouts for this client (configurable at [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts#L273))
- Filters by category if specified (e.g., "strength" sessions only)

**Step B: Build movement frequency stats**
- Counts how many times each movement appeared across those 12 workouts
- **Only counts movements with valid IDs** (matched to your library)
- Unmatched movements are ignored in frequency calculation
- Example: If "Lat Pull Down" appeared in 8 of 12 sessions → rank: 8

Code: [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts#L510) `buildMovementStats()`

**Step C: Build round templates**
- Looks for recurring round patterns (e.g., "which movements appear together in STRENGTH sections?")
- Extracts typical sets/reps/load for each movement

**Step D: Apply structure template (if selected)**
- If you chose a workout structure (e.g., "PP/MB/Ballistics + Conditioning"), DDS fills each section:
  - High-frequency movements get picked first
  - Typical workload from history is carried over
  - Section fallback logic fills gaps (if no history for a section type)

**Step E: Generate draft**
- Returns a structured workout with:
  - Movements ranked by frequency
  - Workload (reps, weight) from recent history
  - Sections aligned to your structure template

Code: [src/lib/ai/workoutDraft.ts](src/lib/ai/workoutDraft.ts#L1930) `buildWorkoutDraftFromHistory()`

### 4. You Edit & Refine
- Review the draft
- Add/remove movements, adjust weights, modify sections
- Save as a real workout

## Key Tuning Parameters

| Parameter | Location | Current Value | Impact |
|-----------|----------|----------------|--------|
| **Recent history window** | [src/app/api/fill/workouts/draft/route.ts](src/app/api/fill/workouts/draft/route.ts#L273) | 12 sessions | How far back DDS looks. Smaller = more recent bias. Larger = broader pattern recognition. |
| **Movement match fuzz** | [src/lib/workouts/pasteHistoryImport.ts](src/lib/workouts/pasteHistoryImport.ts#L1) | Substring overlap | How permissive the fuzzy match is. Tighter = fewer false positives. Looser = fewer unmatched. |

## Best Practices to Improve DDS Outputs

1. **Import complete history**
   - More sessions = better movement frequency signals
   - Aim for at least 20–30 recent sessions per client for stable patterns

2. **Keep movement names consistent**
   - Use exact names as they appear in your library
   - "Lat Pull Down - Wide" vs "Lat Pulldown - Wide" will create separate entries
   - If you see unmatched names repeatedly, add them to your library or rename in imports

3. **Use source dates accurately**
   - Helps DDS ignore stale patterns (e.g., movements from 6 months ago)
   - Prevents "reference sessions" (duplicates) from skewing frequency

4. **Manually assign unmatched movements**
   - If DDS keeps ignoring "Custom Movement", manually link it to a library movement
   - Over time, this trains the system to recognize your personal vocabulary

## Debugging

**"My favorite movement isn't being picked"**
- Check if it has a valid movement ID (matched during import)
- Count frequency: did it appear in enough recent sessions?
- Check if it's in the right category for the section being filled

**"Unmatched movements in my import"**
- Look at the import results summary
- Click the archived session to load it back into the editor
- Edit the movement name to match your library exactly, then re-save

**"DDS is choosing weird movements"**
- It's ranking by frequency, not by coaching logic
- Use section guidance (aiGuidance) in your structure templates to steer it
- Manually edit the draft if DDS makes poor choices—that's normal coaching

## Future Enhancements

- [ ] Configurable history window (currently hardcoded to 12)
- [ ] Movement remapping UI (assign unmatched → library movements automatically)
- [ ] Frequency bias weighting (recent sessions count more)
- [ ] Seasonal pattern detection (adjust recommendations by date/phase)
- [ ] Session context (intensity, client feedback) informing DDS logic
