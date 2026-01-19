# Update Google OAuth Settings for Render

## Your Render URL
**https://pca-app-gqj9.onrender.com**

## Add to Google Cloud Console OAuth Settings

Go to: https://console.cloud.google.com/apis/credentials?project=performancecoachapp-26bd1

Find your OAuth 2.0 Client ID and click to edit.

### Add to "Authorized JavaScript origins":
Add this URL:
```
https://pca-app-gqj9.onrender.com
```

### Add to "Authorized redirect URIs":
Add this URL:
```
https://pca-app-gqj9.onrender.com/api/auth/google/callback
```

## Updated OAuth Settings Should Look Like:

**Authorized JavaScript origins:**
1. `http://localhost:3000`
2. `https://pca-app-eta.vercel.app`
3. `https://performancecoach.web.app`
4. `https://performancecoach.firebaseapp.com`
5. `https://pca-app-gqj9.onrender.com` ← **ADD THIS**

**Authorized redirect URIs:**
1. `http://localhost:3000/api/auth/google/callback`
2. `https://pca-app-eta.vercel.app/api/auth/google/callback`
3. `https://performancecoach.web.app/api/auth/google/callback`
4. `https://performancecoach.firebaseapp.com/api/auth/google/callback`
5. `https://pca-app-gqj9.onrender.com/api/auth/google/callback` ← **ADD THIS**

## After Adding

1. Click "Save" in Google Cloud Console
2. Wait 1-2 minutes for changes to propagate
3. Test OAuth on Render: https://pca-app-gqj9.onrender.com/configure
4. Should redirect correctly after OAuth

## Test

Once OAuth settings are updated:
1. Go to: https://pca-app-gqj9.onrender.com/configure
2. Click "Connect Google Calendar"
3. Should redirect to Google OAuth
4. After authorizing, should redirect back to Render (not 0.0.0.0:3000)
