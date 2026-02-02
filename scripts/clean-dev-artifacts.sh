#!/bin/bash

# List of patterns/files to remove from main branch
# These are development artifacts that should stay in dev branch only
FILES_TO_REMOVE=(
  "FUTURE_IMPROVEMENTS.md"
  "CURRENT_UNDERSTANDING_SESSION1.md"
  "ARCHITECTURE_*.md"
  "MULTI_USER_*.md"
  "EVENT_FILTERING_GUIDE.md"
  "MULTI_CLIENT_*.md"
  "SETUP_AUTH_FOR_CODESPACES.md"
  "WORK_CALENDAR_SYNC_*.md"
  "ADD_MISSING_ENV_VARS.md"
  "CALENDAR_EVENTS_MIGRATION_STATUS.md"
  "CHECK_CLIENT_ID.md"
  "DEBUG_OAUTH_MISMATCH.md"
  "FIREBASE_*.md"
  "GOOGLE_CALENDAR_OAUTH_SETUP.md"
  "GOOGLE_CLOUD_CONSOLE_CHECKLIST.md"
  "SET_CLOUD_RUN_ENV_VARS.md"
  "STATUS_CHECK_SUMMARY.md"
  "WORKFLOW_SPEED_COMPARISON.md"
  "DEPLOYMENT_*.md"
  "*_PLAN.md"
  "BRANCH_*.md"
  "CODESPACES_DEV.md"
  "DEV_BRANCH_CLEANUP_ANALYSIS.md"
  "ADD_VERCEL_ENV_NOW.md"
  "GOOGLE_CALENDAR_SETUP.md"
  "HOW-TO.md"
  "TROUBLESHOOTING.md"
  "WORKOUT_LOGGING_TEST_GUIDE.md"
  "COST_BREAKDOWN.md"
  "GET_STARTED_FIREBASE.md"
  "READY_TO_TEST.md"
  "REMINDERS.md"
  "ARCHITECTURAL_REVIEW.md"
  "FIX_*.md"
  "HOW_TO_DEPLOY.md"
  "PROGRESS_SUMMARY.md"
  "PHASE_STATUS_REPORT.md"
  "REACT_ERROR_310_PREVENTION.md"
  "RENDER_DEV_*.md"
)

echo "🧹 Cleaning up development artifacts from main branch..."

for pattern in "${FILES_TO_REMOVE[@]}"; do
  # Use eval to expand wildcards correctly
  eval rm -f $pattern
done

# Also verify they are gone and echo result
if [ -f "FUTURE_IMPROVEMENTS.md" ]; then
  echo "❌ Warning: Failed to remove some files."
else
  echo "✅ Main branch clean. Development artifacts removed."
fi
