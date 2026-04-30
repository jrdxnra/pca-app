import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp } from '@/lib/firebase/admin';
import { ensureCoachAccountProvisioned } from '@/lib/firebase/admin/provision';

getFirebaseAdminApp();

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer', '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const decodedToken = await getAuth().verifyIdToken(token);

    // Dev guardrail: if no explicit cloud credentials are configured, skip expensive provisioning attempts.
    // This prevents repeated ~20s hangs and noisy stack traces in local environments.
    const hasExplicitCloudCreds = Boolean(
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_CLOUD_PROJECT
    );

    if (
      process.env.NODE_ENV === 'development' &&
      !hasExplicitCloudCreds &&
      process.env.FORCE_DEV_PROVISION_ATTEMPT !== '1'
    ) {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: 'missing_cloud_credentials_in_dev',
        },
        { status: 200 }
      );
    }

    const result = await ensureCoachAccountProvisioned({
      userId: decodedToken.uid,
      displayName: decodedToken.name,
      email: decodedToken.email,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error provisioning account via API:', error);

    const message = error instanceof Error ? error.message : String(error);

    // Local dev fallback: never block the UI on provisioning failures.
    if (process.env.NODE_ENV === 'development') {
      return NextResponse.json(
        {
          success: true,
          skipped: true,
          reason: 'provisioning_failed_in_dev',
          detail: message,
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ error: 'Failed to provision account' }, { status: 500 });
  }
}
