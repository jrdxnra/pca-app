import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
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

// Lazy initialization to handle async script loading race conditions
let _app: FirebaseApp | undefined;
let _db: Firestore | undefined;
let _auth: Auth | undefined;

function ensureInitialized(): FirebaseApp | undefined {
  if (_app) return _app;
  
  const firebaseConfig = getPublicFirebaseConfig();
  const hasFirebaseConfig = Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );

  if (!hasFirebaseConfig) {
    console.warn('Firebase config not available yet');
    return undefined;
  }

  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}

// Getter for db that ensures initialization
export function getDb(): Firestore {
  if (_db) return _db;
  const app = ensureInitialized();
  if (!app) {
    throw new Error('Firebase not initialized - config may not be available yet');
  }
  _db = getFirestore(app);
  return _db;
}

// Getter for auth that ensures initialization
export function getAuthInstance(): Auth {
  if (_auth) return _auth;
  const app = ensureInitialized();
  if (!app) {
    throw new Error('Firebase not initialized - config may not be available yet');
  }
  _auth = getAuth(app);
  return _auth;
}

// For backwards compatibility, export db and auth as getters
// These will throw if Firebase isn't initialized
export const db: Firestore = new Proxy({} as Firestore, {
  get(_, prop) {
    return (getDb() as any)[prop];
  }
});

export const auth: Auth = new Proxy({} as Auth, {
  get(_, prop) {
    return (getAuthInstance() as any)[prop];
  }
});

export default ensureInitialized();
