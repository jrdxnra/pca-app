# Deployment Troubleshooting

## Common Issues

### Build Failures

**Symptom:** "Build step failure: build step 0 'gcr.io/cloud-builders/docker' failed"

**Common Causes:**
1. **Dockerfile syntax errors** - Fixed by removing unsupported cache mount syntax
2. **Missing dependencies** - Check package.json
3. **Build errors** - Check TypeScript/Next.js compilation
4. **Memory issues** - Increase Cloud Build machine type

**How to Check:**
- View Cloud Build logs: https://console.cloud.google.com/cloud-build/builds
- Check GitHub Actions logs for error details

### Permission Errors

**Symptom:** "Permission 'run.services.get' denied"

**Solution:** Grant Firebase service account Cloud Run permissions (workflow now handles this automatically)

### Slow Deployments

**Current:** 5-8 minutes
**Optimized:** 2-3 minutes (with Docker layer caching)

**Bottlenecks:**
- npm install: 2-3 min (500+ packages)
- Next.js build: 1-2 min (TypeScript compilation)
- Docker build: 1 min
- Cloud Run deploy: 1-2 min

**Optimization Status:**
- ✅ Docker layer caching enabled (automatic in Cloud Build)
- ✅ Optimized .dockerignore
- ⚠️ Cache mounts removed (not supported in Cloud Build)

## Current Status

**Last Fix:** Removed unsupported Docker cache mount syntax
**Expected:** Deployments should work now
**Monitoring:** Check latest deployment status
