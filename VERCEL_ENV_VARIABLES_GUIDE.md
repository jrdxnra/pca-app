# Adding Environment Variables to Vercel - Step by Step

## Common Issues Causing 400 Errors

1. **Special characters not escaped** - The Client secret has underscores and dashes, but those should be fine
2. **Trailing spaces** - Make sure there are no extra spaces
3. **Wrong format** - Vercel expects specific format

## Step-by-Step Instructions

### Method 1: Via Vercel Dashboard (Recommended)

1. Go to https://vercel.com
2. Select your project (pca-app or similar)
3. Click **Settings** (top navigation)
4. Click **Environment Variables** (left sidebar)
5. For each variable, click **Add New**:

#### Variable 1:
- **Key**: `GOOGLE_CLIENT_ID`
- **Value**: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`
- **Environments**: Check all three (Production, Preview, Development)
- Click **Save**

#### Variable 2:
- **Key**: `GOOGLE_CLIENT_SECRET`
- **Value**: `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`
- **Environments**: Check all three (Production, Preview, Development)
- Click **Save**

#### Variable 3:
- **Key**: `GOOGLE_REDIRECT_URI`
- **Value**: `https://pca-app-eta.vercel.app/api/auth/google/callback`
- **Environments**: Check all three (Production, Preview, Development)
- Click **Save**

### Method 2: Via Vercel CLI (Alternative)

If the dashboard isn't working, you can use the CLI:

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Link to your project
vercel link

# Add environment variables
vercel env add GOOGLE_CLIENT_ID production
# Paste: 63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_SECRET production
# Paste: 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

vercel env add GOOGLE_REDIRECT_URI production
# Paste: https://pca-app-eta.vercel.app/api/auth/google/callback

# Also add to preview and development
vercel env add GOOGLE_CLIENT_ID preview
vercel env add GOOGLE_CLIENT_ID development
# (repeat for other variables)
```

## Troubleshooting 400 Error

If you're still getting a 400 error:

1. **Check for hidden characters**: Copy the values fresh from Google Cloud Console
2. **No quotes needed**: Don't wrap values in quotes
3. **No spaces**: Make sure there are no leading/trailing spaces
4. **Key format**: Must be uppercase with underscores (GOOGLE_CLIENT_ID is correct)
5. **Try one at a time**: Add them one by one to see which one fails

## After Adding Variables

1. **Redeploy**: Go to Deployments → Latest → Three dots → Redeploy
2. **Or push a commit**: Any new commit will trigger a redeploy with new env vars
3. **Wait for deployment**: Environment variables are available after redeploy

## Verify Variables Are Set

After redeploying, you can verify in Vercel:
- Settings → Environment Variables → Should show all three variables
- Or check function logs to see if they're being read
