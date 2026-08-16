# About the Skill System

This repository uses a **skill-based workout generation system** instead of a single deterministic rules engine.

The goal of the system is to let the app reason about workout creation in smaller, clearer pieces:
- understand the client and program context
- plan the block or session sequence
- reason about progression
- generate the exact workout
- validate safety and coherence
- learn from feedback after the workout is completed

## Core idea

The skill system splits workout generation into specialized responsibilities so each part can stay focused and easier to update.

### Skill 0: Workout Knowledge Base
The source of truth for all training rules, movement families, periodization ideas, progression models, deload logic, and style definitions.

### Skill 1: Context Analyzer
Figures out the training context:
- time horizon
- training style
- client goals
- block type and phase

### Skill 2: Session Planner
Figures out how the sessions should be arranged across the week or month.

### Skill 7: Progression Reasoner
Figures out how the next session should progress based on:
- prior sessions
- feedback
- current phase
- training style
- fatigue and deload timing

### Skill 3: Movement Generator
Chooses the exact movements and configures:
- sets
- reps
- load
- tempo
- effort targets

### Skill 4: Quality Validator
Checks the generated workout for:
- safety
- pain history
- avoid lists
- load sanity
- fatigue risk

### Skill 5: Session Sequencer
Checks whether the week or month still makes sense as a whole:
- fatigue spread
- movement balance
- phase progression
- overall coherence

### Skill 6: Feedback Interpreter
Turns coach notes and post-workout feedback into structured signals that the next generation cycle can use.

## Updated flow

```text
USER STARTS WORKOUT CREATION
        |
        v
+---------------------------+
| SKILL 1: Context Analyzer |
| - time horizon            |
| - training style          |
| - block type / phase      |
+---------------------------+
        |
        v
+---------------------------+
| SKILL 2: Session Planner  |
| - session order           |
| - phase plan              |
| - conflicts / spacing     |
| - deload timing           |
+---------------------------+
        |
        v
+------------------------------------+
| SKILL 7: Progression Reasoner      |
| - repeat or rotate movement        |
| - load / volume / density          |
| - target RPE / RIR / velocity      |
| - deload recommendation           |
| - style-specific progression       |
+------------------------------------+
        |
        v
+------------------------------------+
| SKILL 3: Movement Generator        |
| - choose exact movements           |
| - apply progression guidance       |
| - assign sets / reps / load        |
| - assign tempo / effort targets    |
| - respect family + horizon rules   |
+------------------------------------+
        |
        v
+------------------------------------+
| SKILL 4: Quality Validator         |
| - safety checks                    |
| - pain / avoid checks              |
| - load sanity                      |
| - form / fatigue risk              |
+------------------------------------+
        |
        v
+------------------------------------+
| SKILL 5: Session Sequencer         |
| - verify week/month flow           |
| - fatigue spread                   |
| - movement balance across block    |
| - progression arc consistency      |
+------------------------------------+
        |
        v
SAVE WORKOUT
        |
        v
USER COMPLETES WORKOUT
        |
        v
+------------------------------------+
| SKILL 6: Feedback Interpreter      |
| - coach notes                       |
| - pain / too hard / too easy        |
| - great quality / poor tolerance    |
| - update feedback history          |
+------------------------------------+
        |
        v
NEXT CYCLE REUSES FEEDBACK
```

## Why the progression step exists

The progression step exists because **movement selection** and **progression logic** are not the same problem.

- **Skill 7** decides what kind of progression should happen.
- **Skill 3** decides which exact movement should be used.

That separation makes the system easier to change, easier to test, and easier to expand later.

For example:
- strength may want load-led progression
- hypertrophy may want double progression
- power may want velocity-led progression
- endurance may want duration-led progression
- skill work may want complexity-led progression
- prehab and mobility may want tolerance or range-of-motion progression

If all of that lived inside one skill, it would be harder to maintain.

## How this file should be maintained

This document should stay aligned with the current skill architecture.

When the skill system changes, update this file to reflect:
- new skills
- renamed skills
- changed responsibilities
- new movement families
- new progression or deload logic
- updated flow order

## Internal sandbox for manual QA

The app now includes an internal sandbox for testing the skill chain before production integration:

- **Page:** `/admin/skill-sandbox`
- **API contract:** `/api/admin/skills/sandbox`
- **Purpose:** enter structured workout-generation inputs, inspect each skill output, review QA flags, and compare the final generated workout against the intermediate reasoning

The sandbox is intentionally modular and mock-friendly so it can render end-to-end without the full production backend. As the real skill system evolves, the sandbox contract and UI should keep matching the current responsibilities and flow described in this file.

## Current source of truth

At the moment, the following files define the active system:
- `skills/skill-0-knowledge-base.md`
- `skills/skill-3-movement-generator.md`
- `skills/skill-7-progression-reasoner.md`

If those files change, this document should be updated to match.
