# Render Dev Server Setup (Hot Reload)

## Overview

Setting up a separate Render service that runs `npm run dev` for instant hot reload during development. This gives you the speed of local development without freezing your laptop.

## Current Setup

- **Production Service**: `pca-app` at `https://pca-app-gqj9.onrender.com`
  - Build: `npm install && npm run build`
  - Start: `npm start`
  - Environment: `production`

- **Dev Service** (to create): `pca-app-dev`
  - Build: `npm install` (no build step)
  - Start: `npm run dev`
  - Environment: `development`

## Step-by-Step: Create Dev Service

### 1. Create New Web Service in Render

1. Go to: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. Connect GitHub repository: `jrdxnra/pca-app`
4. Select branch: `render-dev` ← **Dedicated dev branch for hot reload testing**

### 2. Configure Service Settings

**Basic Settings:**
- **Name**: `pca-app-dev`
- **Region**: **Oregon (us-west)** - Same as production
- **Branch**: `render-dev` ← **Dedicated dev branch**
- **Root Directory**: `/` (root of repo)

**Build & Deploy:**
- **Environment**: `Node`
- **Build Command**: `npm install` ← **No build step!**
- **Start Command**: `npm run dev` ← **Dev server!**
- **Plan**: **Starter ($7/month)** - Always-on, no cold starts

**Advanced Settings:**
- **Auto-Deploy**: Yes (deploy on every push)
- **Pull Request Previews**: Disabled (optional, for dev service)

### 3. Environment Variables

Copy all environment variables from your production service (`pca-app`):

**Firebase Config:**
- `NEXT_PUBLIC_FIREBASE_API_KEY` = `AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` = `performancecoachapp-26bd1.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` = `performancecoachapp-26bd1`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` = `performancecoachapp-26bd1.firebasestorage.app`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` = `63362206075`
- `NEXT_PUBLIC_FIREBASE_APP_ID` = `1:63362206075:web:1a35b23242b06fd56f15de`

**Google OAuth:**
- `GOOGLE_CLIENT_ID` = `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET` = `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`
- `GOOGLE_REDIRECT_URI` = `https://pca-app-dev-XXXX.onrender.com/api/auth/google/callback` ← **Update after getting URL**

**Node Environment:**
- `NODE_ENV` = `development` ← **Important: Use development, not production**

### 4. Get Dev Service URL

After service is created, you'll get:
- **Dev Service URL**: `https://pca-app-dev-XXXX.onrender.com`
- **Update `GOOGLE_REDIRECT_URI`** with this URL
- **Add to Google OAuth** (see step 5)

### 5. Update Google OAuth Settings

Add the dev service URL to Google Cloud Console:

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select your OAuth 2.0 Client ID
3. **Authorized JavaScript origins** - Add:
   - `https://pca-app-dev-XXXX.onrender.com`
4. **Authorized redirect URIs** - Add:
   - `https://pca-app-dev-XXXX.onrender.com/api/auth/google/callback`

### 6. Verify Hot Reload Works

1. **Wait for first deployment** - Initial setup takes 5-8 minutes
2. **Access dev service**: `https://pca-app-dev-XXXX.onrender.com`
3. **Make a code change** - Edit a file, commit, push
4. **Watch Render logs** - You should see hot reload happening
5. **Changes appear instantly** - No full rebuild needed

## How Hot Reload Works

### Development Workflow:

1. **Push code to Git** → Render detects change
2. **Render runs**: `npm install` (only if package.json changed)
3. **Render runs**: `npm run dev` (starts dev server)
4. **Next.js hot reload** → Changes appear in seconds
5. **No full build** → Much faster than production builds

### Expected Times:

- **First deployment**: 5-8 minutes (npm install + dev server start)
- **Subsequent changes**: 10-30 seconds (hot reload only)
- **Package changes**: 2-3 minutes (npm install + hot reload)

## Cost

### Option 1: Two Services (Recommended)
- **Production**: `pca-app` - $7/month (Starter plan)
- **Dev**: `pca-app-dev` - $7/month (Starter plan)
- **Total**: $14/month

### Option 2: Switch One Service (Save Money)
- **One service**: $7/month
- **Switch between dev/prod** as needed
- **Trade-off**: Manual switching, can't run both simultaneously

**Recommendation**: Start with Option 1 to test, then decide if you need both running simultaneously.

## Troubleshooting

### Dev Server Not Starting
- Check build logs for errors
- Verify `NODE_ENV=development` is set
- Ensure `npm run dev` works locally

### Hot Reload Not Working
- Check that you're using `npm run dev` (not `npm start`)
- Verify Next.js dev server is running (check logs)
- Changes should appear in 10-30 seconds

### OAuth Not Working
- Verify `GOOGLE_REDIRECT_URI` matches dev service URL
- Check Google OAuth settings include dev service URL
- Ensure environment variables are set correctly

### Slow Hot Reload
- First change after deployment: 10-30 seconds (normal)
- Subsequent changes: Should be instant
- If still slow, check Render service status

## Quick Reference

### Production Service (`pca-app`):
- **URL**: `https://pca-app-gqj9.onrender.com`
- **Build**: `npm install && npm run build`
- **Start**: `npm start`
- **Use for**: Final testing, production-like builds

### Dev Service (`pca-app-dev`):
- **URL**: `https://pca-app-dev-XXXX.onrender.com` (get after creation)
- **Build**: `npm install`
- **Start**: `npm run dev`
- **Use for**: Active development, instant feedback

---

## Last Updated
January 18, 2026
