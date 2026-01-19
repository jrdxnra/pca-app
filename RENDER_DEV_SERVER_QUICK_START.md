# Render Dev Server - Quick Start Guide

## TL;DR - Create Dev Service in 5 Minutes

### 1. Create Service in Render Dashboard

1. Go to: https://dashboard.render.com
2. **New +** → **Web Service**
3. Connect repo: `jrdxnra/pca-app`
4. Branch: `render-dev` ← **Dedicated dev branch for hot reload**

### 2. Configure Settings

**Basic:**
- **Name**: `pca-app-dev`
- **Region**: Oregon (us-west)
- **Branch**: `cursor/react-query-calendar-workouts-e64a`

**Build & Deploy:**
- **Build Command**: `npm install` ← **No build step!**
- **Start Command**: `npm run dev` ← **Dev server!**
- **Plan**: Starter ($7/month)

### 3. Copy Environment Variables

Go to your production service (`pca-app`) → Environment → Copy all variables to dev service, BUT:

- Change `NODE_ENV` to `development` (not `production`)
- `GOOGLE_REDIRECT_URI` will be different (update after getting dev URL)

### 4. Get Dev URL & Update OAuth

After service creates:
1. Get URL: `https://pca-app-dev-XXXX.onrender.com`
2. Update `GOOGLE_REDIRECT_URI` in dev service env vars
3. Add to Google OAuth:
   - **Authorized JavaScript origins**: `https://pca-app-dev-XXXX.onrender.com`
   - **Authorized redirect URIs**: `https://pca-app-dev-XXXX.onrender.com/api/auth/google/callback`

### 5. Test Hot Reload

1. Wait for first deployment (5-8 min)
2. Make a code change → commit → push
3. Watch logs → Should see hot reload in 10-30 seconds
4. Changes appear instantly!

## Environment Variables Checklist

Copy these from production service (`pca-app`):

✅ `NEXT_PUBLIC_FIREBASE_API_KEY`
✅ `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
✅ `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
✅ `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
✅ `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
✅ `NEXT_PUBLIC_FIREBASE_APP_ID`
✅ `GOOGLE_CLIENT_ID`
✅ `GOOGLE_CLIENT_SECRET`
✅ `GOOGLE_REDIRECT_URI` ← **Update with dev service URL**
✅ `NODE_ENV` = `development` ← **Important: Use development**

## What You Get

- ✅ **Instant hot reload** - Changes in 10-30 seconds
- ✅ **No full builds** - Just hot reload
- ✅ **Always-on** - No cold starts ($7/month)
- ✅ **Same as local dev** - But in the cloud

## Cost

- **Production**: $7/month (`pca-app`)
- **Dev**: $7/month (`pca-app-dev`)
- **Total**: $14/month

---

For detailed instructions, see `RENDER_DEV_SERVER_SETUP.md`
