# Architecture Deep Dive - Clarification Questions

**Goal:** Get everything crystal clear BEFORE implementation  
**Status:** Exploration Phase  
**Your approach:** Take time, get it right

---

## 1. Collection Prefixing vs Metadata Field

Let me explain both approaches in detail:

### Approach A: Collection Prefixing

**How it works:**
```
movements-your-uid
├─ squat: { name: "Squat", ... }
└─ bench: { name: "Bench", ... }

movements-coach1-uid
├─ squat: { name: "Squat", ... }
└─ bench: { name: "Bench", ... }
```

**Code looks like:**
```typescript
const collection = `movements-${userId}`;
const q = query(collection(db, collection), ...);
```

**Pros:**
- ✅ Super clear at Firestore level (visually separated)
- ✅ Can have different rules per collection if needed
- ✅ Easy to backup/export (just grab the whole collection)
- ✅ Clear permissions (collection name = owner)
- ✅ Better for large databases (sharding benefit)

**Cons:**
- ❌ More collections in Firestore (cosmetic mainly)
- ❌ Need to know userId to query anything
- ❌ Harder to query "all movements across all users" (if needed)

---

### Approach B: Single Collection + Metadata Field

**How it works:**
```
movements (single collection)
├─ squat-v1-your-uid: { name: "Squat", ownerId: "your-uid", version: 1, ... }
├─ squat-v2-your-uid: { name: "Squat", ownerId: "your-uid", version: 2, ... }
├─ squat-v1-coach1-uid: { name: "Squat", ownerId: "coach1-uid", version: 1, ... }
├─ bench-your-uid: { name: "Bench", ownerId: "your-uid", ... }
└─ bench-coach1-uid: { name: "Bench", ownerId: "coach1-uid", ... }
```

**Code looks like:**
```typescript
const q = query(
  collection(db, 'movements'),
  where('ownerId', '==', userId),
  orderBy('name')
);
```

**Pros:**
- ✅ Single collection (feels more organized)
- ✅ Can query across owners if needed
- ✅ Can implement "shared" movements easily
- ✅ Good for analytics/reporting

**Cons:**
- ❌ More complex Firestore rules
- ❌ Every query needs WHERE clause (could be forgotten)
- ❌ Harder to backup per-user
- ❌ More complex permissions

---

### Questions for You

**Q1A:** Which feels more natural to you?
- Option A (Collection prefixing) feels cleaner
- Option B (Metadata field) feels more organized
- No preference

**Q1B:** Do you ever need to query "show me movements from ALL users"?
- No - each coach only ever sees their own
- Yes - you'd want to see what all coaches have
- Maybe - for admin analytics only

**Q1C:** Future: Might you want to share a movement between two coaches?
- No - every coach is completely independent
- Maybe - could happen, deal with it later
- Yes - eventually coaches should be able to share movements

---

## 2. Current Data Migration Decision

**Current situation:** All your data is in `movements`, `programs`, `clients`, etc.

### Option A: Move Everything to Dev Collections

```
BEFORE:
movements ← 60 items (your library)
clientWorkouts ← 100 items (your workouts)
programs ← 15 items (your programs)
clients ← 5 items (your clients)

AFTER Migration:
dev-movements ← 60 items (testing area)
dev-clientWorkouts ← 100 items (testing area)
dev-programs ← 15 items (testing area)
dev-clients ← 5 items (testing area)

movements-your-uid ← EMPTY (fresh start)
clientWorkouts-your-uid ← EMPTY
programs-your-uid ← EMPTY
clients-your-uid ← EMPTY
```

**Impact:**
- ✅ Clean slate for production collections
- ✅ Everything existing goes to dev (safe)
- ✅ You can gradually move tested items to prod
- ❌ Need to manually move things over

**Your workflow after:**
1. Test in dev
2. When happy, manually copy to prod (movements-your-uid)
3. Gradually build your prod library

---

### Option B: Move Everything to Production Collections

```
BEFORE:
movements ← 60 items (your library)
clientWorkouts ← 100 items
programs ← 15 items
clients ← 5 items

AFTER Migration:
movements-your-uid ← 60 items (your library, now in prod)
clientWorkouts-your-uid ← 100 items
programs-your-uid ← 15 items
clients-your-uid ← 5 items

dev-movements ← EMPTY (waiting for you to test new stuff)
```

**Impact:**
- ✅ Your current library is immediately usable
- ✅ When you add coach, they get your complete library
- ✅ You can still test in dev before moving to prod
- ❌ Current data is "production" even if untested

**Your workflow after:**
1. Current stuff in prod is stable baseline
2. Test new ideas in dev
3. Move tested items to prod (or replace existing)
4. Coaches get your prod library

---

### Questions for You

**Q2A:** What describes your current data better?
- "This is my complete, stable, tested library" → Option B (prod)
- "This is my work-in-progress, not all tested" → Option A (dev)
- "Mix of both" → Probably Option B still

**Q2B:** When you add the first coach, what should they get?
- My current exact library as-is (Option B)
- Only the stuff I'm confident in (Option A, curated after review)

**Q2C:** Are there any movements/programs in your current data that you'd want to delete or re-do before coaches see them?
- No - everything is solid
- Yes - quite a few things I'd update first

---

## 3. User Roles - Exploring Deeper

You said admin/coach/client seems good. Let me probe:

### Current Roles You Proposed
```
Admin (You)
├─ Access: Everything
├─ Can: Create/edit/delete anything
├─ See: All data
└─ Manage: Everything

Coach
├─ Access: Their own collections
├─ Can: Add clients, create programs, manage workouts
├─ See: Only their data
└─ Manage: Their own stuff

Client
├─ Access: Limited (workouts assigned to them)
├─ Can: Log workouts, view their schedule
├─ See: Their workouts/schedules only
└─ Manage: Their workout logs
```

### Questions About Roles

**Q3A:** Should coaches be able to invite/manage their own clients?
- Yes - coaches should handle client management
- No - you'll manually assign clients to coaches
- Maybe - coaches can see/manage their own clients only

**Q3B:** What if you want a "super-coach" role that can do more?
- Not needed - coach role is enough
- Maybe - eventually you might need power users
- Possibly - some coaches might be more advanced

**Q3C:** What about VIEW-ONLY access?
- Not needed
- Yes - might want assistants to view but not edit
- Maybe - deal with later

**Q3D:** Can multiple coaches work on the same client?
- No - 1 coach : 1 client relationship
- Maybe - a coach can share a client with another coach
- Not sure - need to think about this

**Q3E:** Athlete/Client future: Might clients sign up directly?
- No - they're always invited
- Maybe - eventually allow clients to join
- Not thinking about that yet

---

## 4. Calendar Sync - Let's Dig Deeper

You said:
> "They set up their own calendar sync, like I have with the script"
> "Meta data for names can display on event scheduler modal"

Let me make sure I understand:

### Current Setup (Your Calendar Sync)
```
You:
├─ Google Calendar OAuth token (stored in Firestore)
├─ Run sync script (manual or automated?)
├─ Script pulls your calendar events
├─ Creates scheduled-workouts in Firestore
├─ References your Google Calendar
```

### Your Vision for Coaches
```
Each Coach:
├─ Has their own Google Calendar
├─ Sets up their own OAuth
├─ Has their own sync script (or runs yours?)
├─ Gets their own scheduled-workouts-{coach-uid}
├─ References their own Google Calendar
├─ Completely independent from your calendar
```

### Questions About Calendar Sync

**Q4A:** How does the sync script work currently?
- Manual: You run it when you want to sync
- Scheduled: Runs automatically (cron job? Cloud Function?)
- On-demand: Triggered by user action in app

**Q4B:** When a coach sets up calendar sync:
- They click button → opens Google OAuth → tokens stored
- They provide a script to run themselves
- You set it up for them
- Other?

**Q4C:** The "metadata for names to display on event scheduler modal" - what does this mean?
- When showing event on scheduler, display the person's name from their profile?
- Show sync status (synced/not synced)?
- Show last sync time?
- Something else?

**Q4D:** What if a coach doesn't want to sync Google Calendar?
- App still works fine without it
- Calendar features just disabled for them
- They manually create scheduled workouts

**Q4E:** Could a coach's calendar have events from OTHER people?
- No - just their own events
- Possible - might share a team calendar
- They manage multiple calendars

**Q4F:** When you (admin) view a coach's data:
- Should you see their calendar events too?
- Or just their scheduled-workouts?
- Or neither?

---

## 5. Meta Questions - The Bigger Picture

Now some broader questions to clarify vision:

### Access & Visibility

**Q5A:** Admin (You) viewing a Coach's Data
- Can see everything in their collections?
- Can view but not edit?
- Can view/edit?
- Cannot see?

**Q5B:** What if Coach A and Coach B both exist:
- Can Coach A see Coach B's movements?
- Can Coach A see Coach B's clients?
- Can Coach A see Coach B's calendar?
- Or complete isolation?

**Q5C:** Client perspective:
- Can a client see their coach's other clients?
- Can a client see other coaches?
- Completely isolated to their own coach only?

---

### Data & Permissions

**Q5D:** When you add a coach and bootstrap their library:
- Should they be able to DELETE movements you gave them?
- Should they be able to EDIT movements you gave them?
- Should they be able to distinguish "from library" vs "created by me"?

**Q5E:** Updating movements later:
- If you improve a movement in your library, does coach's copy get updated?
- Or are they forever independent after bootstrap?
- Or can coach choose to update to your latest version?

**Q5F:** Disaster scenario - Coach deletes all their data:
- Can they restore from backup?
- Do they ask you to re-bootstrap?
- You can force re-bootstrap from admin?

---

### Growth & Scale

**Q5G:** How many coaches are you planning to have?
- 2-3 max
- 5-10 probably
- Could grow to 50+
- Unknown

**Q5H:** How many clients per coach?
- 1-5 each
- 10-20 each
- 50+ each
- Varies widely

**Q5I:** Will coaches interact with each other?
- No - completely isolated
- Maybe - can share templates/movements
- Yes - collaborative environment

---

### Features & Functionality

**Q5J:** Notifications:
- Should coaches get notified of anything?
- Should clients get notified?
- Should you get notified of coach activity?

**Q5K:** Reporting/Analytics:
- Should you see metrics across all coaches?
- Should coaches see their own metrics?
- Shared dashboards?

**Q5L:** Backup & Recovery:
- Automatic backups?
- Manual export capability?
- Disaster recovery plan?

**Q5M:** Versioning & History:
- Track who changed what?
- Audit logs?
- Ability to rollback?

---

## 6. Implementation Order Questions

### Q6A: Onboarding Flow
When adding a first coach, what's the flow?

**Option 1: Invite-Based**
```
You click "Add Coach"
→ Enter email
→ System sends invite link
→ Coach clicks link
→ Coach signs in with Google
→ System creates their account & bootstraps data
```

**Option 2: Direct Access**
```
Coach already has Google account
→ Coach goes to app & signs in
→ You approve them in admin panel
→ System bootstraps data
```

**Option 3: Manual**
```
You manually create their account in Firebase
→ Set password / reset link
→ Coach signs in
→ System bootstraps data
```

What makes sense for you?

---

### Q6B: First Coach Testing
For your FIRST coach (the test case):
- Will it be a real coach? Real clients?
- Or a test account (you testing as coach)?
- Or a friend testing the system?

**Q6C: Chicken & Egg Problem**
```
Coach 1 signs up
→ Gets bootstrap of your data
→ Creates clients
→ Creates workouts
→ Sets up calendar

Coach 2 signs up 3 months later
→ Gets bootstrap of YOUR current data
→ Should Coach 2 also get Coach 1's data?
→ Or completely separate?
```

What's the right answer?

---

## 7. Technical Deep Dives

### Q7A: Collection Querying
In the UI, when a coach loads "my movements":

```typescript
// What should happen?
const movements = await getMovements(currentUserId);

// Should it return:
// A) Only movements from their collection
// B) Movements + note of which are "from bootstrap"
// C) Movements organized by source
```

### Q7B: Editing Shared Data
If a coach wants to edit a movement that came from your bootstrap:

```
Option 1: Direct edit
├─ Edit the movement in place
├─ Your version unaffected
├─ Clean but loses history

Option 2: Create version
├─ Keep original, create new "improved" version
├─ Both exist in their library
├─ Cleaner workflow

Option 3: Mark as custom
├─ Edit in place
├─ Flag as "modified from library"
├─ Track original source
```

Which feels right?

### Q7C: Search & Filter
When coach sees movements, should they:
- See ALL movements in their collection
- Filter by category?
- Search by name?
- Filter by "created by me" vs "from library"?

---

## 8. Let's Talk About Your Dev Environment

You mentioned:
> "You test in dev environment before moving to prod"

### Q8A: Dev Workflow Details
When you create a new movement in dev:

```
Option 1: Fresh test
├─ Create in dev-movements
├─ Test with dev-clients, dev-programs
├─ When happy, COPY to movements-{your-uid}
├─ Delete from dev (clean up)

Option 2: Iterative
├─ Create in dev-movements
├─ Keep iterating in dev
├─ Only move to prod when stable
├─ Dev becomes scratchpad

Option 3: Branching
├─ Create in dev-movements (like git branch)
├─ Can have multiple versions
├─ Merge/promote when ready
```

How do you want dev to work?

### Q8B: Dev Data
When you move something from dev to prod:
```
Option 1: Copy
├─ Stays in dev, copied to prod
├─ Dev unchanged
├─ Clean slate for next test

Option 2: Move
├─ Removed from dev
├─ Added to prod
├─ Dev only has current work

Option 3: Link
├─ Still one version
├─ Just changes which collection it's "published" to
```

### Q8C: Test Clients in Dev
When testing workouts in dev:
- Create fake test clients in dev-clients?
- Use real clients in dev-clientWorkouts?
- Don't test with real clients (dev is templates only)?

---

## 9. Super Important: The Admin Power

### Q9A: What can you (admin) do?

```
View Coach Data?
├─ Yes - see everything
├─ Yes - read-only
├─ No - complete isolation

Edit Coach Data?
├─ Yes - can fix things
├─ Yes - but with audit log
├─ No - never touch their data

Delete Coach Data?
├─ Yes - full cleanup power
├─ Yes - but soft-delete (recoverable)
├─ No - prevent data loss

See Coach Clients?
├─ Yes - all clients visible
├─ Yes - read-only
├─ No - privacy boundary

Make Changes on Behalf?
├─ Yes - can do anything they do
├─ Yes - but flagged as admin
├─ No - they must do it
```

---

### Q9B: Audit & Accountability
Should the system track:
- Who (which user) made changes?
- When changes were made?
- What was changed?
- Can you view this history?
- Can you undo changes?

---

## 10. The Phase 1 Gateway Questions

Before we can start Phase 1 (Authentication), I need clarity on:

**MUST DECIDE:**
1. Collection Prefixing (A) or Metadata Field (B)?
2. Current data → Dev (A) or Prod (B)?
3. Admin visibility → Can see all coach data? (Or isolated?)

**SHOULD CLARIFY:**
4. Coach onboarding flow (Invite? Manual? Direct?)?
5. Calendar sync setup process?
6. What should coaches see in admin panel?
7. Dev environment workflow?

**NICE TO KNOW:**
8. Future: sharing between coaches?
9. Future: client accounts?
10. Notifications/audit logs?

---

## Your Answers Guide

Here's how to answer:

```
1. Collection Prefixing: A / B / Not sure yet
   → Why?

2. Current Data: A (dev) / B (prod) / Not sure
   → Why?

3. Admin Access: Can see all / Read-only / Isolated
   → Why?

4-10: [Your thoughts]

Questions for me: [What else should we clarify?]
```

---

**This is the deep dive. Take your time. What are your thoughts?**
