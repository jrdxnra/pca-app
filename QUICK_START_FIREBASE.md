# Quick Start: Deploy to Firebase + Cloud Run

## Prerequisites Check

Run these commands to verify you're ready:

```bash
# Check Firebase CLI
firebase --version

# Check Google Cloud CLI
gcloud --version

# Check Docker
docker --version

# Verify Firebase project
firebase use
# Should show: performancecoachapp-26bd1
```

## One-Time Setup

### 1. Authenticate with Google Cloud

```bash
gcloud auth login
gcloud config set project performancecoachapp-26bd1
```

### 2. Enable Required APIs

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

### 3. Configure Docker for GCR

```bash
gcloud auth configure-docker
```

## First Deployment

### Step 1: Set Environment Variables

Create `.env.cloudrun` file with your environment variables (see FIREBASE_SETUP.md for details).

### Step 2: Deploy

```bash
npm run deploy:firebase
```

Or manually:

```bash
# Build
npm run build

# Build and push Docker image
docker build -t gcr.io/performancecoachapp-26bd1/pca-app:latest .
docker push gcr.io/performancecoachapp-26bd1/pca-app:latest

# Deploy to Cloud Run (with env vars)
gcloud run deploy pca-app \
  --image gcr.io/performancecoachapp-26bd1/pca-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --set-env-vars "$(cat .env.cloudrun | grep -v '^#' | xargs | tr ' ' ',')"

# Deploy Firebase Hosting
firebase deploy --only hosting
```

## Get Your URLs

After deployment:

```bash
# Cloud Run URL
gcloud run services describe pca-app --region us-central1 --format 'value(status.url)'

# Firebase Hosting URL
firebase hosting:channel:list
```

## Update Google OAuth

After first deployment, update your Google OAuth redirect URI:
1. Go to Google Cloud Console → APIs & Services → Credentials
2. Edit your OAuth 2.0 Client
3. Add your Firebase Hosting URL: `https://your-app.web.app/api/auth/google/callback`

## Troubleshooting

**Build fails?**
- Make sure Docker is running: `docker ps`
- Check you're logged in: `gcloud auth list`

**Deployment fails?**
- Check APIs are enabled: `gcloud services list --enabled`
- Verify project: `gcloud config get-value project`

**App doesn't work?**
- Check Cloud Run logs: `gcloud run services logs read pca-app --region us-central1`
- Verify environment variables are set in Cloud Run
