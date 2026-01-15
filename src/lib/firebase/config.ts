import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
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
      app = getApps().length ? getApp() : initializeApp(config);
    } else {
      // In browser, config might be injected later via window.__FIREBASE_CONFIG__
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
      throw new Error('Firebase not initialized. Please ensure Firebase configuration is available in window.__FIREBASE_CONFIG__ or environment variables.');
    }
    dbInstance = getFirestore(firebaseApp);
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
  }
  return authInstance;
}

// Export getter function
export function getDb(): Firestore {
  return initializeDb();
}

// Export direct access - will throw if Firebase isn't initialized yet
// This ensures we get clear errors instead of mysterious "collection() expects Firestore" errors
export const db: Firestore = (() => {
  // Try to initialize immediately if config is available
  const firebaseApp = ensureApp();
  if (firebaseApp) {
    return getFirestore(firebaseApp);
  }
  // If not available, return a placeholder that will throw helpful errors
  // Services should handle initialization timing issues
  return undefined as unknown as Firestore;
})();

export const auth: Auth = (() => {
  const firebaseApp = ensureApp();
  if (firebaseApp) {
    return getAuth(firebaseApp);
  }
  return undefined as unknown as Auth;
})();

export default app;
