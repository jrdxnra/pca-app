import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import type { Auth } from 'firebase/auth';

type PublicFirebaseConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
};

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: PublicFirebaseConfig;
  }
}

function getPublicFirebaseConfig(): PublicFirebaseConfig {
  // On the server (Cloud Run), use runtime env vars.
  if (typeof window === 'undefined') {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }

  // In the browser, prefer runtime-injected config (works even when NEXT_PUBLIC_* were missing at build time).
  if (window.__FIREBASE_CONFIG__) return window.__FIREBASE_CONFIG__;

  // Fallback (local dev / older deployments).
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
}

const firebaseConfig = getPublicFirebaseConfig();

const hasFirebaseConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

// Initialize Firebase app only once
let app: ReturnType<typeof initializeApp> | undefined;
if (hasFirebaseConfig) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
}

// Helper to ensure app is initialized
function ensureApp() {
  if (!app) {
    const config = getPublicFirebaseConfig();
    if (config.apiKey && config.projectId && config.authDomain && config.appId) {
      try {
        app = getApps().length ? getApp() : initializeApp(config);
      } catch (error) {
        console.error('Error initializing Firebase app:', error);
        return undefined;
      }
    } else {
      // In browser, config might be injected later via window.__FIREBASE_CONFIG__
      // Try to wait a bit if we're in the browser
      if (typeof window !== 'undefined') {
        // Check if config is available now (script might have loaded)
        const retryConfig = getPublicFirebaseConfig();
        if (retryConfig.apiKey && retryConfig.projectId && retryConfig.authDomain && retryConfig.appId) {
          try {
            app = getApps().length ? getApp() : initializeApp(retryConfig);
            return app;
          } catch (error) {
            console.error('Error initializing Firebase app on retry:', error);
          }
        }
      }
      return undefined;
    }
  }
  return app;
}

// Lazy initialization - initialize on first access
let dbInstance: Firestore | undefined;
let authInstance: Auth | undefined;

function initializeDb(): Firestore {
  if (!dbInstance) {
    const firebaseApp = ensureApp();
    if (!firebaseApp) {
      // Log a helpful error message
      console.error('Firestore not initialized, returning defaults');
      console.error('Firebase configuration is missing. Please ensure Firebase configuration is available in window.__FIREBASE_CONFIG__ or environment variables.');
      // Return a mock that will throw clear errors when used
      throw new Error('Firebase not initialized. Please ensure Firebase configuration is available in window.__FIREBASE_CONFIG__ or environment variables.');
    }
    try {
      dbInstance = getFirestore(firebaseApp);

      // Connect to Firestore Emulator ONLY in development mode
      // CRITICAL: Never use emulators in production builds
      if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
        // Only connect if not already connected (prevents multiple connections)
        if (!(dbInstance as any)._delegate?._settings?.host?.includes('localhost')) {
          try {
            connectFirestoreEmulator(dbInstance, 'localhost', 8080);
            console.log('🔧 Connected to Firestore Emulator (development only)');
          } catch (error) {
            // Ignore if already connected
            if (!(error as Error).message.includes('already been initialized')) {
              console.warn('⚠️ Could not connect to Firestore Emulator:', error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error initializing Firestore:', error);
      throw error;
    }
  }
  return dbInstance;
}

function initializeAuth(): Auth {
  if (!authInstance) {
    const firebaseApp = ensureApp();
    if (!firebaseApp) {
      throw new Error('Firebase not initialized. Please ensure Firebase configuration is available in window.__FIREBASE_CONFIG__ or environment variables.');
    }
    authInstance = getAuth(firebaseApp);

    // Connect to Auth Emulator ONLY in development mode
    // CRITICAL: Never use emulators in production builds
    if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
      // Only connect if not already connected
      if (!(authInstance as any)._delegate?._config?.emulator) {
        try {
          connectAuthEmulator(authInstance, 'http://localhost:9099');
          console.log('🔧 Connected to Auth Emulator (development only)');
        } catch (error) {
          // Ignore if already connected
          if (!(error as Error).message.includes('already been initialized')) {
            console.warn('⚠️ Could not connect to Auth Emulator:', error);
          }
        }
      }
    }
  }
  return authInstance;
}

// Helper to wait for Firebase config in browser (if script tag hasn't loaded yet)
async function waitForFirebaseConfig(maxWait = 2000): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }

  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const config = getPublicFirebaseConfig();
    if (config.apiKey && config.projectId && config.authDomain && config.appId) {
      return true;
    }
    // Wait a bit before checking again
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  return false;
}

// Export getter function - always returns a valid Firestore instance or throws
export function getDb(): Firestore {
  // Allow server-side execution for API routes
  // The check for window is removed to allow server-side usage (e.g. in API routes)

  try {
    return initializeDb();
  } catch (error) {
    // If initialization failed, try waiting for config (in case script tag hasn't loaded)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Firebase not initialized') || errorMessage.includes('configuration is missing')) {
      // Try to wait for config synchronously (quick check)
      const config = getPublicFirebaseConfig();
      if (config.apiKey && config.projectId && config.authDomain && config.appId) {
        // Config is now available, try again
        try {
          return initializeDb();
        } catch (retryError) {
          console.error('Failed to initialize Firestore after config became available:', retryError);
          throw retryError;
        }
      }
    }
    // Re-throw with more context
    console.error('Failed to get Firestore instance:', error);
    throw error;
  }
}

// Async version for cases where we can wait for config
export async function getDbAsync(): Promise<Firestore> {
  if (typeof window === 'undefined') {
    // Server-side: no need to wait for window injection, just initialize
    return initializeDb();
  }

  // Wait for config if needed
  const configAvailable = await waitForFirebaseConfig();
  if (!configAvailable) {
    throw new Error('Firebase configuration not available after waiting. Please check your environment variables or window.__FIREBASE_CONFIG__.');
  }

  return initializeDb();
}

// Export direct access - use getDb() instead for better error handling
// This is kept for backwards compatibility but should be avoided
// We use a getter function to defer initialization until first access
let _db: Firestore | null = null;
export const db = new Proxy({} as Firestore, {
  get(_target, prop) {
    if (!_db) {
      // Only try to initialize if we have config or are on server
      // This prevents errors on initial load if config is delayed
      try {
        _db = getDb();
      } catch (e) {
        console.warn('Firestore proxy access failed (likely waiting for config):', e);
        // Return a dummy that logs errors? Or just throw?
        // Throwing is safer as it reveals bugs.
        throw e;
      }
    }
    const value = (_db as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_db);
    }
    return value;
  }
});

// Lazy export for auth - prevents initialization on import
let _auth: Auth | null = null;
export const auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (!_auth) {
      if (typeof window === 'undefined') {
        // On server, we generally advise against using Client Auth SDK
        // But we allow it if called, just log a warning if needed
        // console.warn('Accessing Firebase Auth on server.');
      }
      _auth = initializeAuth();
    }
    const value = (_auth as any)[prop];
    if (typeof value === 'function') {
      return value.bind(_auth);
    }
    return value;
  }
});

export default app;
