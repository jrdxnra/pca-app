# Secondary Calendar Onboarding Guide

**Last Updated:** March 2, 2026

This guide standardizes how we onboard any coach (or tester) using a dedicated secondary Google account that has access to their work calendar. The process enforces privacy, keeps production data untouched during development, and guarantees that PCA interacts only with the shared calendar rather than corporate Google accounts.

---

## 1. Environment Roles & Expectations

| Lane | Purpose | Google Account Used | Calendar Scope |
| --- | --- | --- | --- |
| **Dev (DEC Sandbox)** | Rapid iteration, feature flags, mock data allowed | `dec+pca@…` secondary Gmail | Shared view of DEC work calendar |
| **Admin Validation** | Production backend verification without coach impact | `admin+pca@…` secondary Gmail | Shared view of Admin work calendar |
| **Coach Rollout** | Full production usage | `coachname+pca@…` secondary Gmail | Shared view of coach work calendar |

**Promotion Rule:** No feature reaches coaches until the Admin lane signs off using the exact build and configuration destined for production.

---

## 2. Prerequisites

1. **Secondary Gmail created** for the tester/coach (naming convention: `<primary-username>+pca@gmail.com`).
2. **Work calendar share** granted from the corporate Google account to the secondary Gmail with "Make changes to events" permission.
3. **OAuth credentials** in Google Cloud Console include the PCS redirect URIs for both staging and production.
4. **Feature flag / config entry** identifying which calendar IDs are enabled in each lane (e.g., `DEC_CALENDAR_ID`, `ADMIN_CALENDAR_ID`).

---

## 3. Step-by-Step Onboarding

### Step 1 – Create or Verify the Secondary Account
- Log into Google with the secondary Gmail and confirm basic access (Gmail, Calendar).
- Add recovery phone + 2FA to avoid future security prompts.
- Record the account info in the secure credential tracker (1Password / Secrets Manager).

### Step 2 – Share the Work Calendar
From the **work account**:
1. Open Google Calendar → hover the target calendar → `Settings and sharing`.
2. Under "Share with specific people" add the secondary Gmail.
3. Set permission to **Make changes to events**.
4. Save; Google sends an invite to the secondary account (accept it).

### Step 3 – Confirm Visibility & API Access
From the **secondary account**:
1. Open Google Calendar; ensure the work calendar appears under "Other calendars" (toggle it on).
2. In the browser console (or via `curl`) call `https://www.googleapis.com/calendar/v3/users/me/calendarList` using the PCA OAuth client to confirm the shared calendar ID shows up.
3. Note the calendar ID (`<corp-domain>_random@group.calendar.google.com`); store it in the per-lane config map.

### Step 4 – Connect to PCA (Per Lane)
- **Dev Lane:**
  - Add the calendar ID to `.env.local` (`NEXT_PUBLIC_DEV_CALENDAR_ID`).
  - Authenticate in the app using the secondary account; verify the calendar picker lists the shared calendar. 
  - Run the end-to-end flow (event fetch, extendedProperties write, client matching).
- **Admin Lane:**
  - Deploy/flag the build to staging.
  - Admin repeats the auth + picker steps; ensure metadata updates succeed against the real backend.
  - Capture sign-off in STATUS_CHECK_SUMMARY.md.
- **Coach Lane:**
  - Provide the coach with this guide plus a checklist in Notion/Email.
  - After they log in with the secondary account and pick their shared calendar, monitor logs for the first sync window.

### Step 5 – Add / Import Clients (After Calendar Sync)
1. Launch the in-app **Setup Hub** (auto-opens on Schedule) and confirm the calendar checkpoint is complete.
2. Switch the hub to the **Clients** tab (or just open the Clients page) and click **Add Client**.
3. Enter at least Name + Email for each athlete. The matching engine can’t bind events until the roster exists.
4. For bulk onboarding, send your CSV to HQ or use the admin import helper.
5. Revisit the Setup Hub review gate; once it shows both steps complete, dismiss it and continue to workouts.

### Step 6 – Metadata & Migration (If Coming from Personal Dupes)
1. Run the migration script that copies `extendedProperties.shared/private` from personal duplicates back to the original work events (once per calendar).
2. Disable any legacy Apps Script triggers to prevent duplicate events.
3. Verify the PCA app shows the same metadata for an event before and after migration.

---

## 4. Acceptance Checklist

- [ ] Secondary Gmail has 2FA + recovery info.
- [ ] Work calendar shared with "Make changes to events" permissions.
- [ ] Calendar ID recorded in the environment config.
- [ ] PCA OAuth login succeeds with the secondary account.
- [ ] Calendar picker shows the shared work calendar and fetches events.
- [ ] PCA can write/read `extendedProperties` on that calendar.
- [ ] Admin lane sign-off logged before enabling coaches.

---

## 5. Troubleshooting

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| Shared calendar missing in picker | Calendar not shared or permissions downgraded | Re-share from work account with "Make changes" access |
| Events visible but metadata writes fail | Secondary account only has read access | Upgrade permissions, retry OAuth consent |
| OAuth consent shows work email | User accidentally authing with corporate account | Use Chrome profile separation; confirm email in consent screen |
| Coach sees duplicate events | Legacy Apps Script still running | Disable script + delete duplicated personal calendar |

---

## 6. Environment Config Matrix

| Variable | Dev Lane | Admin Lane | Coach Lane |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SELECTED_CALENDAR_ID` | `NEXT_PUBLIC_DEV_CALENDAR_ID` (per developer) | `NEXT_PUBLIC_ADMIN_CALENDAR_ID` | Chosen at runtime via calendar picker |
| `PCA_ENVIRONMENT` | `dev` | `staging` | `production` |
| Feature Flag | `enableSharedCalendarFlow=true` (local `.env`) | Remote config flag + staging rollout document | Gradually enabled per coach cohort |
| Secret Store | `.env.local` (not committed) | Secret Manager: `pca-admin-staging` | Secret Manager: `pca-prod` |

**Tip:** keep the matrix in sync with `PROJECT_PREFERENCES.md` whenever we add new calendar-dependent features.

---

## 7. Communication Templates

### Email / Notion Template for Coaches
```
Subject: Action Required – Set Up Your PCA Secondary Calendar Access

Hi <Coach>,

We’re enabling the new PCA calendar flow this week. Please complete the following before <date>:

1. Sign into your secondary Gmail (<coach+pca@...>) and confirm 2FA.
2. Share your work calendar with that account (Settings → Share with specific people → Make changes to events).
3. Log into PCA using the secondary Gmail and choose the shared calendar when prompted.
4. Reply “done” here so we can verify metadata writes on our end.

Need help? Ping <primary contact>.

Thanks!
```

### Admin Sign-off Template
```
- Build version: <git sha / tag>
- Admin secondary account used: <email>
- Calendar ID tested: <id>
- Result: ✅ Event fetch | ✅ extendedProperties write | ✅ workout linking
- Notes: <any blockers>
```

Store completed templates in `STATUS_CHECK_SUMMARY.md` for traceability.

---

## 8. Monitoring & Audit Requirements

- **Logging:** Ensure Cloud Run logs include the secondary email and calendar ID for every Google Calendar API call (PII safe) to speed up incident responses.
- **Alerting:** Add a lightweight alert if writes to `extendedProperties` fail three times in a row for the same calendar ID.
- **Periodic Audit:** Once per quarter, run a report of active secondary accounts vs. calendar shares to confirm nothing fell out of sync.

---

## 9. References
- [DEV.md](DEV.md) – release ladder details
- [WORK_CALENDAR_SYNC_METADATA.md](WORK_CALENDAR_SYNC_METADATA.md) – event metadata format
- [src/lib/stores/useCalendarStore.ts](src/lib/stores/useCalendarStore.ts) – calendar selection logic
- [src/lib/services/clientMatching.ts](src/lib/services/clientMatching.ts) – attendee + guest email matching
