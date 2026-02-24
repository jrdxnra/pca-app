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
        try {
            const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
                process.env.GOOGLE_CLOUD_PROJECT ||
                process.env.FIREBASE_PROJECT_ID ||
                'performancecoachapp-26bd1';

            console.log('[Firebase Admin] Initializing with Project ID:', projectId);

            const options: admin.AppOptions = {
                projectId: projectId,
            };

            // Check if we have a service account key in environment variables
            if (process.env.FIREBASE_SERVICE_ACCOUNT) {
                try {
                    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
                    options.credential = admin.credential.cert(serviceAccount);
                    console.log('[Firebase Admin] Using service account from environment');
                } catch (e) {
                    console.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT, falling back to applicationDefault');
                    options.credential = admin.credential.applicationDefault();
                }
            } else {
                options.credential = admin.credential.applicationDefault();
            }

            admin.initializeApp(options);
            console.log('[Firebase Admin] Initialized successfully');
        } catch (error) {
            console.error('[Firebase Admin] Initialization fatal error:', error);
            throw error; // Re-throw to inform the caller (e.g., API route)
        }
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
