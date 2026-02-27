import {
    collection,
    doc,
    setDoc,
    getDocs,
    getDoc,
    query,
    where,
    updateDoc,
    deleteDoc,
    Timestamp
} from 'firebase/firestore';
import { getDb } from '../config';
import { Invitation } from '../../types';
import { resolveActiveAccountId } from './memberships';

const COLLECTION_NAME = 'invitations';

/**
 * Send invitation to a coach to join the account
 */
export const sendInvitation = async (invitedEmail: string, role: 'trainer' | 'client', invitedBy: string): Promise<string> => {
    try {
        const accountId = await resolveActiveAccountId();
        if (!accountId) throw new Error('Unauthorized');

        const invitationId = `${accountId}_${invitedEmail}_${Date.now()}`;
        const docRef = doc(getDb(), COLLECTION_NAME, invitationId);

        await setDoc(docRef, {
            accountId,
            invitedEmail: invitedEmail.toLowerCase(),
            role,
            status: 'pending',
            invitedBy,
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        console.log(`Invitation sent to ${invitedEmail} for account ${accountId}`);
        return invitationId;
    } catch (error) {
        console.error('Error sending invitation:', error);
        throw error;
    }
};

/**
 * Get all pending invitations for an account
 */
export const getAccountInvitations = async (accountId?: string): Promise<Invitation[]> => {
    try {
        const targetAccountId = accountId || (await resolveActiveAccountId());
        if (!targetAccountId) throw new Error('Unauthorized');

        const q = query(
            collection(getDb(), COLLECTION_NAME),
            where('accountId', '==', targetAccountId)
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Invitation[];
    } catch (error) {
        console.error('Error getting invitations:', error);
        throw error;
    }
};

/**
 * Get invitations for a specific email
 */
export const getInvitationsByEmail = async (email: string): Promise<Invitation[]> => {
    try {
        const q = query(
            collection(getDb(), COLLECTION_NAME),
            where('invitedEmail', '==', email.toLowerCase())
        );

        const querySnapshot = await getDocs(q);
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        })) as Invitation[];
    } catch (error) {
        console.error('Error getting invitations by email:', error);
        throw error;
    }
};

/**
 * Accept an invitation
 */
export const acceptInvitation = async (invitationId: string, userId: string): Promise<void> => {
    try {
        const invitationRef = doc(getDb(), COLLECTION_NAME, invitationId);
        const invitationSnap = await getDoc(invitationRef);

        if (!invitationSnap.exists()) throw new Error('Invitation not found');

        const invitation = invitationSnap.data() as Invitation;

        // Import createMembership to avoid circular dependency at top level
        const { createMembership } = await import('./memberships');

        // Create membership
        await createMembership(userId, invitation.accountId, invitation.role);

        // Mark invitation as accepted
        await updateDoc(invitationRef, {
            status: 'accepted',
            acceptedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        console.log(`Invitation ${invitationId} accepted`);
    } catch (error) {
        console.error('Error accepting invitation:', error);
        throw error;
    }
};

/**
 * Decline an invitation
 */
export const declineInvitation = async (invitationId: string): Promise<void> => {
    try {
        const invitationRef = doc(getDb(), COLLECTION_NAME, invitationId);

        await updateDoc(invitationRef, {
            status: 'declined',
            declinedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        });

        console.log(`Invitation ${invitationId} declined`);
    } catch (error) {
        console.error('Error declining invitation:', error);
        throw error;
    }
};

/**
 * Revoke a pending invitation
 */
export const revokeInvitation = async (invitationId: string): Promise<void> => {
    try {
        const invitationRef = doc(getDb(), COLLECTION_NAME, invitationId);
        const invitationSnap = await getDoc(invitationRef);

        if (!invitationSnap.exists()) throw new Error('Invitation not found');

        const accountId = await resolveActiveAccountId();
        if (accountId !== invitationSnap.data().accountId) {
            throw new Error('Unauthorized: Only account owner can revoke invitations');
        }

        await deleteDoc(invitationRef);
        console.log(`Invitation ${invitationId} revoked`);
    } catch (error) {
        console.error('Error revoking invitation:', error);
        throw error;
    }
};

/**
 * Update invitation status (for admin)
 */
export const updateInvitationStatus = async (
    invitationId: string,
    status: 'pending' | 'accepted' | 'declined'
): Promise<void> => {
    try {
        const invitationRef = doc(getDb(), COLLECTION_NAME, invitationId);
        const invitationSnap = await getDoc(invitationRef);

        if (!invitationSnap.exists()) throw new Error('Invitation not found');

        const accountId = await resolveActiveAccountId();
        if (accountId !== invitationSnap.data().accountId) {
            throw new Error('Unauthorized: Only account owner can update invitations');
        }

        await updateDoc(invitationRef, {
            status,
            updatedAt: Timestamp.now(),
        });

        console.log(`Invitation ${invitationId} status updated to ${status}`);
    } catch (error) {
        console.error('Error updating invitation:', error);
        throw error;
    }
};
