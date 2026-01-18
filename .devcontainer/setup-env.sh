#!/bin/bash
# Auto-setup environment variables for Codespaces
# This script runs automatically when the codespace is created

cat > .env.local << 'ENVEOF'
# Firebase Configuration - Performance Coach App
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=performancecoachapp-26bd1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=performancecoachapp-26bd1.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=63362206075
NEXT_PUBLIC_FIREBASE_APP_ID=1:63362206075:web:1a35b23242b06fd56f15de

# Development
NODE_ENV=development

# Google OAuth Configuration
# NOTE: Update GOOGLE_REDIRECT_URI after starting dev server with your Codespaces URL
# The URL will be shown in the Ports tab (e.g., https://xxxxx-3000.preview.app.github.dev)
GOOGLE_CLIENT_ID=220447477156-i7mis4i6nfqa5ag8ud2c0943t11ns98m.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
ENVEOF

echo "✅ .env.local created automatically!"
echo "⚠️  Remember to update GOOGLE_REDIRECT_URI after starting the dev server with your Codespaces URL"
