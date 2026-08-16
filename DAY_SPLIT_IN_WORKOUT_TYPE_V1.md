# Day Split In Workout Type (V1)

## Goal
Keep configuration simple for coaches by placing Day Split inside Workout Type instead of adding a new top-level config area.

## Product Decision
1. Day Split is stored as a nested object under each Workout Type.
2. A Workout Type can have multiple split variants.
3. One split variant is marked as default.
4. Period or Program can optionally override the default split variant.

## Why This Works
1. Simple for first-time coaches: one place to configure.
2. Flexible for advanced use: multiple variants per type.
3. Future-proof: split can be extracted later if needed.

## V1 Data Shape

WorkoutType
- id: string
- key: string
- name: string
- description: string
- color: string
- intentKeys: string[]
- constraints: object
- daySplits: DaySplit[]
- defaultDaySplitId: string
- createdAt: timestamp
- updatedAt: timestamp

DaySplit
- id: string
- label: string
- daysPerWeek: number
- dayAssignments: DayAssignment[]
- notes: string
- active: boolean

DayAssignment
- dayIndex: number
- focusKey: string
- structureTemplateIds: string[]
- optionalTags: string[]

## Example V1 Record

WorkoutType strength
- key: strength
- name: Strength
- color: #2f7a54
- intentKeys: [build_strength]
- defaultDaySplitId: ul_3d
- daySplits:
  1. ul_3d (3 days)
     - day 1: upper_strength -> [exo_upper_a, exo_upper_b]
     - day 2: lower_strength -> [exo_lower_a, exo_lower_b]
     - day 3: full_body_strength -> [exo_full_a]
  2. ppl_4d (4 days)
     - day 1: push_strength -> [ppl_push_a]
     - day 2: pull_strength -> [ppl_pull_a]
     - day 3: lower_strength -> [ppl_lower_a]
     - day 4: upper_volume -> [ppl_upper_vol]

## Runtime Resolution (V1)
1. Select Workout Type.
2. Resolve splitId:
   - use Period override if present,
   - else use WorkoutType defaultDaySplitId.
3. Resolve day assignment from split using weekly sequence index.
4. Send focusKey and structureTemplateIds to draft generation.
5. DDS ranks candidates only within those constraints.

## UX Structure (V1)

Single screen: Workout Type Editor

Basic tab (required)
1. Name
2. Description
3. Color
4. Primary intent
5. Training days per week
6. Default split selector

Advanced tab (optional)
1. Split Variants section
   - Add split variant
   - Duplicate split variant
   - Archive split variant
2. Day mapping editor per split
   - Day cards (Day 1, Day 2, Day 3...)
   - Focus selector
   - Structure template multi-select
3. Constraint overrides
   - Repeat guardrails
   - Progression mode

## First-Time Coach Flow
1. Choose goal.
2. Choose days per week.
3. System auto-selects recommended Workout Type + default split.
4. Coach can finish setup immediately.
5. Advanced edits remain collapsed unless expanded.

## Validation Rules
1. Workout Type must have at least one split variant.
2. defaultDaySplitId must reference an active split variant.
3. dayAssignments count must equal daysPerWeek.
4. Every dayAssignment must include at least one structureTemplateId.
5. focusKey must be one of allowed focus keys.

## Migration Plan
1. Add daySplits and defaultDaySplitId fields to Workout Type.
2. For existing Workout Types, create one auto-generated split variant named default.
3. Populate default split using current behavior mappings.
4. Mark migration complete with schema version.

## Feature Flags
1. useWorkoutTypeDaySplits: true enables nested split logic.
2. If false, fallback to current type -> structure routing.

## Success Metrics
1. Time to first program setup under 5 minutes for new coach.
2. Fewer configuration errors in first setup session.
3. Lower duplicate workout rate after split-constrained routing.

## Future Extension (Optional)
If needed later, Day Split can become a standalone entity without breaking UI by:
1. Keeping the same split shape.
2. Replacing nested storage with referenced split profiles.
3. Preserving the same editor experience.
