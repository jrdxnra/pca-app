# Multi-Client Session Support - Phase 1 Implementation

## Overview

Phase 1 implementation for handling calendar events with multiple client attendees. This update extends the name-based matching system to identify ALL matching clients per event (not just the first match), classify session types, and display appropriate badges in the UI.

## Changes Implemented

### 1. Core Matching Service (`/src/lib/services/clientMatching.ts`)

#### New Types
```typescript
export type SessionType = '1-on-1' | 'buddy' | 'group';

export interface MultiClientMatchResult {
  matches: ClientMatchResult[];
  sessionType: SessionType;
  totalAttendees: number;
}
```

#### New Functions
- **`matchEventToAllClients()`**: Returns ALL matching clients for an event (not just first match)
  - Loops through all attendees and finds matching clients
  - Prevents duplicate client matches using `Set<string>`
  - Automatically classifies session type based on attendee count:
    - `1-on-1`: 1 attendee
    - `buddy`: 2 attendees  
    - `group`: 3+ attendees
  - Returns `MultiClientMatchResult` with all matches, session type, and total attendee count

- **`matchEventsToAllClients()`**: Batch version that returns `Map<eventId, MultiClientMatchResult>`

#### Preserved Functions
- `matchEventToClient()`: Still available for backward compatibility (returns first match only)
- `matchEventsToClients()`: Still available for backward compatibility

### 2. React Hook (`/src/hooks/useClientMatching.ts`)

#### New Exports
- `matchEventToAll()`: Hook-wrapped version of `matchEventToAllClients()`
- `matchEventsToAll()`: Hook-wrapped version of `matchEventsToAllClients()`
- `MultiClientMatchResult` type export

#### Updated Interface
```typescript
export interface UseClientMatchingResult {
  // Single-client matching (backward compatible)
  matchEvent: (event) => ClientMatchResult | null;
  matchEvents: (events) => Map<string, ClientMatchResult>;
  
  // Multi-client matching (new)
  matchEventToAll: (event) => MultiClientMatchResult | null;
  matchEventsToAll: (events) => Map<string, MultiClientMatchResult>;
  
  // ... other existing functions
}
```

### 3. Session Type Badge Component (`/src/components/calendar/SessionTypeBadge.tsx`)

New reusable component for displaying session type badges:

**Props:**
- `sessionType`: `'1-on-1' | 'buddy' | 'group'`
- `clientCount?`: Optional exact client count for group sessions
- `showIcon?`: Whether to show Users icon
- `variant?`: `'default'` (full label) or `'compact'` (short label)

**Styling:**
- `1-on-1`: Default blue badge, label "1-on-1" or "1:1"
- `buddy`: Secondary purple badge, label "Buddy (2)" or "Buddy"
- `group`: Outline green badge, label "Group (3+)" or "Group (N)"

### 4. Diagnostic Component (`/src/components/calendar/ClientMatchingDiagnostic.tsx`)

#### Updated Display
- **Overview Tab**: Shows session type badge + all matched clients for each event
- **Matched Tab**: Detailed view with:
  - Session type badge with total attendee count
  - List of all matched clients with their matched names and confidence
  - Other unmatched attendees listed separately

#### Sample Output
```
Training Session
Nov 15, 3:00 PM

[Buddy (2)] [Devon McGuire] [John Smith] ✓

Matched Clients:
  [Devon McGuire] matched to [Devon] (exact)
  [John Smith] matched to [John] (partial)

Other attendees: Conference Room A
```

## Session Type Classification Logic

```
attendees.length === 1  →  1-on-1
attendees.length === 2  →  buddy
attendees.length >= 3   →  group
```

**Note**: Classification is based on total attendees in the event, not number of matched clients. This ensures consistency even when not all attendees match clients in the database.

## Usage Examples

### Get all matches for an event
```typescript
import { useClientMatching } from '@/hooks/useClientMatching';

const { matchEventToAll } = useClientMatching();

const result = matchEventToAll(event);
// Returns: {
//   matches: [
//     { clientId: '1', clientName: 'Devon McGuire', matchedName: 'Devon', confidence: 'exact' },
//     { clientId: '2', clientName: 'John Smith', matchedName: 'John', confidence: 'partial' }
//   ],
//   sessionType: 'buddy',
//   totalAttendees: 2
// }
```

### Display session badge
```tsx
import { SessionTypeBadge } from '@/components/calendar/SessionTypeBadge';

<SessionTypeBadge 
  sessionType={result.sessionType}
  clientCount={result.matches.length}
/>
```

### Batch process events
```typescript
const { matchEventsToAll } = useClientMatching();

const allMatches = matchEventsToAll(events);
// Map<eventId, MultiClientMatchResult>

// Check if event has multiple clients
const multiMatch = allMatches.get(eventId);
if (multiMatch && multiMatch.matches.length > 1) {
  // Handle multi-client session
}
```

## Backward Compatibility

All existing code using single-match functions continues to work:
- `matchEvent()` and `matchEvents()` remain unchanged
- Diagnostic component updated to use new multi-match functions
- No breaking changes to existing APIs

## Next Steps (Phase 1 Remaining)

1. **Add session badges to main calendar views**
   - Programs page calendar
   - Individual client calendar views
   - Workout list views

2. **Update workout builder**
   - Multi-select client dropdown
   - Pre-populate with matched clients from event
   - Show session type badge

3. **Implement duplicate workout creation**
   - When creating workout from multi-client event
   - One workout record per selected client
   - Identical structure (exercises, sets, reps)
   - Independent editing capabilities

4. **Update calendar event display**
   - Show all matched clients on event hover/click
   - Session type indicator in event styling

## Testing Checklist

- [x] Multi-client matching returns all matches (not just first)
- [x] Session type correctly classified (1-on-1, buddy, group)
- [x] Diagnostic shows all matched clients per event
- [x] Session type badge displays correctly
- [ ] Badges appear on main calendar views
- [ ] Workout builder supports multi-client selection
- [ ] Duplicate workouts created for multi-client sessions
- [ ] Each client can edit their workout independently

## Performance Considerations

- Multi-client matching loops through all attendees × all clients
- Complexity: O(attendees × clients) per event
- Mitigated by:
  - Early break when client already matched
  - Typical events have 1-3 attendees
  - Typical client lists have 10-50 clients
  - Results are memoized in React hook

## Files Modified

1. `/src/lib/services/clientMatching.ts` - Core matching logic
2. `/src/hooks/useClientMatching.ts` - React hook wrapper
3. `/src/components/calendar/ClientMatchingDiagnostic.tsx` - Diagnostic UI
4. `/src/components/calendar/SessionTypeBadge.tsx` - New badge component

## Migration Notes

No database migrations required. All changes are client-side logic only.

Existing workout records remain unchanged. Multi-client support is opt-in when creating new workouts from calendar events.
