import * as admin from 'firebase-admin';

function readServiceAccountFromEnv(): Record<string, unknown> | null {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!raw) return null;

    try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Ignore and try base64 path below.
    }

    try {
        const decoded = Buffer.from(raw, 'base64').toString('utf8');
        const parsed = JSON.parse(decoded);
        if (parsed && typeof parsed === 'object') {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // Fall through.
    }

    return null;
}

export function getFirebaseAdminApp() {
    if (!admin.apps.length) {
        try {
            const serviceAccount = readServiceAccountFromEnv();
            const serviceAccountProjectId =
                serviceAccount && typeof serviceAccount.project_id === 'string'
                    ? serviceAccount.project_id
                    : undefined;
            const projectId =
                process.env.GOOGLE_CLOUD_PROJECT ||
                process.env.FIREBASE_PROJECT_ID ||
                serviceAccountProjectId ||
                process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
                'performancecoachapp-26bd1';

            console.log('[Firebase Admin] Initializing with project:', projectId);

            const options: admin.AppOptions = {
                projectId: projectId,
            };

            // Check if we have a service account key in environment variables.
            // Support both FIREBASE_SERVICE_ACCOUNT and FIREBASE_SERVICE_ACCOUNT_KEY.
            if (serviceAccount) {
                if (!serviceAccount.project_id) {
                    serviceAccount.project_id = projectId;
                }
                options.credential = admin.credential.cert(serviceAccount as admin.ServiceAccount);
                console.log('[Firebase Admin] Using service account from environment');
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
