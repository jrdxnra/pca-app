# Manual Steps to Add Vercel Environment Variables

If the Vercel dashboard is giving you a 400 error, try these manual steps:

## Option 1: Try Adding One Variable at a Time

1. **Refresh the Vercel page** - Sometimes the UI gets stuck
2. **Clear your browser cache** - Old cached data might cause issues
3. **Try in incognito/private window** - Rule out browser extensions

## Option 2: Use Vercel CLI (Most Reliable)

### Install Vercel CLI:
```bash
npm install -g vercel
```

### Login:
```bash
vercel login
```

### Link to your project:
```bash
cd /workspace
vercel link
# Select your project when prompted
```

### Add environment variables one by one:

**For Production:**
```bash
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID production

echo "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" | vercel env add GOOGLE_CLIENT_SECRET production

echo "https://pca-app-eta.vercel.app/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI production
```

**For Preview:**
```bash
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID preview

echo "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" | vercel env add GOOGLE_CLIENT_SECRET preview

echo "https://pca-app-eta.vercel.app/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI preview
```

**For Development:**
```bash
echo "63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com" | vercel env add GOOGLE_CLIENT_ID development

echo "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" | vercel env add GOOGLE_CLIENT_SECRET development

echo "http://localhost:3000/api/auth/google/callback" | vercel env add GOOGLE_REDIRECT_URI development
```

### Verify they were added:
```bash
vercel env ls
```

### Redeploy:
```bash
vercel --prod
```

## Option 3: Check Vercel Dashboard Again

After trying CLI, go back to the dashboard:
1. Settings → Environment Variables
2. They should now appear if CLI worked
3. If not, the CLI output will show any errors

## Troubleshooting 400 Error

The 400 error usually means:
- Invalid format in the value
- Missing required field
- Vercel API issue

**Try:**
1. Make sure you're selecting all three environments (Production, Preview, Development)
2. Don't include quotes around the values
3. Copy-paste the exact values (don't type them)
4. Try adding just one variable first to see which one fails
