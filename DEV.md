# Dev Branch Strategy & Documentation

**Created/Diverged**: January 17, 2026 (Commit `02c6772`)
**Purpose**: High-speed local development with optimized API handling.

## Core Philosophy
The `dev` branch is optimized for developer experience:
- **Speed**: Minimizes network requests and re-renders.
- **Stability**: Prevents infinite loops and UI crashes during rapid iteration.
- **Optimized APIs**: Uses aggressive caching for external APIs (Google Calendar) to prevent rate limits and latency.

## Key Differences vs Main

| Feature | Dev Branch (Optimized) | Main Branch (Production) |
| :--- | :--- | :--- |
| **API Caching** | Aggressive (10min stale, 30min GC) | Standard (Default React Query settings) |
| **Data Fetching** | Deduplicated via React Query (Single source) | Hybrid (Zustand + React Query) |
| **Re-renders** | Minimized via Selectors & Memoization | Standard React behavior |
| **Console Logs** | Suppressed/Cleaned via `logger` | Standard console output |
| **Dev Server** | `webpack` + `usePolling` (Docker/Visual Studio friendly) | `turbopack` (Default Next.js) |

## Specific Optimizations (DO NOT OVERWRITE)

### 1. Google Calendar API (src/hooks/queries/useCalendarEvents.ts)
The `dev` branch implements aggressive caching to simulate an "offline-first" fail.
```typescript
// Dev Branch Settings
staleTime: 10 * 60 * 1000, // 10 minutes cache
gcTime: 30 * 60 * 1000,    // 30 minutes garbage collection
retry: false,              // No retries (prevents loops)
```
*Why*: Prevents the dev interface from slowing down due to frequent Google API roundtrips.

### 2. React Query Integration (src/app/programs/page.tsx)
The `dev` branch uses React Query selectors to prevent entire page re-renders when a single store value changes.
*Why*: Essential for typing and UI responsiveness.


## Branch Content Policy
- **Main Branch**: production code + essential documentation (README.md, DEPLOYMENT_*.md).
- **Dev Branch**: all of main + development process artifacts (ANALYSIS.md, FUTURE_IMPROVEMENTS.md, ARCHITECTURE_*.md, etc.).
- **Merge Strategy**: When merging `main` -> `dev`, keep dev-only files. If `dev` content is deleted in `main`, verify if it should be restored/preserved in `dev`.

## Promoting Dev to Main
To protect `main` from dev-only artifacts (like `FUTURE_IMPROVEMENTS.md`), follow this workflow when merging `dev -> main`:

1. Checkout main: `git checkout main`
2. Merge dev: `git merge dev`
3. **Execute Cleanup**: Run `npm run clean:main`
4. Commit: `git commit -a -m "cleanup: remove dev artifacts after merge"`

This ensures features are promoted but process documentation remains in `dev`.

## Conflict Resolution Strategy
When merging `main` (UI features) into `dev`:
1. **Preserve** `src/hooks/queries/useCalendarEvents.ts` from `dev`.
2. **Preserve** `src/app/programs/page.tsx` structural logic from `dev`.
3. **Accept** only the UX additions (new buttons, layout changes) from `main`.

## Codespaces Development Guide

This repo is set up to run cleanly in **GitHub Codespaces** (Hybrid Workflow).

### 1) Connect Local Editor (Antigravity/VS Code)
1.  Install **GitHub Codespaces** extension.
2.  Click the Remote Explorer icon (monitor with >_).
3.  Select "GitHub Codespaces" -> Connect to your codespace on `dev` branch.

### 2) Troubleshooting: Connect via Standard SSH
**If the official extension fails** (e.g. Antigravity compatibility issues), use this backdoor:

1.  **Generate SSH Config** (Local Terminal):
    ```bash
    mkdir -p ~/.ssh
    gh codespace ssh -c <your-codespace-name> --config > ~/.ssh/codespaces_config
    cat ~/.ssh/codespaces_config >> ~/.ssh/config
    ```
2.  **Connect**:
    - Press `Ctrl+Shift+P` -> **"Remote-SSH: Connect to Host..."**
    - Select the host starting with `cs.<name>...`

### 3) Daily Workflow (Remote)
Once connected (window bottom-left is green/blue):
1.  Open Terminal (`Ctrl+~`).
2.  Navigate to workspace: `cd /workspaces/pca-app`.
3.  Start Server: `npm run dev`.
### 4) Codespaces Lifecycle (The 3 Loops)

This workflow separates "seeing it work" from "saving it forever".

#### Loop 1: The "Live" Loop (Speed: Instant)
**Goal:** See your changes on the screen.
*   **Action:** Edit a file in the remote window and hit `Ctrl+S` (Save).
*   **What Happens:** File saves directly to the cloud server; Next.js detects it.
*   **Result:** Browser (`localhost:3000`) refreshes **instantly**.
*   *Note: No `git push` needed here.*

#### Loop 2: The "Save" Loop (Speed: Daily/Hourly)
**Goal:** Back up your work to version control.
*   **Action:** In the Remote Terminal:
    ```bash
    git add .
    git commit -m "feat: my new feature"
    git push origin dev
    ```
*   **Result:** Work is safe on GitHub.

#### Loop 3: The "Deploy" Loop (Speed: Weekly)
**Goal:** Update the public website (`performancecoach.web.app`).
*   **Action:**
    ```bash
    npm run deploy:firebase
    ```
*   **Result:** Real users see the changes.
