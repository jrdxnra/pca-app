# Deployment Strategy

## Current Setup

**Auto-deploy on push to main** - Every code change triggers a deployment.

### Pros:
- ✅ Always up-to-date
- ✅ Automatic
- ✅ No manual steps

### Cons:
- ❌ Uses resources on every commit
- ❌ Can be wasteful during rapid development
- ❌ Multiple deployments queued

## Better Strategy: Manual Deployments

**Recommendation:** Switch to manual deployments during active development.

### How it works:
1. **Develop freely** - Commit as much as you want, no deployments
2. **Test locally** - Use `npm run dev` to test changes
3. **Deploy when ready** - Click "Run workflow" in GitHub Actions when you want to deploy

### Benefits:
- 💰 Saves Cloud Build minutes
- 💰 Saves GitHub Actions minutes
- ⚡ Faster development (no waiting for deployments)
- 🎯 Deploy only when you're ready to test in production

### When to Deploy:
- After completing a feature
- After fixing bugs
- When ready for user testing
- At end of development session

## How to Deploy Manually

1. Go to: https://github.com/jrdxnra/pca-app/actions
2. Click "Deploy to Firebase" workflow
3. Click "Run workflow" button
4. Select branch (usually `main`)
5. Click "Run workflow"

That's it! Deployment will start.

## Alternative: Deploy on Tags

We could also set it to only deploy when you create a release tag:

```yaml
on:
  workflow_dispatch:
  push:
    tags:
      - 'v*'  # Only deploy on version tags like v1.0.0
```

Then you'd deploy by:
```bash
git tag v1.0.1
git push origin v1.0.1
```

## Recommendation

**For now:** Keep auto-deploy but be aware it uses resources.

**For active development:** Switch to manual deployments to save resources.

**For production:** Auto-deploy is fine (fewer commits = fewer deployments).

Would you like me to switch to manual-only deployments?
