# SKILL 7: Progression Reasoner

**Type**: Guidance Skill (Runs per-session)  
**Purpose**: Determine how to progress from prior sessions in WEEKLY and MONTHLY flows  
**Input**: Recent workout history, training style, phase context, client feedback  
**Output**: Progression guidance for movement selection, load, reps, volume, density, tempo, and effort targets  
**Called By**: WEEKLY and MONTHLY flows (NOT SINGLE)  
**Reads**: SKILL 0 (Knowledge Base) + outputs from SKILL 1 (Context), SKILL 2 (Session Plan)  
**Feeds Into**: SKILL 3 (Movement Generator), SKILL 4 (Quality Validator)

---

## INPUT CONTRACT

```json
{
  "progressionContext": {
    "timeHorizon": "weekly" | "monthly",
    "trainingStyle": "strength" | "hypertrophy" | "power" | "conditioning" | "endurance" | "skill" | "prehab" | "mobility" | "mixed",
    "currentPhase": "base" | "build" | "peak" | "deload",
    "weekNumber": number,
    "sessionDayOfWeek": number,
    "periodizationMode": "linear" | "block" | "weekly_undulating" | "daily_undulating" | "conjugate" | "autoregulated"
  },
  
  "currentSession": {
    "date": "YYYY-MM-DD",
    "category": string,
    "templateId": string,
    "templateName": string,
    "focusArea": string,
    "isSameDayPosition": boolean
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
          "actualRIR": number,
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
    "frequency": number
  },
  
  "blockContext": {
    "blockStartDate": "YYYY-MM-DD",
    "weekStartDate": "YYYY-MM-DD",
    "totalBlockWeeks": number,
    "sessionPlan": {
      "thisWeekPhase": "base" | "build" | "peak" | "deload",
      "nextWeekPhase": "base" | "build" | "peak" | "deload",
      "deloadReason": "structural" | "performance" | "contextual" | null,
      "calendarEvents": string[]
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
    
    "suggestedProgression": "load" | "volume" | "density" | "tempo" | "technique" | "recovery" | "complexity" | "frequency" | "range_of_motion" | "effort",
    
    "loadAdjustment": number,
    "volumeAdjustment": number,
    "densityAdjustment": number,
    "tempoAdjustment": string | null,
    "targetRPE": number | null,
    "targetRIR": number | null,
    "targetVelocity": number | null,
    "repRangeTarget": { "min": number, "max": number } | null,
    "setTarget": number | null,
    "frequencyAdjustment": number,
    "romAdjustment": string | null,
    
    "repsStrategy": "same" | "plus_one" | "reduce" | "increase_range" | "lower_range",
    "setsStrategy": "same" | "plus_one" | "reduce",
    
    "movementFamilyRepeatStrategy": "avoid" | "allow_different_angle" | "allow_same" | "encourage",
    
    "recommendDeload": boolean,
    "deloadProtocol": "full" | "intensity" | "volume" | "active_recovery" | "movement_variety" | null,
    
    "reasoning": string,
    "expectedOutcome": string,
    "riskFlags": string[]
  },
  
  "detailedGuidance": {
    "mainLiftStrategy": string,
    "accessoryStrategy": string,
    "conditioningStrategy": string,
    "recoveryConsiderations": string,
    "styleSpecificNotes": string
  },
  
  "warnings": [
    {
      "type": "fatigue" | "progression" | "form_quality" | "volume_overload" | "deload_needed" | "calendar" | "movement_quality",
      "message": string,
      "severity": "high" | "medium" | "low"
    }
  ]
}
```

---

## CORE LOGIC

### ENTRY POINT: Determine Progression Level

```text
IF timeHorizon == "weekly":
  use within-week progression logic
ELSE IF timeHorizon == "monthly":
  use both within-week and between-week logic
```

**General principle**
- Weekly flow: progress from session to session.
- Monthly flow: progress across sessions *and* across weeks.
- The periodization mode and training style determine what kind of progression matters most.

---

## WITHIN-WEEK PROGRESSION LOGIC

### Purpose
How to progress from one session to the next session in the same week.

### General logic
1. Find the prior session in the same block.
2. Evaluate performance, fatigue, and feedback.
3. Apply style-specific progression rules.
4. Respect movement-specific signals and calendar context.

---

### Within-Week: STRENGTH Training

- If the previous session went well, small load increases are appropriate.
- If the movement felt too hard, reduce load or hold steady.
- If quality dropped, prioritize technique over loading.
- Main lift repetition is expected when the same lift is intentionally programmed.

Typical outputs:
- `suggestedProgression`: `load`, `technique`, or `recovery`
- `loadAdjustment`: small increments only
- `targetRPE`: usually moderate to hard, not maximal
- `targetRIR`: useful when autoregulating

---

### Within-Week: HYPERTROPHY Training

- Progress volume first.
- Then increase load once the rep ceiling is hit.
- Use variation within the same family when appropriate.
- Keep local fatigue in mind.

Typical outputs:
- `suggestedProgression`: `volume`, `load`, or `recovery`
- `volumeAdjustment`: small positive increases when tolerated
- `repRangeTarget`: can shift upward before load changes
- `setsStrategy`: may add sets when volume accumulation is the goal

---

### Within-Week: POWER / SPEED-STRENGTH

- Progress only if speed and quality stay high.
- Quality drop is a stop signal.
- Prefer small changes, not fatigue chasing.
- If speed falls, reduce load, reduce volume, or stop adding work.

Typical outputs:
- `suggestedProgression`: `tempo` is rarely the right lever here; usually `load`, `technique`, or `recovery`
- `targetVelocity`: should be present when velocity targets are used
- `targetRPE`: should usually stay lower than strength work
- `riskFlags`: should flag speed decay or CNS fatigue

---

### Within-Week: CONDITIONING Training

- Progress density, work output, or work-to-rest shape.
- Rotate movement combinations to manage fatigue.
- Avoid repeating the same exact high-intensity format too often.

Typical outputs:
- `suggestedProgression`: `density`, `effort`, or `recovery`
- `densityAdjustment`: positive when work capacity is improving
- `targetRPE`: useful for capping overshoot

---

### Within-Week: ENDURANCE Training

- Progress duration first.
- Then distance.
- Then pace.
- Keep weekly increases conservative.
- Respect zone-specific recovery demands.

Typical outputs:
- `suggestedProgression`: `volume`, `effort`, or `recovery`
- `frequencyAdjustment`: may increase easy aerobic frequency if appropriate
- `romAdjustment`: not relevant here

---

### Within-Week: SKILL WORK

- Progress complexity only after stable execution.
- Keep effort low enough that quality is preserved.
- If the pattern is unstable, repeat the simpler version.

Typical outputs:
- `suggestedProgression`: `complexity`, `technique`, or `recovery`
- `targetRPE`: low to moderate
- `riskFlags`: should flag technical breakdown

---

### Within-Week: PREHAB / MOBILITY

- Progress range, control, and tolerance.
- Avoid turning corrective work into a conditioning session.
- Increase load only when the goal is intentional graded exposure.

Typical outputs:
- `suggestedProgression`: `range_of_motion`, `technique`, or `recovery`
- `romAdjustment`: often relevant
- `targetRPE`: low

---

## BETWEEN-WEEK PROGRESSION LOGIC (MONTHLY ONLY)

### Purpose
How to progress from one week to the next inside a monthly block.

### General logic
1. Inspect last week’s completion and quality.
2. Identify the current phase and next phase.
3. Apply phase-based progression.
4. Adjust for performance, calendar events, and deload triggers.

---

### Phase Logic

**Base**
- Establish baseline movement quality.
- Do not force aggressive progression.

**Build**
- Add work or load.
- For strength: load usually leads.
- For hypertrophy: volume usually leads.
- For conditioning: density usually leads.

**Peak**
- Increase intensity or specificity.
- Reduce unnecessary volume if needed.
- Quality matters more than adding more work.

**Deload**
- Reduce stress intentionally.
- The deload reason should determine the protocol.

---

### Deload Reasoning

**Structural**
- Planned deload after accumulation.

**Performance**
- Triggered by repeated high effort, poor tolerance, or regression.

**Contextual**
- Triggered by holidays, travel, illness, life stress, or schedule disruption.

### Deload protocol selection

- `full`: reduce both volume and intensity meaningfully
- `intensity`: keep structure, lower intensity more aggressively
- `volume`: keep intensity more stable, reduce work amount
- `active_recovery`: very low stress movement only
- `movement_variety`: keep structure but use easier variations

---

## SPECIAL RULES BY TRAINING STYLE

### STRENGTH TRAINING
- Main lifts can repeat week-to-week.
- Use linear, wave, DUP, block, or autoregulated progression depending on the block.
- Progress is usually load-led.
- RPE/RIR are valid control tools.

### HYPERTROPHY TRAINING
- Double progression is usually the best default.
- Load, reps, and sets can all be manipulated.
- Variation within family is usually valuable.

### POWER / SPEED-STRENGTH
- Progress via velocity, quality, or wave structure.
- Do not let fatigue become the main stimulus.
- If bar speed is falling, progression should slow down or stop.

### CONDITIONING
- Progress via density, work completed, or work-to-rest changes.
- Use structure intentionally.

### ENDURANCE
- Progress via duration, distance, or pace.
- Use conservative weekly increases.

### SKILL WORK
- Progress via complexity and precision.
- Do not overload the movement just to force progression.

### PREHAB / MOBILITY
- Progress via tolerance, control, ROM, and integration.
- Loaded progression should be intentional, not automatic.

### MIXED
- Use the most appropriate lever for the current priority.
- Avoid overloading one quality while ignoring the rest.

---

## DECISION TREE: WHAT TO REPEAT

```text
IF trainingStyle == "strength":
  repeat main lift when intentional and spacing supports it

IF trainingStyle == "hypertrophy":
  repeat family, rotate variation

IF trainingStyle == "power":
  repeat high-quality movement only while speed stays high

IF trainingStyle == "conditioning":
  usually rotate movement selection and structure

IF trainingStyle == "endurance":
  repeat modality if the zone and duration logic remain correct

IF trainingStyle == "skill":
  repeat the movement until quality improves, then raise complexity

IF trainingStyle == "prehab" or "mobility":
  repeat controlled work and progress tolerance gradually
```

---

## RISK DETECTION & WARNINGS

Flag warnings when:
- repeated `too_hard` or poor tolerance shows up
- RPE is unexpectedly high on multiple sessions
- load jumps too fast
- volume spikes too aggressively
- a deload should probably happen soon
- the calendar suggests travel, holiday, or disruption
- a movement’s quality is deteriorating
- power output or bar speed is dropping

---

## SUMMARY

**SKILL 7 makes decisions about**:
- whether to repeat or rotate movements
- how to progress load, reps, volume, density, tempo, or complexity
- whether to target RPE, RIR, or velocity
- whether to recommend a deload and what kind
- how to interpret prior session quality in the context of the current phase

**SKILL 7 does NOT decide**:
- which exact movement wins inside a section (SKILL 3 does that)
- whether the workout is safe enough to release (SKILL 4 does that)
- whether the week/month sequences correctly as a whole (SKILL 5 does that)
