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

## Conflict Resolution Strategy
When merging `main` (UI features) into `dev`:
1. **Preserve** `src/hooks/queries/useCalendarEvents.ts` from `dev`.
2. **Preserve** `src/app/programs/page.tsx` structural logic from `dev`.
3. **Accept** only the UX additions (new buttons, layout changes) from `main`.
