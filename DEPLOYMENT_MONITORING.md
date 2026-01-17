# Firebase Deployment Monitoring Guide

## How to Know When Your Code is Deployed

### 1. **GitHub Actions (Primary Method)**

The easiest way to monitor deployments is through GitHub Actions:

**View Active Deployments:**
- Go to: https://github.com/jrdxnra/pca-app/actions
- Look for the "Deploy to Firebase" workflow
- Green checkmark ✅ = Deployment successful
- Red X ❌ = Deployment failed
- Yellow circle ⏳ = Deployment in progress

**Watch a Deployment in Real-Time:**
1. Click on the running workflow
2. Click on the "deploy" job
3. You'll see live logs of each step:
   - 🔨 Cloud Build (builds your Docker image)
   - ☁️ Cloud Run deployment
   - 🔥 Firebase Hosting deployment
   - 📊 Deployment Summary

**Deployment Summary:**
At the end of each successful deployment, you'll see a summary with:
- Commit hash
- Branch name
- Cloud Run service URL
- Link to Firebase console

### 2. **Firebase Console**

**View Deployment History:**
- Go to: https://console.firebase.google.com/project/performancecoachapp-26bd1/hosting
- Click on "Deploy history" tab
- See all deployments with timestamps

**Check Current Version:**
- The hosting page shows the latest deployment
- You can see when it was deployed and by whom

### 3. **Command Line (Quick Check)**

If you have GitHub CLI installed:
```bash
# Check latest deployment status
gh run list --workflow="Deploy to Firebase" --limit 1

# Watch a specific deployment
gh run watch <run-id>

# View deployment logs
gh run view <run-id> --log
```

### 4. **Verify Code is Live**

**Test Your Changes:**
1. Wait for the GitHub Actions workflow to show ✅ (green checkmark)
2. Give it 1-2 minutes for CDN propagation
3. Visit your Firebase Hosting URL
4. Hard refresh (Ctrl+Shift+R or Cmd+Shift+R) to bypass cache
5. Check browser DevTools → Network tab to verify new files are loading

**Check Deployment Version:**
- Open browser DevTools → Console
- Look for any version/build identifiers in the code
- Check the commit hash in the deployment summary matches your latest commit

### 5. **Deployment Timeline**

Typical deployment takes:
- **Cloud Build:** 3-5 minutes (builds Docker image)
- **Cloud Run Deploy:** 1-2 minutes (deploys container)
- **Firebase Hosting:** 30 seconds - 1 minute (updates CDN)
- **Total:** ~5-8 minutes

### 6. **Troubleshooting**

**If deployment is stuck:**
- Check GitHub Actions logs for errors
- Verify all secrets are set correctly
- Check Cloud Build logs: https://console.cloud.google.com/cloud-build/builds

**If code doesn't seem updated:**
- Hard refresh your browser (Ctrl+Shift+R)
- Clear browser cache
- Check the deployment summary for the commit hash
- Verify you're looking at the correct Firebase project

**If deployment fails:**
- Check the error message in GitHub Actions
- Common issues:
  - Missing environment variables
  - Build errors
  - Cloud Run quota limits
  - Firebase permissions

### 7. **Automatic Notifications**

The workflow automatically triggers on:
- ✅ Push to `main` branch
- ✅ Manual trigger from GitHub Actions UI

You can also set up GitHub notifications to get emails when deployments complete.

### Quick Reference Links

- **GitHub Actions:** https://github.com/jrdxnra/pca-app/actions
- **Firebase Console:** https://console.firebase.google.com/project/performancecoachapp-26bd1/hosting
- **Cloud Build:** https://console.cloud.google.com/cloud-build/builds
- **Cloud Run:** https://console.cloud.google.com/run/detail/us-central1/pca-app
