import { NextRequest } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '@/lib/firebase/admin';

/**
 * Extracts the authenticated user ID from the request headers.
 * Uses Firebase Admin SDK to verify the Bearer token.
 * 
 * @param request NextRequest
 * @returns Promise<string | null> The user ID if authenticated, null otherwise.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<string | null> {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null;
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
        const adminApp = getFirebaseAdminApp();
        const auth = getAuth(adminApp);
        const decodedToken = await auth.verifyIdToken(idToken);
        return decodedToken.uid;
    } catch (error) {
        console.error('[Auth Helper] Error verifying ID token:', error);
        return null;
    }
}
