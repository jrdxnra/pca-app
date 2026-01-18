# Debugging redirect_uri_mismatch Error

## What We Know

From Vercel logs:
- **Request origin**: `https://pca-app-eta.vercel.app` ✅
- **Redirect URI being sent**: `https://pca-app-eta.vercel.app/api/auth/google/callback` ✅
- **URL-encoded in auth URL**: `https%3A%2F%2Fpca-app-eta.vercel.app%2Fapi%2Fauth%2Fgoogle%2Fcallback` ✅

From Google Cloud Console:
- **Authorized redirect URI**: `https://pca-app-eta.vercel.app/api/auth/google/callback` ✅

## The Problem

Even though they match, Google is saying `redirect_uri_mismatch`. This usually means:

1. **Client ID mismatch** - The Client ID in Vercel env vars doesn't match the OAuth client in Google Cloud Console
2. **Caching** - Google might be caching the old OAuth client configuration
3. **Multiple OAuth clients** - There might be multiple OAuth clients and we're using the wrong one

## Solution: Verify Client ID Matches

### Step 1: Get Client ID from Google Cloud Console
1. Go to Google Cloud Console → Credentials → "PCA App"
2. Copy the **Client ID** (should be: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`)

### Step 2: Verify in Vercel
```bash
vercel env ls | grep GOOGLE_CLIENT_ID
```

### Step 3: Make sure they match EXACTLY
- Google Cloud Console Client ID: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`
- Vercel GOOGLE_CLIENT_ID: Should be the SAME

### Step 4: If they don't match
Update Vercel with the correct Client ID:
```bash
vercel env rm GOOGLE_CLIENT_ID production
vercel env rm GOOGLE_CLIENT_ID preview  
vercel env rm GOOGLE_CLIENT_ID development

# Then add the correct one from Google Cloud Console
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID production
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID preview
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID development
```

### Step 5: Wait and retry
- Wait 2-5 minutes for changes to propagate
- Try connecting Google Calendar again
