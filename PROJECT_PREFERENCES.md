# Project Preferences & Structure

This document tracks project preferences, deployment strategy, and structural decisions for reference.

## Deployment Strategy

### Firebase = Production/Live Updates
- **Purpose**: Live production environment for end users
- **Deployment**: Manual via `npm run deploy:firebase`
- **Use Case**:
  - Stable, tested features ready for users
  - Production updates and releases
  - Live environment with real data

**Workflow**: Validate locally → Deploy to Firebase when ready

## Project Structure

### Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State**: Zustand stores
- **Database**: Firebase Firestore
- **Forms**: React Hook Form + Zod validation

### Key Directories
```
src/
├── app/              # Next.js pages and API routes
├── components/       # Reusable UI components
│   ├── ui/          # shadcn/ui base components
│   ├── programs/    # Program/calendar components
│   ├── workouts/     # Workout builder components
│   └── movements/    # Movement catalog components
├── lib/
│   ├── firebase/    # Firebase services and config
│   ├── stores/      # Zustand state management
│   ├── types/       # TypeScript definitions
│   └── utils/       # Utility functions
└── hooks/           # Custom React hooks
```

## Development Preferences

### Code Style
- Use TypeScript strict mode
- Prefer functional components with hooks
- Use shadcn/ui components for consistency
- Follow Next.js App Router patterns

### Button Styling
- Default buttons use `variant="outline"` and `size="sm"` for consistency
- Primary actions may use `variant="default"` when appropriate
- Maintain visual consistency across the app

### State Management
- Use Zustand for global state
- Keep component state local when possible
- Firebase real-time listeners for data sync

### Error Handling
- Use ErrorBoundary for React errors
- Graceful fallbacks for Firebase operations
- User-friendly error messages

## Deployment Preferences

### Firebase (Production)
- Manual deployment via script: `npm run deploy:firebase`
- Cloud Run for Next.js server + API routes
- Firebase Hosting as CDN
- Environment variables in Cloud Run service config
- Deploy Firestore rules separately: `npm run deploy:firebase`
- **CRITICAL: Same deployment frequency rules apply** - Batch fixes, test locally first
- **Don't deploy after every small change** - Group related changes together

## Environment Variables

### Required for Both Environments
```
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI
```

## Git Workflow

### Branching
- `main` branch = production-ready code (Firebase deployment)
- `dev` branch = Google Calendar API integration (Isolated Workspace)
  - **Connection to Google API**: Strictly kept on this branch.
  - **Purpose**: Testing new calendar features without affecting the stable `main` codebase.
  - **Do NOT merge to main** until fully validated and user explicit approval.
- Feature branches for new development

### Commits & Deployment Frequency
- **CRITICAL: Batch related fixes into single commits** - Don't push after every small fix
- **Before pushing**: Test locally with `npm run build` when possible
- **Group related changes**: Multiple small fixes should be one commit, not many
- **Only push when necessary**: Not after every single line change
- Clear, descriptive commit messages
- Reference issues/features when applicable

**Example of what NOT to do:**
- ❌ Fix 1 → commit → push
- ❌ Fix 2 → commit → push  
- ❌ Fix 3 → commit → push
- This creates 3 deployments for what should be 1

**Example of what TO do:**
- ✅ Fix 1, Fix 2, Fix 3 → single commit → push
- ✅ Test locally first → fix any issues → then push
- ✅ Batch all related fixes together

## Firebase Project

- **Project ID**: `performancecoachapp-26bd1`
- **Region**: us-central1 (for Cloud Run)
- **Firestore**: Open rules for development (until auth implemented)

## Important Notes

### API Routes
- Next.js API routes require server-side execution
- Firebase: Requires Cloud Run (not static hosting) ✅

### Google OAuth
- Redirect URI must match deployment URL
- Firebase: `https://your-firebase-app.web.app/api/auth/google/callback`

### Build Configuration
- Next.js configured for `standalone` output (Cloud Run compatible)
- Dockerfile included for containerized deployment
- Static export NOT used (would break API routes)

## Documentation Files

- `README.md` - Project overview
- `FIREBASE_SETUP.md` - Firebase + Cloud Run setup
- `QUICK_START_FIREBASE.md` - Quick Firebase deployment reference
- `DEPLOYMENT_CHECKLIST.md` - Pre-production checklist
- `PROJECT_PREFERENCES.md` - This file (preferences reference)

## Development Rules (CRITICAL - Refer Often)

### React Performance (see REACT_ERROR_310_PREVENTION.md)
- **NEVER use useMemo** for simple array operations (filter, find, map)
- Calculate values directly - React Query already handles caching
- Don't try to "optimize" what doesn't need optimization

### Deployment Frequency (CRITICAL)
- **BATCH FIXES**: Multiple related fixes = ONE commit, not many
- **TEST LOCALLY FIRST**: Run `npm run build` before pushing/deploying
- **Firebase**: Same rules apply - batch fixes, test locally, don't deploy after every small change
- **Only push/deploy when necessary**: Not after every small change
- **Group related changes**: All fixes for the same issue should be one commit

### Data and Testing (CRITICAL)
- **NO MOCK DATA IN PRODUCTION**: Production builds MUST use real services only
- **Emulators OK for development**: Firebase Emulators with mock data are allowed for local dev
- **Clear separation**: Development can use emulators, production always uses real Firebase/Google Calendar
- **Never deploy emulator code**: Production code paths must never reference emulators or mocks
- **Real services in production**: All production deployments use real Firebase, real Google Calendar API, real data

**This is as important as the useMemo rule - refer to this often!**

## Last Updated
January 18, 2026
