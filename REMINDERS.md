# PC+ App - Important Reminders

## 🔐 Firebase Security Rules - EXPIRES 2026-12-31

**Current Status:** The Firestore security rules are set to allow open read/write access until December 31, 2026.

**Location:** `firestore.rules`

**What this means:**
- Anyone with the Firebase project ID can read/write data
- This is fine for personal/internal use but NOT for public deployment
- Before going public, you MUST implement Firebase Authentication

### To Fix Before Public Launch:
1. Set up Firebase Authentication (Google Sign-in recommended)
2. Uncomment the auth-based rules in `firestore.rules`
3. Comment out/remove the temporary open access rule
4. Deploy rules: `firebase deploy --only firestore:rules`

### Quick Reference - Current Rule:
```javascript
// TEMPORARY - Remove before public launch
match /{document=**} {
  allow read, write: if request.time < timestamp.date(2026, 12, 31);
}
```

---

## 📅 Annual Check-In Reminders

### Before Each Year End:
- [ ] Review Firebase security rules expiration date
- [ ] Check Google Calendar API credentials/quotas
- [ ] Review any deprecated dependencies (`npm audit`)
- [ ] Clear old/unused data from Firestore if needed

---

## 🔧 Technical Debt to Address

### High Priority (Before Scaling)
- [ ] Implement Firebase Authentication
- [ ] Add proper security rules per collection
- [ ] Remove remaining `console.log` statements (~234 left in codebase)
- [ ] Replace remaining `alert()` calls with toast notifications (~29 left)

### Medium Priority (Performance)
- [ ] Add React.memo to heavy list item components
- [ ] Implement data caching for frequently accessed collections
- [ ] Consider pagination for large client/workout lists

#### React.memo Notes:
- Only add when you notice lag scrolling large lists (500+ items)
- Best candidates: client cards, workout rows, movement list items
- Use React DevTools Profiler to identify slow components first
- Don't add blindly - can cause stale data bugs if misapplied

#### Caching Notes:
- Firebase already caches locally by default
- Zustand stores hold data in memory during session
- Consider adding `staleTime` logic (don't re-fetch if loaded <5 min ago)
- Most valuable for: movements list, categories, week templates

### Low Priority (Nice to Have)
- [ ] Add offline support with Firebase persistence
- [ ] Implement image optimization for any uploaded assets
- [ ] Add bundle size analysis and optimization

### UI/UX Improvements to Revisit
- [ ] Week highlight indicators on builder page - consider adding a legend or tooltip explaining the blue (current week) vs purple (viewed week) highlighting
- [ ] Removing remaining `console.log` statements - there are ~234 left in the codebase that should be reviewed and removed before production
- [ ] Workout builder button click issues - there were issues with the Cancel/Save/X buttons at the top of the editor being hard to click. Fixed with z-index changes (z-20/z-30), but monitor for recurrence. If buttons still have issues, may need to investigate the WorkoutEditor component's rendered content overlapping the header.

---

## 🔑 API Keys & Credentials

### Google Calendar API
- **Console:** https://console.cloud.google.com
- **Project:** Check `.env.local` for `GOOGLE_CLIENT_ID`
- **Scopes:** Calendar read/write access
- **Refresh:** OAuth tokens auto-refresh, but check if issues arise

### Firebase
- **Console:** https://console.firebase.google.com
- **Config:** `src/lib/firebase/config.ts`
- **Hosting:** Uses Next.js SSR support

---

## 📝 Quick Commands

```bash
# Start development
npm run dev

# Deploy to Firebase Hosting
firebase deploy

# Deploy only Firestore rules
firebase deploy --only firestore:rules

# Check for security vulnerabilities
npm audit

# Update dependencies
npm update
```

---

## 🚨 If Something Breaks

1. **Firebase Access Denied:** Check if security rules expired
2. **Google Calendar Not Syncing:** Try clicking the sync button again (it auto-checks connection). If still broken, re-authenticate in App Config
3. **Build Errors:** Check for external project folders in workspace
4. **Styling Issues:** Clear browser cache, restart dev server
5. **"Async Client Component" Error:** This is a Next.js 16/Turbopack quirk. Click "Try Again" on the error page. See `TROUBLESHOOTING.md` for more details.

---

## 📋 Phase 2 Features (Planned)

### Google Calendar Integration - Phase 2
**Current Status:** Basic integration complete, Phase 2 features pending

**Phase 2 Features:**
- **Sync Frequency:** Automatic background sync (currently manual only)
  - Options: Every 5 minutes, Every 15 minutes, Every hour, Manual only
  - Location: Configure page → Calendar Settings → Sync Frequency
  - Implementation: Set up background job/service to periodically fetch calendar events

- **Google Account Email Display:** Show connected Google account email
  - Location: Configure page → Google Account Connection → Google Account Email
  - Implementation: Fetch user info from Google OAuth API after authentication
  - Currently shows placeholder: "your-email@gmail.com (Phase 2)"

**Phase 2 Implementation Notes:**
- Sync frequency requires:
  - Background service/worker to poll Google Calendar API
  - Consider using Firebase Cloud Functions or Next.js API routes with cron
  - Store last sync time in Firestore for tracking
  - Handle rate limiting (Google Calendar API has quotas)

- Google Account Email requires:
  - Call to `google.oauth2('v2').userinfo.get()` after OAuth
  - Store email in calendar config or user profile
  - Display in UI after successful connection

**Current Phase 1 Status:**
- ✅ Google Calendar OAuth connection working
- ✅ Manual calendar event fetching
- ✅ Calendar selection and sync status
- ✅ Event creation and modification
- ✅ Coaching/Class session keyword detection
- ⏳ Automatic sync (Phase 2)
- ⏳ Account email display (Phase 2)

---

## 🚀 Next Phase Planning

### Phase 3: Performance Optimization (Recommended Before Production)

**Current Status:** Quick wins implemented, medium/advanced optimizations pending

**✅ Completed (Quick Wins):**
- Request caching in Zustand stores (30-second deduplication)
- Parallel data loading on main pages (Schedule, Builder)
- Stores skip refetch if data is fresh and matches cached query

**⏳ Medium Effort Optimizations:**

1. **React Query / SWR Integration**
   - Replace manual caching with battle-tested solution
   - Benefits: automatic background revalidation, request deduplication, error retry
   - Estimated effort: 2-4 hours
   - Files to update: All stores and pages that fetch data

2. **Prefetch on Hover**
   - Load data when hovering over navigation links
   - Reduces perceived latency when clicking
   - Implementation: Add `onMouseEnter` handlers to nav links
   
3. **Zustand Persist Middleware**
   - Persist store data to localStorage between sessions
   - Faster initial load on return visits
   - Files: `useClientStore.ts`, `useProgramStore.ts`, `useCalendarStore.ts`

**🏗️ Production-Ready Optimizations:**

4. **Server Components + Streaming (Next.js 14+)**
   - Convert data-fetching to Server Components where possible
   - Stream UI to show content progressively
   - Reduces JavaScript bundle sent to client
   - Major refactor - consider for v2.0

5. **API Response Caching (Redis/Upstash)**
   - Server-side cache for Google Calendar API responses
   - Reduces API calls and improves reliability
   - Useful when multiple users share calendar data
   - Implementation: Add Redis to API routes

6. **Firebase Realtime Subscriptions**
   - Instead of polling/refetching, subscribe to Firestore changes
   - Real-time updates without manual refresh
   - Already partially implemented (`subscribeToPrograms`, `subscribeToClients`)
   - Expand to all collections that change frequently

**📊 Performance Monitoring:**
- Add web vitals tracking (Core Web Vitals)
- Consider: Vercel Analytics, Google Analytics 4, or custom tracking
- Monitor: LCP, FID, CLS, TTFB

### Phase 3 Additional Features
- **Multi-calendar support:** Allow syncing multiple Google Calendars
- **Calendar event templates:** Pre-configured event templates for common session types
- **Bulk event operations:** Create/modify multiple events at once
- **Event conflict detection:** Warn when events overlap
- **Recurring event management:** Better UI for managing recurring series
- **Calendar export:** Export schedule to other calendar formats (iCal, etc.)

### Phase 4+ Ideas
- **Client calendar sharing:** Allow clients to view their schedule
- **Mobile app:** Native mobile app for coaches and clients
- **Notifications:** Email/SMS reminders for upcoming sessions
- **Analytics:** Track session attendance, client progress metrics
- **Payment integration:** Link sessions to payment processing

---

*Last Updated: January 10, 2026*

