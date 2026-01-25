# Multi-User Architecture - Current Understanding (Session 1)

**Date:** January 21, 2026  
**Status:** Architecture Planning Complete - Ready for Next Chat  
**Last Updated:** Session 1 Conclusion

---

## 🎯 Overall Vision

**Goal:** Enable multiple coaches to use the PC+ app, each with their own complete, independent data environment, while you maintain a dev/prod separation for safe testing.

```
YOU (Admin)
├─ Dev Environment (testing new features)
├─ Production Environment (your stable library)
└─ Full access to everything

COACH (Independent)
├─ Gets bootstrap copy of your library at signup
├─ Complete independence after that
├─ Own movements, programs, clients, workouts
└─ You don't see their additions (unless invited)

COACH 2 (Independent)
├─ Gets bootstrap copy of YOUR CURRENT library
├─ Completely separate from Coach 1
├─ Their own everything
└─ Independent from day one
```

---

## ✅ DECISIONS MADE

### 1. Data Ownership Model (FINAL)
**Each user owns complete, independent data copies**

- NOT a shared catalog model
- Each user gets their own collections
- Bootstrap: Coach gets copy of your library at signup
- After bootstrap: Complete independence forever
- You maintain control of your data, coaches control theirs

### 2. Collection Prefixing (FINAL)
**Use collection name prefixing: `{collection}-{uid}`**

Examples:
```
movements-your-uid
movements-coach1-uid
programs-your-uid
programs-coach1-uid
clientWorkouts-your-uid
clientWorkouts-coach1-uid

dev-movements (admin only, testing)
dev-programs (admin only, testing)
dev-clients (admin only, testing)
```

**Why:** Cleaner permissions, clearer at Firestore level, simpler rules

---

### 3. Current Data Migration (DECIDED)
**Move current data to PRODUCTION collections (not dev)**

Current:
```
movements ← 60+ items
programs ← 15+ items  
clients ← your clients
clientWorkouts ← your workouts
```

Becomes:
```
movements-{your-uid} ← your production library
programs-{your-uid} ← your production library
clients-{your-uid} ← your clients
clientWorkouts-{your-uid} ← your workouts
```

**Why:** Your current library is solid and tested - coaches should get it as baseline

### 4. User Roles (DECIDED)
**Three roles: Admin, Coach, Client**

| Role | Purpose | Permissions |
|------|---------|-------------|
| **Admin (You)** | Manage system, test features | Everything in every collection |
| **Coach (Users)** | Manage own clients, create programs | Read/write own collections only |
| **Client** | Log workouts, view schedule | Read/write their own workout logs |

---

### 5. Calendar Sync (DECIDED)
**Each coach has independent setup**

- Coach sets up their own Google Calendar OAuth
- Stores their own token in Firestore
- Runs sync independently (like you do)
- Gets their own `scheduled-workouts-{coach-uid}`
- Metadata (coach name, last sync) displayed on scheduler modal
- Completely separate from your calendar
- You don't manage their setup

---

## ✅ CRITICAL DECISIONS - SESSION 2 (NOW LOCKED IN)

### 1. Admin Access (FINAL) ✅
**You have FULL ACCESS for debugging**

- Can see all coach data in their collections
- Can edit coach data to fix issues
- Can view/access anything needed for troubleshooting
- Firestore rules: `if (isAdmin) return true;`

**Why:** Critical for debugging, support, and fixing issues

---

### 2. Collection Naming (FINAL) ✅
**Use HUMAN-READABLE names (easier for debugging)**

Format: `{collection}-{uid}` with human display

Examples:
```
movements-alice (Firebase UID, but displays as "Alice")
movements-coach-bob
programs-sarah
clients-coach-alex
```

**Why:** When debugging in Firestore console, you can see at a glance which coach owns what data. Much clearer than random UIDs.

---

### 3. Coach Onboarding (FINAL) ✅
**Direct signup with admin approval (most professional)**

Flow:
```
1. Coach visits app → clicks "Sign Up"
2. Coach signs in with Google
3. System shows them as "Pending Approval"
4. You (admin) approve in admin panel
5. System automatically bootstraps their library
6. Coach gets access to all your movements/programs
```

**Why:** Feels professional and industry-standard. They can self-serve, you maintain control.

---

### 4. Calendar Sync (FINAL) ✅
**In-app OAuth setup (already decided)**

- Coach clicks "Connect Calendar"
- Google OAuth popup in app
- Tokens stored securely
- Completely independent per coach

---

### 5. Client Management (FINAL) ✅
**Coaches create their own clients, you can see for debugging**

- Coaches create & manage their own clients
- You (admin) can view all coach clients for support
- Clients are isolated to their coach's collections
- You don't modify them unless fixing issues

---

## 🔄 Remaining Questions (Optional, Lower Priority)

These don't block Phase 1 but can clarify design:

- **Dev Workflow:** When you test, do you copy whole features or small pieces?
- **Coach Data Independence:** After bootstrap, should coaches be able to update to your newer versions of movements?
- **Admin Capabilities:** Can you force re-bootstrap a coach?
- **Sharing:** Future - should coaches be able to share movements with each other?
- **Analytics:** Want reports across all coaches, or just individual?

---

## 📁 Collection Structure (Final Plan)

```
Firestore Collections After Migration:

users/ ← New (for all user profiles)
├─ {your-uid}
├─ {coach1-uid}
├─ {coach2-uid}
└─ ...

movements-{your-uid}
movements-{coach1-uid}
movements-{coach2-uid}

programs-{your-uid}
programs-{coach1-uid}
programs-{coach2-uid}

clients-{your-uid}
clients-{coach1-uid}
clients-{coach2-uid}

clientWorkouts-{your-uid}
clientWorkouts-{coach1-uid}
clientWorkouts-{coach2-uid}

workoutLogs-{your-uid}
workoutLogs-{coach1-uid}
workoutLogs-{coach2-uid}

scheduled-workouts-{your-uid}
scheduled-workouts-{coach1-uid}
scheduled-workouts-{coach2-uid}

workoutTemplates-{your-uid}
workoutTemplates-{coach1-uid}
workoutTemplates-{coach2-uid}

[Other collections follow same pattern]

--- DEV ONLY (Admin testing) ---
dev-movements
dev-programs
dev-clients
dev-clientWorkouts
dev-workoutLogs
dev-scheduled-workouts
dev-workoutTemplates
[etc]
```

---

## 🔐 Security Model (Architecture)

### Firestore Rules Pattern (Simplified)
```firestore
// Admin-only dev collections
match /dev-{collection=**} {
  allow read, write: if isAdmin();
}

// User-owned collections
match /{collection}-{uid}/{doc=**} {
  allow read, write: if isOwner(uid) || isAdmin();
}

// Helper functions
function isAdmin() { return request.auth.uid == ADMIN_UID; }
function isOwner(uid) { return request.auth.uid == uid; }
```

---

## 🔄 Bootstrap Process (Defined)

### When New Coach Signs Up
```
1. Coach signs in with Google OAuth
   ↓
2. System creates user profile
   ↓
3. BOOTSTRAP: Copy these collections
   ├─ movements-{your-uid} → movements-{coach-uid}
   ├─ programs-{your-uid} → programs-{coach-uid}
   ├─ workoutTemplates-{your-uid} → workoutTemplates-{coach-uid}
   ├─ [other template collections]
   └─ NOT copied: clients, workouts, logs, schedules (they start fresh)
   ↓
4. Coach can now:
   ├─ See your 60+ movements
   ├─ See your programs
   ├─ Use them to create their own workouts
   ├─ Add their own movements
   ├─ Create their own clients
   └─ Manage everything independently
   ↓
5. From this point: COMPLETE INDEPENDENCE
   ├─ Your changes don't affect them
   ├─ Their changes don't affect you
   ├─ Separate collections forever
```

---

## 📊 Your Daily Workflows (Expected)

### Workflow 1: Test New Feature (You)
```
1. Toggle: DEV mode ON
2. Create movement in dev-movements
3. Test with dev-clients, dev-programs
4. When happy: PROMOTE to movements-{your-uid}
5. Coaches unaffected (completely separate)
```

### Workflow 2: Add New Coach
```
1. Invite coach via email
2. Coach signs in (first time)
3. System automatically bootstraps library
4. Coach gets all your movements, programs
5. Coach starts adding own clients, workouts
6. You never see their changes (separate collections)
```

### Workflow 3: Support/Help
```
1. Coach has question or problem
2. You access their collection (if permission allows)
3. View their data
4. Potentially fix/help (if permission allows)
5. Coach continues independently
```

---

## 📋 Phase 1 Plan (Next Session)

**Phase 1: Authentication Foundation**

When ready to start implementation:

### Tasks
1. Set up Firebase Authentication (Google Sign-in)
2. Create user profiles in Firestore
3. Implement role-based access control
4. Update Firestore security rules
5. Create login/logout UI components
6. Protect routes requiring authentication

### Code to Create
- `src/lib/context/AuthContext.tsx`
- `src/lib/hooks/useAuth.ts`
- `src/lib/types/user.ts`
- `src/lib/firebase/services/userProfile.ts`
- `src/components/auth/LoginButton.tsx`
- `src/components/auth/LogoutButton.tsx`
- `src/components/auth/ProtectedRoute.tsx`
- Updated `firestore.rules`
- Updated `src/app/layout.tsx`

### Expected Outcome
- Users can log in with Google
- User profiles created automatically
- Routes protected by authentication
- Firestore rules enforce permissions

---

## 🗂️ Documentation Created This Session

1. **MULTI_USER_CORRECTED_ARCHITECTURE.md** - Full architecture details
2. **ARCHITECTURE_COMPARISON.md** - Original vs corrected model
3. **ARCHITECTURE_CLARIFICATION_QUESTIONS.md** - Pending decisions (40+ questions)
4. **MULTI_USER_SEPARATION_STRATEGY.md** - First attempt (partly superseded)
5. **MULTI_USER_IMPLEMENTATION_ROADMAP.md** - Phase breakdown (partly superseded)
6. **MULTI_USER_QUICK_REFERENCE.md** - Quick lookup (partly superseded)
7. **This file** - Current understanding summary

---

## 🚀 For Next Chat - What to Review

**Start new chat with:**

```
## Current Understanding - Session 1 Complete

### DECIDED ✅
- User-owned data copies (not shared catalogs)
- Collection prefixing: {collection}-{uid}
- Current data → production collections
- Three roles: Admin, Coach, Client
- Independent calendar sync per coach

### PENDING ⏳
- Admin access to coach data? (See/edit/read-only?)
- Collection naming format? (UID vs human-readable)
- Dev workflow details?
- Coach onboarding process?
- Coach data independence rules?
- Admin capabilities?
- Client management?

### READY TO START
- Phase 1: Authentication (when you say go)
- All architecture decided
- All code structure planned

### FILES TO REFERENCE
- MULTI_USER_CORRECTED_ARCHITECTURE.md (main doc)
- ARCHITECTURE_CLARIFICATION_QUESTIONS.md (pending items)
- ARCHITECTURE_COMPARISON.md (why this model)
```

---

## 🎯 Session 2 Status

**CRITICAL 5 DECISIONS:** ✅ ALL LOCKED IN
- Admin Access: FULL ACCESS (can debug/fix anything)
- Collection Names: HUMAN-READABLE (for easy debugging)
- Onboarding: DIRECT SIGNUP + ADMIN APPROVAL (professional)
- Calendar Sync: IN-APP OAUTH (already confirmed)
- Client Management: COACHES CREATE, YOU CAN VIEW (for support)

**OPTIONAL QUESTIONS:** Can refine during implementation if needed
- Dev workflow details
- Coach data independence rules
- Admin-specific capabilities
- Future sharing features

**READY:** Phase 1 Implementation can start now!

---

## 📝 Git Commit Info

**Commit:** Multi-user architecture planning complete

**Files Added:**
- MULTI_USER_CORRECTED_ARCHITECTURE.md
- ARCHITECTURE_COMPARISON.md
- ARCHITECTURE_CLARIFICATION_QUESTIONS.md
- MULTI_USER_SEPARATION_STRATEGY.md
- MULTI_USER_IMPLEMENTATION_ROADMAP.md
- MULTI_USER_QUICK_REFERENCE.md

**Files Modified:**
- README updates (if any)

**Status:** Ready for Phase 1 implementation when you confirm pending decisions

---

*Session 1 Complete - Ready for Session 2 Implementation*
