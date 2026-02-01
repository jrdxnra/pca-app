# Codespaces Development Guide (PC+)

This repo is set up to run cleanly in **GitHub Codespaces** using the devcontainer in `.devcontainer/`.

## One-time setup

### 1) Create a Codespace

GitHub → **Code** → **Codespaces** → **Create codespace on main**

### 2) Add Codespaces secrets

GitHub → Repo → **Settings** → **Secrets and variables** → **Codespaces** → **New repository secret**

Add:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

Optional:

- `GOOGLE_REDIRECT_URI` (the devcontainer can auto-detect a Codespaces redirect URI; set this only if you want to override)

## Daily workflow

### Start the dev server

```bash
npm run dev
```

If Turbopack acts flaky, use the stable dev server:

```bash
npm run dev:stable
```

### Open the app

Use the **Ports** panel for port `3000` (it should auto-open a preview).

Hot reload / Fast Refresh should work normally.

## Google OAuth in Codespaces

OAuth requires an exact match redirect URI.

### Your redirect URI

Codespaces uses:

- `https://<CODESPACE_NAME>-3000.<forwarding_domain>/api/auth/google/callback`

In most cases, `.devcontainer/setup-env.sh` will auto-populate `GOOGLE_REDIRECT_URI` to that value when creating `.env.local`.

### Add it in Google Cloud Console

Google Cloud Console → **APIs & Services** → **Credentials** → OAuth 2.0 Client ID → **Authorized redirect URIs**

Add the exact URI from above.

### If you recreate the Codespace

The forwarded URL may change. If OAuth suddenly fails with `redirect_uri_mismatch`, add the new redirect URI.

## Notes on secrets

- `.devcontainer/setup-env.sh` intentionally does **not** contain any real secrets.
- `.env.local` is ignored by git (`.gitignore` ignores `.env*`).

