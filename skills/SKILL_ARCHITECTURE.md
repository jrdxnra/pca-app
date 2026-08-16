# Skill-Based Workout Generation Architecture

This document maps the complete skill-based workflow for workout creation across three time horizons: Single, Weekly, and Monthly planning.

## Overview: Master + Contextual Skills

The system uses **7 skills** organized around a **Knowledge Base**:

- **SKILL 0**: Workout Knowledge Base (read-only reference for all skills)
- **SKILL 1**: Context Analyzer (determine time horizon + training style)
- **SKILL 2**: Session Planner (validate plan across block)
- **SKILL 3**: Movement Generator (select movements for a session)
- **SKILL 4**: Quality Validator (check safety + coherence)
- **SKILL 5**: Session Sequencer (optimize fatigue + progression across block)
- **SKILL 6**: Feedback Interpreter (extract structured signals from coach notes)
- **SKILL 7**: Progression Reasoner (determine next session progression)

---

## SINGLE Workout Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "FILL" ON SINGLE WORKOUT                           │
│ (Standalone session, no block context)                         │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │ SKILL 1: Context Analyzer                  │
        │ Input: Selected goals, client profile      │
        │ Reads: SKILL 0 (Knowledge Base)            │
        │ Decision: "This is SINGLE horizon"         │
        │ Output: ContextAnalysis {                  │
        │   timeHorizon: 'single'                    │
        │   trainingStyle: 'strength' | 'cond' | ... │
        │   isProgressive: false                     │
        │ }                                           │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │ SKILL 3: Movement Generator                │
        │ Input:                                     │
        │  - Session category + template             │
        │  - Context from Skill 1                    │
        │  - Recent movement history                │
        │  - Client feedback log                    │
        │  - Movement library                       │
        │ Reads: SKILL 0 (density, variety rules)   │
        │ Decision:                                 │
        │  "This is single/standalone"              │
        │  "Pick best movements for THIS session"   │
        │  "No cross-day coordination needed"       │
        │ Output: GeneratedWorkout {                │
        │   rounds: ClientWorkoutRound[]            │
        │   movementReasoning: {...}                │
        │ }                                          │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │ SKILL 4: Quality Validator                 │
        │ Input:                                     │
        │  - Generated workout                      │
        │  - Client profile                         │
        │ Reads: SKILL 0 (safety rules)             │
        │ Decision:                                 │
        │  ✓ No pain-blocked movements?             │
        │  ✓ Density matches session length?        │
        │  ✓ Movements reasonable for this session? │
        │ Output: Approved OR warnings               │
        └──────────────┬───────────────────────────────┘
                       │
                       │
        ┌──────────────▼──────────────────────────────┐
        │ SAVE WORKOUT TO FIRESTORE                  │
        │ Ready for coach review/edit                │
        └──────────────────────────────────────────────┘
```

**Key Characteristics:**
- Shortest flow (3 skills)
- No cross-session coordination
- Movement selection is greedy (best for this session only)
- Skill 5 & 7 not needed

---

## WEEKLY Planning Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "WEEK PLAN + FILL"                                 │
│ (1-4 week assignment, 4-7 sessions with coordination)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │ SKILL 1: Context Analyzer                  │
        │ Input:                                     │
        │  - Week template (if selected)             │
        │  - Selected goals                          │
        │  - Client profile + frequency              │
        │ Reads: SKILL 0 (Knowledge Base)            │
        │ Decision:                                 │
        │  "This is WEEKLY horizon"                 │
        │  "Need movement coordination"             │
        │  "Fatigue spreading is critical"          │
        │ Output: ContextAnalysis {                  │
        │   timeHorizon: 'weekly'                    │
        │   trainingStyle: 'strength' | 'cond' | ... │
        │   expectations: {                          │
        │     fatigueCoordination: 'critical',      │
        │     movementSpacing: '2-3 days min'       │
        │   }                                        │
        │ }                                           │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────┐
        │ SKILL 2: Session Planner                   │
        │ Input:                                     │
        │  - All sessions for week (dates, cats)    │
        │  - Context from Skill 1                    │
        │  - Historical sessions (2 weeks prior)    │
        │ Reads: SKILL 0 (movement spacing rules)   │
        │ Decision:                                 │
        │  "Mon: Strength A"                        │
        │  "Tue: Condition (no leg overlap)"       │
        │  "Wed: Upper Body (different from Mon)"  │
        │  "Thu: Strength B"                        │
        │  "Fri: Conditioning"                      │
        │  → Check for conflicts                    │
        │ Output: SessionPlan {                      │
        │   [dateKey]: {                             │
        │     recommendedCategory,                  │
        │     conflictWarnings: [],                 │
        │     progressionNote                       │
        │   }                                        │
        │ }                                           │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────────┐
        │ FOR EACH SESSION IN WEEK:                          │
        │                                                    │
        │  ┌────────────────────────────────────────────┐   │
        │  │ SKILL 7: Progression Reasoner             │   │
        │  │ Input:                                    │   │
        │  │  - Last 1-2 sessions (if any in week)    │   │
        │  │  - Training style from Skill 1            │   │
        │  │  - Feedback on prior sessions             │   │
        │  │ Reads: SKILL 0 (progression rules)       │   │
        │  │ Decision:                                │   │
        │  │  "Wed strength: Progresses from Mon"    │   │
        │  │  "Fri conditioning: Fresh patterns"     │   │
        │  │ Output: ProgressionReasoning {           │   │
        │  │   shouldRepeatMovement: boolean,         │   │
        │  │   suggestedProgression: 'load'|'volume' │   │
        │  │ }                                        │   │
        │  └────────────┬───────────────────────────────┘   │
        │               │                                   │
        │  ┌────────────▼───────────────────────────────┐   │
        │  │ SKILL 3: Movement Generator              │   │
        │  │ Input:                                   │   │
        │  │  - Session category + template           │   │
        │  │  - Context from Skill 1 (WEEKLY)        │   │
        │  │  - Progression from Skill 7              │   │
        │  │  - Recent history (this week + prior)   │   │
        │  │  - Client feedback log                  │   │
        │  │  - Movement library                     │   │
        │  │ Reads: SKILL 0 (weekly rules)           │   │
        │  │ Decision:                               │   │
        │  │  "WEEKLY horizon active"                │   │
        │  │  "Avoid movements used Mon/Tue"         │   │
        │  │  "Coordinate with adjacent sessions"   │   │
        │  │  "Respect 2-3 day spacing rule"        │   │
        │  │ Output: GeneratedWorkout {              │   │
        │  │   rounds: ClientWorkoutRound[]          │   │
        │  │   movementReasoning: {...}              │   │
        │  │ }                                        │   │
        │  └────────────┬────────────────────────────────┘   │
        │               │                                   │
        │  ┌────────────▼───────────────────────────────┐   │
        │  │ SKILL 4: Quality Validator               │   │
        │  │ Input:                                   │   │
        │  │  - Generated workout                    │   │
        │  │  - Client profile                       │   │
        │  │  - SessionPlan recommendations          │   │
        │  │ Reads: SKILL 0 (safety + weekly rules)  │   │
        │  │ Decision:                               │   │
        │  │  ✓ No pain-blocked movements?           │   │
        │  │  ✓ Respects spacing from other days?   │   │
        │  │  ✓ Consistent with SessionPlan?        │   │
        │  │ Output: Approved OR warnings             │   │
        │  └────────────┬────────────────────────────────┘   │
        │               │                                   │
        │               └─── (repeat for next session)     │
        │                                                    │
        └────────────────┬─────────────────────────────────┘
                         │
        ┌────────────────▼──────────────────────────────┐
        │ SKILL 5: Session Sequencer                  │
        │ Input:                                      │
        │  - ALL generated sessions (dates+movements)│
        │  - Training style from Skill 1              │
        │ Reads: SKILL 0 (weekly fatigue rules)      │
        │ Decision:                                  │
        │  ✓ Fatigue spread well? (no Mon/Tue high) │
        │  ✓ Movement families spaced correctly?    │
        │  ✓ Back-to-back intensity managed?        │
        │  Example: "Mon/Tue both leg-heavy"        │
        │  Recommendation: "Move Tue to upper body" │
        │ Output: SequenceValidation {               │
        │   approved: boolean,                       │
        │   adjustments: [{date, suggestion}],      │
        │ }                                           │
        └────────────┬──────────────────────────────────┘
                     │
                     │ If adjustments needed:
                     │ (regenerate affected sessions)
                     │
        ┌────────────▼──────────────────────────────┐
        │ SAVE ALL WEEK SESSIONS TO FIRESTORE       │
        │ Ready for coach review/edit                │
        └──────────────────────────────────────────┘
```

**Key Characteristics:**
- Medium complexity (5-7 skills used)
- Skill 2 validates session plan
- Skill 7 runs per-session (determines progression)
- Skill 5 optimizes entire week after all sessions generated
- May loop if Skill 5 recommends adjustments

---

## MONTHLY Planning Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ USER CLICKS "MONTH PLAN + FILL"                                │
│ (4 weeks, 12-16+ sessions with progressive structure)          │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────────────────┐
        │ SKILL 1: Context Analyzer                                  │
        │ Input:                                                     │
        │  - Selected goals (macro for month)                       │
        │  - Selected split template (if any)                       │
        │  - Client profile + frequency                            │
        │ Reads: SKILL 0 (Knowledge Base)                          │
        │ Decision:                                                │
        │  "This is MONTHLY horizon"                              │
        │  "Need cross-week progression"                           │
        │  "Microcycle structure matters"                          │
        │  "Progression rules: build→peak→deload or similar"      │
        │ Output: ContextAnalysis {                                │
        │   timeHorizon: 'monthly'                                │
        │   trainingStyle: determined from goals                  │
        │   isProgressive: true                                   │
        │   expectations: {                                       │
        │     fatigueCoordination: 'critical',                   │
        │     progressionStructure: 'microcycle',                │
        │     weeklyVariation: 'essential'                       │
        │   }                                                     │
        │ }                                                        │
        └──────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────────────────┐
        │ SKILL 2: Session Planner                                   │
        │ Input:                                                     │
        │  - 4 weeks of scheduled sessions (dates, categories)     │
        │  - Context from Skill 1 (MONTHLY + progressive)          │
        │  - Historical context (prior month/phase)                │
        │ Reads: SKILL 0 (monthly progression rules, microcycles)  │
        │ Decision:                                                │
        │  "Week 1: Base phase - establish patterns"             │
        │  "Week 2: Build phase - increase volume"               │
        │  "Week 3: Peak phase - intensity/skill focus"          │
        │  "Week 4: Deload phase - recovery"                     │
        │  "Within each week, coordinate fatigue"                │
        │ Output: SessionPlan {                                    │
        │   [weekNumber]: {                                       │
        │     phase: 'base'|'build'|'peak'|'deload',            │
        │     progressionNote: string,                           │
        │     sessions: [                                        │
        │       {date, recommendedCategory, warnings}           │
        │     ]                                                  │
        │   }                                                     │
        │ }                                                        │
        └──────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────▼──────────────────────────────────────────────┐
        │ FOR EACH WEEK:                                             │
        │                                                            │
        │  ┌────────────────────────────────────────────────────┐   │
        │  │ SKILL 7: Progression Reasoner (Week-level)       │   │
        │  │ Input:                                           │   │
        │  │  - Last 5-10 sessions (prior week or month)     │   │
        │  │  - Week phase from SessionPlan (Skill 2)        │   │
        │  │  - Training style from Skill 1                  │   │
        │  │  - Feedback on prior weeks                      │   │
        │  │ Reads: SKILL 0 (progression trajectory rules)  │   │
        │  │ Decision:                                       │   │
        │  │  "Week 1→2 transition: increase volume 10-15%"│   │
        │  │  "Week 2→3 transition: shift to intensity"    │   │
        │  │  "Week 3→4 transition: reduce, recover"       │   │
        │  │ Output: WeeklyProgressionReasoning {           │   │
        │  │   loadProgression: number,                    │   │
        │  │   volumeAdjustment: number,                   │   │
        │  │   movementFamilyRepeat: strategy               │   │
        │  │ }                                              │   │
        │  └────────────┬───────────────────────────────────────┘   │
        │               │                                           │
        │               ▼                                           │
        │  ┌────────────────────────────────────────────────────┐   │
        │  │ FOR EACH SESSION IN WEEK:                        │   │
        │  │                                                  │   │
        │  │  ┌─────────────────────────────────────────┐    │   │
        │  │  │ SKILL 7: Progression Reasoner         │    │   │
        │  │  │           (Session-level)             │    │   │
        │  │  │ Input:                                │    │   │
        │  │  │  - Last 1-2 sessions (this week)     │    │   │
        │  │  │  - Weekly progression from above     │    │   │
        │  │  │  - Feedback on recent workouts       │    │   │
        │  │  │ Reads: SKILL 0 (daily progression)   │    │   │
        │  │  │ Decision:                            │    │   │
        │  │  │  "Wed strength: Progress from Mon"  │    │   │
        │  │  │  "Load increase: 5% on main lift"   │    │   │
        │  │  │  "Volume: add 1-2 sets accessory"   │    │   │
        │  │  │ Output: SessionProgressionReasoning  │    │   │
        │  │  └────────────┬─────────────────────────┘    │   │
        │  │               │                              │   │
        │  │  ┌────────────▼──────────────────────────┐    │   │
        │  │  │ SKILL 3: Movement Generator         │    │   │
        │  │  │ Input:                              │    │   │
        │  │  │  - Session category + template      │    │   │
        │  │  │  - Context from Skill 1 (MONTHLY)  │    │   │
        │  │  │  - Week progression (Skill 7)       │    │   │
        │  │  │  - Session progression (Skill 7)    │    │   │
        │  │  │  - Recent history (week + month)   │    │   │
        │  │  │  - Client feedback log              │    │   │
        │  │  │  - Movement library                 │    │   │
        │  │  │ Reads: SKILL 0 (monthly rules)     │    │   │
        │  │  │ Decision:                          │    │   │
        │  │  │  "MONTHLY horizon active"          │    │   │
        │  │  │  "Week 1 base: establish pattern"  │    │   │
        │  │  │  "Week 2 build: progress load"     │    │   │
        │  │  │  "Can repeat Mon squat Thu with +"│    │   │
        │  │  │  "Coordinate within week rules"    │    │   │
        │  │  │ Output: GeneratedWorkout           │    │   │
        │  │  └────────────┬──────────────────────────┘    │   │
        │  │               │                              │   │
        │  │  ┌────────────▼──────────────────────────┐    │   │
        │  │  │ SKILL 4: Quality Validator          │    │   │
        │  │  │ Input:                              │    │   │
        │  │  │  - Generated workout                │    │   │
        │  │  │  - Client profile                   │    │   │
        │  │  │  - SessionPlan recommendations      │    │   │
        │  │  │  - Progression guidance from Skill 7│    │   │
        │  │  │ Reads: SKILL 0 (monthly + safety)  │    │   │
        │  │  │ Decision:                          │    │   │
        │  │  │  ✓ Safety checks (pain blocks)    │    │   │
        │  │  │  ✓ Weekly spacing respected       │    │   │
        │  │  │  ✓ Progression coherent?          │    │   │
        │  │  │  ✓ Consistent with week phase?    │    │   │
        │  │  │ Output: Approved OR warnings        │    │   │
        │  │  └────────────┬──────────────────────────┘    │   │
        │  │               │                              │   │
        │  │               └─── (repeat for sessions)    │   │
        │  │                                              │   │
        │  └──────────────┬───────────────────────────────┘   │
        │                 │                                   │
        │                 └─── (repeat for weeks 2,3,4)      │
        │                                                    │
        └────────────────┬─────────────────────────────────┘
                         │
        ┌────────────────▼──────────────────────────────────┐
        │ SKILL 5: Session Sequencer                       │
        │         (Cross-week optimization)                │
        │ Input:                                           │
        │  - ALL 4 weeks of generated sessions            │
        │  - Training style from Skill 1                   │
        │  - Weekly phases from SessionPlan               │
        │ Reads: SKILL 0 (monthly fatigue + progression)  │
        │ Decision:                                       │
        │  ✓ Progression trajectory makes sense?         │
        │  ✓ Week-to-week intensity/volume flow logic?   │
        │  ✓ Movement families spaced across 4 weeks?    │
        │  ✓ Deload week appropriately lighter?          │
        │  Example:                                       │
        │    "Week 2 too much volume, dial back"         │
        │    "Movement A repeats Mon+Tue both weeks 1-2" │
        │    "Weeks 3→4 progression too steep"           │
        │ Output: SequenceValidation {                    │
        │   approved: boolean,                           │
        │   adjustments: [{week, date, suggestion}]      │
        │ }                                               │
        └────────────┬──────────────────────────────────┘
                     │
                     │ If adjustments needed:
                     │ (regenerate affected sessions)
                     │
        ┌────────────▼──────────────────────────────────┐
        │ SAVE ALL MONTH SESSIONS TO FIRESTORE          │
        │ Ready for coach review/edit                    │
        │ Monthly progression plan locked in             │
        └──────────────────────────────────────────────┘
```

**Key Characteristics:**
- Most complex flow (all 7 skills involved)
- Skill 2 creates 4-week structure + phases
- Skill 7 runs at BOTH week-level and session-level
- Skill 5 optimizes across 4 weeks (not just 1 week)
- Progressive structure is primary driver
- Multiple feedback loops possible if adjustments needed

---

## Cross-Cutting: Feedback Loop (All Flows)

```
┌──────────────────────────────────────────────┐
│ WORKOUT COMPLETED & LOGGED BY CLIENT         │
└──────────────────┬───────────────────────────┘
                   │
        ┌──────────▼────────────────────────────────────┐
        │ SKILL 6: Feedback Interpreter               │
        │ Input:                                       │
        │  - Coach session notes                      │
        │  - Pain/tolerance signals selected          │
        │  - Session RPE                              │
        │  - Time notes (overrun?)                    │
        │  - Movement-specific feedback               │
        │ Reads: SKILL 0 (signal definitions)        │
        │ Decision:                                  │
        │  "Front Squat: 'knee felt strained'"      │
        │    → Signal: pain                         │
        │    → Action: Block future use             │
        │  "Conditioning AMRAP: completed early"    │
        │    → Signal: too_easy                     │
        │    → Action: Increase load next time      │
        │  "Session ran 15min over"                 │
        │    → Signal: time_overrun                 │
        │    → Action: Reduce movement count        │
        │ Output: FeedbackSignals {                 │
        │   [movementId]: signal_type,              │
        │   overallQuality: number,                 │
        │   sessionNotes: string                    │
        │ }                                          │
        └──────────────┬───────────────────────────────┘
                       │
        ┌──────────────▼───────────────────────────────┐
        │ PERSIST to clientMovementProfiles           │
        │ .feedbackLog in Firestore                   │
        │                                             │
        │ This feeds into NEXT generation:            │
        │ SKILL 3 reads feedback when selecting       │
        │ SKILL 7 reads feedback for progression      │
        │ SKILL 4 checks pain-blocked movements       │
        └─────────────────────────────────────────────┘
```

---

## Summary Table: Which Skills Run When

| Skill | Single | Weekly | Monthly | When it Runs |
|-------|--------|--------|---------|--------------|
| **0: Knowledge Base** | ✓ | ✓ | ✓ | Always (read-only reference) |
| **1: Context Analyzer** | ✓ | ✓ | ✓ | At start of any flow |
| **2: Session Planner** | ✗ | ✓ | ✓ | Only for multi-session blocks |
| **3: Movement Generator** | ✓ | ✓ | ✓ | Per-session (with context changes) |
| **4: Quality Validator** | ✓ | ✓ | ✓ | After each generation |
| **5: Session Sequencer** | ✗ | ✓ | ✓ | After all sessions in block generated |
| **6: Feedback Interpreter** | ✓ | ✓ | ✓ | After workout completion (async) |
| **7: Progression Reasoner** | ✗ | ✓ | ✓ | Per-session in multi-session blocks |

---

## Skill Interaction Map

```
                           ┌─────────────────┐
                           │ SKILL 0         │
                           │ Knowledge Base  │
                           │ (read-only)     │
                           └────────┬────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
            │ SKILL 1      │ │ SKILL 2      │ │ SKILL 7      │
            │ Context      │ │ Session      │ │ Progression  │
            │ Analyzer     │ │ Planner      │ │ Reasoner     │
            └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
                   │                │               │
                   ▼                ▼               ▼
            ┌──────────────────────────────────────────────────┐
            │ SKILL 3: Movement Generator                      │
            │ (uses all above inputs + history + feedback)     │
            └────────────────────┬─────────────────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ SKILL 4          │
                        │ Quality Validator│
                        └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                        │
                    ▼ (if multi-session)     ▼ (save)
            ┌──────────────────┐    ┌─────────────────┐
            │ SKILL 5          │    │ FIRESTORE       │
            │ Session Sequencer│    │ (Persist)       │
            └────────────────┬─┘    └─────────────────┘
                             │
                             ▼
                        (Loop if needed)

    ASYNC AFTER COMPLETION:
            │
            ▼
    ┌──────────────────┐
    │ SKILL 6          │
    │ Feedback         │
    │ Interpreter      │
    └────────┬─────────┘
             │
             ▼
    (Update clientMovementProfiles.feedbackLog)
    (Feeds into next generation cycle)
```

---

## Data Objects Passed Between Skills

```typescript
// CONTEXT from SKILL 1 → used by SKILL 2, 3, 7
ContextAnalysis {
  timeHorizon: 'single' | 'weekly' | 'monthly'
  trainingStyle: 'strength' | 'conditioning' | 'hypertrophy' | 'mixed'
  sessionFrequency: number
  isProgressive: boolean
  expectations: {
    movementRepeatFrequency: 'rare' | 'occasional' | 'frequent'
    varietyImportance: 'high' | 'medium' | 'low'
    fatigueCoordination: 'critical' | 'important' | 'minimal'
    progressionStructure?: 'microcycle' | 'linear' | 'undulating'
  }
}

// PLAN from SKILL 2 → used by SKILL 3, 4, 5
SessionPlan {
  byDateOrWeek: {
    [key: string]: {
      recommendedCategory: string
      recommendedTemplate?: string
      phase?: 'base' | 'build' | 'peak' | 'deload'
      conflictWarnings: string[]
      progressionNote: string
    }
  }
}

// PROGRESSION from SKILL 7 → used by SKILL 3, 4
ProgressionReasoning {
  shouldRepeatMovement: boolean
  suggestedProgression: 'load' | 'volume' | 'density' | 'technique' | 'recovery'
  loadAdjustment?: number // e.g., 1.05 for +5%
  volumeAdjustment?: number
  movementFamilyRepeatStrategy?: string
}

// GENERATED from SKILL 3 → used by SKILL 4, 5
GeneratedWorkout {
  rounds: ClientWorkoutRound[]
  movementReasoning: {
    [movementId]: {
      whySelected: string
      horizonContext: string
      progressionJustification?: string
    }
  }
}

// VALIDATED from SKILL 4 → used by SKILL 5 or save
ValidationResult {
  approved: boolean
  warnings: string[]
  errors?: string[]
  suggestions?: string[]
}

// SEQUENCED from SKILL 5 → triggers adjustments or save
SequenceValidation {
  approved: boolean
  adjustments: Array<{
    dateOrWeek: string
    reason: string
    suggestion: string
  }>
}

// FEEDBACK from SKILL 6 → persisted to Firestore
FeedbackSignals {
  byMovement: {
    [movementId]: {
      signal: 'pain' | 'too_easy' | 'too_hard' | 'great_quality' | 'good_tolerance' | 'poor_tolerance' | 'time_overrun'
      count?: number
      lastDate: Date
    }
  }
  sessionQuality: number // 1-5
  notes: string
}
```

---

## Key Differences by Horizon

| Aspect | Single | Weekly | Monthly |
|--------|--------|--------|---------|
| **Skill 1 output** | Simple context | Time-critical context | Progressive context |
| **Skill 2 role** | N/A | Validate week structure | Validate 4-week phase structure |
| **Skill 3 constraints** | Greedy (best for this session) | Must avoid adjacent day patterns | Must respect 4-week progression arc |
| **Skill 5 scope** | N/A | 1 week optimization | 4 week optimization |
| **Skill 7 frequency** | N/A | Once per session | Twice per session (week + day level) |
| **Feedback impact** | Immediate (for next single) | Within-week (for remaining sessions) | Across weeks (for future weeks if ongoing) |

---

## Example Execution: Strength-Focused 4-Week Monthly

**Input**: User selects "Strength" goal, month split template, 4 weeks

**SKILL 1 Output**:
```
{
  timeHorizon: 'monthly',
  trainingStyle: 'strength',
  isProgressive: true,
  expectations: {
    movementRepeatFrequency: 'frequent',
    varietyImportance: 'low',
    fatigueCoordination: 'critical',
    progressionStructure: 'linear'
  }
}
```

**SKILL 2 Output** (partial):
```
Week 1 (Base): Mon & Thu main lifts (squat focus), Wed upper
Week 2 (Build): Mon & Thu main lifts (increase volume +20%), Wed upper
Week 3 (Peak): Mon & Thu main lifts (increase intensity, lower reps), Wed skill work
Week 4 (Deload): Mon & Thu reduced volume (-40%), Wed mobility
```

**SKILL 7 → SKILL 3 for Week 2, Day 1 (Monday)**:
```
Progression: Load from Week 1 Mon squat by +5%
Volume: Accessory sets +1
Selected: Back Squat (progression), RDL (support), Leg Press (volume)
```

**SKILL 4 Check**: ✓ No pain blocks, ✓ Matches progression, ✓ Density appropriate

**SKILL 5 Final Check (all 4 weeks)**:
```
✓ Week 1→2 progression smooth (volume build)
✓ Week 2→3 progression smooth (intensity shift)
✓ Week 3→4 appropriately deloaded
✓ Back Squat spaced Mon/Thu each week (48h apart)
✓ No adjacent high-stress sessions
✓ Approved: Save all 16 sessions
```

---

