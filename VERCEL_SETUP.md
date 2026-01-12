# Vercel Deployment Setup

## Quick Start

### 1. Connect Your Repository to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New Project"
3. Import your repository: `jrdxnra/pca-app`
4. Vercel will auto-detect Next.js - click "Deploy"

### 2. Configure Environment Variables

In Vercel dashboard → Your Project → Settings → Environment Variables, add:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCXBHv53uNRIjKRvCX1e6J-PYnP6-7jmvA
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=performancecoachapp-26bd1.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=performancecoachapp-26bd1.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=63362206075
NEXT_PUBLIC_FIREBASE_APP_ID=1:63362206075:web:1a35b23242b06fd56f15de

GOOGLE_CLIENT_ID=220447477156-i7mis4i6nfqa5ag8ud2c0943t11ns98m.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://your-vercel-url.vercel.app/api/auth/google/callback
```

⚠️ **Important:** After first deployment, update `GOOGLE_REDIRECT_URI` with your actual Vercel URL, then:
- Update it in Vercel environment variables
- Add the URL to Google Cloud Console → Credentials → Authorized redirect URIs

### 3. Deploy

**Automatic:** Just push to GitHub - Vercel auto-deploys!

**Manual:** 
```bash
npm install -g vercel
vercel
```

## Workflow

1. **Edit code locally** in Cursor
2. **Commit & push** to GitHub
3. **Vercel automatically deploys** (2-3 minutes)
4. **Test on Vercel URL** - no manual steps needed!

## Benefits Over Codespaces

✅ **No code sync issues** - deploys directly from GitHub  
✅ **No port visibility problems** - public by default  
✅ **No manual restarts** - automatic on every push  
✅ **API routes work** - built for Next.js  
✅ **Preview deployments** - test before merging  
✅ **Free tier** - generous limits for testing  

## URLs

- **Production:** `https://your-project.vercel.app`
- **Preview:** Each branch/PR gets its own URL

## Troubleshooting

- **Build fails?** Check Vercel build logs in dashboard
- **Environment variables not working?** Make sure they're set in Vercel dashboard
- **API routes not working?** They should work automatically with Next.js on Vercel
