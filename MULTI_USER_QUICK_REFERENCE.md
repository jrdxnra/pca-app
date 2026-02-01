# Multi-User Strategy - Quick Reference

**Last Updated:** January 21, 2026

---

## 🎯 The Big Picture

```
BEFORE (Current):
  Your PC+ App
  └─ All data in one place
  └─ Anyone with project ID can access

AFTER (Goal):
  Your PC+ App
  ├─ YOU (Admin)
  │  ├─ Dev Environment (testing)
  │  └─ Prod Environment (stable)
  │
  ├─ USER 1 (Coach)
  │  └─ Prod Environment only
  │  └─ Their own clients & workouts
  │
  ├─ USER 2 (Coach)
  │  └─ Prod Environment only
  │  └─ Their own clients & workouts
  │
  └─ Shared Catalogs (everyone)
     ├─ Movements
     ├─ Categories
     └─ Workout Types
```

---

## 📊 Key Concepts

### Dev vs Prod
| Aspect | Dev (You) | Prod (Everyone) |
|--------|-----------|-----------------|
| **Collections** | `dev-movements`, `dev-clientWorkouts`, etc | `movements`, `clientWorkouts`, etc |
| **Purpose** | Test new features | Live data for real users |
| **Access** | Admin only | Authenticated users |
| **Data** | Your test data | All users' real data |

### User Roles
| Role | Access | Can See | Can Edit |
|------|--------|---------|----------|
| **Admin** (You) | Dev + Prod | Everything | Everything |
| **Coach** (Users) | Prod only | Their clients/workouts | Their data |
| **Client** | Prod only | Their workouts | Minimal (log workouts) |

---

## 🔐 Security Model

### Three-Level Security
```
Level 1: Authentication
  └─ Are you logged in? → YES/NO

Level 2: Role-Based
  └─ Are you admin/coach/client? → Determines access

Level 3: Data Ownership
  └─ Do you own this data? → Can read/write
```

### Firestore Rules Pattern
```
if isAuthenticated() && (isOwner(data) || isAdmin()) → allow
```

---

## 📁 Collection Structure After Migration

```
Firestore Project (performancecoachapp-26bd1)
│
├─ users/
│  ├─ your-uid: { role: admin, ... }
│  ├─ coach-1-uid: { role: coach, ... }
│  └─ coach-2-uid: { role: coach, ... }
│
├─ SHARED (all users can read, admin can write)
│  ├─ movements/
│  ├─ movementCategories/
│  ├─ workoutTypes/
│  └─ workoutCategories/
│
├─ PRODUCTION (users' real data)
│  ├─ clients/          ← per-user clients
│  ├─ clientWorkouts/   ← per-user workouts
│  ├─ programs/         ← per-user programs
│  ├─ scheduled-workouts/
│  ├─ workoutLogs/      ← per-user logs
│  └─ (others)
│
└─ DEVELOPMENT (your testing - admin only)
   ├─ dev-clients/
   ├─ dev-clientWorkouts/
   ├─ dev-programs/
   ├─ dev-scheduled-workouts/
   ├─ dev-workoutLogs/
   └─ (others)
```

---

## 🔄 Your Workflow

### Daily Development
```
1. Login as Admin
2. See "DEV | PROD" toggle in header
3. Toggle = DEV
4. Make changes (tests, new features)
5. All changes go to dev-* collections
6. Other users unaffected ✅
```

### When Ready to Release
```
1. Test everything in DEV
2. Click "Ready for Production"
3. Review changes
4. Click "Promote to Prod"
5. Changes sync to production collections
6. All users see updates 🚀
```

---

## 🛠️ Implementation Phases

```
PHASE 1 (Week 1): Authentication
├─ Firebase Auth setup
├─ Google Sign-in
├─ User profiles created
└─ Security rules enabled
RESULT: Users can log in

PHASE 2 (Week 1-2): Dev/Prod Separation  
├─ Create dev-* collections
├─ Migrate your data
├─ Update services
└─ Add UI toggle
RESULT: You have dev & prod environments

PHASE 3 (Week 2): Data Isolation
├─ Add user filters to queries
├─ Implement permission checks
└─ Multi-user testing
RESULT: Users only see their data

PHASE 4 (Week 2-3): Sync System
├─ Build promotion interface
├─ Version tracking
└─ Rollback capability
RESULT: Can safely promote to prod

PHASE 5 (Week 3): Testing & Polish
├─ Comprehensive testing
├─ Performance optimization
└─ Documentation
RESULT: Ready for launch
```

---

## 💾 Data Migration Strategy

### Before Phase 2 Starts (One-time)

```bash
# Step 1: Get your Firebase UID
# After first login, go to Firebase Console
# Authentication → Users → Copy your UID

# Step 2: Backup current data
firebase firestore:export gs://performancecoachapp-26bd1-backup

# Step 3: Update Firestore rules with your UID
# firestore.rules → Replace REPLACE_WITH_YOUR_UID

# Step 4: Deploy rules
firebase deploy --only firestore:rules

# Step 5: Run migration script
# Creates dev-* collections, copies your data
npm run migrate:create-dev-environment
```

### Migration Script (To Create)
```bash
# src/scripts/migrate-to-dev.ts
# Function: Copy all collections to dev-* versions
# Only runs if authenticated as admin
```

---

## ✅ Success Checkpoints

After Phase 1: ✅ Users can log in  
After Phase 2: ✅ You have dev and prod environments  
After Phase 3: ✅ Multiple users can use the app simultaneously  
After Phase 4: ✅ You can test and release updates safely  
After Phase 5: ✅ Ready for real users  

---

## 🚨 Important Notes

### 1. Shared Catalogs
- **Never** create `dev-movements` or `dev-movementCategories`
- Keep single version for all users
- Changes affect everyone → test carefully!

### 2. Your Admin UID
- Get after first login
- Required for Firestore rules
- Document and save it

### 3. Current Data
- All currently in "production" collections
- Will move to dev-* in Phase 2
- New users will start with empty prod collections

### 4. Google Calendar
- Each user has their own OAuth token
- System already supports this (see `token-storage.ts`)
- Works automatically once auth is set up

### 5. Testing
- Use 2+ Google accounts to test
- Verify one user can't see another's data
- Test calendar sync per-account

---

## 📞 Quick Decision Checklist

Before Phase 1 starts, decide:

- [ ] Collection Prefixing (`dev-*`) ← **RECOMMENDED**
  - OR Metadata field approach
  
- [ ] Current data handling:
  - [ ] Move to dev-* (start prod fresh)
  - OR Keep in prod (users can see it)
  
- [ ] User roles needed:
  - [ ] Admin (you)
  - [ ] Coach (users who create programs)
  - [ ] Client (users who log workouts)
  
- [ ] Calendar sync:
  - [ ] Per-user (each user their own calendar)
  - OR Centralized (all sync to one calendar)
  
- [ ] User invitation:
  - [ ] Open signup
  - OR Admin invites only
  
- [ ] Shared catalogs:
  - [ ] All users see all movements
  - OR Curated per user

---

## 🎯 Next Steps

### Immediate
1. ✅ Review this document
2. ✅ Review main strategy document
3. ✅ Review implementation roadmap
4. ⏭️ Answer decision checklist questions

### Phase 1 (Start ASAP)
1. Implement authentication
2. Create user profiles
3. Update Firestore rules
4. Test login/logout

### Phase 2 (After Phase 1 complete)
1. Get your Firebase UID
2. Create dev-* collections
3. Migrate data
4. Update all services

### Phase 3+ (Follow roadmap)
1. Add user filters
2. Build UI
3. Test everything
4. Launch!

---

## 📚 Related Documents

- **MULTI_USER_SEPARATION_STRATEGY.md** → Full strategy & architecture
- **MULTI_USER_IMPLEMENTATION_ROADMAP.md** → Detailed implementation steps
- **firestore.rules** → Security rules (will be updated)
- **.env.local** → Firebase config

---

## 💡 Key Principles

✅ **Principle 1:** Clear separation between dev and prod  
✅ **Principle 2:** Users only see their own data  
✅ **Principle 3:** You (admin) can see and manage everything  
✅ **Principle 4:** Shared catalogs stay unified  
✅ **Principle 5:** Easy promotion from dev to prod  

---

*Last Updated: 2026-01-21*  
*Status: READY TO IMPLEMENT*
