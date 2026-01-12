#!/bin/bash
# Set port 3000 to public visibility in Codespace
# Run this from your LOCAL terminal (Cursor), not inside the Codespace
# Usage: .devcontainer/set-port-public.sh [codespace-name]

CODESPACE_NAME="${1:-stunning-rotary-phone-44vr6x459g9hjqww}"

echo "Setting port 3000 to public visibility..."
gh codespace ports visibility 3000:public -c "$CODESPACE_NAME"

if [ $? -eq 0 ]; then
    echo "✅ Port 3000 is now PUBLIC"
    echo "🌐 Your app URL: https://${CODESPACE_NAME}-3000.app.github.dev/"
else
    echo "❌ Failed to set port to public"
    exit 1
fi
