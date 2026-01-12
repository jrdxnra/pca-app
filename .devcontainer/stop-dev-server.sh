#!/bin/bash
# Script to stop the dev server

if [ -f /tmp/nextjs-dev.pid ]; then
    PID=$(cat /tmp/nextjs-dev.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        rm /tmp/nextjs-dev.pid
        echo "Dev server stopped (PID: $PID)"
    else
        echo "Dev server process not found"
        rm /tmp/nextjs-dev.pid
    fi
else
    # Try to find and kill by process name
    pkill -f "next dev"
    echo "Attempted to stop dev server"
fi
