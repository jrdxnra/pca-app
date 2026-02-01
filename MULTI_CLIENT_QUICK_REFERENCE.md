# Multi-Client Session Support - Quick Reference

## What's New?

The PCA app now supports calendar events with multiple clients. When your work calendar event has multiple attendees who match clients in your database, the app will:

1. **Identify all matching clients** (not just the first one)
2. **Classify the session type** based on number of attendees
3. **Display session badges** to help you quickly identify session types

## Session Types

| Type | Attendees | Badge Color | Example |
|------|-----------|-------------|---------|
| **1-on-1** | 1 client | Blue (default) | Solo training session |
| **Buddy** | 2 clients | Purple (secondary) | Partner workout |
| **Group** | 3+ clients | Green (outline) | Group class |

## Where to See Multi-Client Info

### Configure Page (`/configure`)

The **Client Matching Diagnostic** shows:

- **Overview Tab**: Sample matched events with session badges and all matched clients
- **Matched Tab**: Detailed breakdown of each multi-client event:
  - Session type badge (e.g., "Buddy (2)")
  - Total attendee count
  - List of all matched clients with confidence levels
  - Unmatched attendees listed separately

### Example Display

```
Training Session
Nov 15, 3:00 PM

[Buddy (2)] [Devon McGuire] [John Smith] ✓

Matched Clients:
  Devon McGuire matched to Devon (exact)
  John Smith matched to John (partial)

Other attendees: Conference Room A
```

## Using the API

### In Components

```typescript
import { useClientMatching } from '@/hooks/useClientMatching';

function MyComponent() {
  const { matchEventToAll } = useClientMatching();
  
  const result = matchEventToAll(calendarEvent);
  
  if (result) {
    console.log(`Session type: ${result.sessionType}`);
    console.log(`Matched ${result.matches.length} clients:`);
    result.matches.forEach(match => {
      console.log(`- ${match.clientName}`);
    });
  }
}
```

### Display Session Badge

```tsx
import { SessionTypeBadge } from '@/components/calendar/SessionTypeBadge';

<SessionTypeBadge 
  sessionType={result.sessionType}
  clientCount={result.matches.length}
/>

// Compact version
<SessionTypeBadge 
  sessionType={result.sessionType}
  variant="compact"
  showIcon
/>
```

## Data Structure

### MultiClientMatchResult

```typescript
{
  matches: [
    {
      clientId: string;       // Client ID in database
      clientName: string;     // Client's full name
      matchedName: string;    // Attendee name that matched
      confidence: 'exact' | 'partial';
    },
    // ... more matches
  ],
  sessionType: '1-on-1' | 'buddy' | 'group',
  totalAttendees: number    // All attendees (matched + unmatched)
}
```

## Coming Soon (Phase 1 Remaining)

- **Session badges on main calendar views** - See session type at a glance
- **Multi-client workout builder** - Select multiple clients from matched attendees
- **Duplicate workout creation** - Create identical workouts for each selected client
- **Independent editing** - Each client can have their own workout variations

## Phase 2 Vision

Future enhancement will support **shared group workouts**:
- One workout record shared by multiple clients
- Individual performance tracking per client
- Shared programming, individual inputs
- Group session history and analytics

## Technical Notes

### Matching Logic

1. Extracts attendee names from calendar event
2. Filters out room/resource attendees (e.g., "Conference Room A")
3. Loops through all attendees
4. Matches each attendee against client database using fuzzy name matching
5. Prevents duplicate client matches
6. Returns all matches with confidence scores

### Session Type Classification

Based on **total number of attendees** (not matched clients):
- 1 attendee → 1-on-1
- 2 attendees → buddy
- 3+ attendees → group

This ensures consistent classification even when some attendees don't match database clients.

### Backward Compatibility

All existing single-client matching functions still work:
```typescript
const { matchEvent } = useClientMatching();
const match = matchEvent(event); // Returns first match only
```

New multi-client functions are opt-in:
```typescript
const { matchEventToAll } = useClientMatching();
const result = matchEventToAll(event); // Returns all matches
```

## Troubleshooting

**Q: Event shows 3 attendees but classified as "buddy"?**  
A: Classification is based on attendee count, not matched clients. Check if one attendee is a room/resource.

**Q: Client not showing in matches?**  
A: Name matching requires at least a partial match. Check:
- Client name in database
- Attendee display name in calendar
- Name normalization (removes punctuation, lowercases)

**Q: Want to use old single-match behavior?**  
A: Use `matchEvent()` instead of `matchEventToAll()`

## Resources

- Full documentation: `/MULTI_CLIENT_SESSION_PHASE1.md`
- Phase 2 vision: `/FUTURE_IMPROVEMENTS.md`
- Matching logic: `/src/lib/services/clientMatching.ts`
- Badge component: `/src/components/calendar/SessionTypeBadge.tsx`
