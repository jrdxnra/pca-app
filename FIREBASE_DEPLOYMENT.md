# Firebase Hosting Deployment Guide

## Current Setup

Your app is currently deployed on **Vercel**, which works great for Next.js apps with API routes. 

## Firebase Hosting Options

Since your app has **API routes** (Google Calendar auth, etc.), you have two options:

### Option 1: Keep Vercel (Recommended for Now)
- ✅ Already working
- ✅ Full Next.js support with API routes
- ✅ Automatic deployments
- ✅ Free tier is generous

**No changes needed** - you're already live!

### Option 2: Firebase Hosting + Cloud Run
For full Next.js support with API routes on Firebase:

1. **Deploy Next.js to Cloud Run** (handles API routes)
2. **Use Firebase Hosting** as CDN (serves static assets)
3. **Configure rewrites** to route API calls to Cloud Run

This requires:
- Google Cloud project setup
- Cloud Run service configuration
- More complex deployment process

### Option 3: Static Export (Limited)
- ❌ **Breaks API routes** (Google Calendar auth won't work)
- ✅ Simple deployment
- Only use if you remove/move API routes elsewhere

## Quick Start: Test Static Build Locally

To test if your app works without API routes:

```bash
# Temporarily enable static export
# Edit next.config.ts and add: output: 'export'
npm run build
npm run start  # Test the static build
```

## Recommended Approach

**For now**: Keep using Vercel for production. It's working perfectly.

**For Firebase**: Set up Cloud Run when you're ready for a more complex deployment.

## Environment Variables for Firebase

If deploying to Firebase, set these in Firebase Console → Project Settings → Environment Variables:

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=your-redirect-uri
```

## Deployment Commands

### Deploy Firestore Rules Only
```bash
firebase deploy --only firestore:rules
```

### Deploy Everything
```bash
firebase deploy
```

### Deploy Hosting Only (if using static export)
```bash
firebase deploy --only hosting
```
