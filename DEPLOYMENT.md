# Deployment Guide

This project deploys the Next.js app to Google Cloud Run and frontloads it through Firebase Hosting. The `deploy-firebase.sh` script orchestrates the build pipeline so we have a single command to promote the latest commit.

## Prerequisites

1. **Tooling installed and authenticated**
   - [`firebase-tools`](https://firebase.google.com/docs/cli) (`npm install -g firebase-tools`).
   - [Google Cloud SDK](https://cloud.google.com/sdk/docs/install) with `gcloud` on your `PATH`.
   - Run `firebase login` and `gcloud auth login` once per workstation.
2. **Project context set**
   - `firebase use performancecoachapp-26bd1` (or whichever project you are targeting).
   - `.env.production` must exist and include the public Firebase vars plus the Google Calendar OAuth values (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`). The script loads this file automatically.
3. **Code ready**
   - Working tree clean and the commit pushed to `origin/main` (we deploy the code that the script builds from the local filesystem, so ensure it matches what you expect).
   - Optional but recommended: `npm run lint` / `npm run test`, and smoke the app locally via `npm run dev`.

## Standard Production Deploy

```bash
./deploy-firebase.sh
```

What the script does:

1. Verifies the Firebase and Google Cloud CLIs are installed.
2. Loads environment variables from `.env.production` (falls back to `.env.local` if needed).
3. Determines the active Firebase project (`firebase use`).
4. Calculates the current git SHA (`SHORT_SHA`) for traceability.
5. Runs `gcloud builds submit` using `cloudbuild.yaml`, pushing an image tagged `gcr.io/<project>/pca-app:<SHORT_SHA>` and deploying it to the `pca-app` Cloud Run service in `us-central1`.
6. Runs `firebase deploy --only hosting`, which points Firebase Hosting at the new Cloud Run service.

The script streams Cloud Build progress to the terminal and prints the Cloud Run URL plus the Firebase Hosting URL when it finishes. Typical runtime is ~5 minutes.

### Monitoring & Logs

- The script prints a Cloud Build URL. Open it to see build logs if something fails.
- Cloud Run revisions can be viewed in the GCP console (`Cloud Run → pca-app`).
- Firebase Hosting releases are visible in the Firebase console under "Hosting".

### Post-deploy checks

1. Visit Cloud Run directly: https://pca-app-awu2h3ecyq-uc.a.run.app
2. Hit the public site: https://performancecoach.web.app
3. Run through a quick smoke test (login, dashboard, analytics, builder) to ensure the new behavior is live.

## Firestore Rules / Other Targets

If Firestore security rules changed, deploy them explicitly:

```bash
firebase deploy --only firestore:rules
```

(You can run this before or after the main script; it executes quickly.)

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `firebase` or `gcloud` command not found | Install the CLIs, or source `$HOME/google-cloud-sdk/path.bash.inc` if the SDK was already downloaded. |
| `No active project` error | Run `firebase use performancecoachapp-26bd1`. |
| Build fails with missing env var | Ensure `.env.production` contains all required keys; regenerate Google Calendar credentials if needed. |
| Cloud Build exits with `143` | The script already disables the webpack build worker to avoid this. If it reappears, rerun the script—Cloud Build handles caching. |
| Hosting shows the old version | Run `firebase deploy --only hosting` once more; occasionally retries are required if a deploy was interrupted. |

## Summary

1. `firebase use performancecoachapp-26bd1`
2. Verify `.env.production`
3. `./deploy-firebase.sh`
4. Smoke-test Cloud Run + Firebase Hosting
5. `firebase deploy --only firestore:rules` (only when rules changed)

Keep this guide handy so we can repeat the exact flow every time.
