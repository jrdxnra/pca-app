# Firebase Service Account Reference

## Where It's Stored

The Firebase service account JSON is stored as a GitHub Secret:
- **Secret Name**: `FIREBASE_SERVICE_ACCOUNT`
- **Location**: GitHub → Settings → Secrets and variables → Actions → Repository secrets
- **Purpose**: Used by GitHub Actions workflow to authenticate with Firebase and Google Cloud for deployments

## Current Service Account Details

- **Service Account Email**: `firebase-adminsdk-fbsvc@performancecoachapp-26bd1.iam.gserviceaccount.com`
- **Project ID**: `performancecoachapp-26bd1`
- **Key ID**: `c2c5ab4cbd40a50e57f758ee9a04a3c80054b5e7` (created Jan 14, 2026)
- **Status**: Active (expires Dec 31, 9999)

## How to Retrieve the JSON

### Option 1: From GitHub Secrets (if you have access)
1. Go to: https://github.com/jrdxnra/pca-app/settings/secrets/actions
2. Find `FIREBASE_SERVICE_ACCOUNT`
3. Click to view (you can't copy the value, but you can verify it exists)

### Option 2: Generate a New One (if needed)
1. Go to: https://console.firebase.google.com/project/performancecoachapp-26bd1/settings/serviceaccounts/adminsdk
2. Click "Generate new private key"
3. Download the JSON file
4. Update the GitHub secret with the new JSON

### Option 3: From Google Cloud Console
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=performancecoachapp-26bd1
2. Find: `firebase-adminsdk-fbsvc@performancecoachapp-26bd1.iam.gserviceaccount.com`
3. Click on it → "KEYS" tab → "ADD KEY" → "Create new key" → JSON

## Important Security Notes

⚠️ **NEVER commit the service account JSON to the repository**
- It's stored only in GitHub Secrets
- The actual JSON key is sensitive and should never be in version control
- If a key is accidentally committed, rotate it immediately

## What It's Used For

- GitHub Actions workflow authentication (`firebase-deploy.yml`)
- Firebase Hosting deployments
- Cloud Run service verification
- Google Cloud API access

## Related Files

- `.github/workflows/firebase-deploy.yml` - Uses this secret for deployments
- `SET_CLOUD_RUN_ENV_VARS.md` - Environment variables setup guide
- `FIREBASE_SETUP.md` - Firebase deployment guide

## Last Updated
January 18, 2026
