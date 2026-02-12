import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/google-calendar/token-storage';
import { getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const status: any = {
            env: {
                nodeEnv: process.env.NODE_ENV,
                hasApiKey: !!process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
                hasProjectId: !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
            },
            firebase: {
                appInitialized: false,
                appsCount: 0,
            },
            firestore: {
                initialized: false,
                canConnect: false,
                tokenDocExists: false,
                tokenData: null,
            },
            storedTokens: null,
        };

        // Check Firebase App
        try {
            const { getApps } = await import('firebase/app');
            status.firebase.appsCount = getApps().length;
            if (getApps().length > 0) {
                status.firebase.appInitialized = true;
            }
        } catch (e: any) {
            status.firebase.error = e.message;
        }

        // Check Firestore explicitly
        try {
            const { getDb } = await import('@/lib/firebase/config');
            const db = await getDb();
            if (db) {
                status.firestore.initialized = true;

                // Try raw read
                try {
                    const tokensRef = doc(db, 'googleCalendarTokens', 'google-calendar-tokens');
                    const snap = await getDoc(tokensRef);
                    status.firestore.canConnect = true;
                    status.firestore.tokenDocExists = snap.exists();
                    if (snap.exists()) {
                        const data = snap.data();
                        status.firestore.tokenData = {
                            hasAccessToken: !!data?.accessToken,
                            hasRefreshToken: !!data?.refreshToken,
                            updatedAt: data?.updatedAt,
                        };
                    }
                } catch (readError: any) {
                    status.firestore.readError = readError.message;
                    status.firestore.readErrorCode = readError.code;
                }
            } else {
                status.firestore.initialized = false;
            }
        } catch (e: any) {
            status.firestore.initError = e.message;
        }

        // Check Firebase Admin SDK (New server-side storage)
        status.adminSdk = { initialized: false, readSuccess: false };
        try {
            const { adminDb } = await import('@/lib/firebase/admin');
            status.adminSdk.initialized = !!adminDb;

            try {
                const adminTokensRef = adminDb.collection('googleCalendarTokens').doc('google-calendar-tokens');
                const adminSnap = await adminTokensRef.get();
                status.adminSdk.readSuccess = true;
                status.adminSdk.docExists = adminSnap.exists;
                if (adminSnap.exists) {
                    const data = adminSnap.data();
                    status.adminSdk.data = {
                        hasAccessToken: !!data?.accessToken,
                        hasRefreshToken: !!data?.refreshToken,
                    };
                }
            } catch (readError: any) {
                status.adminSdk.readError = readError.message;
            }
        } catch (e: any) {
            status.adminSdk.importError = e.message;
        }

        // Check high-level getStoredTokens
        try {
            const tokens = await getStoredTokens();
            status.storedTokens = {
                found: !!tokens,
                hasAccessToken: !!tokens?.accessToken,
                hasRefreshToken: !!tokens?.refreshToken,
            };
        } catch (e: any) {
            status.storedTokensError = e.message;
        }

        return NextResponse.json(status, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({
            error: 'CRITICAL DIAGNOSTIC ERROR',
            message: error.message,
            stack: error.stack
        }, { status: 500 });
    }
}
