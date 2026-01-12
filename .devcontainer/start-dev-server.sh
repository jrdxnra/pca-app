#!/bin/bash
# Script to start the dev server in the background
# This can be run manually or via postStartCommand

cd /workspaces/pca-app

# Check if dev server is already running
if pgrep -f "next dev" > /dev/null; then
    echo "Dev server is already running"
    exit 0
fi

# Start dev server in background
nohup npm run dev > /tmp/nextjs-dev.log 2>&1 &
echo $! > /tmp/nextjs-dev.pid

echo "Dev server started in background (PID: $(cat /tmp/nextjs-dev.pid))"
echo "Logs: tail -f /tmp/nextjs-dev.log"
echo "Stop: kill $(cat /tmp/nextjs-dev.pid)"
