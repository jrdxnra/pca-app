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
    "trainingStyle": "strength" | "hypertrophy" | "power" | "conditioning" | "endurance" | "skill" | "prehab" | "mobility" | "mixed",
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
        "workoutTypeName": "Warmup" | "Strength" | "Accessory" | "Conditioning" | "Skill" | "Prehab" | "Mobility" | etc,
        "focusArea": string,
        "defaultStructure": "straight-sets" | "supersets" | "circuits" | "amrap" | "emom" | "intervals",
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
                "signal": "pain" | "too_easy" | "too_hard" | "great_quality" | "good_tolerance" | "poor_tolerance",
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
        "signals": ["pain", "too_easy", "too_hard", "great_quality", "good_tolerance", "poor_tolerance"],
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
      "structure": "straight-sets" | "supersets" | "circuits" | "amrap" | "emom" | "intervals",
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
          "targetRIR": number,
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
      "conditioning": number,
      "locomotive": number,
      "carry": number,
      "mobility": number,
      "prehab": number,
      "skill": number,
      "power": number,
      "endurance": number
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

```text
IF timeHorizon == "single":
  constraint_set = SINGLE_CONSTRAINTS
  selection_mode = "greedy"
ELSE IF timeHorizon == "weekly":
  constraint_set = WEEKLY_CONSTRAINTS
  selection_mode = "coordinated"
ELSE IF timeHorizon == "monthly":
  constraint_set = MONTHLY_CONSTRAINTS
  selection_mode = "progressive"
```

**SINGLE_CONSTRAINTS**
- No cross-session coordination
- Movement can repeat if appropriate
- Density target: Standard for session type

**WEEKLY_CONSTRAINTS**
- Same movement family: avoid if used in last 2-3 days
- Same movement: avoid if used within 2 days
- Pattern balance: vary across week
- Fatigue: don't stack high-stress movements

**MONTHLY_CONSTRAINTS**
- Main lift: can repeat week-to-week, but progress load/volume/quality
- Accessory: can rotate per week
- Movement family: space minimum 2 days within week
- Cross-week: allow same movement same day position each week when intentional
- Phase-sensitive: base, build, peak, and deload modify the target outcome

---

### STEP 2: Build Movement Candidate Pool

For each template section:

1. Extract section intent from section name, focusArea, workoutTypeName.
2. Filter movement library by:
   - client experience level ≥ movement difficulty
   - equipment available
   - movements not in avoid list
   - no blocked movements from pain / poor_tolerance
   - match to section intent
3. Score candidates by:
   - recency in history
   - success feedback
   - progression potential
   - fit to section
   - fit to training style and horizon
4. Rank top 5 candidates.

---

### STEP 3: Apply Time Horizon Selection Logic

#### SINGLE HORIZON SELECTION

**Goal**: Pick the best movements for this isolated session.

- Greedy selection is allowed.
- Use recent history if helpful.
- Favor the best fit for the current session.
- If the movement was used recently and still makes sense, repeating it is fine.

#### WEEKLY HORIZON SELECTION

**Goal**: Coordinate across the week without redundant stress.

- Avoid repeating the same movement too soon.
- Avoid overlapping high-stress patterns unnecessarily.
- Favor variation when the week already contains the same family.
- Use SKILL 7 guidance to decide whether to repeat a movement or rotate to a variation.

#### MONTHLY HORIZON SELECTION

**Goal**: Build the month intentionally.

- Main lifts can repeat in the same slot each week.
- Apply phase logic from SKILL 7.
- Respect block progression.
- Rotate accessories when useful.
- Keep the program coherent over the whole month.

---

### STEP 4: Validate Movement Balance

Check:
- pattern balance across the workout
- whether the weekly or monthly plan is missing important families
- whether the session duration is realistic
- whether structure matches the training style

**Additional style-specific checks**
- Power / speed: quality first, stop on speed drop
- Endurance: zone and duration must match the goal
- Skill: keep freshness high and fatigue low
- Prehab / mobility: keep volume low enough to avoid turning it into a fatigue session
- Conditioning: make sure work-to-rest structure matches the target system

---

### STEP 5: Generate Selection Reasoning

For each movement, explain:
- why it was selected
- how it fits the horizon
- how progression was applied
- what alternatives were considered
- what risks remain

---

## SPECIAL RULES BY TRAINING STYLE

### STRENGTH-FOCUSED

- Prioritize main lifts first.
- Use 1-6 rep main work and moderate accessory ranges.
- Repeat main movements when appropriate.
- Apply small load jumps when quality supports it.
- Use RPE / RIR when autoregulating.

### HYPERTROPHY-FOCUSED

- Repeat movement families.
- Rotate variations within the family.
- Keep tension, volume, and local fatigue in mind.
- Use double progression when possible.

### POWER / SPEED-STRENGTH

- Select explosive movements.
- Keep reps low and quality high.
- Stop before speed degrades.
- Use velocity or fast bar intent as a constraint.
- Power should usually come before heavy strength when both are in the same session.

### CONDITIONING-FOCUSED

- Prioritize structure, density, and energy system match.
- Rotate movements more often.
- Avoid repeating the same exact MetCon too often.

### ENDURANCE-FOCUSED

- Match the zone target.
- Match duration and recovery requirements.
- Keep progression conservative.
- Respect zone 4-5 recovery needs.

### SKILL WORK

- Keep the athlete fresh.
- Use simple-to-complex progression.
- Practice quality over quantity.
- Avoid burying skill work under fatigue.

### PREHAB

- Select controlled, low-risk work.
- Favor stability, control, and graded exposure.
- Do not turn prehab into a fatigue block.

### MOBILITY

- Use dynamic mobility before sessions.
- Use static or longer-hold mobility after sessions or as standalone work.
- Keep the purpose clear: ROM and tissue tolerance.

### MIXED

- Blend the above according to the client’s needs.
- Avoid over-optimizing one quality at the cost of the others.

---

## NEW SKILL 0 ALIGNMENT NOTES

### Family keys expected from SKILL 0
- `squat`
- `hinge`
- `push-horizontal`
- `push-vertical`
- `pull-horizontal`
- `pull-vertical`
- `squat-unilateral`
- `hinge-unilateral`
- `hip-extension-supine`
- `carry`
- `locomotive`
- `core-rotational`
- `core-anti-rotation`
- `conditioning`
- `mobility`
- `prehab`
- `skill`
- `power`
- `endurance`

### Movement selection rules
- Do not create redundant variations that only look different.
- If the session already contains a family, a second movement from the same family must add a clear new stimulus.
- For strength, same family may be okay if the role is different and spacing supports it.
- For hypertrophy, variation inside the family is often preferred.
- For conditioning, the same family repeated without a new stimulus should usually be avoided.
- For power, quality loss is a stop signal.
- For endurance, zone and duration matter more than exercise novelty.

---

## SUMMARY

SKILL 3 makes decisions about:
- which movement to select for each section
- how much load, reps, sets, tempo, and effort to use
- how to respect spacing rules and the training horizon
- how to interpret progression guidance from SKILL 7
- how to preserve balance across the session

SKILL 3 does not decide:
- whether the workout is ultimately safe enough for release (SKILL 4)
- whether the broader sequence across the week or month is optimal (SKILL 5)
- whether a deload or major progression shift is needed (SKILL 7 informs that)
