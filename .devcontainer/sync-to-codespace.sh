#!/bin/bash
# One-step workflow: commit, push, and set port to public
# Usage: ./sync-to-codespace.sh "commit message"

CODESPACE_NAME="${CODESPACE_NAME:-stunning-rotary-phone-44vr6x459g9hjqww}"
COMMIT_MSG="${1:-Update code}"

echo "🚀 Syncing to Codespace..."
echo "📝 Committing: $COMMIT_MSG"

# Stage all changes, commit, and push
git add -A
git commit -m "$COMMIT_MSG" || {
    echo "⚠️  No changes to commit"
    # Still set port to public even if no commit
    echo "🔓 Setting port 3000 to public..."
    gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || {
        echo "⚠️  Could not set port to public (Codespace might not be running)"
    }
    exit 0
}

git push || {
    echo "❌ Push failed"
    exit 1
}

echo "✅ Changes pushed to GitHub!"
echo "📦 Codespaces will auto-sync changes (if browser is open)"

# Set port to public
echo "🔓 Setting port 3000 to public..."
gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || {
    echo "⚠️  Could not set port to public (Codespace might not be running)"
    echo "💡 Run manually: gh codespace ports visibility 3000:public -c $CODESPACE_NAME"
}

echo "✅ Complete! Port 3000 is now public"
echo "🌐 App URL: https://${CODESPACE_NAME}-3000.app.github.dev/"
