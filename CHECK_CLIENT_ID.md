# How to Check Client ID in Vercel

## Method 1: View all environment variables
```bash
vercel env ls
```
Look for the `GOOGLE_CLIENT_ID` row and check the value shown.

## Method 2: Pull environment variables locally
```bash
vercel env pull .env.vercel
cat .env.vercel | grep GOOGLE_CLIENT_ID
```

## Method 3: Check in Vercel Dashboard
1. Go to https://vercel.com
2. Your Project → Settings → Environment Variables
3. Find `GOOGLE_CLIENT_ID`
4. Click the eye icon to reveal the value

## What to Verify

The Client ID in Vercel should be:
`63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`

This must match EXACTLY the Client ID in Google Cloud Console → Credentials → "PCA App"

If they don't match, that's why you're getting `redirect_uri_mismatch` - Google is rejecting the request because the Client ID doesn't match the OAuth client that has that redirect URI configured.
