# SKILL 7: Progression Reasoner

**Type**: Guidance Skill (Runs per-session)  
**Purpose**: Determine how to progress from the previous session(s) for WEEKLY and MONTHLY flows  
**Input**: Recent workout history, training style, phase context, client feedback  
**Output**: Progression guidance (load adjustment, volume adjustment, movement strategy)  
**Called By**: WEEKLY and MONTHLY flows (NOT SINGLE)  
**Reads**: SKILL 0 (Knowledge Base) + outputs from SKILL 1 (Context), SKILL 2 (Session Plan)  
**Feeds Into**: SKILL 3 (Movement Generator), SKILL 4 (Quality Validator)

---

## INPUT CONTRACT

```json
{
  "progressionContext": {
    "timeHorizon": "weekly" | "monthly",
    "trainingStyle": "strength" | "hypertrophy" | "conditioning" | "endurance" | "mixed",
    "currentPhase": "base" | "build" | "peak" | "deload",
    "weekNumber": number,
    "sessionDayOfWeek": number
  },
  
  "currentSession": {
    "date": "YYYY-MM-DD",
    "category": string,
    "templateId": string,
    "templateName": string,
    "focusArea": string,
    "isSameDayPosition": boolean  // is this Monday again? (for monthly)
  },
  
  "priorSessions": [
    {
      "date": "YYYY-MM-DD",
      "category": string,
      "isInSameBlock": boolean,
      "movements": [
        {
          "movementId": string,
          "name": string,
          "familyKey": string,
          "load": number,
          "reps": number,
          "sets": number,
          "actualRPE": number,
          "feedback": {
            "signal": "pain" | "too_easy" | "too_hard" | "great_quality" | "good_tolerance" | "poor_tolerance",
            "date": "YYYY-MM-DD",
            "notes": string
          }
        }
      ],
      "overallRPE": number,
      "timeOverrun": boolean,
      "notes": string
    }
  ],
  
  "clientProfile": {
    "id": string,
    "trainingAge": "beginner" | "intermediate" | "advanced",
    "goals": string[],
    "frequency": number  // sessions per week
  },
  
  "blockContext": {
    "blockStartDate": "YYYY-MM-DD",
    "weekStartDate": "YYYY-MM-DD",
    "totalBlockWeeks": number,
    "sessionPlan": {
      "thisWeekPhase": "base" | "build" | "peak" | "deload",
      "nextWeekPhase": "base" | "build" | "peak" | "deload"
    }
  }
}
```

---

## OUTPUT CONTRACT

```json
{
  "success": boolean,
  
  "progressionReasoning": {
    "shouldRepeatMovement": boolean,
    "repeatedMovementId": string | null,
    "repeatedMovementName": string | null,
    
    "suggestedProgression": "load" | "volume" | "density" | "technique" | "recovery",
    
    "loadAdjustment": number,  // multiplier (1.05 = +5%, 0.95 = -5%)
    "volumeAdjustment": number,  // multiplier for total reps
    "densityAdjustment": number,  // time/structure adjustment
    
    "repsStrategy": "same" | "plus_one" | "reduce" | "increase_range",
    "setsStrategy": "same" | "plus_one" | "reduce",
    
    "movementFamilyRepeatStrategy": "avoid" | "allow_different_angle" | "allow_same" | "encourage",
    
    "reasoning": string,
    "expectedOutcome": string,
    "riskFlags": string[]
  },
  
  "detailedGuidance": {
    "mainLiftStrategy": string,
    "accessoryStrategy": string,
    "conditioningStrategy": string,
    "recoveryConsiderations": string
  },
  
  "warnings": [
    {
      "type": "fatigue" | "progression" | "form_quality" | "volume_overload",
      "message": string,
      "severity": "high" | "medium" | "low"
    }
  ]
}
```

---

## CORE LOGIC

### ENTRY POINT: Determine Progression Level

**Input**: timeHorizon + weekNumber + trainingStyle

```
IF timeHorizon == "weekly":
  CALL within_week_progression_logic()
  
ELSE IF timeHorizon == "monthly":
  IF session_is_first_of_day_in_week:
    CALL between_week_progression_logic()  // Major progression
  
  CALL within_week_progression_logic()  // Minor progression
```

---

## WITHIN-WEEK PROGRESSION LOGIC

**Purpose**: How to progress from one session to the next session IN THE SAME WEEK

**Input**: 
- Last session (same week, if exists)
- Current session date
- Days since last session
- Training style

**Algorithm**:

```
// Find prior session (in same week)
prior_session = priorSessions
  .filter(s => s.isInSameBlock AND s.date < currentSession.date)
  .sort_by_date()
  .last()

IF prior_session == null:
  // First session of this week, no within-week progression
  return {
    shouldRepeatMovement: false,
    suggestedProgression: "technique",
    reasoning: "First session of week; establish movement quality"
  }

// Analyze prior session quality
prior_performance = analyze_performance(prior_session)
days_since_prior = currentSession.date - prior_session.date

// Apply training-style-specific logic
IF trainingStyle == "strength":
  CALL within_week_strength_progression(prior_session, days_since_prior)
  
ELSE IF trainingStyle == "hypertrophy":
  CALL within_week_hypertrophy_progression(prior_session, days_since_prior)
  
ELSE IF trainingStyle == "conditioning":
  CALL within_week_conditioning_progression(prior_session, days_since_prior)

ELSE:
  CALL within_week_general_progression(prior_session, days_since_prior)
```

### Within-Week: STRENGTH Training

```
// Strength blocks typically have TWO main lifts per week (e.g., Mon squat, Thu squat)
// Within-week progression = minor refinement to same movement

prior_main_lift = prior_session.mainLift()
current_template = currentSession.templateName

IF prior_main_lift != null AND daysince_prior >= 2:
  // 2+ days since last main lift of this type
  // Same session type (both strength main), so likely same lift
  
  prior_rpe = prior_session.overallRPE
  prior_feedback = prior_main_lift.feedback
  
  IF prior_feedback == "great_quality":
    // Excellent performance; increase load
    loadAdjustment = 1.03  // +3% conservative within-week bump
    suggestedProgression = "load"
    reasoning = "Prior session marked 'great_quality'; slight load increase appropriate"
  
  ELSE IF prior_feedback == "too_easy":
    // Movement felt effortless
    loadAdjustment = 1.05  // +5% load increase
    suggestedProgression = "load"
    reasoning = "Movement marked 'too_easy' last time; increase load"
  
  ELSE IF prior_feedback == "too_hard":
    // Client struggled
    loadAdjustment = 0.95  // -5% load reduction
    suggestedProgression = "recovery"
    reasoning = "Movement marked 'too_hard' last time; reduce load to allow quality"
  
  ELSE IF prior_rpe >= 9:
    // Very hard effort
    loadAdjustment = 0.98  // minimal or no change
    suggestedProgression = "technique"
    reasoning = "High RPE last session; focus on form quality before loading"
  
  ELSE:
    // Standard performance
    loadAdjustment = 1.02  // +2% small bump
    suggestedProgression = "load"
    reasoning = "Standard performance; small load increase appropriate"
  
  shouldRepeatMovement = true
  repsStrategy = "same"
  setsStrategy = "same"
  
  IF prior_session.timeOverrun:
    add_warning("Prior session ran over time; consider fewer total reps")

ELSE:
  // Different main lift (e.g., squat vs deadlift) or first of pattern this week
  shouldRepeatMovement = false
  loadAdjustment = 1.0
  suggestedProgression = "technique"
  reasoning = "Different main lift or first session; establish baseline"
```

### Within-Week: HYPERTROPHY Training

```
// Hypertrophy within-week: volume accumulation
prior_main_lift = prior_session.movements_in_family(currentSession.focusArea)

IF prior_main_lift != null:
  // Same body part/family within week
  
  prior_feedback = prior_main_lift.feedback
  prior_volume = prior_main_lift.sets * prior_main_lift.reps
  
  IF prior_feedback == "great_quality":
    // Felt good, can add volume
    volumeAdjustment = 1.10  // +10% more reps or sets
    setsStrategy = "plus_one"  // Add 1 set
    repsStrategy = "same"
    loadAdjustment = 1.0
    suggestedProgression = "volume"
    reasoning = "Good execution last session; increase volume accumulation"
  
  ELSE IF prior_feedback == "too_easy":
    // Could do more
    volumeAdjustment = 1.15  // +15% volume
    setsStrategy = "plus_one"
    repsStrategy = "plus_one"
    loadAdjustment = 1.05  // slight load increase too
    suggestedProgression = "volume"
    reasoning = "Felt easy; both load and volume increase appropriate"
  
  ELSE IF prior_feedback == "too_hard":
    // Struggled
    loadAdjustment = 0.95
    volumeAdjustment = 1.0  // same volume
    suggestedProgression = "recovery"
    reasoning = "Struggled last session; reduce load but maintain volume for form practice"
  
  ELSE:
    // Standard
    volumeAdjustment = 1.05  // +5% volume
    repsStrategy = "plus_one"  // 1 more rep per set if possible
    loadAdjustment = 1.0
    suggestedProgression = "volume"
    reasoning = "Standard performance; gradual volume increase for hypertrophy"
  
  shouldRepeatMovement = true  // Different exercise, same family
  movementFamilyRepeatStrategy = "allow_different_angle"
  
ELSE:
  // First session in family this week
  shouldRepeatMovement = false
  volumeAdjustment = 1.0
  suggestedProgression = "technique"
```

### Within-Week: CONDITIONING Training

```
// Conditioning within-week: different stimulus or intensity

prior_metcon = prior_session.conditioning_movements
prior_structure = prior_session.structure  // AMRAP? EMOM? Intervals?

IF prior_metcon != null:
  prior_feedback = prior_metcon.feedback
  prior_rpe = prior_session.overalRPE
  
  // Conditioning rarely repeats same workout in one week
  // Decide on PROGRESSION TYPE instead
  
  IF prior_feedback == "great_quality":
    // Good execution; can repeat same structure but increase demands
    densityAdjustment = 1.10  // 10% more work in same time
    suggestedProgression = "density"
    reasoning = "Well-executed last session; increase density or volume"
  
  ELSE IF prior_feedback == "too_easy":
    // Felt too easy
    densityAdjustment = 1.15  // More work or more intensity
    suggestedProgression = "density"
    reasoning = "Felt easy; increase density or reduce rest periods"
  
  ELSE IF prior_feedback == "too_hard":
    // Struggled
    densityAdjustment = 0.95  // Reduce demands
    suggestedProgression = "recovery"
    reasoning = "Struggled last session; reduce intensity, vary movements"
  
  ELSE:
    // Standard
    densityAdjustment = 1.05
    suggestedProgression = "density"
    reasoning = "Standard performance; small increase in work capacity"
  
  shouldRepeatMovement = false  // Different movements from last session
  movementFamilyRepeatStrategy = "avoid"
  expectedOutcome = "Vary conditioning stimulus while building capacity"

ELSE:
  // First conditioning session
  densityAdjustment = 1.0
  suggestedProgression = "technique"
```

### Within-Week: GENERAL/MIXED Training

```
// Mixed training: balanced approach

prior_sessions_this_week = count of sessions before current in this week

IF prior_sessions_this_week == 0:
  // First session
  shouldRepeatMovement = false
  suggestedProgression = "technique"
  loadAdjustment = 1.0
  reasoning = "First session of week; establish baseline"

ELSE:
  // Subsequent sessions: light progression if different focus
  prior_session = priorSessions.last_in_block()
  
  IF prior_session.category != currentSession.category:
    // Different focus (strength vs conditioning)
    suggestedProgression = "technique"
    loadAdjustment = 1.0
    shouldRepeatMovement = false
    reasoning = "Different session focus; reset to baseline quality"
  
  ELSE:
    // Same focus
    IF prior_session.overallRPE >= 8:
      suggestedProgression = "recovery"
      loadAdjustment = 0.95
    ELSE:
      suggestedProgression = "load"
      loadAdjustment = 1.02
    
    shouldRepeatMovement = true
```

---

## BETWEEN-WEEK PROGRESSION LOGIC (MONTHLY ONLY)

**Purpose**: How to progress from one WEEK to the next WEEK in a monthly block

**Input**:
- Last week's sessions (all of them)
- Current week's phase (from SessionPlan)
- Next week's phase
- Training style

**Algorithm**:

```
last_week_sessions = priorSessions
  .filter(s => s.date in last_week AND s.isInSameBlock)
  .sort_by_date()

IF last_week_sessions.empty():
  // First week of block
  return {
    loadAdjustment: 1.0,
    volumeAdjustment: 1.0,
    reasoning: "First week of block; establish baseline"
  }

// Analyze last week quality
last_week_avg_rpe = average(last_week_sessions.overallRPE)
last_week_feedback = summarize_feedback(last_week_sessions)
last_week_completions = count successful completions / total sessions

current_phase = blockContext.sessionPlan.thisWeekPhase
next_phase = blockContext.sessionPlan.nextWeekPhase

// Apply phase-based progression
CALL phase_progression_logic(current_phase, next_phase, trainingStyle)
```

### Between-Week Progression by Phase

```
// Standard microcycle: Base → Build → Peak → Deload

IF current_phase == "base":
  // Week 1: Establish baseline
  loadAdjustment = 1.0
  volumeAdjustment = 1.0
  repsStrategy = "same"
  reasoning = "First week; establish patterns and recover"
  
  IF trainingStyle == "strength":
    expectedOutcome = "Establish 5RM baseline across main lifts"
  ELSE IF trainingStyle == "hypertrophy":
    expectedOutcome = "Establish movement patterns and form quality"

ELSE IF current_phase == "build":
  // Week 2: Increase volume or load
  
  IF trainingStyle == "strength":
    loadAdjustment = 1.05  // +5% load
    volumeAdjustment = 1.0  // same volume (load progression over volume)
    reasoning = "Build phase: primary progression lever is load"
    expectedOutcome = "5x5 @ 5lb increase per week"
  
  ELSE IF trainingStyle == "hypertrophy":
    loadAdjustment = 1.0  // same load
    volumeAdjustment = 1.10  // +10% volume (volume progression over load)
    setsStrategy = "plus_one"  // Add 1 set OR 1-2 reps
    reasoning = "Build phase: primary progression lever is volume"
    expectedOutcome = "+1-2 reps per set OR +1 set"
  
  ELSE IF trainingStyle == "conditioning":
    densityAdjustment = 1.10  // More work in same time
    reasoning = "Build phase: increase capacity"
    expectedOutcome = "More rounds or reps in same time cap"

ELSE IF current_phase == "peak":
  // Week 3: Higher intensity, possibly lower volume
  
  IF trainingStyle == "strength":
    loadAdjustment = 1.05  // Another +5% load
    volumeAdjustment = 0.90  // Reduce volume slightly (-10% reps)
    setsStrategy = "same"
    repsStrategy = "reduce"  // Fewer reps per set (3-5 instead of 5-8)
    reasoning = "Peak phase: intensity focus, reduce volume to maintain quality"
    expectedOutcome = "Attempt heavier singles or doubles"
  
  ELSE IF trainingStyle == "hypertrophy":
    loadAdjustment = 1.05  // Slight load increase
    volumeAdjustment = 1.0  // Same total volume
    reasoning = "Peak phase: shift to higher load, same volume"
    expectedOutcome = "Same total reps but heavier weight"
  
  ELSE IF trainingStyle == "conditioning":
    densityAdjustment = 1.05  // Slight increase
    suggestedProgression = "intensity"  // More important than volume
    reasoning = "Peak phase: intensity focus"

ELSE IF current_phase == "deload":
  // Week 4: Recovery
  
  loadAdjustment = 0.65  // -35% load
  volumeAdjustment = 0.60  // -40% volume
  reasoning = "Deload week: significant reduction for CNS recovery"
  expectedOutcome = "Reduced stress, active recovery"
  
  IF any_session_marked_pain_in_last_week:
    add_warning("Pain noted last week; use deload to assess")

// Exceptional progression: if last week quality was poor
IF last_week_avg_rpe >= 9.5 AND completions < 0.8:
  // Overdid it
  loadAdjustment *= 0.95  // Reduce planned increase
  reasoning += "; last week completed at very high effort, slight reduction"
  add_warning("Last week intensity very high; recovery prioritized")

IF last_week_feedback includes "great_quality" on 80%+ of sessions:
  // All sessions went well; can increase harder
  loadAdjustment *= 1.05  // More aggressive increase
  reasoning += "; excellent execution last week, increased progression"
```

---

## SPECIAL RULES BY TRAINING STYLE

### STRENGTH TRAINING

**Main Lift Progression**:
```
// Main lifts progress linearly within and across weeks

// Within week (Mon vs Thu squat):
IF prior_main_lift_rpe <= 8 AND NOT marked_too_hard:
  loadAdjustment = 1.02-1.05  // 2-5% increase
  repsStrategy = "same"

// Across weeks (Mon W1 vs Mon W2):
IF phase == "base":
  week_over_week_adjustment = 0.0  // Establish baseline
ELSE IF phase == "build":
  week_over_week_adjustment = +5%  // Standard progression
ELSE IF phase == "peak":
  week_over_week_adjustment = +5%  // Final push
ELSE IF phase == "deload":
  week_over_week_adjustment = -35%  // Recovery
```

**Accessory Progression**:
```
// Accessory can rotate more; progression on different movement each week
// But if repeating same accessory:

IF repeating_same_accessory_next_week:
  loadAdjustment = 1.03  // Conservative
  repsStrategy = "plus_one"  // 1 more rep
ELSE:
  // Rotating to different accessory
  movementFamilyRepeatStrategy = "allow_different_angle"
  reasoning = "Rotating accessory variation for balanced development"
```

---

### HYPERTROPHY TRAINING

**Volume Accumulation**:
```
// Primary driver is total volume (sets × reps × load)

within_week_volume_adjustment = 1.05-1.10  // Accumulate volume
between_week_volume_adjustment = 1.10  // Build phase, 1.0 peak, 0.6 deload

// Emphasis on variation
movementFamilyRepeatStrategy = "allow_different_angle"
reasoning = "Same pattern each week but different angle/implement"
```

**Rep Range Progression**:
```
// Start of block: higher reps (10-12)
// End of build: moderate-high reps (8-10) with more load
// Peak: lower reps (6-8) with heavy load
// Deload: higher reps (12-15) with light load
```

---

### CONDITIONING TRAINING

**Density Progression**:
```
// Primary driver is more work in same time, not load

within_week_density_adjustment = 1.05-1.15
between_week_density_adjustment = 1.10 build, 1.05 peak, 0.70 deload

// Movement variety essential
movementFamilyRepeatStrategy = "avoid"
reasoning = "Different movements each session for varied stimulus"
```

**Never Repeat MetCon**:
```
IF last_session.structure == "AMRAP" AND last_session.movements == current_session.movements:
  add_warning("Same MetCon twice in close proximity; recommend variation")
```

---

## DECISION TREE: Repeat vs. Rotate Movement

```
IF trainingStyle == "strength":
  // Main lifts: ALWAYS repeat with progression
  shouldRepeatMovement = true (for main lifts)
  
  // Accessory: Can rotate but not required
  IF is_accessory AND repeating_same_accessory:
    shouldRepeatMovement = true
    loadAdjustment = slight_increase
  ELSE IF is_accessory:
    shouldRepeatMovement = false
    movementFamilyRepeatStrategy = "allow_different_angle"

ELSE IF trainingStyle == "hypertrophy":
  // Repeat family, rotate variation
  IF is_main_pattern AND repeating_same_pattern:
    shouldRepeatMovement = false  // But same family
    movementFamilyRepeatStrategy = "allow_different_angle"
    reasoning = "Different variation same pattern for stimulus variety"

ELSE IF trainingStyle == "conditioning":
  // Rarely repeat exact movement
  shouldRepeatMovement = false
  movementFamilyRepeatStrategy = "avoid"
  reasoning = "Different stimulus each session"

ELSE:  // Mixed
  // Moderate repetition
  IF last_session_same_template:
    shouldRepeatMovement = true
    loadAdjustment = slight_increase
  ELSE:
    shouldRepeatMovement = false
```

---

## RISK DETECTION & WARNINGS

```
// Fatigue Risk
IF between_week_sessions.count() >= 5 AND last_week_avg_rpe >= 8.5:
  add_warning("High frequency + high intensity last week; monitor recovery")
  loadAdjustment *= 0.95  // Reduce increase

// Form Quality Risk
IF last_week_sessions.any(marked_poor_tolerance):
  add_warning("Form quality concerns noted; prioritize technique week")
  loadAdjustment *= 0.90
  suggestedProgression = "technique"

// Volume Overload Risk
IF volumeAdjustment > 1.20:
  add_warning("Large volume increase (>20%); ensure adequate nutrition/recovery")

// Load Jump Risk
IF loadAdjustment > 1.10:
  add_warning("Large load jump (>10%); verify client readiness")

// Deload Skipping Risk
IF current_phase == "peak" AND weekNumber == 4:
  IF next_phase != "deload":
    add_warning("Consider deload week after peak; CNS fatigue risk")
```

---

## EXAMPLES

### Example 1: WEEKLY Within-Session (Strength Focus)

**Input**:
- timeHorizon: "weekly"
- trainingStyle: "strength"
- Prior session: Mon, 5x5 @ 225 lbs Back Squat, marked "great_quality"
- Current session: Thu (2 days later), same Strength Main template

**Algorithm**:
```
prior_feedback = "great_quality"
days_since_prior = 2 days

IF trainingStyle == "strength" AND days_since_prior >= 2:
  loadAdjustment = 1.03  // +3% conservative bump
  suggestedProgression = "load"
  shouldRepeatMovement = true
  repsStrategy = "same"
```

**Output**:
```
{
  shouldRepeatMovement: true,
  repeatedMovement: "Back Squat",
  suggestedProgression: "load",
  loadAdjustment: 1.03,
  volumeAdjustment: 1.0,
  reasoning: "Prior session marked 'great_quality'; slight load increase appropriate"
}
```

**Implication for SKILL 3**: Back Squat 5x5 @ 232 lbs (225 × 1.03)

---

### Example 2: MONTHLY Between-Week (Hypertrophy Focus, W1→W2)

**Input**:
- timeHorizon: "monthly"
- trainingStyle: "hypertrophy"
- Current phase: "base" (Week 1)
- Next phase: "build" (Week 2)
- Last week avg RPE: 7.5 (moderate)
- Last week feedback: Mix of "good_tolerance" and "great_quality"

**Algorithm**:
```
current_phase = "base"
next_phase = "build"

IF current_phase == "base" AND next_phase == "build":
  IF trainingStyle == "hypertrophy":
    loadAdjustment = 1.0  // same load
    volumeAdjustment = 1.10  // +10% volume
    setsStrategy = "plus_one"  // add 1 set
    repsStrategy = "same"
    reasoning = "Build phase: primary progression lever is volume accumulation"
```

**Output**:
```
{
  suggestedProgression: "volume",
  loadAdjustment: 1.0,
  volumeAdjustment: 1.10,
  setsStrategy: "plus_one",
  repsStrategy: "same",
  reasoning: "Build phase: increase volume accumulation from Week 1 baseline"
}
```

**Implication for SKILL 3**: 
- If W1 was "4x8 @ 185 lbs", W2 becomes "5x8 @ 185 lbs" (add 1 set)
- Or "4x9 @ 185 lbs" (add 1 rep per set)

---

### Example 3: MONTHLY Between-Week (Strength Focus, W2→W3)

**Input**:
- timeHorizon: "monthly"
- trainingStyle: "strength"
- Current phase: "build" (Week 2)
- Next phase: "peak" (Week 3)
- W2 main lift: 5x5 @ 230 lbs Back Squat
- W2 avg RPE: 8.0 (moderate-high)
- W2 feedback: Mix of "great_quality" and one session marked "too_hard"

**Algorithm**:
```
current_phase = "build"
next_phase = "peak"

IF trainingStyle == "strength" AND next_phase == "peak":
  loadAdjustment = 1.05  // +5% intensity push
  volumeAdjustment = 0.90  // -10% volume (fewer reps)
  repsStrategy = "reduce"  // 3-5 instead of 5
  reasoning = "Peak phase: intensity focus"
  
// But one session marked "too_hard", so warn
IF any_session_marked_too_hard:
  add_warning("One session marked 'too_hard' in build phase; monitor recovery")
  loadAdjustment *= 0.98  // More conservative: 1.05 * 0.98 = 1.029
```

**Output**:
```
{
  suggestedProgression: "load",
  loadAdjustment: 1.029,  // ~2.9% instead of 5%
  volumeAdjustment: 0.90,
  repsStrategy: "reduce",
  reasoning: "Peak phase intensity progression; conservative due to fatigue note",
  warnings: [
    {
      type: "fatigue",
      message: "One session marked 'too_hard' in build phase; monitor recovery",
      severity: "medium"
    }
  ]
}
```

**Implication for SKILL 3**: 
- If W2 was "5x5 @ 230 lbs", W3 becomes "5x3 @ 237 lbs" (230 × 1.029 ≈ 237)
- Fewer reps, more load = intensity focus

---

## SUMMARY

**SKILL 7 makes decisions about**:
- ✅ Should the client repeat the same movement or rotate?
- ✅ How much should load increase/decrease?
- ✅ Should volume increase, decrease, or stay same?
- ✅ Should reps/sets adjust?
- ✅ Is progression appropriate based on prior session quality?
- ✅ Are there fatigue/form/recovery concerns?

**SKILL 7 does NOT decide**:
- ❌ Which specific movement to select (SKILL 3 does that)
- ❌ Whether the progression is actually safe (SKILL 4 validates)
- ❌ Cross-week balance and sequencing (SKILL 5 does that)

**Key Principle**: 
SKILL 7 provides **guidance** (loadAdjustment, volumeAdjustment, repsStrategy) that SKILL 3 uses when selecting and configuring movements. It's an **input** to movement generation, not the final decision.

