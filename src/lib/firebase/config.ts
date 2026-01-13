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

// Initialize Firebase (skip during builds without env vars)
const app = hasFirebaseConfig ? (getApps().length ? getApp() : initializeApp(firebaseConfig)) : undefined;

// Initialize Firebase services
export const db: Firestore = app ? getFirestore(app) : (undefined as unknown as Firestore);
export const auth: Auth = app ? getAuth(app) : (undefined as unknown as Auth);

export default app;
