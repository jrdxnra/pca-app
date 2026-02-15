import { NextRequest, NextResponse } from 'next/server';
import { storeTokens } from '@/lib/google-calendar/adapters/token-adapter';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '@/lib/firebase/admin';

export async function POST(request: NextRequest) {
    try {
        const { accessToken, refreshToken, idToken } = await request.json();

        if (!accessToken || !idToken) {
            return NextResponse.json({ error: 'Missing tokens' }, { status: 400 });
        }

        // Verify the user via Firebase Admin
        const adminApp = getFirebaseAdminApp();
        const auth = getAuth(adminApp);
        let decodedToken;

        try {
            decodedToken = await auth.verifyIdToken(idToken);
        } catch (error) {
            console.error('Error verifying ID token:', error);
            return NextResponse.json({ error: 'Invalid ID token' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        console.log(`[SaveTokens] Saving tokens for user: ${userId}`);

        // Store the tokens
        const expiryDate = Date.now() + (60 * 60 * 1000); // Default 1 hour expiry

        await storeTokens({
            accessToken,
            refreshToken, // Might be null if user has already granted offline access previously without prompt
            expiryDate,
            userId
        }, userId);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error saving tokens:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
