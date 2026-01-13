# Get Started: Deploy to Firebase (Quick Checklist)

## ✅ Current Status

- ✅ Firebase CLI: Installed
- ✅ Firebase Project: `performancecoachapp-26bd1` (set)
- ❌ Google Cloud CLI: **Need to install**
- ❌ Docker: **Need to install**

## Step 1: Install Google Cloud CLI (5 minutes)

### On Linux (your system):
```bash
# Download and install
curl https://sdk.cloud.google.com | bash

# Restart your shell or run:
exec -l $SHELL

# Verify it worked
gcloud --version
```

### Alternative (if curl doesn't work):
```bash
# Download manually
wget https://dl.google.com/dl/cloudsdk/channels/rapid/downloads/google-cloud-cli-linux-x86_64.tar.gz
tar -xzf google-cloud-cli-linux-x86_64.tar.gz
./google-cloud-sdk/install.sh
```

## Step 2: Install Docker (5 minutes)

### On Linux:
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (so you don't need sudo)
sudo usermod -aG docker $USER

# Log out and back in, or run:
newgrp docker

# Verify
docker --version
docker ps  # Should work without sudo
```

## Step 3: Authenticate with Google Cloud (2 minutes)

```bash
# Login (opens browser)
gcloud auth login

# Set your project
gcloud config set project performancecoachapp-26bd1

# Verify
gcloud config get-value project
```

## Step 4: Enable APIs (1 minute - FREE)

```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
```

## Step 5: Configure Docker (1 minute)

```bash
gcloud auth configure-docker
```

## Step 6: Create Environment Variables File

Create `.env.cloudrun` in your project root:

```bash
cd /home/jrdnkeith/projects/pca-main
nano .env.cloudrun
```

Paste your environment variables (get them from Vercel or `.env.local`):

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain-here
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket-here
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://placeholder.web.app/api/auth/google/callback
```

**Note**: Update `GOOGLE_REDIRECT_URI` after first deployment with your actual Firebase URL.

Save and exit (Ctrl+X, then Y, then Enter).

## Step 7: Deploy! (5-10 minutes)

```bash
npm run deploy:firebase
```

This will:
1. Build your app
2. Create Docker image
3. Push to Google Cloud
4. Deploy to Cloud Run
5. Deploy Firebase Hosting

## Step 8: Get Your URL

After deployment completes:

```bash
# Get Firebase Hosting URL
firebase hosting:channel:list
```

Your app will be live at: `https://performancecoachapp-26bd1.web.app`

## Step 9: Update Google OAuth (Important!)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click your OAuth 2.0 Client ID
3. Add to "Authorized redirect URIs":
   ```
   https://performancecoachapp-26bd1.web.app/api/auth/google/callback
   ```
4. Save

## Troubleshooting

### "Permission denied" for Docker
```bash
sudo usermod -aG docker $USER
newgrp docker
```

### "gcloud: command not found"
- Make sure you restarted your shell after installing
- Or run: `source ~/.bashrc`

### Build takes a long time
- First build is slow (downloading base images)
- Subsequent builds are faster

### Need to see what's happening
```bash
# Watch Cloud Run logs
gcloud run services logs read pca-app --region us-central1 --tail
```

## All Done! 🎉

Your app is now live on Firebase. Total setup time: ~20 minutes.

**Cost: $0/month** (stays in free tier)

## Next Time You Deploy

Just run:
```bash
npm run deploy:firebase
```

That's it!
