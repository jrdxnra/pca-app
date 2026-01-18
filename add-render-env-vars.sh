#!/bin/bash

# Script to add environment variables to Render service
# Requires Render CLI: npm install -g render-cli
# Requires RENDER_API_KEY environment variable

SERVICE_ID="srv-d5mmn8h4tr6s73cp18lg"
RENDER_URL="https://pca-app-gqj9.onrender.com"

echo "Adding environment variables to Render service..."

# Firebase Config
render env:set NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA" --service $SERVICE_ID
render env:set NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="performancecoachapp-26bd1.firebaseapp.com" --service $SERVICE_ID
render env:set NEXT_PUBLIC_FIREBASE_PROJECT_ID="performancecoachapp-26bd1" --service $SERVICE_ID
render env:set NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="performancecoachapp-26bd1.firebasestorage.app" --service $SERVICE_ID
render env:set NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="63362206075" --service $SERVICE_ID
render env:set NEXT_PUBLIC_FIREBASE_APP_ID="1:63362206075:web:1a35b23242b06fd56f15de" --service $SERVICE_ID

# Google OAuth
render env:set GOOGLE_CLIENT_ID="63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" --service $SERVICE_ID
render env:set GOOGLE_CLIENT_SECRET="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" --service $SERVICE_ID
render env:set GOOGLE_REDIRECT_URI="https://pca-app-gqj9.onrender.com/api/auth/google/callback" --service $SERVICE_ID

# Node Environment
render env:set NODE_ENV="production" --service $SERVICE_ID

echo "✅ All environment variables added!"
