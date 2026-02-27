import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
    });
}

const db = getFirestore();

/**
 * POST /api/admin/invitations
 * Send an invitation to a coach
 */
export async function POST(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await request.json();
        const { invitedEmail, role } = body;

        if (!invitedEmail || !role) {
            return NextResponse.json(
                { error: 'Missing required fields' },
                { status: 400 }
            );
        }

        if (!['trainer', 'client'].includes(role)) {
            return NextResponse.json(
                { error: 'Invalid role' },
                { status: 400 }
            );
        }

        // Verify user is account owner
        const membershipsQuery = db.collection('memberships').where('userId', '==', userId);
        const membershipSnaps = await membershipsQuery.get();
        
        const ownerMembership = membershipSnaps.docs.find(doc => doc.data().role === 'owner');
        if (!ownerMembership) {
            return NextResponse.json(
                { error: 'Only account owners can send invitations' },
                { status: 403 }
            );
        }

        const accountId = ownerMembership.data().accountId;

        // Check if invitation already exists
        const existingInvitation = await db.collection('invitations')
            .where('accountId', '==', accountId)
            .where('invitedEmail', '==', invitedEmail.toLowerCase())
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (!existingInvitation.empty) {
            return NextResponse.json(
                { error: 'Pending invitation already exists' },
                { status: 400 }
            );
        }

        // Create invitation
        const invitationId = `${accountId}_${invitedEmail}_${Date.now()}`;
        await db.collection('invitations').doc(invitationId).set({
            accountId,
            invitedEmail: invitedEmail.toLowerCase(),
            role,
            status: 'pending',
            invitedBy: userId,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        // TODO: Send email invitation
        // await sendInvitationEmail(invitedEmail, accountId, invitationId);

        return NextResponse.json(
            {
                success: true,
                invitationId,
                message: 'Invitation sent successfully',
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error sending invitation:', error);
        return NextResponse.json(
            { error: 'Failed to send invitation' },
            { status: 500 }
        );
    }
}

/**
 * GET /api/admin/invitations
 * Get all invitations for the account
 */
export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(token);
        const userId = decodedToken.uid;

        // Verify user is account owner
        const membershipsQuery = db.collection('memberships').where('userId', '==', userId);
        const membershipSnaps = await membershipsQuery.get();
        
        const ownerMembership = membershipSnaps.docs.find(doc => doc.data().role === 'owner');
        if (!ownerMembership) {
            return NextResponse.json(
                { error: 'Only account owners can view invitations' },
                { status: 403 }
            );
        }

        const accountId = ownerMembership.data().accountId;

        // Get invitations
        const invitations = await db.collection('invitations')
            .where('accountId', '==', accountId)
            .orderBy('createdAt', 'desc')
            .get();

        const data = invitations.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ invitations: data });
    } catch (error) {
        console.error('Error fetching invitations:', error);
        return NextResponse.json(
            { error: 'Failed to fetch invitations' },
            { status: 500 }
        );
    }
}
