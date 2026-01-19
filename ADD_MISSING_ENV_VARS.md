# Missing Environment Variables - Add Them Now

Your `vercel env ls` only shows `GOOGLE_REDIRECT_URI`, but `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are missing!

## Add the Missing Variables

Run these commands from `~/projects/pca-main`:

### GOOGLE_CLIENT_ID:
```bash
vercel env add GOOGLE_CLIENT_ID production
# When prompted, paste: 63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_ID preview
# When prompted, paste: 63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com

vercel env add GOOGLE_CLIENT_ID development
# When prompted, paste: 63362206075-2lkbi4ilk5n41eroa9oo36gtuh9hlddd.apps.googleusercontent.com
```

### GOOGLE_CLIENT_SECRET:
```bash
vercel env add GOOGLE_CLIENT_SECRET production
# When prompted, paste: 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

vercel env add GOOGLE_CLIENT_SECRET preview
# When prompted, paste: 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

vercel env add GOOGLE_CLIENT_SECRET development
# When prompted, paste: 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
```

### Verify:
```bash
vercel env ls
```

You should now see all three:
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET  
- GOOGLE_REDIRECT_URI

### Then redeploy:
```bash
vercel --prod
```
