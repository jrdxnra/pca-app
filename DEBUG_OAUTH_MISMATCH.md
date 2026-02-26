# Debugging redirect_uri_mismatch Error

## What We Know

From production logs:
- **Request origin**: `https://your-firebase-domain.web.app` ✅
- **Redirect URI being sent**: `https://your-firebase-domain.web.app/api/auth/google/callback` ✅
- **URL-encoded in auth URL**: `https%3A%2F%2Fyour-firebase-domain.web.app%2Fapi%2Fauth%2Fgoogle%2Fcallback` ✅

From Google Cloud Console:
- **Authorized redirect URI**: `https://your-firebase-domain.web.app/api/auth/google/callback` ✅

## The Problem

Even though they match, Google is saying `redirect_uri_mismatch`. This usually means:

1. **Client ID mismatch** - The Client ID in Cloud Run env vars doesn't match the OAuth client in Google Cloud Console
2. **Caching** - Google might be caching the old OAuth client configuration
3. **Multiple OAuth clients** - There might be multiple OAuth clients and we're using the wrong one

## Solution: Verify Client ID Matches

### Step 1: Get Client ID from Google Cloud Console
1. Go to Google Cloud Console → Credentials → "PCA App"
2. Copy the **Client ID** (should be: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`)

### Step 2: Verify in Cloud Run
Check the Cloud Run service environment variables for `GOOGLE_CLIENT_ID`.

### Step 3: Make sure they match EXACTLY
- Google Cloud Console Client ID: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`
- Cloud Run GOOGLE_CLIENT_ID: Should be the SAME

### Step 4: If they don't match
Update Cloud Run with the correct Client ID using the Cloud Run service env vars, then deploy a new revision.

### Step 5: Wait and retry
- Wait 2-5 minutes for changes to propagate
- Try connecting Google Calendar again
