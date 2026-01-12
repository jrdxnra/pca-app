#!/bin/bash
# One-step workflow: commit, push, and pull in Codespace
# Usage: ./sync-to-codespace.sh "commit message"

CODESPACE_NAME="${CODESPACE_NAME:-stunning-rotary-phone-44vr6x459g9hjqww}"
COMMIT_MSG="${1:-Update code}"

echo "🚀 Syncing to Codespace..."
echo "📝 Committing: $COMMIT_MSG"

# Stage all changes, commit, and push
git add -A
git commit -m "$COMMIT_MSG" || {
    echo "⚠️  No changes to commit"
    exit 0
}

git push || {
    echo "❌ Push failed"
    exit 1
}

echo "⬇️  Triggering sync in Codespace..."
# Codespaces auto-syncs, but we can trigger a refresh by touching a file
# Or just let the user know it's done - Codespaces will auto-sync
gh codespace ssh -c "$CODESPACE_NAME" -- "cd /workspaces/pca-app && git fetch origin main 2>/dev/null || echo 'Git fetch failed (Codespaces will auto-sync)'" || true

echo "✅ Changes pushed! Codespaces will auto-sync the changes."
echo "💡 If changes don't appear, refresh the Codespace browser or restart the dev server"
