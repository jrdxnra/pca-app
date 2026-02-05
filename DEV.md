# Developer Documentation & Deployment Guide

This document serves as the central reference for development workflow, local setup, and deployment processes.

---

## 1. Dev Branch Strategy & Philosophy

**Created/Diverged**: January 17, 2026 (Commit `02c6772`)
**Purpose**: High-speed local development with optimized API handling.

### Core Philosophy
The `dev` branch is optimized for developer experience:
- **Speed**: Minimizes network requests and re-renders.
- **Stability**: Prevents infinite loops and UI crashes during rapid iteration.
- **Optimized APIs**: Uses aggressive caching for external APIs (Google Calendar) to prevent rate limits and latency.

### Key Differences vs Main

| Feature | Dev Branch (Optimized) | Main Branch (Production) |
| :--- | :--- | :--- |
| **API Caching** | Aggressive (10min stale, 30min GC) | Standard (Default React Query settings) |
| **Data Fetching** | Deduplicated via React Query (Single source) | Hybrid (Zustand + React Query) |
| **Re-renders** | Minimized via Selectors & Memoization | Standard React behavior |
| **Console Logs** | Suppressed/Cleaned via `logger` | Standard console output |
| **Dev Server** | `webpack` + `usePolling` (Docker/Visual Studio friendly) | `turbopack` (Default Next.js) |

### Branch Content Policy
- **Main Branch**: production code + essential documentation.
- **Dev Branch**: all of main + development process artifacts.
- **Merge Strategy**: When merging `main` -> `dev`, keep dev-only files. If `dev` content is deleted in `main`, verify if it should be restored/preserved in `dev`.

### Promoting Dev to Main
To protect `main` from dev-only artifacts (like `FUTURE_IMPROVEMENTS.md`), follow this workflow when merging `dev -> main`:

1. Checkout main: `git checkout main`
2. Merge dev: `git merge dev`
3. **Execute Cleanup**: Run `npm run clean:main`
4. Commit: `git commit -a -m "cleanup: remove dev artifacts after merge"`

---

## 2. Local Development Environment

### Codespaces Development (PC+)

This repo is set up to run cleanly in **GitHub Codespaces** using the devcontainer in `.devcontainer/`.

#### One-time setup
1.  **Create/Open Codespace**: Use the GitHub UI or VS Code Remote Explorer.
2.  **Rebuild Container**: If updating `.devcontainer` or `firebase.json`, always run `Codespaces: Rebuild Container`.
3.  **Add Secrets**: Add the following secrets in GitHub Repo Settings -> Secrets -> Codespaces:
    *   `NEXT_PUBLIC_FIREBASE_API_KEY`
    *   `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
    *   `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
    *   `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
    *   `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
    *   `NEXT_PUBLIC_FIREBASE_APP_ID`
    *   `GOOGLE_CLIENT_ID`
    *   `GOOGLE_CLIENT_SECRET`

#### Daily Workflow
*   **Start Dev Server**: `npm run dev` (or `npm run dev:stable` if Turbopack is flaky).
*   **Google OAuth**: Ensure your Codespace URL (e.g., `https://<CODESPACE_NAME>-3000.<domain>/api/auth/google/callback`) is added to the Authorized Redirect URIs in Google Cloud Console.

### Firebase Emulators

Use Firebase Emulators for fast local development without hitting real cloud resources.

#### Setup
1.  Install tools: `npm install -g firebase-tools`
2.  Start Emulators: `npm run emulators`
    *   Firestore: `localhost:8080`
    *   Auth: `localhost:9099`
    *   UI: `http://localhost:4000`
3.  Start App with Emulators: `npm run dev:emulator`

#### Modes
*   **Development (Emulators)**: `npm run dev:emulator` (Sets `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`)
*   **Production/Real Services**: `npm run dev` (Connects to real Firebase project)

---

## 3. Deployment Guide

### Overview
Your Next.js app uses a hybrid deployment model:
1.  **Cloud Run**: Handles the Next.js server (SSR) and API routes (Google Calendar Auth).
2.  **Firebase Hosting**: Serves as the CDN for static assets and routes traffic to Cloud Run.

### Prerequisites
Run `bash -c "firebase --version && gcloud --version && docker --version"` to verify tools.
1.  **Firebase CLI**: `npm install -g firebase-tools`
2.  **Google Cloud CLI**: [Install Guide](https://cloud.google.com/sdk/docs/install)
3.  **Docker**: Required for building container images.

### Environment Variables
For deployment, create a `.env.cloudrun` file (do not commit) with:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=performancecoachapp-26bd1
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://your-firebase-url.web.app/api/auth/google/callback
```

### Deployment Steps

#### Option A: Automated Script (Recommended)
This handles building, dockerizing, and deploying to both Cloud Run and Firebase Hosting.
```bash
npm run deploy:firebase
```

#### Option B: Manual Deployment
1.  **Build Next.js**: `npm run build`
2.  **Build Docker**: `docker build -t gcr.io/performancecoachapp-26bd1/pca-app:latest .`
3.  **Push to Registry**: `docker push gcr.io/performancecoachapp-26bd1/pca-app:latest`
4.  **Deploy Cloud Run**:
    ```bash
    gcloud run deploy pca-app \
      --image gcr.io/performancecoachapp-26bd1/pca-app:latest \
      --platform managed \
      --region us-central1 \
      --allow-unauthenticated \
      --port 3000 \
      --memory 2Gi \
      --cpu 2 \
      --set-env-vars "$(cat .env.cloudrun | tr '\n' ',')"
    ```
5.  **Deploy Hosting**: `firebase deploy --only hosting`

### Post-Deployment Checklist
1.  **Update OAuth**: Ensure `https://your-app-id.web.app/api/auth/google/callback` is in your Google Cloud Console OAuth credentials.
2.  **Verify**: Check `https://your-app-id.web.app` loads and you can sign in.

### Monitoring & Troubleshooting

*   **View Logs**: `gcloud run services logs read pca-app --region us-central1`
*   **Check Status**: `gcloud run services describe pca-app --region us-central1`
*   **Deployment History**: [GitHub Actions](https://github.com/jrdxnra/pca-app/actions)

#### Common Issues
*   **"gcloud: command not found"**: Install Google Cloud SDK.
*   **"Permission denied"**: Run `gcloud auth login` and `gcloud config set project performancecoachapp-26bd1`.
*   **Build Fails**: Ensure Docker is running.
*   **404 on API Routes**: Check `firebase.json` rewrites are pointing to the correct Cloud Run service name (`pca-app`).

---

## 4. Maintenance & Admin

### Updating Environment Variables
To update secrets without a full redeploy:
```bash
gcloud run services update pca-app --region us-central1 \
  --update-env-vars KEY=value
```

### Firestore Indexes & Rules
*   **Deploy Rules**: `firebase deploy --only firestore:rules`
*   **Deploy Indexes**: `firebase deploy --only firestore:indexes`

---

## 5. Coding Standards & Best Practices

### React Error #310 Prevention
We encountered significant issues with React Error #310 (Hook order mismatch) in the schedule components. To prevent this:

*   **Avoid unnecessary `useMemo`**: For simple array operations (`filter`, `find`, `map`), calculate directly. The performance cost is negligible compared to the risk of hook order errors.
*   **Avoid `array.length` dependencies**: Never use `array.length` in `useMemo` dependencies as it triggers rapid re-renders and hook mismatches.
*   **Golden Rule**: In schedule-related components, prefer direct calculation over `useMemo` unless the computation is proven to be expensive and dependencies are stable primitives.
