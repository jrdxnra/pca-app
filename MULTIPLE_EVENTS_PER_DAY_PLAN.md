# Multiple Events Per Day - Design Plan

## 📋 Executive Summary

**Revised Approach (Based on Google Calendar Pattern):**
- **Week View = Primary Work Area** - Optimize for detailed event display (8+ events per day)
- **Month View = Overview** - Keep simple with event counts and indicators
- **Day View = Maximum Detail** - Full event cards for deep dive

**Key Principle:** Month view should never be cluttered. If you need details, navigate to week/day view.

---

## 🎯 Problem Statement

**Current Limitation:**
- Calendar currently shows only 1-2 events per day
- User can have **8+ workout sessions** per day
- Some sessions are **shared between multiple clients**
- Need better UI/UX for dense event days

## 📊 Current Implementation Issues

1. **Limited Display:**
   - Shows only `.slice(0, 1)` event when category exists
   - Shows only `.slice(0, 2)` events when no category
   - "+X more" indicator doesn't help with 8+ events

2. **No Time-Based Organization:**
   - Events not sorted by time
   - Can't see schedule at a glance

3. **Shared Client Sessions:**
   - No support for multiple clients in one event
   - Need to handle client arrays/relationships

4. **Space Constraints:**
   - Month view cells are small
   - Can't fit 8 events in a single day cell

## 🎨 Proposed Solutions (Revised Based on Google Calendar Pattern)

### ✅ Recommended Approach: Week View Optimization + Simple Month View

**Philosophy:** Month view = Overview, Week/Day view = Detailed Work

### Month View (Informative Overview)
- **Show ALL events** (not just count)
- **One line per event** with:
  - **Color dot on left** - Indicates category/event type
  - **Client name** - Most important info for quick scanning
  - **Time-sorted** - Shows order of sessions
  - **Color coding** - Visual category identification
  
- **Interactive Elements:**
  - **Click color dot** → Opens category changing options (staircase menu)
  - **Click event (right side)** → Opens day view with workout editor (like hyperlink)
  - **Click day cell** → Opens week view with expanding effect
  
**Key Principle:** Month view shows all events in compact one-line format. Color + client name + time sorting = all info needed for quick schedule review.

### Week View (Detailed Schedule - PRIMARY FOCUS)
- **Time-sorted event list** for each day
- **Full event details:**
  - Time range (8:00 AM - 9:00 AM)
  - Client name(s) - support multiple for shared sessions
  - Event title/summary
  - Status indicators (linked/unlinked, coaching session)
  - Action buttons (Build Workout, View Workout)
- **Visual hierarchy:**
  - Color-coded by category/type
  - Clear time-based organization
  - Easy to scan and interact

### Day View (Maximum Detail)
- **All events for the day** in chronological order
- **Full event cards** with all details
- **Quick actions** for each event
- **Workout editor** integration

**Key Insight:** Week view is where users actually work with their schedule. Month view is just for navigation and overview.

## 🔧 Implementation Plan (Revised - Week View Focus)

### Phase 1: Week View Optimization (PRIMARY FOCUS) 🎯

#### 1.1 Event Sorting & Time Organization
```typescript
// Sort events by time for each day in week view
const sortedEvents = calendarEventsForDay.sort((a, b) => {
  return new Date(a.start.dateTime).getTime() - new Date(b.start.dateTime).getTime();
});

// Group by time slots for visual organization
const timeSlots = groupEventsByTimeSlot(sortedEvents, 30); // 30-minute slots
```

#### 1.2 Enhanced Week View Event Display
- **Create `WeekDayEventsList` component**
  - Shows all events for a day in week view
  - Time-sorted vertical list
  - Each event as a card with:
    - Time range (8:00 AM - 9:00 AM)
    - Client name(s) - with support for multiple
    - Event title
    - Status indicators (🏋️, ✓)
    - Action buttons (Build/View Workout)
  - Color-coded by category
  - Scrollable if many events

#### 1.3 Week View Layout Improvements
- **Time column on left** (like Google Calendar)
- **Day columns** with all events listed
- **Event cards** that are clickable and actionable
- **Visual separation** between days
- **Responsive** to handle 8+ events per day

### Phase 2: Month View Simplification

#### 2.1 Simple Mode (Default)
- Show **event count badge**: "8 sessions" or "+6 more"
- Show **colored dot indicators** for event types
- Minimal text, clean overview
- Click day → Navigate to week/day view

#### 2.2 Expanded Mode (Optional Toggle)
- Toggle button: "Simple" / "Expanded"
- Expanded shows first 2-3 events with time
- Still shows "+X more" for remaining
- Click day → Still navigates to detailed view

#### 2.3 Day Click Behavior
- Click day cell → Navigate to **week view** (not day view)
- Week view shows all events for that week
- Day view available for maximum detail

### Phase 3: Shared Client Sessions

#### 3.1 Event Creation
- Allow selecting multiple clients when creating test event
- Store client array in event metadata
- Display multiple client names in event title/summary

#### 3.2 Workout Linking
- Support linking multiple workouts to one event
- Each client can have their own workout
- Show all linked workouts in event display

#### 3.3 Workout Builder
- When building from shared session event:
  - Show client selector (if multiple clients)
  - Create workout for selected client
  - Link to event with client context

## 📐 UI/UX Design

### Month View Cell (Simple Overview)
```
┌─────────────────────┐
│ 15                  │
│ 🔴 🔴 🔴            │
│ +5 more sessions    │
└─────────────────────┘
```
**Or Expanded:**
```
┌─────────────────────┐
│ 15                  │
│ 🔴 8am Client A     │
│ 🔴 10am Client B    │
│ +6 more sessions    │
└─────────────────────┘
```

### Week View (Detailed Schedule - PRIMARY)
```
┌──────┬──────────────┬──────────────┬──────────────┐
│ Time │ Monday       │ Tuesday      │ Wednesday    │
├──────┼──────────────┼──────────────┼──────────────┤
│ 7am  │              │              │ [Event Card] │
│      │              │              │ 7:00-8:00 AM │
│      │              │              │ Client A     │
│      │              │              │ [Build]      │
├──────┼──────────────┼──────────────┼──────────────┤
│ 8am  │ [Event Card] │              │ [Event Card] │
│      │ 8:00-9:00 AM │              │ 8:00-9:00 AM │
│      │ Client B     │              │ Client C     │
│      │ [View] ✓     │              │ [Build]      │
├──────┼──────────────┼──────────────┼──────────────┤
│ 9am  │              │ [Event Card] │              │
│      │              │ 9:00-10:00   │              │
│      │              │ Client D & E │              │
│      │              │ [Build]      │              │
├──────┼──────────────┼──────────────┼──────────────┤
│ ...  │              │              │              │
└──────┴──────────────┴──────────────┴──────────────┘
```

### Day View (Maximum Detail)
```
┌─────────────────────────────────┐
│ Monday, January 15, 2024         │
├─────────────────────────────────┤
│ 8:00 AM - 9:00 AM               │
│ [Event Card] Client A            │
│ 🏋️ Coaching Session              │
│ [Build Workout] [View Workout]  │
├─────────────────────────────────┤
│ 10:00 AM - 11:00 AM             │
│ [Event Card] Client B & C        │
│ 🏋️ Group Session                 │
│ [Build Workout] [View Workout]  │
├─────────────────────────────────┤
│ ... (6 more events)             │
└─────────────────────────────────┘
```

### Event Card (Shared Clients)
```
┌─────────────────────────────────┐
│ 🏋️ 10:00 AM - 11:00 AM         │
│ Group Session                    │
│ 👥 Client A, Client B, Client C  │
│ ✓ Linked (3 workouts)           │
│ [View Workouts]                 │
└─────────────────────────────────┘
```

## 🔄 Data Model Updates

### Event Metadata
```typescript
interface GoogleCalendarEvent {
  // ... existing fields
  
  // Multiple clients support
  preConfiguredClients?: string[]; // For shared sessions
  linkedWorkoutIds?: Record<string, string>; // clientId -> workoutId mapping
  
  // Better organization
  eventType?: 'individual' | 'group' | 'shared';
  clientCount?: number;
}
```

### Workout Linking
```typescript
// Current: Single workout link
linkedWorkoutId?: string;

// Proposed: Multiple workout links
linkedWorkouts?: {
  clientId: string;
  workoutId: string;
}[];
```

## 🚀 Implementation Steps (Revised Priority)

### Step 1: Week View Optimization (PRIMARY) 🎯
- [ ] **Event Sorting** - Sort all events by time in week view
- [ ] **Create `WeekDayEventsList` component** - Time-sorted event list for each day
- [ ] **Enhanced Event Cards** - Full details with time, client(s), actions
- [ ] **Week View Layout** - Time column + day columns with scrollable event lists
- [ ] **Visual Improvements** - Color coding, clear hierarchy, easy scanning

### Step 2: Month View Simplification
- [ ] **Simple Mode** - Event count badges ("8 sessions") + colored dots
- [ ] **Expanded Mode Toggle** - Optional expanded view with 2-3 events
- [ ] **Click Behavior** - Click day → Navigate to week view (not day view)
- [ ] **Clean Overview** - Keep month view uncluttered

### Step 3: Shared Client Support
- [ ] **Update Event Types** - Add `preConfiguredClients` array
- [ ] **Update Linking** - Support `linkedWorkoutIds` mapping (client → workout)
- [ ] **Test Event Creation** - Allow selecting multiple clients
- [ ] **Workout Builder** - Handle client selection for shared sessions
- [ ] **UI Display** - Show multiple client names in event cards

### Step 4: Day View Enhancement
- [ ] **Chronological List** - All events sorted by time
- [ ] **Full Event Cards** - Maximum detail for each event
- [ ] **Quick Actions** - Easy access to build/view workouts

### Step 5: Testing & Polish
- [ ] Test with 8+ events on one day in week view
- [ ] Test shared client sessions workflow
- [ ] Test navigation between views
- [ ] Test performance with many events
- [ ] Polish UI/UX for dense schedules

## 💡 Key Considerations

### Performance
- Lazy load events for days not in view
- Virtual scrolling for long event lists
- Efficient sorting and filtering

### User Experience
- Quick access to most important events
- Easy navigation to day view for details
- Clear visual indicators for linked/unlinked
- Time-based organization for schedule clarity

### Scalability
- Handle 10+ events per day
- Support 3-4 clients per shared session
- Efficient data loading and rendering

## 🎯 Success Criteria

### Week View (Primary)
✅ Can see all 8+ events on a day in week view  
✅ Events sorted by time for easy scanning  
✅ Full event details visible (time, client, status, actions)  
✅ Easy to build/view workouts for each event  
✅ Shared client sessions clearly indicated  
✅ Scrollable event lists handle many events  
✅ Performance remains good with many events  

### Month View (Overview)
✅ Clean, uncluttered overview  
✅ Event count badges show schedule density  
✅ Colored indicators for quick scanning  
✅ Click day → Navigate to week view for details  
✅ Optional expanded mode for more detail  

### Day View (Maximum Detail)
✅ All events in chronological order  
✅ Full event cards with all details  
✅ Quick actions for each event  

---

## 📝 Next Steps

1. **✅ Review and approve approach** - Week view optimization + simple month view
2. **🚀 Start with Step 1** - Week View Optimization (PRIMARY FOCUS)
   - Event sorting by time
   - Create `WeekDayEventsList` component
   - Enhanced event cards with full details
   - Week view layout improvements
3. **Step 2** - Month View Simplification
   - Simple mode with event counts
   - Optional expanded mode toggle
4. **Step 3** - Shared Client Support
   - Update data models
   - Multi-client event creation
   - Multiple workout linking
5. **Step 4** - Day View Enhancement
6. **Step 5** - Testing & Polish

**Priority:** 🚨 HIGH - Critical for real-world usage with 8+ daily sessions and shared client sessions.

**Recommended Starting Point:** Week View Optimization (Step 1) - This is where users will actually work with their schedule.

