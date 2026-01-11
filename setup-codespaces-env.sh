#!/bin/bash

# Setup script for GitHub Codespaces environment variables
# Run this in your Codespaces terminal after the codespace is created

echo "Setting up .env.local for Codespaces..."

# Create .env.local with your Firebase and Google Calendar credentials
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

echo "✅ .env.local created successfully!"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Start your dev server: npm run dev"
echo "2. Check the 'Ports' tab in VS Code for your forwarded URL"
echo "3. Update GOOGLE_REDIRECT_URI in .env.local to use your Codespaces URL"
echo "   Example: GOOGLE_REDIRECT_URI=https://xxxxx-3000.preview.app.github.dev/api/auth/google/callback"
echo "4. Add the same URL to Google Cloud Console > Credentials > Authorized redirect URIs"
echo "5. Restart the dev server after updating the redirect URI"
