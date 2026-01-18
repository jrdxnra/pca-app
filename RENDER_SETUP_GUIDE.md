# Render Setup Guide - $7/month Tier

## Overview

Setting up Render to replace Vercel for preview/testing deployments. Using the $7/month "Starter" tier for always-on service (no cold starts).

## Step-by-Step Setup

### 1. Create Render Account
- Go to: https://render.com
- Sign up with GitHub (recommended for easy repo connection)
- Verify email

### 2. Create New Web Service
- Dashboard → "New +" → "Web Service"
- Connect GitHub repository: `jrdxnra/pca-app`
- Select branch: `cursor/react-query-calendar-workouts-e64a` (or `main` for production)

### 3. Configure Service Settings

**Basic Settings:**
- **Name**: `pca-app` (or `pca-app-preview`)
- **Region**: **Oregon (us-west)** - Closest to California
- **Branch**: `cursor/react-query-calendar-workouts-e64a`
- **Root Directory**: `/` (root of repo)

**Build & Deploy:**
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Plan**: **Starter ($7/month)** - Always-on, no cold starts

**Advanced Settings:**
- **Auto-Deploy**: Yes (deploy on every push)
- **Pull Request Previews**: Enabled (one per PR)

### 4. Environment Variables

Add all these in Render dashboard:

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
- `GOOGLE_REDIRECT_URI` = `https://your-app-name.onrender.com/api/auth/google/callback` (will get URL after creation)

**Node Environment:**
- `NODE_ENV` = `production`

### 5. Get Render URL

After service is created, you'll get:
- **Service URL**: `https://pca-app-xxxx.onrender.com` (or custom domain)
- **Update `GOOGLE_REDIRECT_URI`** with this URL

### 6. Update Google OAuth Settings

Add to Google Cloud Console OAuth:
- **Authorized JavaScript origins**: `https://your-app-name.onrender.com`
- **Authorized redirect URIs**: `https://your-app-name.onrender.com/api/auth/google/callback`

### 7. Optional: Cloud Dev Server Setup

For instant feedback during development:
- Create separate service or use same service
- Change **Start Command** to: `npm run dev`
- Access at: `https://your-app-name.onrender.com`
- **Note**: Dev server uses more resources, might want separate service

## Render Service Configuration

### Recommended Settings ($7/month Starter):

```yaml
# render.yaml (optional, can also use UI)
services:
  - type: web
    name: pca-app
    env: node
    plan: starter  # $7/month - always-on
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      # ... all other env vars
    autoDeploy: true
```

## Cost Breakdown

### $7/month Starter Plan Includes:
- ✅ Always-on (no cold starts)
- ✅ 512 MB RAM
- ✅ 0.5 CPU (shared)
- ✅ Unlimited bandwidth
- ✅ Auto-deploy from Git
- ✅ Preview deployments
- ✅ Custom domains
- ✅ SSL certificates

### Total Cost:
- **Render**: $7/month
- **Firebase**: Free tier (keeping for database)
- **Total**: $7/month

## After Setup

### Workflow:
1. **Push to branch** → Auto-deploys to Render (2-4 min)
2. **Preview URL** → Test immediately
3. **No rate limits** → Deploy as often as needed
4. **Always-on** → No cold starts

### For Development:
- Option A: Use preview deployments (2-4 min)
- Option B: Set up cloud dev server (instant hot reload)

## Migration Checklist

- [ ] Create Render account
- [ ] Connect GitHub repo
- [ ] Create Web Service ($7/month)
- [ ] Configure build/start commands
- [ ] Add all environment variables
- [ ] Get Render URL
- [ ] Update Google OAuth settings
- [ ] Test first deployment
- [ ] Verify OAuth works
- [ ] Update documentation
- [ ] Stop using Vercel (remove webhook or just don't deploy there)

## Next Steps

Once Render is set up:
1. Test deployment
2. Verify all features work
3. Update OAuth redirect URIs
4. Start using Render for all preview/testing
5. Keep Firebase for production (or move production to Render later)

---

## Last Updated
January 18, 2026
