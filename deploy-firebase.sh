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

# Check if gcloud CLI is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Google Cloud CLI not found. Install from: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(firebase use 2>&1 | grep -oP '(?<=\()[^)]+' | head -1 || echo "")
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Could not determine Firebase project. Run: firebase use <project-id>"
    exit 1
fi

echo "📦 Project: $PROJECT_ID"

# Build Next.js app
echo "🔨 Building Next.js app..."
npm run build

# Build Docker image
echo "🐳 Building Docker image..."
IMAGE_NAME="gcr.io/$PROJECT_ID/pca-app:latest"
docker build -t $IMAGE_NAME .

# Push to Google Container Registry
echo "📤 Pushing image to GCR..."
docker push $IMAGE_NAME

# Deploy to Cloud Run
echo "☁️  Deploying to Cloud Run..."
gcloud run deploy pca-app \
  --image $IMAGE_NAME \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --project $PROJECT_ID

# Get Cloud Run service URL
SERVICE_URL=$(gcloud run services describe pca-app --region us-central1 --format 'value(status.url)' --project $PROJECT_ID)
echo "✅ Cloud Run deployed at: $SERVICE_URL"

# Deploy Firebase Hosting (which will route to Cloud Run)
echo "🔥 Deploying Firebase Hosting..."
firebase deploy --only hosting

echo "🎉 Deployment complete!"
echo "🌐 Your app should be live at your Firebase Hosting URL"
