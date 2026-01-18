# Correct Vercel CLI Commands for Environment Variables

Run these commands **one at a time** from `~/projects/pca-main`:

## Step 1: Install and Login
```bash
npm install -g vercel
vercel login
vercel link
```

## Step 2: Add Environment Variables

**For each variable, you'll be prompted to paste the value. Copy the value BEFORE running each command.**

### GOOGLE_CLIENT_ID (Production):
```bash
vercel env add GOOGLE_CLIENT_ID production
```
When prompted, paste: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`

### GOOGLE_CLIENT_ID (Preview):
```bash
vercel env add GOOGLE_CLIENT_ID preview
```
When prompted, paste: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`

### GOOGLE_CLIENT_ID (Development):
```bash
vercel env add GOOGLE_CLIENT_ID development
```
When prompted, paste: `63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com`

---

### GOOGLE_CLIENT_SECRET (Production):
```bash
vercel env add GOOGLE_CLIENT_SECRET production
```
When prompted, paste: `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`

### GOOGLE_CLIENT_SECRET (Preview):
```bash
vercel env add GOOGLE_CLIENT_SECRET preview
```
When prompted, paste: `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`

### GOOGLE_CLIENT_SECRET (Development):
```bash
vercel env add GOOGLE_CLIENT_SECRET development
```
When prompted, paste: `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`

---

### GOOGLE_REDIRECT_URI (Production):
```bash
vercel env add GOOGLE_REDIRECT_URI production
```
When prompted, paste: `https://pca-app-eta.vercel.app/api/auth/google/callback`

### GOOGLE_REDIRECT_URI (Preview):
```bash
vercel env add GOOGLE_REDIRECT_URI preview
```
When prompted, paste: `https://pca-app-eta.vercel.app/api/auth/google/callback`

### GOOGLE_REDIRECT_URI (Development):
```bash
vercel env add GOOGLE_REDIRECT_URI development
```
When prompted, paste: `http://localhost:3000/api/auth/google/callback`

---

## Step 3: Verify
```bash
vercel env ls
```

## Step 4: Redeploy
```bash
vercel --prod
```

Or just push a commit and Vercel will auto-deploy with the new env vars.
