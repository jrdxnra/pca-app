# Quick Commands to Add Vercel Environment Variables

Run these commands from your project directory (`~/projects/pca-main`):

## Step 1: Install Vercel CLI (if not already installed)
```bash
npm install -g vercel
```

## Step 2: Login to Vercel
```bash
vercel login
```
(Follow the prompts to authenticate)

## Step 3: Link to your project
```bash
vercel link
```
(Select your project when prompted, or enter project name)

## Step 4: Add Environment Variables

**Add GOOGLE_CLIENT_ID:**
```bash
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID production
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID preview
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID development
```

**Add GOOGLE_CLIENT_SECRET:**
```bash
echo "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" | vercel env add GOOGLE_CLIENT_SECRET production
echo "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" | vercel env add GOOGLE_CLIENT_SECRET preview
echo "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" | vercel env add GOOGLE_CLIENT_SECRET development
```

**Add GOOGLE_REDIRECT_URI:**
```bash
echo "https://pca-app-eta.vercel.app/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI production
echo "https://pca-app-eta.vercel.app/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI preview
echo "http://localhost:3000/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI development
```

## Step 5: Verify they were added
```bash
vercel env ls
```

## Step 6: Redeploy
```bash
vercel --prod
```

Or just push a new commit and Vercel will auto-deploy with the new env vars.
