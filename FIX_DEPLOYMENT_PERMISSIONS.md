# Fix Deployment Permission Error

## The Problem

Deployments are failing with:
```
Permission 'run.services.get' denied on resource 'namespaces/63362206075/services/pca-app'
```

## Why This Happens

Firebase Hosting needs to verify that the Cloud Run service exists when you have rewrites in `firebase.json`. The Firebase service account doesn't have permission to check Cloud Run services.

## The Fix (One-Time Setup)

You need to manually grant the Firebase service account Cloud Run permissions:

### Step 1: Get Your Firebase Service Account Email

1. Go to: https://console.firebase.google.com/project/performancecoachapp-26bd1/settings/serviceaccounts/adminsdk
2. Copy the service account email (looks like: `firebase-adminsdk-xxxxx@performancecoachapp-26bd1.iam.gserviceaccount.com`)

OR check your GitHub secret `FIREBASE_SERVICE_ACCOUNT` - the `client_email` field.

### Step 2: Grant Cloud Run Viewer Permission

**Option A: Via Google Cloud Console (Easiest)**

1. Go to: https://console.cloud.google.com/iam-admin/iam?project=performancecoachapp-26bd1
2. Find your Firebase service account (search for "firebase-adminsdk")
3. Click the pencil icon (Edit)
4. Click "ADD ANOTHER ROLE"
5. Select: **Cloud Run Viewer** (`roles/run.viewer`)
6. Click "SAVE"

**Option B: Via Command Line**

```bash
# Replace SERVICE_ACCOUNT_EMAIL with your Firebase service account email
SERVICE_ACCOUNT_EMAIL="firebase-adminsdk-xxxxx@performancecoachapp-26bd1.iam.gserviceaccount.com"

# Grant Cloud Run Viewer role
gcloud projects add-iam-policy-binding performancecoachapp-26bd1 \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.viewer"
```

### Step 3: Verify

After granting permissions, try deploying again. The error should be gone.

## Alternative: Make the Check Optional

If you can't grant permissions right now, we can make Firebase skip the Cloud Run verification check. However, this is not recommended as it may cause issues.

## Why This Is Needed

Your `firebase.json` has rewrites that point to Cloud Run:
```json
"rewrites": [
  {
    "source": "/api/**",
    "run": {
      "serviceId": "pca-app",
      "region": "us-central1"
    }
  }
]
```

Firebase needs to verify this service exists before finalizing the deployment.

## After Fixing

Once permissions are granted, deployments should complete successfully in ~5-8 minutes.
