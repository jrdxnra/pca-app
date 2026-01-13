# Ready to Test Checklist ✅

## What's Already Configured

### ✅ Firebase & Database
- **Firestore Rules**: Deployed (open access until Dec 31, 2026)
- **Firestore Indexes**: Deployed
- **Firebase Config**: Properly injected into client bundle
- **Database Connection**: Working

### ✅ Google Calendar Integration
- **OAuth Redirect URI**: Configured for `https://performancecoach.web.app/api/auth/google/callback`
- **API Routes**: Working (tested - redirects to Google OAuth)

### ✅ Deployment
- **Cloud Run**: Deployed and running
- **Firebase Hosting**: Deployed and routing to Cloud Run
- **Environment Variables**: All set in Cloud Run

## What to Test Now

### 1. Firestore Data Loading
- ✅ Go to: https://performancecoach.web.app/clients
- ✅ Should see your clients list (or empty state if no clients yet)
- ✅ Try adding a new client
- ✅ Verify it saves and appears in the list

### 2. Google Calendar Connection
- ✅ Click the calendar icon in the header
- ✅ Should redirect to Google OAuth
- ✅ Authorize access
- ✅ Should redirect back and show calendar connected
- ✅ Go to Schedule tab - should see calendar events

### 3. Core Features
- ✅ **Clients**: Add, edit, delete clients
- ✅ **Programs**: Create programs for clients
- ✅ **Schedule**: View calendar, assign workouts
- ✅ **Workouts**: Build workouts, assign to schedule
- ✅ **Movements**: Browse movement catalog

### 4. Data Persistence
- ✅ Refresh the page - data should persist
- ✅ Navigate between pages - data should load
- ✅ Add data on one page, verify it appears on related pages

## If Something Doesn't Work

### Firestore Errors
- Check browser console for errors
- Verify Firestore rules are deployed: `firebase deploy --only firestore:rules`
- Check if data exists in Firebase Console: https://console.firebase.google.com/project/performancecoachapp-26bd1/firestore

### Calendar Not Connecting
- Verify OAuth redirect URI in Google Cloud Console matches: `https://performancecoach.web.app/api/auth/google/callback`
- Check Cloud Run logs: `gcloud run services logs read pca-app --region us-central1 --tail`

### Data Not Loading
- Open browser DevTools → Console tab
- Look for Firebase errors
- Check Network tab for failed requests
- Verify Firebase config is present: `console.log(window.__FIREBASE_CONFIG__)`

## Quick Commands

```bash
# View Cloud Run logs
gcloud run services logs read pca-app --region us-central1 --tail

# Redeploy Firestore rules
firebase deploy --only firestore:rules

# Redeploy everything
gcloud builds submit --config=cloudbuild-simple.yaml .
gcloud run deploy pca-app --image gcr.io/performancecoachapp-26bd1/pca-app:latest --platform managed --region us-central1 --allow-unauthenticated --port 3000
firebase deploy --only hosting
```

## You're Ready! 🚀

Everything is configured. Start testing at:
**https://performancecoach.web.app**
