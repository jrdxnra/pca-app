# Event Filtering & Detection Guide

## Overview

The PCA app now integrates **Event Detection Keywords** with **Client Matching** to automatically filter out non-session events (like holds, meetings, admin time) from client matching results.

## How It Works

### 1. Session Keywords (Included)

Events must contain at least ONE of these keywords to be considered valid sessions:

**From Your Configuration:**
- Coaching Sessions: `Personal Training`, `PT`, `Training Session`, `Workout`
- Class Sessions: `Class`, `Group Class`, `Group Training`, `Group Session`, `Total`, `Choice`

**Default Keywords:**
- `personal training`, `pt`, `training session`, `workout`
- `class`, `group class`, `group training`, `group session`, `total`, `choice`

### 2. Exclusion Keywords (Filtered Out)

Events containing these keywords are **automatically excluded** from client matching:

- `hold`
- `blocked` / `blocked time`
- `busy`
- `unavailable`
- `do not schedule`
- `out of office` / `ooo`
- `meeting`
- `admin`

### 3. Two-Step Filter

For an event to be matched to clients, it must:
1. ✅ **Pass Step 1**: NOT contain any exclusion keywords
2. ✅ **Pass Step 2**: Contain at least one session keyword

## Example Cases

### ✅ Valid Sessions (Matched)

```
"Devon - Personal Training"
→ Contains "Personal Training" (coaching keyword)
→ No exclusion keywords
→ ✅ MATCHED

"Group Class - Total"
→ Contains "Total" (class keyword)
→ No exclusion keywords
→ ✅ MATCHED

"PT with Colleen"
→ Contains "PT" (coaching keyword)
→ No exclusion keywords
→ ✅ MATCHED
```

### ❌ Excluded Events (Filtered)

```
"Colleen / Jordan Hold"
→ Contains "hold" (exclusion keyword)
→ ❌ EXCLUDED (reason: Excluded keyword)

"Team Meeting - Admin"
→ Contains "admin" (exclusion keyword)
→ ❌ EXCLUDED (reason: Excluded keyword)

"Session with Devon"
→ No exclusion keywords
→ But doesn't contain session keywords
→ ❌ EXCLUDED (reason: Missing session keywords)
```

## Viewing Filtered Events

### In the Diagnostic Tool

Navigate to **Configure → Client Matching Diagnostic**

**New "Excluded" Tab** shows:
- Events with attendees that were filtered out
- Reason for exclusion
- List of attendees
- Highlighted in orange

Example display:
```
Colleen / Jordan Hold
Jan 26, 8:30 AM

[Excluded keyword (hold, meeting, admin, etc.)]

Attendees:
  [Colleen Pimentel] [huntjordan@xwf.google.com]
```

## Configuring Keywords

### Update Session Keywords

1. Go to **Configure** page
2. Find "Event Detection" section
3. Update keywords:

```
Coaching Sessions
Personal Training, PT, Training Session, Workout, 1-on-1
Save

Class Sessions
Class, Group Class, Group Training, Group Session, Total, Choice
Save
```

4. Changes apply immediately to new matching operations

### Keywords Are Case-Insensitive

All matching is case-insensitive:
- "Personal Training" = "personal training" = "PERSONAL TRAINING"

### Multiple Keywords = OR Logic

Event needs to match **ANY ONE** keyword (not all):
- "PT Session" matches because it contains "PT"
- "Group Class" matches because it contains "Class"

## Color Coding Integration

The event detection system also controls calendar color-coding:

- **Coaching Sessions**: Blue (or your configured color)
- **Class Sessions**: Green (or your configured color)
- **Excluded Events**: Not color-coded (filtered out)

## Technical Details

### Filter Priority

1. **First**: Check exclusion keywords (most specific)
2. **Then**: Check session keywords (least specific)
3. **Finally**: Apply client name matching

### Default Behavior

If you haven't configured keywords yet:
- Uses default session keywords listed above
- Exclusion keywords always apply
- New configurations merge with defaults

### API Usage

```typescript
import { useClientMatching } from '@/hooks/useClientMatching';

function MyComponent() {
  const { matchEventsToAll, getExcluded } = useClientMatching();
  
  // Only valid sessions are matched
  const matches = matchEventsToAll(events);
  
  // See what was filtered out
  const excluded = getExcluded(events);
  excluded.forEach(({ event, reason }) => {
    console.log(`Excluded: ${event.summary} - ${reason}`);
  });
}
```

## Troubleshooting

### Event Not Being Matched?

**Check the Excluded tab:**
1. If it appears there → Check the reason
2. If reason is "Excluded keyword" → Remove that word from title or add to session keywords
3. If reason is "Missing session keywords" → Add a session keyword to the title

### Event Should Be Excluded But Isn't?

1. Check if title contains any session keywords (those take precedence)
2. Add more specific exclusion keywords
3. Or remove conflicting session keywords

### Want to Match All Events with Attendees?

Currently not recommended, but you can:
1. Remove all coaching/class keywords
2. The system will fall back to defaults
3. Better: Add very generic keywords like "session", "training", "class"

## Best Practices

### Event Naming Conventions

**Good (Auto-Detected):**
- "Devon - PT @ Main Gym"
- "Colleen Personal Training"
- "Group Class - Total Body"

**Bad (Won't Match):**
- "Devon Session" (needs PT, Training, or Workout keyword)
- "Jordan Hold" (contains exclusion keyword)
- "Team Meeting" (contains exclusion keyword)

### Keyword Strategy

**Be Specific:**
- ✅ "Personal Training", "PT", "Training Session"
- ❌ "Training" (too broad, matches "Training Meeting")

**Cover Variations:**
- ✅ "Group Class", "Group Training", "Group Session"
- Covers different ways trainers name group events

**Use Abbreviations:**
- ✅ "PT" for Personal Training
- ✅ "OOO" for Out of Office

## Statistics

The diagnostic shows:
- **Total Events**: All calendar events in the window
- **With Attendees**: Events that have attendees
- **Matched**: Valid sessions matched to clients
- **Unmatched**: Valid sessions with no client match
- **Excluded**: Events filtered out by keywords

## Future Enhancements

Potential additions:
- Custom exclusion keywords per user
- Regex pattern matching
- Location-based filtering
- Time-based filtering (e.g., exclude events outside work hours)
- Manual override to force-include specific events
