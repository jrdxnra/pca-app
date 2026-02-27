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
 * POST /api/admin/coaches
 * Get all coaches for the account
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

        // Get user's membership
        const membershipsQuery = db.collection('memberships').where('userId', '==', userId);
        const membershipSnaps = await membershipsQuery.get();
        
        if (membershipSnaps.empty) {
            return NextResponse.json({ error: 'User has no account' }, { status: 403 });
        }

        const userMembership = membershipSnaps.docs[0];
        const accountId = userMembership.data().accountId;
        const userRole = userMembership.data().role;

        // Only owners can manage coaches
        if (userRole !== 'owner') {
            return NextResponse.json(
                { error: 'Only account owners can manage coaches' },
                { status: 403 }
            );
        }

        // Get all trainers in the account
        const coachesQuery = db.collection('memberships').where('accountId', '==', accountId).where('role', '==', 'trainer');
        const coachSnaps = await coachesQuery.get();

        const coaches = [];
        for (const doc of coachSnaps.docs) {
            const coachData = doc.data();
            const userRecord = await getAuth().getUser(coachData.userId);
            
            coaches.push({
                id: doc.id,
                userId: coachData.userId,
                email: userRecord.email,
                displayName: userRecord.displayName,
                role: coachData.role,
                createdAt: coachData.createdAt.toDate(),
                updatedAt: coachData.updatedAt.toDate(),
            });
        }

        return NextResponse.json({ coaches });
    } catch (error) {
        console.error('Error fetching coaches:', error);
        return NextResponse.json(
            { error: 'Failed to fetch coaches' },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/admin/coaches?coachId=...
 * Remove a coach from the account
 */
export async function DELETE(request: NextRequest) {
    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(token);
        const userId = decodedToken.uid;

        const membershipId = request.nextUrl.searchParams.get('membershipId');
        if (!membershipId) {
            return NextResponse.json(
                { error: 'Missing membershipId' },
                { status: 400 }
            );
        }

        // Verify requester is owner
        const requesterQuery = db.collection('memberships').where('userId', '==', userId);
        const requesterSnaps = await requesterQuery.get();
        
        const ownerMembership = requesterSnaps.docs.find(doc => doc.data().role === 'owner');
        if (!ownerMembership) {
            return NextResponse.json(
                { error: 'Only account owners can remove coaches' },
                { status: 403 }
            );
        }

        const accountId = ownerMembership.data().accountId;

        // Verify the coach belongs to this account
        const coachMembership = await db.collection('memberships').doc(membershipId).get();
        const coachData = coachMembership.data();
        if (!coachMembership.exists || !coachData || coachData.accountId !== accountId) {
            return NextResponse.json(
                { error: 'Coach not found in this account' },
                { status: 404 }
            );
        }

        // Delete the membership
        await db.collection('memberships').doc(membershipId).delete();

        return NextResponse.json({
            success: true,
            message: 'Coach removed successfully',
        });
    } catch (error) {
        console.error('Error removing coach:', error);
        return NextResponse.json(
            { error: 'Failed to remove coach' },
            { status: 500 }
        );
    }
}
