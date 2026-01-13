# Step-by-Step: Deploy to Firebase (Free Setup)

Follow these steps in order to get your app running on Firebase.

## Prerequisites Check

Run these commands to see what you need:

```bash
# Check Firebase CLI
firebase --version

# Check Google Cloud CLI
gcloud --version

# Check Docker
docker --version

# Check Firebase project
firebase use
```

## Step 1: Install Google Cloud CLI (if needed)

### On Linux:
```bash
# Download and install
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Verify
gcloud --version
```

### On macOS:
```bash
brew install google-cloud-sdk
```

### On Windows:
Download from: https://cloud.google.com/sdk/docs/install

## Step 2: Authenticate with Google Cloud

```bash
# Login to Google Cloud
gcloud auth login

# Set your Firebase project
gcloud config set project performancecoachapp-26bd1

# Verify
gcloud config get-value project
```

## Step 3: Enable Required APIs (Free)

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

These are all **FREE** - just enabling the services.

## Step 4: Configure Docker for Google Cloud

```bash
gcloud auth configure-docker
```

This allows Docker to push images to Google Container Registry.

## Step 5: Create Environment Variables File

Create `.env.cloudrun` in your project root (don't commit this file):

```bash
# Copy your existing .env.local values
# Or get them from Vercel dashboard

NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-firebase-url.web.app/api/auth/google/callback
```

**Note**: You'll need to update `GOOGLE_REDIRECT_URI` after first deployment with your actual Firebase URL.

## Step 6: Build and Deploy

### Option A: Use the Automated Script (Easiest)

```bash
npm run deploy:firebase
```

This will:
1. Build your Next.js app
2. Build Docker image
3. Push to Google Container Registry
4. Deploy to Cloud Run
5. Deploy Firebase Hosting

### Option B: Manual Deployment (More Control)

```bash
# 1. Build Next.js
npm run build

# 2. Build Docker image
docker build -t gcr.io/performancecoachapp-26bd1/pca-app:latest .

# 3. Push to Google Container Registry
docker push gcr.io/performancecoachapp-26bd1/pca-app:latest

# 4. Deploy to Cloud Run (with env vars from .env.cloudrun)
gcloud run deploy pca-app \
  --image gcr.io/performancecoachapp-26bd1/pca-app:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "$(cat .env.cloudrun | grep -v '^#' | xargs | tr ' ' ',')"

# 5. Deploy Firebase Hosting
firebase deploy --only hosting
```

## Step 7: Get Your URLs

After deployment:

```bash
# Get Cloud Run URL
gcloud run services describe pca-app --region us-central1 --format 'value(status.url)'

# Get Firebase Hosting URL
firebase hosting:channel:list
```

## Step 8: Update Google OAuth Redirect URI

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Find your OAuth 2.0 Client ID
3. Add your Firebase Hosting URL to authorized redirect URIs:
   ```
   https://your-app-id.web.app/api/auth/google/callback
   ```

## Troubleshooting

### "gcloud: command not found"
- Install Google Cloud CLI (Step 1)

### "docker: command not found"
- Install Docker Desktop from https://www.docker.com/products/docker-desktop

### "Permission denied" errors
- Run `gcloud auth login` again
- Check: `gcloud auth list`

### Build fails
- Make sure Docker is running: `docker ps`
- Check you're in the project directory

### Deployment fails
- Verify APIs are enabled: `gcloud services list --enabled`
- Check project: `gcloud config get-value project`

### App doesn't work after deployment
- Check Cloud Run logs: `gcloud run services logs read pca-app --region us-central1`
- Verify environment variables are set in Cloud Run
- Check Firebase Hosting URL matches Cloud Run service

## Quick Reference

```bash
# View logs
gcloud run services logs read pca-app --region us-central1 --tail

# Update environment variables
gcloud run services update pca-app --region us-central1 \
  --update-env-vars KEY=value

# Redeploy (after code changes)
npm run deploy:firebase
```

## Cost Reminder

All of this is **FREE**:
- ✅ Google Cloud CLI: Free
- ✅ Docker: Free
- ✅ Cloud Run: 2M requests/month free
- ✅ Container Registry: 500 MB free
- ✅ Firebase Hosting: 10 GB free

**Expected cost: $0/month** for your use case.
