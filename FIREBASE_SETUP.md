# Firebase + Cloud Run Setup Guide

## Overview

Your Next.js app is configured to deploy to:
- **Cloud Run**: Handles the Next.js server and API routes
- **Firebase Hosting**: Serves as CDN and routes traffic to Cloud Run

## Prerequisites

1. **Firebase CLI** (already installed ✅)
2. **Google Cloud CLI** - Install from https://cloud.google.com/sdk/docs/install
3. **Docker** - For building container images
4. **Firebase Project**: `performancecoachapp-26bd1` (already set ✅)

## Initial Setup

### 1. Install Google Cloud CLI

```bash
# macOS
brew install google-cloud-sdk

# Linux
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Windows
# Download from https://cloud.google.com/sdk/docs/install
```

### 2. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project performancecoachapp-26bd1
```

### 3. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 4. Set Environment Variables in Cloud Run

You'll need to set these when deploying. Create a `.env.cloudrun` file (don't commit it):

```bash
# Copy from your .env.local or Vercel settings
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-firebase-hosting-url.web.app/api/auth/google/callback
```

## Deployment Steps

### Option 1: Automated Script (Recommended)

```bash
npm run deploy:firebase
```

This script will:
1. Build Next.js app
2. Build Docker image
3. Push to Google Container Registry
4. Deploy to Cloud Run
5. Deploy Firebase Hosting

### Option 2: Manual Deployment

#### Step 1: Build and Deploy to Cloud Run

```bash
# Build Next.js
npm run build

# Build Docker image
docker build -t gcr.io/performancecoachapp-26bd1/pca-app:latest .

# Push to GCR
docker push gcr.io/performancecoachapp-26bd1/pca-app:latest

# Deploy to Cloud Run
gcloud run deploy pca-app \
  --image gcr.io/performancecoachapp-26bd1/pca-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars "$(cat .env.cloudrun | tr '\n' ',')"
```

#### Step 2: Deploy Firebase Hosting

```bash
firebase deploy --only hosting
```

## Environment Variables

Set environment variables in Cloud Run:

```bash
gcloud run services update pca-app \
  --region us-central1 \
  --update-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=your-key,NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
```

Or use the Cloud Console:
1. Go to Cloud Run → pca-app → Edit & Deploy New Revision
2. Add environment variables in the "Variables & Secrets" tab

## Testing Locally

### Test Docker Build

```bash
docker build -t pca-app:local .
docker run -p 3000:3000 --env-file .env.local pca-app:local
```

Visit http://localhost:3000

### Test Production Build

```bash
npm run build
npm run start
```

## Troubleshooting

### Build Fails
- Check Docker is running: `docker ps`
- Check you're authenticated: `gcloud auth list`

### Cloud Run Deployment Fails
- Verify APIs are enabled: `gcloud services list --enabled`
- Check quotas: `gcloud compute project-info describe`

### Firebase Hosting Not Routing
- Verify Cloud Run service name matches `firebase.json` (should be `pca-app`)
- Check service is deployed: `gcloud run services list`

## Cost Considerations

- **Cloud Run**: Pay per request (free tier: 2 million requests/month)
- **Firebase Hosting**: Free tier: 10 GB storage, 360 MB/day transfer
- **Container Registry**: First 500 MB free, then $0.026/GB/month

## Next Steps

1. ✅ Set up Google Cloud CLI
2. ✅ Enable required APIs
3. ✅ Configure environment variables
4. ✅ Deploy to Cloud Run
5. ✅ Deploy Firebase Hosting
6. ✅ Test the live site
7. ✅ Update Google OAuth redirect URI to Firebase URL

## Useful Commands

```bash
# View Cloud Run logs
gcloud run services logs read pca-app --region us-central1

# Update environment variables
gcloud run services update pca-app --region us-central1 --update-env-vars KEY=value

# View Firebase Hosting URL
firebase hosting:channel:list

# Deploy only Firestore rules
npm run deploy:firestore
```
