#!/bin/bash

# Firebase + Cloud Run Deployment Script
# This script builds and deploys the Next.js app to Cloud Run, then updates Firebase Hosting

set -e

echo "🚀 Starting Firebase + Cloud Run deployment..."

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

# detailed check for gcloud, trying to source if missing
if ! command -v gcloud &> /dev/null; then
    if [ -f "$HOME/google-cloud-sdk/path.bash.inc" ]; then
        source "$HOME/google-cloud-sdk/path.bash.inc"
    elif [ -f "./google-cloud-sdk/path.bash.inc" ]; then
        source "./google-cloud-sdk/path.bash.inc"
    fi
fi

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(firebase use 2>&1 | grep "Active Project" | awk '{print $3}')
if [ -z "$PROJECT_ID" ]; then
    # Fallback for different firebase-tools versions or if just the ID is printed
    PROJECT_ID=$(firebase use 2>&1 | head -n 1)
fi

if [ -z "$PROJECT_ID" ] || [[ "$PROJECT_ID" == *"No active project"* ]]; then
    echo "❌ Could not determine Firebase project. Run: firebase use <project-id>"
    exit 1
fi

echo "📦 Project: $PROJECT_ID"

# Load environment variables
# Prioritize .env.production for deployment
if [ -f .env.production ]; then
    echo "📄 Loading environment variables from .env.production..."
    export $(grep -v '^#' .env.production | xargs)
elif [ -f .env.local ]; then
    echo "⚠️  .env.production not found. Loading variables from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
else
    echo "⚠️  No environment file found! Ensure variables are set."
fi

# Check for Google Auth Variables
if [ -z "$GOOGLE_CLIENT_ID" ] || [ -z "$GOOGLE_CLIENT_SECRET" ] || [ -z "$GOOGLE_REDIRECT_URI" ]; then
    echo "⚠️  Missing Google Calendar credentials in .env.local (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)"
    echo "   Calendar integration may not work without these."
fi

# Calculate image tag
if command -v git &> /dev/null && [ -d .git ]; then
    IMAGE_TAG=$(git rev-parse --short HEAD)
else
    IMAGE_TAG=$(date +%s) # Fallback to timestamp if not a git repo
fi
echo "Ticket: $IMAGE_TAG"

# Submit to Cloud Build (replaces local docker build + push + deploy)
echo "☁️  Submitting build to Google Cloud Build..."
gcloud builds submit --config=cloudbuild.yaml \
    --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="$NEXT_PUBLIC_FIREBASE_API_KEY",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="$NEXT_PUBLIC_FIREBASE_PROJECT_ID",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",_NEXT_PUBLIC_FIREBASE_APP_ID="$NEXT_PUBLIC_FIREBASE_APP_ID",_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID",_GOOGLE_CLIENT_SECRET="$GOOGLE_CLIENT_SECRET",_GOOGLE_REDIRECT_URI="$GOOGLE_REDIRECT_URI",_IMAGE_TAG="$IMAGE_TAG"

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe pca-app --region us-central1 --format 'value(status.url)' --project $PROJECT_ID)
echo "✅ Cloud Run deployed at: $SERVICE_URL"

# Deploy Firebase Hosting (which will route to Cloud Run)
echo "🔥 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "🎉 Deployment complete!"
echo "🌐 Your app should be live at your Firebase Hosting URL"
