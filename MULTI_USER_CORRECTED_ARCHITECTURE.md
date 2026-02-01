# Multi-User Strategy - CORRECTED

**Clarification:** Each user owns their complete data copy  
**Updated:** January 21, 2026

---

## 🎯 The CORRECT Model

```
┌─────────────────────────────────────────────────────────────┐
│                  Firebase Project                           │
│         (performancecoachapp-26bd1)                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         YOU (Admin Coach)                            │  │
│  │         Your Dev Environment                         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Collections with "dev" prefix                        │  │
│  │ - dev-movements (YOUR testing versions)              │  │
│  │ - dev-clientWorkouts (testing)                       │  │
│  │ - dev-programs (testing)                             │  │
│  │ ISOLATED - No one else sees this                      │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         YOU (Admin Coach)                            │  │
│  │         Your Production Data                         │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Collections prefixed with your-uid or no prefix      │  │
│  │ - movements-{your-uid}  (YOUR library)               │  │
│  │ - clientWorkouts-{your-uid} (YOUR workouts)          │  │
│  │ - programs-{your-uid} (YOUR programs)                │  │
│  │ - clients-{your-uid} (YOUR clients)                  │  │
│  │ This is your stable, production version              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  COACH 1 (When you add them)                         │  │
│  │  Their Own Complete Environment                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Gets a COPY of your current data:                    │  │
│  │ - movements-{coach1-uid}   (copy of yours initially) │  │
│  │ - clientWorkouts-{coach1-uid}                        │  │
│  │ - programs-{coach1-uid}                              │  │
│  │ - clients-{coach1-uid}                               │  │
│  │                                                       │  │
│  │ From now on: COMPLETELY INDEPENDENT                  │  │
│  │ ✅ They can add their own movements                  │  │
│  │ ✅ They can modify anything in their copy            │  │
│  │ ✅ You don't see their changes                       │  │
│  │ ✅ Your changes don't affect them                    │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  COACH 2 (When you add them later)                   │  │
│  │  Their Own Complete Environment                      │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Gets a COPY of YOUR CURRENT data (at time of add)    │  │
│  │ - movements-{coach2-uid}   (snapshot of yours now)   │  │
│  │ - clientWorkouts-{coach2-uid}                        │  │
│  │ - programs-{coach2-uid}                              │  │
│  │ - clients-{coach2-uid}                               │  │
│  │                                                       │  │
│  │ From now on: COMPLETELY INDEPENDENT                  │  │
│  │ (May have more movements than Coach 1 got)           │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Key Difference from Previous Plan

### ❌ WRONG (What I Suggested Before)
```
Shared catalogs (movements, categories)
  ├─ Everyone reads from here
  └─ Only you edit (affects everyone)

+ User-specific data (clients, workouts)
  └─ Each user has their own
```
**Problem:** Coach's library is stuck with your v1 forever. When you add movement v2, only you have it.

### ✅ CORRECT (What You're Describing)
```
Each user has their COMPLETE dataset
  ├─ YOU
  │  ├─ movements-{your-uid}
  │  ├─ clientWorkouts-{your-uid}
  │  ├─ programs-{your-uid}
  │  └─ clients-{your-uid}
  │
  ├─ COACH 1 (gets copy of your data at signup)
  │  ├─ movements-{coach1-uid} ← copy of your movements
  │  ├─ clientWorkouts-{coach1-uid}
  │  ├─ programs-{coach1-uid}
  │  └─ clients-{coach1-uid}
  │
  └─ COACH 2 (gets copy of your data at signup)
     ├─ movements-{coach2-uid} ← copy of your movements
     ├─ clientWorkouts-{coach2-uid}
     ├─ programs-{coach2-uid}
     └─ clients-{coach2-uid}

Each user completely independent from that point on
```

---

## 🏗️ Revised Architecture

### Three-Layer Model

**Layer 1: Your Development Environment**
- Collections: `dev-movements`, `dev-clientWorkouts`, etc.
- Purpose: Test new features before going to production
- Access: Admin (you) only
- Users affected: None

**Layer 2: Your Production Environment**
- Collections: `movements-{your-uid}`, `clientWorkouts-{your-uid}`, etc.
- Purpose: Your stable, working library
- Access: Admin (you) only
- Users affected: None (unless you explicitly share)

**Layer 3: Each Coach's Environment**
- Collections: `movements-{coach-uid}`, `clientWorkouts-{coach-uid}`, etc.
- Purpose: Their complete working library
- Access: That specific coach (and you as admin)
- Bootstrap: Copy of your Layer 2 data at time of signup
- Independence: Completely separate from that point on

---

## 📋 Collection Structure

### Naming Convention
```
movements-{user-uid}
clientWorkouts-{user-uid}
programs-{user-uid}
clients-{user-uid}
workoutLogs-{user-uid}
scheduled-workouts-{user-uid}
workoutTemplates-{user-uid}
periods-{user-uid}

dev-movements (development only, your-uid implied)
dev-clientWorkouts
dev-programs
dev-clients
... (etc)
```

### Example: Real Data
```
Firestore Collections:

movements-your-uid
├─ squat-v1: { name: "Squat", ... }
├─ bench-v1: { name: "Bench", ... }
├─ deadlift-v1: { name: "Deadlift", ... }
└─ (50+ more movements YOU'VE BUILT)

movements-coach1-uid
├─ squat-v1: { name: "Squat", ... }  ← COPY from your v1
├─ bench-v1: { name: "Bench", ... }  ← COPY from your v1
├─ deadlift-v1: { name: "Deadlift", ... }  ← COPY from your v1
├─ (50+ more - exact copies)
├─ swing: { name: "Kettlebell Swing", ... }  ← COACH 1 ADDED
└─ thruster: { name: "Thruster", ... }  ← COACH 1 ADDED

movements-coach2-uid (added 3 months later)
├─ squat-v2: { name: "Squat", ... }  ← COPY from your CURRENT v2
├─ bench-v2: { name: "Bench", ... }  ← COPY from your CURRENT v2
├─ deadlift-v1: { name: "Deadlift", ... }  ← COPY from your v1
├─ legpress: { name: "Leg Press", ... }  ← YOU ADDED since Coach1
├─ (50+ more - YOUR current versions)
├─ swing: { name: "Kettlebell Swing", ... }  ← COACH 2 ADDED
└─ (no thruster - Coach 1's addition isn't shared)
```

---

## 🔐 Security Rules - CORRECTED

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return request.auth.uid == 'YOUR_UID_HERE';
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function extractUserIdFromCollection(collection) {
      // Extract userId from collection name like "movements-{uid}"
      return collection.split('-').slice(1).join('-');
    }
    
    // User profiles (read own, admin reads all)
    match /users/{uid} {
      allow read: if isOwner(uid) || isAdmin();
      allow write: if isAdmin();
      allow create: if isAuthenticated();
    }
    
    // Admin-only: Dev collections
    match /dev-{collection=**} {
      allow read, write: if isAdmin();
    }
    
    // User-specific data collections
    // Pattern: {collection}-{uid}/*
    match /{collection}-{uid}/{doc=**} {
      allow read, write: if 
        isOwner(uid) || isAdmin();
    }
    
    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 👥 User Workflow - CORRECTED

### When You Add a New Coach

```
Step 1: You invite Coach via email
         ↓
Step 2: Coach signs in (first time)
         ↓
Step 3: System creates their profile
         └─ users/{coach-uid}
         └─ { role: 'coach', assignedCoach: your-uid }
         ↓
Step 4: Trigger BOOTSTRAP process
         ├─ Copy movements-{your-uid} → movements-{coach-uid}
         ├─ Copy programs-{your-uid} → programs-{coach-uid}
         ├─ Copy workoutTemplates-{your-uid} → workoutTemplates-{coach-uid}
         └─ Copy other collections...
         ↓
Step 5: Coach now has full library
         ├─ Can view all copied data
         ├─ Can add their own movements
         ├─ Can create their own programs
         ├─ Can manage their own clients
         └─ 100% independent from you going forward
         ↓
Step 6: You continue independently
         ├─ Add new movements to YOUR library
         ├─ Coach doesn't see these (unless invited again)
         ├─ Coach's additions don't show in your library
         └─ Complete isolation maintained
```

### You Testing New Features

```
Step 1: Toggle Dev Mode ON
         ↓
Step 2: Create movement in dev-movements
         ├─ Edit coach assignments
         ├─ Create programs
         └─ Test everything
         ↓
Step 3: Coach sees nothing (dev is admin-only)
         ✅ Unaffected by your tests
         ↓
Step 4: Testing done and happy
         ↓
Step 5: Promote movement to production
         └─ Copy from dev-movements → movements-{your-uid}
         ↓
Step 6: Now in YOUR production library
         ├─ Coach still doesn't have it
         ├─ You can optionally share later if needed
         └─ No automatic sync to coaches
```

---

## 💾 Data Flows

### Initial Setup (One-Time)
```
Your current app
└─ All data in collections (movements, clientWorkouts, etc.)

Migrate to new model:
├─ Copy all to movements-{your-uid}
├─ Copy all to clientWorkouts-{your-uid}
├─ Copy all to programs-{your-uid}
└─ etc.

Now you have your data prefixed with your UID
```

### Adding a New Coach
```
Coach signs up
   ↓
System reads your current data:
├─ movements-{your-uid}
├─ programs-{your-uid}
├─ workoutTemplates-{your-uid}
├─ clients-{your-uid} (maybe - you decide)
└─ etc.
   ↓
System creates copies:
├─ movements-{coach-uid} ← all the data from your version
├─ programs-{coach-uid} ← all the data from your version
├─ workoutTemplates-{coach-uid} ← all the data from your version
└─ etc.
   ↓
Coach can now:
✅ See all your movements in their workspace
✅ Use them to create their own programs
✅ Add their own movements
✅ Build their own client workouts
✅ Manage their own clients
✅ NOT see your private workouts/clients (only shared data gets copied)
```

---

## 🎯 Bootstrap Process Details

### What Gets Copied to New Coach
**COPY:**
- ✅ Movements (the library of exercises)
- ✅ Movement Categories
- ✅ Workout Types
- ✅ Workout Categories  
- ✅ Workout Templates (your templates)
- ✅ Programs (your program structures)
- ✅ Periods (training phases)
- ✅ Week Templates
- ✅ Workout Structure Templates

**DON'T COPY:**
- ❌ Clients (they're YOUR clients)
- ❌ Client Workouts (specific to your clients)
- ❌ Scheduled Workouts (your calendar)
- ❌ Workout Logs (your athletes' logs)
- ❌ Google Calendar tokens (different per person)

### Implementation Code
```typescript
// src/lib/firebase/services/userBootstrap.ts

export async function bootstrapNewCoach(
  newCoachUid: string,
  sourceCoachUid: string  // Your UID
): Promise<void> {
  // Collections to copy (the templates/libraries)
  const collectionsToBootstrap = [
    'movements',
    'movementCategories',
    'workoutTypes',
    'workoutCategories',
    'workoutTemplates',
    'programs',
    'periods',
    'weekTemplates',
    'workoutStructureTemplates'
  ];

  // For each collection
  for (const collection of collectionsToBootstrap) {
    // Read from source: {collection}-{source-uid}
    const sourceCollection = `${collection}-${sourceCoachUid}`;
    const sourceSnapshot = await getDocs(
      collection(getDb(), sourceCollection)
    );

    // Write to new coach: {collection}-{new-coach-uid}
    const targetCollection = `${collection}-${newCoachUid}`;
    const batch = writeBatch(db);

    sourceSnapshot.docs.forEach(doc => {
      const targetRef = doc(getDb(), targetCollection, doc.id);
      batch.set(targetRef, doc.data());
    });

    await batch.commit();
  }

  console.log(`✅ Bootstrapped coach ${newCoachUid} with data from ${sourceCoachUid}`);
}
```

---

## 🔄 Implementation Impact

### Service Updates Required

**Before:**
```typescript
// src/lib/firebase/services/movements.ts
export async function getAllMovements() {
  const q = query(collection(getDb(), 'movements'), orderBy('name'));
  // ...
}
```

**After:**
```typescript
export async function getAllMovements(userId: string, environment: 'dev' | 'prod' = 'prod') {
  const collectionName = environment === 'dev' 
    ? 'dev-movements'
    : `movements-${userId}`;
  
  const q = query(collection(getDb(), collectionName), orderBy('name'));
  // ...
}
```

### All Services Need This Pattern
- movements.ts → `getAllMovements(userId, env)`
- programs.ts → `getAllPrograms(userId, env)`
- workoutTemplates.ts → `getAllTemplates(userId, env)`
- workoutTypes.ts → `getAllTypes(userId, env)`
- etc.

---

## 🚀 Implementation Phases - UPDATED

### Phase 1: Authentication (Week 1)
- [ ] Firebase Auth + Google Sign-in
- [ ] User profiles created
- [ ] Role-based access (admin, coach, client)
- [ ] Security rules (updated for user-owned collections)
- **Result:** Users can log in

### Phase 2: Data Segregation (Week 1-2)
- [ ] Migrate your current data to `movements-{your-uid}`, etc.
- [ ] Build bootstrap function for new coaches
- [ ] Create environment toggle for dev/prod
- [ ] Update all services with userId parameter
- **Result:** Data is segregated per-user

### Phase 3: Dev Environment (Week 2)
- [ ] Create dev-* collections for testing
- [ ] Implement dev mode toggle in UI
- [ ] Build promotion logic (dev → your prod)
- **Result:** Can test safely without affecting anyone

### Phase 4: Coach Onboarding (Week 2-3)
- [ ] Build "Add Coach" admin interface
- [ ] Implement bootstrap process
- [ ] Test data copying
- [ ] Verify isolation
- **Result:** Can add coaches with full data

### Phase 5: Multi-User Testing (Week 3)
- [ ] Test as multiple coaches
- [ ] Verify data isolation
- [ ] Test permissions
- [ ] Performance testing
- **Result:** Ready for production

---

## ✅ Success Criteria - CORRECTED

✅ Multiple coaches can log in  
✅ Each coach has their own complete data set  
✅ Coaches can't see each other's data  
✅ You can test in dev without affecting anyone  
✅ You can promote tested features to your production  
✅ Each coach can add/edit/delete in their copy independently  
✅ Bootstrap process copies your library when coach signs up  
✅ New coaches get your current library at signup time  
✅ Complete data isolation maintained forever after bootstrap  
✅ Admin can view/manage any coach's data if needed  

---

## 🔑 Key Differences from Previous Plan

| Aspect | Previous Plan | CORRECTED Plan |
|--------|---------------|-----------------|
| **Shared Catalogs** | Everyone reads from shared | No shared - everyone has copy |
| **Coach Updates** | Affect only that coach | Affect only that coach (same) |
| **Data Bootstrap** | N/A | Copy your library at signup |
| **Coach Adding Movements** | Would only be in their dataset | Would only be in their dataset (same) |
| **Your New Movements** | Automatically in shared catalog | Go to YOUR prod, coaches don't see unless invited |
| **Isolation** | Partial (shared catalogs) | Complete (everything copied) |
| **Simplicity** | Complex rules for shared access | Simpler rules (user owns collection) |

---

## 📝 Database Naming Examples

```
After Migration:

User: admin (you)
├─ movements-admin
├─ programs-admin
├─ clients-admin
├─ clientWorkouts-admin
└─ dev-movements (testing)

User: coach-alice
├─ movements-coach-alice (bootstrapped from admin)
├─ programs-coach-alice (bootstrapped from admin)
├─ clients-coach-alice
├─ clientWorkouts-coach-alice

User: coach-bob
├─ movements-coach-bob (bootstrapped from admin at later date)
├─ programs-coach-bob (bootstrapped from admin at later date)
├─ clients-coach-bob
├─ clientWorkouts-coach-bob
```

---

## 🎯 Next Steps with Corrected Model

1. **Review** this corrected architecture
2. **Confirm** this matches your vision
3. **Decide:**
   - User ID format: `uid`, `coach-name`, or just Firebase UID?
   - Which collections to bootstrap to new coaches?
   - Can coaches create clients, or do they get bootstrapped?
4. **Start Phase 1:** Authentication setup

---

*Document Status: CORRECTED & COMPLETE*  
*This now matches your intended model: each user owns their complete data copy*
