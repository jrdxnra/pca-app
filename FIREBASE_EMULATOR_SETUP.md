# Firebase Emulator Setup for Fast Local Development

## Overview

Firebase Emulators allow fast local development without using your laptop's resources heavily. Emulators run locally but are lightweight compared to the full Next.js dev server.

**CRITICAL:** Emulators are ONLY for development. Production builds NEVER use emulators.

## Setup

### 1. Install Firebase Tools (if not already installed)
```bash
npm install -g firebase-tools
```

### 2. Start Emulators
In one terminal:
```bash
npm run emulators
```

This starts:
- Firestore Emulator on `localhost:8080`
- Auth Emulator on `localhost:9099`
- Emulator UI on `http://localhost:4000`

### 3. Start Next.js Dev Server with Emulators
In another terminal:
```bash
npm run dev:emulator
```

This sets `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true` which tells the app to connect to emulators.

## How It Works

### Development Mode (with emulators):
- `NODE_ENV=development` AND `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`
- Connects to local emulators
- Fast, no cloud calls
- Mock data in emulators

### Production Mode:
- `NODE_ENV=production` OR `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` not set
- **ALWAYS** uses real Firebase
- **NEVER** connects to emulators
- Real data, real services

## Safety Guarantees

1. **Production builds check**: `NODE_ENV === 'production'` disables emulators
2. **Environment variable required**: Must explicitly set `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`
3. **Build-time check**: Production builds never include emulator connection code
4. **No emulator code in production**: Emulator connections are development-only

## Workflow

### Fast Development:
```bash
# Terminal 1: Start emulators
npm run emulators

# Terminal 2: Start dev server with emulators
npm run dev:emulator
```

### Test with Real Services:
```bash
# Just use regular dev (no emulator flag)
npm run dev
```

### Production Deployment:
- Automatically uses real services (emulators disabled)
- No configuration needed
- Always real data

## Emulator UI

Access at: `http://localhost:4000`

- View Firestore data
- Manage Auth users
- Import/export data
- See emulator logs

## Import Real Data (Optional)

You can import real Firestore data into emulators for testing:

```bash
# Export from real Firestore
gcloud firestore export gs://your-bucket/backup

# Import to emulator (requires emulator setup)
firebase emulators:exec --import=./backup "npm run dev:emulator"
```

## Important Notes

- **Emulators are development-only** - Production never uses them
- **Mock data stays in emulators** - Never deployed to production
- **Fast iteration** - No deployment needed for most development
- **Real services when needed** - Can still test with real Firebase by not using emulator flag

## Troubleshooting

### Emulators won't start
- Check if ports 8080, 9099, 4000 are available
- Make sure Firebase CLI is installed: `firebase --version`

### App not connecting to emulators
- Make sure you're using `npm run dev:emulator` (not `npm run dev`)
- Check that emulators are running: `http://localhost:4000`

### Production accidentally using emulators
- **This should never happen** - Production builds check `NODE_ENV`
- If concerned, verify: `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` is never set in production env vars
