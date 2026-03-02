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
    const result = await ensureCoachAccountProvisioned({
      userId: decodedToken.uid,
      displayName: decodedToken.name,
      email: decodedToken.email,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Error provisioning account via API:', error);
    return NextResponse.json({ error: 'Failed to provision account' }, { status: 500 });
  }
}
