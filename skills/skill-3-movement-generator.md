# SKILL 3: Movement Generator

**Type**: Core Generation Skill  
**Purpose**: Select and populate movements for a workout session  
**Input**: Session context, template structure, client profile, movement library, feedback history  
**Output**: Populated workout rounds with movement selections and reasoning  
**Called By**: All flows (SINGLE, WEEKLY, MONTHLY)  
**Reads**: SKILL 0 (Knowledge Base) + outputs from SKILL 1 (Context), SKILL 2 (Session Plan), SKILL 7 (Progression)

---

## INPUT CONTRACT

```json
{
  "sessionContext": {
    "timeHorizon": "single" | "weekly" | "monthly",
    "trainingStyle": "strength" | "hypertrophy" | "conditioning" | "endurance" | "mixed",
    "isProgressive": boolean,
    "expectations": {
      "movementRepeatFrequency": "rare" | "occasional" | "frequent",
      "varietyImportance": "high" | "medium" | "low",
      "fatigueCoordination": "critical" | "important" | "minimal"
    }
  },
  
  "sessionDetails": {
    "date": "YYYY-MM-DD",
    "category": "Workout" | "Strength" | "Conditioning" | "Mobility" | etc,
    "templateId": "string",
    "durationMinutes": number,
    "templateSections": [
      {
        "ordinal": number,
        "sectionName": string,
        "workoutTypeId": string,
        "workoutTypeName": "Warmup" | "Strength" | "Accessory" | "Conditioning" | etc,
        "focusArea": string,
        "defaultStructure": "straight-sets" | "supersets" | "circuits" | "amrap" | "emom",
        "defaultDuration": number,
        "defaultRepRange": { min: number, max: number },
        "notes": string
      }
    ]
  },
  
  "clientProfile": {
    "id": string,
    "goals": string[],
    "trainingPhase": string,
    "experienceLevel": "beginner" | "intermediate" | "advanced",
    "restrictions": string[],
    "preferences": string[],
    "recentWorkouts": {
      "lastN": number,
      "workouts": [
        {
          "date": "YYYY-MM-DD",
          "movements": [
            {
              "movementId": string,
              "familyKey": string,
              "exerciseName": string,
              "load": number,
              "reps": number,
              "sets": number,
              "feedback": {
                "signal": "pain" | "too_easy" | "too_hard" | "great_quality" | etc,
                "date": "YYYY-MM-DD"
              }
            }
          ]
        }
      ]
    }
  },
  
  "movementLibrary": [
    {
      "id": string,
      "name": string,
      "familyKey": string,
      "category": string,
      "difficulty": "beginner" | "intermediate" | "advanced",
      "equipment": string[],
      "instructions": string,
      "videoUrl": string,
      "cueWords": string[],
      "typicalRepRange": { min: number, max: number },
      "typicalLoad": number
    }
  ],
  
  "contextFromSkills": {
    "contextAnalysis": {
      "timeHorizon": "single" | "weekly" | "monthly",
      "trainingStyle": string,
      "sessionFrequency": number
    },
    "sessionPlan": {
      "phase": "base" | "build" | "peak" | "deload",
      "conflictWarnings": string[],
      "progressionNote": string
    },
    "progressionReasoning": {
      "shouldRepeatMovement": boolean,
      "suggestedProgression": "load" | "volume" | "density" | "technique" | "recovery",
      "loadAdjustment": number,
      "volumeAdjustment": number,
      "movementFamilyRepeatStrategy": string
    }
  },
  
  "feedbackHistory": {
    "byMovement": {
      "movementId": {
        "signals": ["pain", "too_easy", "too_hard", "great_quality"],
        "lastSignal": string,
        "lastSignalDate": "YYYY-MM-DD"
      }
    },
    "sessionNotes": string
  }
}
```

---

## OUTPUT CONTRACT

```json
{
  "success": boolean,
  "rounds": [
    {
      "ordinal": number,
      "sectionName": string,
      "sectionWorkoutTypeId": string,
      "structure": "straight-sets" | "supersets" | "circuits" | "amrap" | "emom",
      "movementUsages": [
        {
          "ordinal": number,
          "movementId": string,
          "exerciseName": string,
          "familyKey": string,
          "targetSets": number,
          "targetReps": number,
          "targetLoad": number,
          "targetTempo": string,
          "targetRPE": number,
          "note": string,
          "selectionReasoning": string
        }
      ]
    }
  ],
  
  "selectionReasoning": {
    "byMovement": {
      "movementId": {
        "whySelected": string,
        "horizonContext": string,
        "progressionJustification": string,
        "alternativesConsidered": string[],
        "riskFlags": string[]
      }
    }
  },
  
  "qualityMetrics": {
    "uniqueMovementCount": number,
    "familyBalance": {
      "squat": number,
      "hinge": number,
      "push_horizontal": number,
      "push_vertical": number,
      "pull_horizontal": number,
      "pull_vertical": number,
      "core": number,
      "conditioning": number
    },
    "totalVolume": number,
    "estimatedDuration": number,
    "densityEstimate": number
  },
  
  "warnings": [
    {
      "type": "safety" | "coherence" | "progression" | "balance",
      "message": string,
      "severity": "high" | "medium" | "low"
    }
  ]
}
```

---

## CORE ALGORITHM

### STEP 1: Parse Context & Constraints

**Input**: All inputs from INPUT CONTRACT

**Decision Logic**:

```
IF timeHorizon == "single":
  constraint_set = SINGLE_CONSTRAINTS
  selection_mode = "greedy" (pick best for this session)
  
ELSE IF timeHorizon == "weekly":
  constraint_set = WEEKLY_CONSTRAINTS
  selection_mode = "coordinated" (avoid recent sessions)
  
ELSE IF timeHorizon == "monthly":
  constraint_set = MONTHLY_CONSTRAINTS
  selection_mode = "progressive" (build on prior weeks)
```

**SINGLE_CONSTRAINTS**:
- No cross-session coordination
- Movement can repeat if appropriate
- Density target: Standard for session type

**WEEKLY_CONSTRAINTS**:
- Same movement family: avoid if used in last 2-3 days
- Same movement: avoid if used within 2 days
- Pattern balance: vary across week
- Fatigue: don't stack high-stress movements

**MONTHLY_CONSTRAINTS**:
- Main lift: can repeat week-to-week, but progress load/volume
- Accessory: can rotate per week
- Movement family: space minimum 2 days within week
- Cross-week: allow same movement same day position each week (e.g., "Monday = Back Squat" every week)

---

### STEP 2: Build Movement Candidate Pool

**For each templateSection in session**:

1. **Extract section intent** from section name, focusArea, workoutTypeName
   - Example: Section name "Strength Main Lift" + focusArea "lower body" = intent is "heavy quad or hinge"

2. **Filter movement library** by:
   - ✓ Client experience level ≥ movement difficulty
   - ✓ Equipment available for client
   - ✗ Movements in client "avoid" preference list
   - ✗ Movements with "pain" or "poor_tolerance" feedback
   - ✓ Movements matching section intent (keyword match on cueWords)

3. **Score candidates** based on:
   - **Recency in history** (used 1 week ago = higher score than 1 month ago)
   - **Success feedback** (marked "great_quality" = higher score)
   - **Progression potential** (can load increase? = higher score)
   - **Fit to section** (matches focusArea and workoutType = higher score)

4. **Rank top 5 candidates** for this section

**Example**:
```
Section: "Strength Main Lift", focusArea: "Lower Body Squat"

Library filtered by:
  ✓ Client is intermediate
  ✓ Has access to barbell rack
  ✗ Exclude: Front Squat (client has "knee_sensitivity" note, avoid)
  ✗ Exclude: Leg Press (marked "pain" 3 days ago)

Candidates ranked:
  1. Back Squat (used 3 days ago with great_quality feedback, load can increase)
  2. Goblet Squat (used 10 days ago, good tolerance, lower load progression)
  3. Belt Squat (used 2 weeks ago, never marked "pain", good progression path)
  4. Split Squat (used 5 days ago, alternative angle, moderate feedback)
  5. Sissy Squat (never used, advanced variation, highest skill requirement)
```

---

### STEP 3: Apply Time Horizon Selection Logic

#### SINGLE HORIZON SELECTION

**Goal**: Pick the BEST movements for this isolated session

**Algorithm**:
```
FOR each templateSection:
  candidates = top_5_from_pool(section)
  
  // Greedy selection: pick highest-scored candidate
  selected = candidates[0]
  
  // Determine load/reps from history or defaults
  IF selected.movementId in client.recentWorkouts:
    load = last_known_load(selected.movementId)
    reps = last_known_reps(selected.movementId)
  ELSE:
    load = selected.typicalLoad
    reps = selected.typicalRepRange.mid
  
  // Adjust for section intent
  IF section.defaultRepRange:
    reps = clamp(reps, section.defaultRepRange.min, section.defaultRepRange.max)
  
  // Sets from section config
  sets = section.defaultSets OR calculate_from_duration(session.durationMinutes)
  
  output.addMovement(selected, sets, reps, load)
```

**No constraints**: Just pick the best movement for each section.

---

#### WEEKLY HORIZON SELECTION

**Goal**: Pick movements that COORDINATE across the week without repeating patterns

**Algorithm**:
```
recent_sessions = client.workouts.last(7_days)
recent_movements_by_family = {}
  FOR each recent_session:
    FOR each movement:
      family = movement.familyKey
      recent_movements_by_family[family].append({movement, date})

FOR each templateSection:
  candidates = top_5_from_pool(section)
  
  // Filter candidates by spacing rules
  filtered_candidates = []
  FOR each candidate:
    days_since_used = today - last_used_date(candidate)
    family = candidate.familyKey
    family_days_since_used = today - last_family_used_date(family)
    
    IF days_since_used >= 2 AND family_days_since_used >= 1:
      filtered_candidates.append(candidate)  // OK to use
    ELSE IF timeHorizon == "weekly" AND days_since_used >= 3:
      filtered_candidates.append(candidate)  // Safer to use
  
  IF filtered_candidates.empty():
    // Spacing rule violated, pick best available with warning
    selected = candidates[0]
    add_warning("Spacing conflict: " + selected.name + " used " + days_since_used + " days ago")
  ELSE:
    selected = filtered_candidates[0]
  
  // Load progression: check SKILL 7 guidance
  IF progressionReasoning.shouldRepeatMovement AND selected == last_occurrence:
    load = last_load * (1 + progressionReasoning.loadAdjustment)
    reps = last_reps OR reps  // same reps, increased load
  ELSE:
    load = last_load OR default_load
    reps = last_reps OR section.defaultRepRange.mid
  
  output.addMovement(selected, sets, reps, load)
```

**Spacing rules enforced**:
- Same movement: 2+ days minimum
- Same family: 1+ day minimum (within reason)

---

#### MONTHLY HORIZON SELECTION

**Goal**: Pick movements that BUILD A PROGRESSION across 4 weeks

**Algorithm**:
```
phase = sessionPlan.phase  // "base", "build", "peak", "deload"
week_number = calculate_week_from_date(sessionContext.date, startDate)
is_same_day_position = (day_of_week == last_week_same_day)

FOR each templateSection:
  candidates = top_5_from_pool(section)
  
  // Check if main lift (should repeat same day position each week)
  IF section.workoutTypeName == "Strength" AND trainingStyle == "strength":
    IF is_same_day_position:
      // Main lift at same day each week: SHOULD use same movement with progression
      main_lift_from_last_week = find_movement_at_same_position_last_week(section)
      
      IF main_lift_from_last_week:
        selected = main_lift_from_last_week
        
        // Apply progression from SKILL 7
        IF phase == "base":
          load_multiplier = 1.0  // establish baseline
        ELSE IF phase == "build":
          load_multiplier = 1.10  // +10% volume or reps
        ELSE IF phase == "peak":
          load_multiplier = 1.05  // +5% load (intensity focus)
        ELSE IF phase == "deload":
          load_multiplier = 0.65  // -35% load (recovery focus)
        
        load = last_load * load_multiplier
        reps = calculate_reps(phase)  // higher reps in build, lower in peak
      ELSE:
        // First week: establish baseline
        selected = candidates[0]
        load = selected.typicalLoad OR estimate_from_client_profile()
        reps = section.defaultRepRange.mid
    ELSE:
      // Not same day position: select from candidates with variety
      // Don't repeat exact same movement as used elsewhere this week
      selected = filter_by_week_coherence(candidates)
      load = estimated_from_history()
      reps = section.defaultRepRange.mid
  
  ELSE:
    // Not a main lift (accessory/conditioning): can rotate more
    selected = candidates[0]
    
    // Check if should repeat this movement this week
    IF progressionReasoning.shouldRepeatMovement:
      // OK to use within week
      load = last_load
      reps = last_reps
    ELSE:
      // Rotate to different variation
      selected = filter_to_different_variation(candidates, selected)
      load = estimated_from_library()
      reps = section.defaultRepRange.mid
  
  output.addMovement(selected, sets, reps, load)
```

**Key behaviors**:
- Main strength lifts: Same day position each week, progressing load/reps by phase
- Accessory lifts: Rotate week-to-week or within-week per progression reasoning
- Conditioning: Vary movements, rarely repeat exact same workout

---

### STEP 4: Validate Movement Balance

**For each round constructed**:

```
// Check pattern balance
pattern_count = {
  squat: 0, hinge: 0, push_h: 0, push_v: 0,
  pull_h: 0, pull_v: 0, core: 0, conditioning: 0
}

FOR each movement in round:
  pattern_count[movement.familyKey] += 1

// For weekly/monthly, check across multiple sessions
IF timeHorizon == "weekly":
  required_patterns = all_6_fundamental_patterns
  missing = required_patterns - pattern_count.keys_with_count_gt_0()
  IF missing.size() > 0:
    add_warning("Week missing patterns: " + missing.join(","))

IF timeHorizon == "monthly":
  required_patterns = all_6_fundamental_patterns
  missing = required_patterns - pattern_count.keys_with_count_gt_0()
  IF missing.size() > 0:
    add_warning("Month missing patterns: " + missing.join(","))

// Check density is appropriate
estimated_duration = calculate_duration(movements, structure, rest_periods)
IF estimated_duration > session.durationMinutes * 1.2:
  add_warning("Workout will likely exceed " + session.durationMinutes + " min; estimated " + estimated_duration + " min")
  // Consider removing one movement or reducing sets

IF estimated_duration < session.durationMinutes * 0.6:
  add_warning("Workout will likely be too short; add movement or increase sets/reps")
```

---

### STEP 5: Generate Selection Reasoning

**For each selected movement**:

```
reasoning = {
  whySelected: 
    "Primary reason" + 
    (IF recent_great_quality: " - marked 'great_quality' " + feedback_date + " ago") +
    (IF progression: " - can progress load by " + progressionReasoning.loadAdjustment * 100 + "%"),
  
  horizonContext:
    IF timeHorizon == "single":
      "This is an isolated session; greedy selection for best movement"
    ELSE IF timeHorizon == "weekly":
      "Weekly context: last used " + days_since + " days ago, respects " +
      "2-3 day spacing rule. Complements " + other_sessions_this_week + " in other sessions."
    ELSE IF timeHorizon == "monthly":
      "Monthly progression: " + phase + " phase. " +
      (IF is_main_lift: "Main lift at same position, load progression from last week.") +
      (IF is_rotation: "Rotated from last week's variation for stimulus variety."),
  
  progressionJustification:
    IF progressionReasoning.suggestedProgression == "load":
      "Load increased " + loadAdjustment * 100 + "% per SKILL 7 progression guidance"
    ELSE IF progressionReasoning.suggestedProgression == "volume":
      "Volume increased by " + volumeAdjustment * 100 + "%; reps +1-2 per set"
    ... etc,
  
  alternativesConsidered:
    candidates[1..3].map(c => c.name),
  
  riskFlags:
    (IF feedback.too_hard_recently: ["Marked 'too_hard' recently, watch load"]) +
    (IF load_jump > 10%: ["Load jump > 10%, verify client readiness"]) +
    (IF spacing_violated: ["Spacing rule requires waiver; monitor fatigue"])
}
```

---

## SPECIAL RULES BY TRAINING STYLE

### STRENGTH-FOCUSED

```
// Main lifts
IF section.workoutTypeName == "Strength":
  candidates = filter_by_complexity("heavy", "compound")
  selected = candidates[0]  // Usually heaviest/most technical
  
  load = last_load * progression_factor
  reps = 3-6 (heavy range)
  sets = 4-6 (high quality needed)

// Accessory
ELSE IF section.workoutTypeName == "Accessory":
  candidates = filter_by_complexity("moderate")
  selected = candidates[0]
  
  load = moderate (60-75% of 1RM equivalent)
  reps = 6-10
  sets = 3-4
```

**Special**: Can stack same main lift 2x per week (spaced 3-4 days).

---

### HYPERTROPHY-FOCUSED

```
// Select movement VARIATION within same family
main_family = section.focusArea.infer_family()  // e.g., "squat"

IF last_session_used == "back squat":
  // This week use different squat variation
  candidates = squat_variations MINUS ["back_squat"]
  selected = candidates[0]
ELSE:
  // First time this week: start with most basic variation
  selected = most_basic_variation_of_family()

load = moderate (65-75% 1RM)
reps = 8-15 (hypertrophy range)
sets = 3-5
```

**Special**: Can stack same pattern 2-3x per week if using different variations.

---

### CONDITIONING-FOCUSED

```
// Maximize movement variety
this_week_movements = client.workouts.this_week().movements
  
selected = candidates.filter(c => c NOT IN this_week_movements)[0]

IF selected.empty():
  // All top candidates used this week, pick best alternative
  selected = candidates[0]
  add_warning("Movement variety limited; using variation of recent movement")

load = varies by modality (time, reps, rounds)
structure = AMRAP | EMOM | intervals
```

**Special**: Rarely repeat exact same conditioning workout in one week.

---

## EXAMPLES

### Example 1: SINGLE Workout (Strength Focus)

**Input**:
- timeHorizon: "single"
- trainingStyle: "strength"
- section: "Strength Main Lift", focusArea: "Lower Body Squat", defaultDuration: 8min
- client: Intermediate, likes squats, never marked pain
- recent: Back Squat 5x205 (3 days ago), Leg Press 5x315 (5 days ago)

**Algorithm**:
```
candidates = [Back Squat, Front Squat, Goblet Squat, Belt Squat, Split Squat]
selection_mode = "greedy"
selected = Back Squat (highest ranked from recent success)

load = 205 * 1.02 = 209 lbs (2% increase, conservative)
reps = 5
sets = 5
```

**Output**: 5x5 @ 209 lbs Back Squat

**Reasoning**: "Used 3 days ago with good execution. Slight load increase for continued progression."

---

### Example 2: WEEKLY Planning (Mixed Style)

**Input**:
- timeHorizon: "weekly"
- sessionDetails: Wednesday, category: "Strength Upper"
- recent sessions: Mon = Bench Press, Tue = Conditioning, (Wed = TBD)
- feedbackHistory: Bench Press marked "great_quality" Mon

**Algorithm**:
```
Section 1 (Horizontal Push, focus: Bench variation):
  recent_movements_by_family = {
    push_horizontal: [Bench Press (1 day ago)]
  }
  
  candidates = [Bench Press, Dumbbell Press, Machine Press, ...]
  
  // Check spacing
  days_since_bench = 1 day
  IF days_since_bench < 2:
    // Can't use Bench, pick alternative
    filtered = [Dumbbell Press, Machine Press, ...]
    selected = Dumbbell Press
  
  load = 85 lbs/side (different modality, slightly conservative)
  reps = 8 (different rep range for variation)
  sets = 4
```

**Output**: 4x8 @ 85 lbs/side Dumbbell Press

**Reasoning**: "Bench Press used yesterday, so switching to dumbbell variation for upper body push work. Different rep range provides hypertrophy stimulus while avoiding fatigue stacking."

---

### Example 3: MONTHLY Planning (Strength Focus, Week 2/Peak)

**Input**:
- timeHorizon: "monthly"
- phase: "peak"
- session: Monday (same as every Monday this month)
- Week 1 Monday workout: 5x5 @ 225 lbs Back Squat
- progressionReasoning: loadAdjustment = 1.05, suggestedProgression = "load"

**Algorithm**:
```
Section: Strength Main Lift (Lower Body Squat)
  is_same_day_position = true (Monday = same position each week)
  main_lift_from_week_1 = Back Squat @ 225 lbs
  phase = "peak"
  
  selected = Back Squat (same movement)
  
  IF phase == "peak":
    load_multiplier = 1.05  // +5% for intensity peak
  
  load = 225 * 1.05 = 236 lbs
  reps = 3-5 (peak phase uses lower reps)
  sets = 5
```

**Output**: 5x3-5 @ 236 lbs Back Squat

**Reasoning**: "Main lift progression: peak phase. Same movement at same day position (Monday) as Week 1 baseline (5x5 @ 225). Increased load 5% for intensity focus; reduced reps to 3-5 per peak phase principles. Total volume roughly maintained, quality increased."

---

## DECISION TREE: When to Reject a Candidate

```
FOR each candidate in pool:
  REJECT IF:
    ✗ Client has "pain" feedback on this movement
    ✗ Client has "avoid" in preferences for this movement
    ✗ Movement marked "poor_tolerance" in last 7 days
    ✗ (WEEKLY/MONTHLY) Same movement used within 2 days
    ✗ (WEEKLY) Same movement family used within 1 day
    ✗ (MONTHLY) Main lift at different position in month
    ✗ Load would exceed client's known 1RM
    ✗ Load would be <30% of estimated 1RM (too light, pointless)
  
  WARN IF:
    ⚠ Load increase > 10% from last occurrence
    ⚠ Movement marked "too_hard" in last 14 days
    ⚠ Spacing rule bent but necessary
    ⚠ Movement family concentration high (3+ same pattern in week)
    ⚠ Estimated workout duration exceeds session limit
  
  ALLOW IF:
    ✓ None of the REJECT conditions
    ✓ Passes all spacing rules for horizon
    ✓ Fits section intent
    ✓ Load progression reasonable
```

---

## QUALITY GATES (Before Output)

```
// Gate 1: No duplicates within round
IF round.movements.unique().size() < round.movements.size():
  add_error("Duplicate movements in same round")
  return error

// Gate 2: Minimum movement count
IF round.movements.size() < 1:
  add_error("No movements selected; likely library mismatch")
  return error

// Gate 3: Load sanity
FOR each movement:
  IF movement.load > client.estimated_1RM * 1.1:
    add_error("Load exceeds estimated 1RM; likely data error")
    return error
  
  IF movement.load < client.estimated_1RM * 0.2:
    add_warning("Load very light; verify reps/sets appropriate")

// Gate 4: No pain blocks missed
FOR each movement:
  IF movement.id in feedbackHistory.pain_movements:
    add_error("Pain-blocked movement selected; SKILL 4 should catch")
    return error
```

---

## SUMMARY

**SKILL 3 makes decisions about**:
- ✅ Which movement to select for each section
- ✅ How much load/reps/sets based on progression stage
- ✅ Respect spacing rules (horizon-dependent)
- ✅ Avoid pain/blocked movements
- ✅ Optimize balance across session/week/month
- ✅ Provide transparent reasoning for each choice

**SKILL 3 does NOT decide**:
- ❌ Whether workout is actually safe (SKILL 4 does that)
- ❌ Whether week/month sequences well (SKILL 5 does that)
- ❌ Whether progression is correct (SKILL 7 inputs it)

