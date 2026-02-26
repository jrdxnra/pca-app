# Dev Branch - Cleanup Analysis (Updated)

**Last Updated**: January 25, 2026  
**Status**: Cleanup completed

## Categories of Potentially Irrelevant Files

### 1. One-Time Migration/Import Scripts
- `bulk-import-accessory.mjs`
- `bulk-import-movements.js`
- `console-import-accessory.js`
- `import-rebrand-to-pca.ts`
- `parse-rebrand.py`
- `rebrand-persistent.js`

### 2. Old Troubleshooting/Debug Docs (May be outdated)
- `DEBUG_OAUTH_MISMATCH.md`
- `TROUBLESHOOTING.md`
- `FIX_DEPLOYMENT_PERMISSIONS.md`
- `FIX_FIREBASE_PERMISSIONS.md`
- `STATUS_CHECK_SUMMARY.md`
- `CHECK_CLIENT_ID.md`

### 3. Old Migration/Removal Status Docs
- `CALENDAR_EVENTS_MIGRATION_STATUS.md`
- `FIREBASE_CALENDAR_EVENTS_REMOVAL_ANALYSIS.md`
- `FIREBASE_CALENDAR_EVENTS_REMOVAL_COMPLETE.md`

### 4. Temporary/One-Time Text Files
- `ADD_ENV_VARS_NOW.txt`
- `EXPLAIN_SCREEN_LAYOUT.txt`
- `README_REBRAND.txt`

### 5. HTML Visualizations (One-time analysis)
- `ARCHITECTURE_VISUAL.html`
- `CURRENT_STATE_INSIGHTS.html`

### 6. Old Comparison/Analysis Docs
- `CURRENT_UNDERSTANDING_SESSION1.md`

### 7. Old Setup Guides (May be outdated)
- `FIREBASE_EMULATOR_CLOUD_SETUP.md`
- `FIREBASE_EMULATOR_SETUP.md`
- `FIREBASE_HOT_RELOAD_ANALYSIS.md`
- `SET_CLOUD_RUN_ENV_VARS.md`

### 8. Status/Progress Reports (Historical)
- `PHASE_STATUS_REPORT.md`
- `PROGRESS_SUMMARY.md`
- `READY_TO_TEST.md`

## Cleanup Completed ✅

**Removed:**
- ✅ All one-time migration scripts (8 files)
- ✅ All temporary text/html files (5 files)
- ✅ Old troubleshooting/migration docs (13 files)

**Total Files Removed**: ~35 additional files

**Kept:**
- `README.md` (main readme)
- `PROJECT_PREFERENCES.md` (project preferences)
- `ARCHITECTURAL_REVIEW.md` (useful reference)
- `FUTURE_IMPROVEMENTS.md` (planning doc)
- `REACT_ERROR_310_PREVENTION.md` (useful reference)
- Firebase config files (firebase.json, firestore.*)
- Deployment scripts (deploy-firebase.sh - still using Firebase)
- Setup guides that might still be useful
- This analysis file
