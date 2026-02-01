# Multi-User Data Separation Strategy

**Created:** January 21, 2026  
**Status:** Strategy Planning Phase  
**Goal:** Enable multiple users to log in with clear data separation between dev/prod environments

---

## 📋 Executive Summary

This document outlines the strategy to:
1. ✅ Enable multiple users to authenticate with their own profiles
2. ✅ Create clear separation between your development/testing data and user production data
3. ✅ Allow you to safely test new features on your profile before rolling them out to users
4. ✅ Manage two separate data environments within one Firebase project

---

## 🏗️ Current Architecture Review

### What We Have
- ✅ **Next.js + Firebase** - Modern framework with real-time database
- ✅ **Single Firebase Project** - `performancecoachapp-26bd1`
- ✅ **Firestore Collections** - Well-organized data structure
  - `movements` (shared catalog)
  - `movementCategories` (shared)
  - `clientWorkouts` (per-client workouts)
  - `workoutLogs` (per-client logs)
  - `programs` (per-client programs)
  - `scheduled-workouts` (calendar-based)
  - And more...

### Current Authentication Status
- ⚠️ **No user authentication yet** - Firestore rules allow open read/write until 2026-12-31
- ⚠️ **Single-user only** - All data appears to be for one user (you)
- ⚠️ **No data isolation** - Any user with the project ID can access everything

---

## 🎯 Three-Tier Architecture (Recommended)

We'll implement a three-tier system:

```
┌─────────────────────────────────────────────────────────────┐
│                     Firebase Project                         │
│           (performancecoachapp-26bd1)                       │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         ENVIRONMENT 1: YOUR DEVELOPMENT              │  │
│  │         (Testing new features, edits)                │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Collections with "dev" prefix or tag                 │  │
│  │ - dev-movements                                      │  │
│  │ - dev-clientWorkouts                                 │  │
│  │ - dev-programs                                       │  │
│  │ - dev-clients                                        │  │
│  │ (or use metadata: isDevMode: true)                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      ENVIRONMENT 2: PRODUCTION (FOR USERS)           │  │
│  │      (Stable, tested features only)                  │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Collections without prefix (normal)                  │  │
│  │ - movements                                          │  │
│  │ - clientWorkouts                                     │  │
│  │ - programs                                           │  │
│  │ - clients                                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      SHARED CATALOGS (Both environments)             │  │
│  │      (Movement templates, categories, etc)           │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ - movements (shared)                                 │  │
│  │ - movementCategories (shared)                        │  │
│  │ - workoutTypes (shared)                              │  │
│  │ - workoutCategories (shared)                         │  │
│  │ (Versioned with: version, lastUpdatedBy)             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Approach: Collection Prefixing vs. Metadata Tags

**Option A: Collection Prefixing** (Simpler)
```
dev-movements          ← Your dev version
movements              ← Shared/production version
dev-clientWorkouts     ← Your dev workouts
clientWorkouts         ← Production workouts for all users
```

**Option B: Metadata Field** (More flexible)
```
movements (single collection)
├─ doc1: { name: "Squat", version: 1, environment: "shared" }
├─ doc2: { name: "Bench", version: 1, environment: "shared" }
├─ doc3: { name: "Squat-V2", version: 2, environment: "dev", createdBy: "your-user-id" }

clientWorkouts (single collection)
├─ workout1: { clientId: "user1", date: "2026-01-20", environment: "prod" }
├─ workout2: { clientId: "you", date: "2026-01-20", environment: "dev" }
```

**Recommendation:** Start with **Option A (Collection Prefixing)** - it's clearer and easier to manage Firestore rules.

---

## 🔐 Security Rules Strategy

### Phase 1: Authentication (Immediate)
```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isOwner(userId) {
      return request.auth.uid == userId;
    }
    
    function isAdmin() {
      return request.auth.uid == 'your-user-id-here';
    }
    
    // Dev collections - admin only
    match /dev-{collection} {
      allow read, write: if isAdmin();
    }
    
    // Production collections
    match /movements { allow read: if isAuthenticated(); }
    match /movementCategories { allow read: if isAuthenticated(); }
    match /workoutTypes { allow read: if isAuthenticated(); }
    
    // User-specific data
    match /clients/{clientId} {
      allow read, write: if isOwner(clientId) || isAdmin();
    }
    
    match /clientWorkouts/{docId} {
      allow read, write: if 
        isAuthenticated() && 
        (resource.data.clientId == request.auth.uid || isAdmin());
    }
    
    // ... more collections following this pattern
  }
}
```

---

## 👥 User Management Architecture

### User Profile Structure
```typescript
// Firestore collection: users/{uid}
interface UserProfile {
  uid: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  role: 'admin' | 'coach' | 'client';
  environment: 'dev' | 'prod';    // Which environment they access
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // For users (non-admin)
  assignedCoach?: string;         // Your UID if they're your client
  canSync?: boolean;              // Calendar sync permission
}
```

### User Roles
- **Admin (You):** 
  - Access to both `dev-*` and production collections
  - Can create/edit for other users
  - Can push dev changes to prod
  - See all data

- **Coach (Users you manage):**
  - Access to production collections only
  - Can only modify their own client data
  - Can sync calendars
  - Cannot see dev environment

- **Client:**
  - Access to their own workouts only
  - Read-only for most things
  - Can log workouts

---

## 📊 Data Flow Strategy

### Your Workflow (Dev → Prod)
```
1. You log in as Admin
   ↓
2. App shows "DEV MODE" toggle in header
   ↓
3. Toggle ON → access dev-* collections
4. Toggle OFF → access prod collections
   ↓
5. Create/test movements in dev-movements
   ↓
6. Test workouts with dev-clients, dev-clientWorkouts
   ↓
7. Once tested and happy → "Promote to Production" button
   ↓
8. System copies from dev-* to production collections
   ↓
9. Other users see the new version
```

### User Workflow (Direct to Prod)
```
1. User signs up / logs in
   ↓
2. App identifies them as "coach" or "client"
   ↓
3. Shows only production data
   ↓
4. Creates their own clients, workouts in production
   ↓
5. You (admin) can see their data
```

---

## 🔄 Implementation Phases

### Phase 1: Authentication Foundation (Week 1)
- [ ] Implement Firebase Authentication (Google Sign-in)
- [ ] Create user profile structure
- [ ] Add role-based access control
- [ ] Update Firestore rules for auth
- [ ] Create simple login/logout UI

**Time:** 2-3 days  
**Difficulty:** Medium  
**Priority:** HIGHEST - Everything else depends on this

---

### Phase 2: Dev/Prod Separation (Week 1-2)
- [ ] Create dev-* collections (copy existing data)
- [ ] Add dev mode toggle to UI
- [ ] Update all Firestore queries to use correct collection
- [ ] Create "Promote" utility to move data from dev to prod

**Time:** 2-3 days  
**Difficulty:** Medium-High  
**Priority:** HIGH

---

### Phase 3: Multi-User Data Isolation (Week 2)
- [ ] Update all queries to filter by `clientId` or owner
- [ ] Add user context to all Firestore operations
- [ ] Create permission checks on client/workout access
- [ ] Test with multiple login accounts

**Time:** 3-4 days  
**Difficulty:** Medium-High  
**Priority:** HIGH

---

### Phase 4: Sync & Promotion System (Week 2-3)
- [ ] Create "Sync from Dev to Prod" interface
- [ ] Build version tracking system
- [ ] Create audit logs for who changed what
- [ ] Build rollback capability

**Time:** 2-3 days  
**Difficulty:** High  
**Priority:** MEDIUM

---

### Phase 5: Testing & Refinement (Week 3)
- [ ] Test with multiple simultaneous users
- [ ] Test permission boundaries
- [ ] Test sync/promotion workflows
- [ ] Performance testing

**Time:** 2-3 days  
**Difficulty:** Medium  
**Priority:** MEDIUM

---

## 💾 Data Migration Plan

### Current Situation
- All your data is currently in "production" collections
- No user IDs associated with data (single-user mode)

### Migration Strategy

**Step 1: Create your admin profile**
```
users/{your-uid}
{
  uid: "your-auth-uid",
  email: "your@email.com",
  role: "admin",
  environment: "both"
}
```

**Step 2: Tag existing data**
- Add `clientId: "your-uid"` to existing documents
- Add `createdBy: "your-uid"` to existing documents
- Add `version: 1` to all shared collections

**Step 3: Duplicate to dev collections** (one-time)
```bash
# Pseudocode - actual implementation in migration script
for each collection:
  if collection is data (not shared):
    create dev-{collection}
    copy all docs from {collection} to dev-{collection}
  else:
    # shared catalogs stay as-is
```

**Step 4: Remaining users migrate to prod**
- Keep production collections as-is for future users
- They'll start fresh or you'll manually add their data

---

## 🛠️ Technical Implementation Details

### 1. Add Environment Context Provider

```typescript
// lib/context/EnvironmentContext.tsx
interface EnvironmentContextType {
  environment: 'dev' | 'prod';
  setEnvironment: (env: 'dev' | 'prod') => void;
  isAdmin: boolean;
}

export const EnvironmentContext = createContext<EnvironmentContextType | null>(null);
```

### 2. Update Collection Names Dynamically

```typescript
// lib/firebase/collections.ts
export function getCollectionName(
  baseCollection: string,
  environment: 'dev' | 'prod' = 'prod'
): string {
  if (environment === 'dev') {
    return `dev-${baseCollection}`;
  }
  return baseCollection;
}

// Usage
const movementsCollection = getCollectionName('movements', environment);
const q = query(collection(db, movementsCollection), ...);
```

### 3. Update All Services

Currently:
```typescript
// src/lib/firebase/services/movements.ts
export async function getAllMovements() {
  const q = query(collection(getDb(), 'movements'), ...);
  // ...
}
```

Updated:
```typescript
export async function getAllMovements(environment: 'dev' | 'prod' = 'prod') {
  const collectionName = getCollectionName('movements', environment);
  const q = query(collection(getDb(), collectionName), ...);
  // ...
}
```

### 4. Add User Context to Components

```typescript
// Before
const movements = await getAllMovements();

// After
const { environment } = useEnvironment();
const movements = await getAllMovements(environment);
```

---

## 🎨 UI Changes Required

### 1. Add Dev Mode Indicator
- Small toggle in header: "DEV / PROD"
- Visual indicator (different colors, "DEV" badge)
- Only visible when admin + dev mode available

### 2. Add Role Badge
- Show user's role (Admin, Coach, Client)
- Show which user is logged in
- Quick access to settings/account

### 3. Promotion Interface
```
┌─────────────────────────────────────┐
│ Ready to Release?                   │
├─────────────────────────────────────┤
│ Changes in DEV:                     │
│ • 5 new movements                   │
│ • 3 updated programs                │
│ • 2 new workout templates           │
│                                     │
│ [Preview Changes] [Promote to Prod] │
└─────────────────────────────────────┘
```

---

## ⚠️ Important Considerations

### 1. **Shared Catalogs**
- Don't duplicate shared catalogs (movements, categories)
- Keep single version for all users
- Add version tracking and history
- Changes affect everyone - be careful!

### 2. **Calendar Sync**
- Each user will have their own Google Calendar OAuth
- Token storage already supports this (`userId` field in `StoredTokens`)
- Sync only their own workouts

### 3. **Performance**
- Dev-prefixed collections: minimal impact (you're only user)
- Queries: add `where` clauses for user isolation
- Index management: Firestore auto-creates as needed

### 4. **Costs**
- More collections = slightly more storage
- Same read/write costs (not multiplied)
- Estimated: 10-15% increase in Firestore storage

### 5. **Backup/Recovery**
- Implement export capability before launch
- Regular exports of important data
- Version tracking for rollbacks

---

## 📱 Implementation Checklist

### Pre-Implementation
- [ ] Review this document with any team members
- [ ] Decide on Option A (Collection Prefixing) or Option B (Metadata)
- [ ] Backup current Firestore data
- [ ] Schedule 4-week sprint

### Phase 1: Authentication
- [ ] Install Firebase Auth UI components
- [ ] Add Google OAuth setup
- [ ] Create user profile collection
- [ ] Implement role system
- [ ] Update Firestore rules

### Phase 2: Dev/Prod Separation
- [ ] Create dev-* collections
- [ ] Build migration scripts
- [ ] Add environment context
- [ ] Update all services
- [ ] Add UI toggle

### Phase 3: Multi-User Isolation
- [ ] Update all queries with user filters
- [ ] Implement permission checks
- [ ] Test with multiple accounts
- [ ] Verify data isolation

### Phase 4: Sync System
- [ ] Build promotion interface
- [ ] Create sync logic
- [ ] Add version tracking
- [ ] Implement rollback

### Phase 5: Testing
- [ ] Multi-user testing
- [ ] Permission boundary testing
- [ ] Performance testing
- [ ] Calendar sync testing

---

## 🚀 Success Criteria

✅ Multiple users can log in with individual accounts  
✅ Each user sees only their own data  
✅ You can test changes in dev environment without affecting users  
✅ You can promote tested changes to production  
✅ Calendar sync works per-user  
✅ Clear separation between dev and prod data  
✅ Admin can view/manage any user's data  
✅ Non-admin users cannot see dev environment  
✅ Shared catalogs maintain single source of truth  
✅ All operations fast and efficient  

---

## 📖 Next Steps

1. **Review** this strategy with your preferences
2. **Decide** on approach (Collection Prefix vs Metadata)
3. **Start Phase 1** - Authentication is the foundation
4. **Use this document** as implementation guide

---

## Questions to Clarify

1. Should calendar sync be per-user or centralized?
2. Do you want all users to see shared movements, or curated lists per user?
3. Should users be able to create their own movements, or only coaches?
4. What's your expected user count in first 6 months?
5. Do you need user invitations, or sign-up freely?

---

*Document Status: DRAFT - Ready for review and feedback*  
*Last Updated: 2026-01-21*
