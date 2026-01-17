# How to Deploy to Firebase

## Automatic Deployment (Recommended)

**Just ask me to deploy!** I'll add `[deploy]` to the commit message and it will deploy automatically.

Example: "Please deploy to Firebase" → I commit with message "Your changes [deploy]"

## Manual Deployment (Alternative)

1. Go to: https://github.com/jrdxnra/pca-app/actions
2. Click **"Deploy to Firebase"** workflow (left sidebar)
3. Click **"Run workflow"** button (top right)
4. Select branch: **`main`**
5. Click **"Run workflow"**

## How It Works

- **Normal commits** (without `[deploy]`) = No deployment (saves resources)
- **Commits with `[deploy]`** = Automatic deployment
- **Manual trigger** = Always deploys (via GitHub Actions UI)

## What Happens

1. **Cloud Build** (3-5 min) - Builds your Docker image
2. **Cloud Run Deploy** (1-2 min) - Deploys the container
3. **Firebase Hosting** (30 sec) - Updates CDN

**Total time:** ~5-8 minutes

## When to Deploy

- ✅ After completing a feature
- ✅ After fixing bugs
- ✅ When ready for user testing
- ✅ At end of development session
- ❌ Don't deploy on every commit (wastes resources)

## Monitor Deployment

- Watch progress: https://github.com/jrdxnra/pca-app/actions
- Green checkmark = Success ✅
- Red X = Failed ❌ (check logs)

## Benefits of Manual Deployments

- 💰 **Saves resources** - No wasted Cloud Build minutes
- ⚡ **Faster development** - Commit freely without waiting
- 🎯 **Deploy when ready** - Full control over when to deploy
- 📊 **Better tracking** - Clear deployment history

## Commit Freely!

You can commit as much as you want during development. Deployments only happen when you manually trigger them.
