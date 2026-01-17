# Fix Firebase Deployment Permissions

## The Problem

The Firebase deployment is failing with:
```
Permission 'run.services.get' denied on resource 'namespaces/63362206075/services/pca-app'
```

This happens because Firebase Hosting needs to verify that the Cloud Run service exists when you have rewrites configured in `firebase.json`.

## The Solution

The Firebase service account needs Cloud Run permissions. I've updated the workflow to automatically grant these permissions, but you may also need to do it manually in the Google Cloud Console.

### Option 1: Automatic (Recommended)

The workflow now automatically grants permissions. Just run the deployment again.

### Option 2: Manual Fix

If the automatic fix doesn't work, grant permissions manually:

1. **Go to Google Cloud Console IAM:**
   https://console.cloud.google.com/iam-admin/iam?project=performancecoachapp-26bd1

2. **Find your Firebase service account:**
   - Look for an account like `firebase-adminsdk-xxxxx@performancecoachapp-26bd1.iam.gserviceaccount.com`
   - Or check your `FIREBASE_SERVICE_ACCOUNT` secret JSON for the `client_email` field

3. **Grant these roles:**
   - **Cloud Run Viewer** (`roles/run.viewer`) - Allows Firebase to verify Cloud Run services exist
   - **Cloud Run Invoker** (`roles/run.invoker`) - Allows Firebase to invoke the Cloud Run service

4. **Or use gcloud command:**
   ```bash
   # Replace SERVICE_ACCOUNT_EMAIL with your Firebase service account email
   SERVICE_ACCOUNT_EMAIL="your-firebase-service-account@performancecoachapp-26bd1.iam.gserviceaccount.com"
   
   # Grant Cloud Run Viewer
   gcloud projects add-iam-policy-binding performancecoachapp-26bd1 \
     --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
     --role="roles/run.viewer"
   
   # Grant Cloud Run Invoker on the specific service
   gcloud run services add-iam-policy-binding pca-app \
     --region=us-central1 \
     --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
     --role="roles/run.invoker"
   ```

## How I Monitor Deployments

I monitor deployments through:

1. **GitHub Actions Logs** - I check the workflow runs and their logs
2. **Error Messages** - I look for specific error patterns like permission denials
3. **Status Checks** - I verify each step completes successfully

The error you showed me was visible in the GitHub Actions logs, which is how I identified the permission issue.

## Verification

After granting permissions, the deployment should succeed. You'll know it worked when:
- ✅ GitHub Actions shows green checkmark
- ✅ No permission errors in logs
- ✅ Firebase Hosting deployment completes successfully
