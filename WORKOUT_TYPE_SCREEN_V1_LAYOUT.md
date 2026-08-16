# Workout Type Screen V1 Layout (Simple + Advanced)

This is a concrete UX layout for keeping Day Split inside Workout Type while reducing coach confusion.

## Screen Goal
Allow a new coach to create a valid Workout Type in one pass, then optionally open advanced split controls.

## Information Architecture
Single page section: Workout Types

Inside each Workout Type editor card:
1. Basic tab (default open)
2. Advanced tab (collapsed by default)

## Basic Tab (Required)

Fields
1. Name
2. Description
3. Color
4. Primary intent key (dropdown)
5. Training days per week (3, 4, 5, custom)
6. Default split variant (dropdown)

Read-only helper preview
- Weekly lane preview cards:
  - Day 1: focusKey
  - Day 2: focusKey
  - Day 3: focusKey
- Template count per day summary

CTA row
- Save Workout Type
- Cancel

Inline guidance copy
- Day split controls how this workout type is distributed across week days.

## Advanced Tab (Optional)

Section A: Split Variants
1. Variant list table
   - label
   - days per week
   - active flag
   - default badge
2. Actions
   - Add variant
   - Duplicate variant
   - Archive variant
   - Set as default

Section B: Day Assignment Editor
For selected split variant:
1. Day cards in order
2. Fields per day card
   - focusKey select
   - structureTemplateIds multi-select
   - optionalTags chips
3. Add day card (if daysPerWeek changed)

Section C: Rules
1. Repeat guardrails
2. Progression mode
3. Optional DDS guidance for this type

## New Coach Quick Flow
1. Click Add Workout Type.
2. Fill Name, Color, Intent.
3. Choose days per week.
4. Choose recommended default split.
5. Save.

Do not force advanced setup in first pass.

## Validation Messages
1. Add at least one split variant.
2. Pick a default split variant.
3. Every day in the selected split needs at least one structure template.
4. daysPerWeek must match number of day cards.

## Empty State Copy
- No split variants yet. Create one to map this workout type across week days.

## Recommended Defaults
When creating a new Workout Type:
1. Create one auto split variant named default.
2. Populate day cards by selected days per week.
3. Preselect first available structure template per day (can be changed).

## Accessibility And Clarity
1. Keep labels explicit: Workout Type and Day Split variant.
2. Keep Advanced collapsed initially.
3. Show one-line tooltips near split controls.
4. Use simple language over domain jargon.
