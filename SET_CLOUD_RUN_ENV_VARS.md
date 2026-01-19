# How to Set Cloud Run Environment Variables

## Method 1: Google Cloud Console (Easiest)

### Step 1: Go to Cloud Run
1. Open [Google Cloud Console](https://console.cloud.google.com)
2. Select project: `performancecoachapp-26bd1`
3. Navigate to **Cloud Run** (search in top bar or go to Navigation Menu → Cloud Run)

### Step 2: Find Your Service
1. Click on the service name: `pca-app`
2. Click **EDIT & DEPLOY NEW REVISION** (top button)

### Step 3: Add Environment Variables
1. Scroll down to **Variables & Secrets** section
2. Click **ADD VARIABLE** for each variable:

**Required Variables:**
- `GOOGLE_CLIENT_ID` = `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com` (your actual client ID)
- `GOOGLE_CLIENT_SECRET` = `your-secret-here` (your actual secret)
- `GOOGLE_REDIRECT_URI` = `https://performancecoach.web.app/api/auth/google/callback`

**Firebase Config (NEXT_PUBLIC_*):**
- `NEXT_PUBLIC_FIREBASE_API_KEY` = (from your .env.local)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = (from your .env.local)
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `performancecoachapp-26bd1`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` = (from your .env.local)
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` = (from your .env.local)
- `NEXT_PUBLIC_FIREBASE_APP_ID` = (from your .env.local)

### Step 4: Deploy
1. Click **DEPLOY** (bottom of page)
2. Wait for deployment to complete (~2-5 minutes)

---

## Method 2: gcloud CLI (Command Line)

### Update Environment Variables

```bash
# Set the project
gcloud config set project performancecoachapp-26bd1

# Update the Cloud Run service with environment variables
gcloud run services update pca-app \
  --region us-central1 \
  --update-env-vars \
    GOOGLE_CLIENT_ID=63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com,\
    GOOGLE_CLIENT_SECRET=your-secret-here,\
    GOOGLE_REDIRECT_URI=https://performancecoach.web.app/api/auth/google/callback,\
    NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key,\
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain,\
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1,\
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket,\
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id,\
    NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
```

**Note:** Replace `your-secret-here`, `your-api-key`, etc. with your actual values.

### Or Update Just GOOGLE_REDIRECT_URI

If you only need to update the redirect URI:

```bash
gcloud run services update pca-app \
  --region us-central1 \
  --update-env-vars GOOGLE_REDIRECT_URI=https://performancecoach.web.app/api/auth/google/callback
```

---

## Method 3: Update During Deployment Script

You can also modify `deploy-firebase.sh` to include `--set-env-vars` flag:

```bash
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
  --project $PROJECT_ID \
  --set-env-vars GOOGLE_REDIRECT_URI=https://performancecoach.web.app/api/auth/google/callback
```

---

## Verify Environment Variables

After setting, verify they're there:

```bash
gcloud run services describe pca-app \
  --region us-central1 \
  --format="value(spec.template.spec.containers[0].env)"
```

Or check in the Cloud Console UI under the service's **Variables & Secrets** tab.

---

## Important Notes

1. **Sensitive values**: `GOOGLE_CLIENT_SECRET` should be marked as "Secret" in Cloud Console (use Secret Manager for production)
2. **Redeploy required**: After updating env vars, the service will automatically redeploy
3. **Service URL**: Your service URL will be something like `https://pca-app-xxxxx-uc.a.run.app` - but Firebase Hosting routes to it
4. **Firebase Hosting**: The `GOOGLE_REDIRECT_URI` should use your Firebase Hosting URL (`performancecoach.web.app`), not the Cloud Run URL
