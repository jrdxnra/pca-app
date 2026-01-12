#!/bin/bash
# One-step workflow: commit, push, restart server, and set port to public
# Usage: ./sync-to-codespace.sh "commit message"

CODESPACE_NAME="${CODESPACE_NAME:-stunning-rotary-phone-44vr6x459g9hjqww}"
COMMIT_MSG="${1:-Update code}"

echo "🚀 Syncing to Codespace..."
echo "📝 Committing: $COMMIT_MSG"

# Stage all changes, commit, and push
git add -A
git commit -m "$COMMIT_MSG" || {
    echo "⚠️  No changes to commit"
    # Still restart server and set port to public even if no commit
    echo "🔄 Restarting dev server..."
    gh codespace ssh -c "$CODESPACE_NAME" -- "cd /workspaces/pca-app && .devcontainer/stop-dev-server.sh && sleep 1 && .devcontainer/start-dev-server.sh" 2>/dev/null || {
        echo "⚠️  Could not restart server (Codespace might not be running)"
    }
    echo "🔓 Setting port 3000 to public..."
    gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || {
        echo "⚠️  Could not set port to public"
    }
    exit 0
}

git push || {
    echo "❌ Push failed"
    exit 1
}

echo "✅ Changes pushed to GitHub!"

# Pull in Codespace and restart dev server
echo "⬇️  Updating Codespace code..."
gh codespace ssh -c "$CODESPACE_NAME" -- "cd /workspaces/pca-app && git pull 2>&1" 2>/dev/null || {
    echo "⚠️  Git pull failed (Codespaces should auto-sync when browser is open)"
    echo "💡 If changes don't appear, manually pull in Codespace browser terminal"
}

echo "🔄 Restarting dev server..."
gh codespace ssh -c "$CODESPACE_NAME" -- "cd /workspaces/pca-app && .devcontainer/stop-dev-server.sh && sleep 2 && .devcontainer/start-dev-server.sh" 2>/dev/null || {
    echo "⚠️  Could not restart server"
    echo "💡 Manually restart: gh codespace ssh -c $CODESPACE_NAME -- 'cd /workspaces/pca-app && .devcontainer/stop-dev-server.sh && .devcontainer/start-dev-server.sh'"
}

# Set port to public
echo "🔓 Setting port 3000 to public..."
gh codespace ports visibility 3000:public -c "$CODESPACE_NAME" 2>/dev/null || {
    echo "⚠️  Could not set port to public"
    echo "💡 Run manually: gh codespace ports visibility 3000:public -c $CODESPACE_NAME"
}

echo "✅ Complete! Port 3000 is now public"
echo "🌐 App URL: https://${CODESPACE_NAME}-3000.app.github.dev/"
echo ""
echo "💡 Note: If changes don't appear, wait ~10 seconds for Next.js to rebuild, then refresh browser"
