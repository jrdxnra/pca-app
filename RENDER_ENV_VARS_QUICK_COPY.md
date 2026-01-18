# Render Environment Variables - Quick Copy/Paste

## Your Render Service
- **URL**: https://pca-app-gqj9.onrender.com
- **Service ID**: srv-d5mmn8h4tr6s73cp18lg

## Quick Copy/Paste Format

Copy each line and paste into Render dashboard (Environment → Add Environment Variable):

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=performancecoachapp-26bd1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=performancecoachapp-26bd1.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=63362206075
NEXT_PUBLIC_FIREBASE_APP_ID=1:63362206075:web:1a35b23242b06fd56f15de
GOOGLE_CLIENT_ID=63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://pca-app-gqj9.onrender.com/api/auth/google/callback
NODE_ENV=production
```

## Manual Entry (If Copy/Paste Doesn't Work)

In Render dashboard → Your Service → Environment → Add Environment Variable:

1. **Name**: `NEXT_PUBLIC_FIREBASE_API_KEY`  
   **Value**: `AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA`

2. **Name**: `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`  
   **Value**: `performancecoachapp-26bd1.firebaseapp.com`

3. **Name**: `NEXT_PUBLIC_FIREBASE_PROJECT_ID`  
   **Value**: `performancecoachapp-26bd1`

4. **Name**: `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`  
   **Value**: `performancecoachapp-26bd1.firebasestorage.app`

5. **Name**: `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`  
   **Value**: `63362206075`

6. **Name**: `NEXT_PUBLIC_FIREBASE_APP_ID`  
   **Value**: `1:63362206075:web:1a35b23242b06fd56f15de`

7. **Name**: `GOOGLE_CLIENT_ID`  
   **Value**: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`

8. **Name**: `GOOGLE_CLIENT_SECRET`  
   **Value**: `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`

9. **Name**: `GOOGLE_REDIRECT_URI`  
   **Value**: `https://pca-app-gqj9.onrender.com/api/auth/google/callback`

10. **Name**: `NODE_ENV`  
    **Value**: `production`

## After Adding Variables

Once all variables are added, the service will automatically redeploy with the new environment variables.

Then we need to update Google OAuth settings to include the Render URL.
