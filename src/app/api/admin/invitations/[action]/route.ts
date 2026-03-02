import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { ensureCoachAccountProvisioned } from '@/lib/firebase/admin/provision';

// Initialize Firebase Admin
if (!getApps().length) {
    initializeApp({
        credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}')),
    });
}

const db = getFirestore();

/**
 * POST /api/admin/invitations/[action]
 * Actions: accept, decline, revoke
 */
export async function POST(
    request: NextRequest,
    context: { params: Promise<{ action: string }> }
) {
    try {
        const { action } = await context.params;
        const authHeader = request.headers.get('authorization');
        if (!authHeader) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await getAuth().verifyIdToken(token);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        const body = await request.json();
        const { invitationId } = body;

        if (!invitationId) {
            return NextResponse.json(
                { error: 'Missing invitationId' },
                { status: 400 }
            );
        }

        const invitationDoc = await db.collection('invitations').doc(invitationId).get();
        if (!invitationDoc.exists) {
            return NextResponse.json(
                { error: 'Invitation not found' },
                { status: 404 }
            );
        }

        const invitation = invitationDoc.data();
        if (!invitation) {
            return NextResponse.json(
                { error: 'Invitation not found' },
                { status: 404 }
            );
        }

        if (action === 'accept') {
            // User accepting their invitation
            if (invitation.invitedEmail !== userEmail) {
                return NextResponse.json(
                    { error: 'This invitation is for a different email' },
                    { status: 403 }
                );
            }

            if (invitation.status !== 'pending') {
                return NextResponse.json(
                    { error: 'Invitation is no longer pending' },
                    { status: 400 }
                );
            }

            if (invitation.role === 'coach' || invitation.role === 'trainer') {
                const coachName = decodedToken.name || invitation.invitedEmail?.split('@')[0] || 'Coach';
                const provisionResult = await ensureCoachAccountProvisioned({
                    userId,
                    displayName: coachName,
                    email: invitation.invitedEmail,
                });

                await db.collection('invitations').doc(invitationId).update({
                    status: 'accepted',
                    acceptedAt: new Date(),
                    updatedAt: new Date(),
                    linkedAccountId: provisionResult.accountId,
                });

                return NextResponse.json({
                    success: true,
                    message: 'Coach account provisioned',
                    accountId: provisionResult.accountId,
                });
            }

            // Non-coach invitations stay within the inviter's account
            const membershipId = `${invitation.accountId}_${userId}`;
            await db.collection('memberships').doc(membershipId).set({
                userId,
                accountId: invitation.accountId,
                role: invitation.role,
                createdAt: new Date(),
                updatedAt: new Date(),
            });

            await db.collection('invitations').doc(invitationId).update({
                status: 'accepted',
                acceptedAt: new Date(),
                updatedAt: new Date(),
            });

            return NextResponse.json({
                success: true,
                message: 'Invitation accepted',
            });
        } else if (action === 'decline') {
            // User declining their invitation
            if (invitation.invitedEmail !== userEmail) {
                return NextResponse.json(
                    { error: 'This invitation is for a different email' },
                    { status: 403 }
                );
            }

            if (invitation.status !== 'pending') {
                return NextResponse.json(
                    { error: 'Invitation is no longer pending' },
                    { status: 400 }
                );
            }

            // Mark invitation as declined
            await db.collection('invitations').doc(invitationId).update({
                status: 'declined',
                declinedAt: new Date(),
                updatedAt: new Date(),
            });

            return NextResponse.json({
                success: true,
                message: 'Invitation declined',
            });
        } else if (action === 'revoke') {
            // Owner revoking an invitation
            const ownerQuery = db.collection('memberships').where('userId', '==', userId);
            const ownerSnaps = await ownerQuery.get();
            
            const ownerMembership = ownerSnaps.docs.find(doc => doc.data().role === 'owner');
            if (!ownerMembership || ownerMembership.data().accountId !== invitation.accountId) {
                return NextResponse.json(
                    { error: 'Only account owners can revoke invitations' },
                    { status: 403 }
                );
            }

            if (invitation.status !== 'pending') {
                return NextResponse.json(
                    { error: 'Can only revoke pending invitations' },
                    { status: 400 }
                );
            }

            // Delete the invitation
            await db.collection('invitations').doc(invitationId).delete();

            return NextResponse.json({
                success: true,
                message: 'Invitation revoked',
            });
        } else {
            return NextResponse.json(
                { error: 'Invalid action' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error processing invitation action:', error);
        return NextResponse.json(
            { error: 'Failed to process invitation' },
            { status: 500 }
        );
    }
}
