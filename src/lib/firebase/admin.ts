import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
        console.log('[Firebase Admin] Initialized successfully');
    } catch (error) {
        console.error('[Firebase Admin] Initialization error:', error);
    }
}


export function getFirebaseAdminApp() {
    if (!admin.apps.length) {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID;
        console.log('[Firebase Admin] Initializing with Project ID:', projectId);
        admin.initializeApp({
            credential: admin.credential.applicationDefault(),
            projectId: projectId,
        });
    }
    return admin.app();
}

/**
 * Returns a Firestore instance using the Admin SDK
 */
export const getAdminDb = () => {
    getFirebaseAdminApp();
    return admin.firestore();
};

// Legacy export - we'll keep it but make it a function for safety if needed
// Actually, it's better to just use getAdminDb() everywhere.
