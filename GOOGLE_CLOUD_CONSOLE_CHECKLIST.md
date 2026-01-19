# Google Cloud Console - Redirect URI Checklist

## Your Production Domain
**https://pca-app-eta.vercel.app**

## Required Redirect URIs in Google Cloud Console

Go to: Google Cloud Console → APIs & Services → Credentials → "PCA App" (OAuth client)

### Authorized JavaScript origins:
- `http://localhost:3000`
- `https://pca-app-eta.vercel.app`

### Authorized redirect URIs:
- `http://localhost:3000/api/auth/google/callback`
- `https://pca-app-eta.vercel.app/api/auth/google/callback` ← **MUST HAVE THIS ONE**

## Verify in Vercel

Make sure `GOOGLE_REDIRECT_URI` is set to:
- Production/Preview: `https://pca-app-eta.vercel.app/api/auth/google/callback`
- Development: `http://localhost:3000/api/auth/google/callback`

Check with:
```bash
vercel env ls | grep GOOGLE_REDIRECT_URI
```

## After Updating

1. Wait 2-5 minutes for Google Cloud Console changes to propagate
2. Try connecting Google Calendar again
3. It should redirect to `https://pca-app-eta.vercel.app/api/auth/google/callback` (not localhost)
