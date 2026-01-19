# Render Environment Variables - Complete List

## Your Render URL
**https://pca-app-gqj9.onrender.com**

## Environment Variables to Add in Render Dashboard

Go to your Render service → Environment → Add each variable:

### Firebase Config:
1. **NEXT_PUBLIC_FIREBASE_API_KEY** = `AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA`
2. **NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN** = `performancecoachapp-26bd1.firebaseapp.com`
3. **NEXT_PUBLIC_FIREBASE_PROJECT_ID** = `performancecoachapp-26bd1`
4. **NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET** = `performancecoachapp-26bd1.firebasestorage.app`
5. **NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID** = `63362206075`
6. **NEXT_PUBLIC_FIREBASE_APP_ID** = `1:63362206075:web:1a35b23242b06fd56f15de`

### Google OAuth:
7. **GOOGLE_CLIENT_ID** = `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`
8. **GOOGLE_CLIENT_SECRET** = `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`
9. **GOOGLE_REDIRECT_URI** = `https://pca-app-gqj9.onrender.com/api/auth/google/callback` ← **Use this exact URL**

### Node Environment:
10. **NODE_ENV** = `production`

## Next: Update Google OAuth Settings

After adding these, we need to add the Render URL to Google Cloud Console OAuth settings.
