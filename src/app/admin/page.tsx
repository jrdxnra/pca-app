'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getActiveMembership } from '@/lib/firebase/services/memberships';
import styles from './admin.module.css';

interface Coach {
    id: string;
    userId: string;
    email: string;
    displayName: string;
    role: string;
    createdAt: Date;
}

interface Invitation {
    id: string;
    invitedEmail: string;
    role: string;
    status: string;
    createdAt: Date;
}

export default function AdminPage() {
    const { user, idToken } = useAuth();
    const router = useRouter();
    const [coaches, setCoaches] = useState<Coach[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [isOwner, setIsOwner] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [showInviteForm, setShowInviteForm] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<'coach' | 'client'>('coach');
    const [inviting, setInviting] = useState(false);

    // Check if user is owner
    useEffect(() => {
        const checkOwner = async () => {
            if (!user) return;
            try {
                const membership = await getActiveMembership(user.uid);
                setIsOwner(membership?.role === 'owner');
                if (membership?.role !== 'owner') {
                    router.push('/dashboard');
                }
            } catch (err) {
                console.error('Error checking ownership:', err);
            }
        };
        checkOwner();
    }, [user, router]);

    // Load coaches and invitations
    useEffect(() => {
        const loadData = async () => {
            if (!user || !idToken) return;

            try {
                setLoading(true);
                setError('');

                // Fetch coaches
                const coachesRes = await fetch('/api/admin/coaches', {
                    headers: {
                        authorization: `Bearer ${idToken}`,
                    },
                });

                if (!coachesRes.ok) {
                    throw new Error('Failed to fetch coaches');
                }

                const coachesData = await coachesRes.json();
                setCoaches(coachesData.coaches || []);

                // Fetch invitations
                const invitationsRes = await fetch('/api/admin/invitations', {
                    headers: {
                        authorization: `Bearer ${idToken}`,
                    },
                });

                if (!invitationsRes.ok) {
                    throw new Error('Failed to fetch invitations');
                }

                const invitationsData = await invitationsRes.json();
                setInvitations(invitationsData.invitations || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'An error occurred');
            } finally {
                setLoading(false);
            }
        };

        if (isOwner) {
            loadData();
        }
    }, [user, idToken, isOwner]);

    const handleSendInvitation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!idToken || !inviteEmail.trim()) {
            setError('Please enter an email address');
            return;
        }

        setInviting(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/admin/invitations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    invitedEmail: inviteEmail,
                    role: inviteRole,
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to send invitation');
            }

            setSuccess(`Invitation sent to ${inviteEmail}`);
            setInviteEmail('');
            setShowInviteForm(false);

            // Reload invitations
            const invitationsRes = await fetch('/api/admin/invitations', {
                headers: {
                    authorization: `Bearer ${idToken}`,
                },
            });
            const invitationsData = await invitationsRes.json();
            setInvitations(invitationsData.invitations || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to send invitation');
        } finally {
            setInviting(false);
        }
    };

    const handleRevokeInvitation = async (invitationId: string) => {
        if (!idToken || !window.confirm('Are you sure you want to revoke this invitation?')) {
            return;
        }

        try {
            const res = await fetch('/api/admin/invitations/revoke', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify({ invitationId }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to revoke invitation');
            }

            setSuccess('Invitation revoked');
            setInvitations(invitations.filter(inv => inv.id !== invitationId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to revoke invitation');
        }
    };

    const handleRemoveCoach = async (membershipId: string, email: string) => {
        if (!idToken || !window.confirm(`Are you sure you want to remove ${email}?`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/coaches?membershipId=${membershipId}`, {
                method: 'DELETE',
                headers: {
                    authorization: `Bearer ${idToken}`,
                },
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to remove coach');
            }

            setSuccess(`Coach ${email} removed`);
            setCoaches(coaches.filter(c => c.id !== membershipId));
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to remove coach');
        }
    };

    if (loading) {
        return (
            <div className={styles.container}>
                <p>Loading...</p>
            </div>
        );
    }

    if (!isOwner) {
        return (
            <div className={styles.container}>
                <p>You do not have permission to access this page.</p>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h1>Admin Panel</h1>
                <p>Manage coaches and team members</p>
            </div>

            {error && <div className={styles.alert + ' ' + styles.error}>{error}</div>}
            {success && <div className={styles.alert + ' ' + styles.success}>{success}</div>}

            {/* Coaches Section */}
            <section className={styles.section}>
                <div className={styles.sectionHeader}>
                    <h2>Active Coaches ({coaches.length})</h2>
                    <button
                        className={styles.primaryButton}
                        onClick={() => setShowInviteForm(!showInviteForm)}
                    >
                        {showInviteForm ? 'Cancel' : '+ Invite Coach'}
                    </button>
                </div>

                {showInviteForm && (
                    <form className={styles.inviteForm} onSubmit={handleSendInvitation}>
                        <div className={styles.formGroup}>
                            <label htmlFor="email">Coach Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="coach@example.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className={styles.formGroup}>
                            <label htmlFor="role">Role</label>
                            <select
                                id="role"
                                value={inviteRole}
                                onChange={(e) => setInviteRole(e.target.value as 'coach' | 'client')}
                            >
                                <option value="coach">Coach</option>
                                <option value="client">Client</option>
                            </select>
                        </div>

                        <button type="submit" className={styles.primaryButton} disabled={inviting}>
                            {inviting ? 'Sending...' : 'Send Invitation'}
                        </button>
                    </form>
                )}

                {coaches.length === 0 ? (
                    <p className={styles.empty}>No coaches yet. Send an invitation to get started!</p>
                ) : (
                    <div className={styles.list}>
                        {coaches.map((coach) => (
                            <div key={coach.id} className={styles.item}>
                                <div className={styles.itemContent}>
                                    <h3>{coach.displayName}</h3>
                                    <p>{coach.email}</p>
                                    <small>Added {new Date(coach.createdAt).toLocaleDateString()}</small>
                                </div>
                                <div className={styles.itemActions}>
                                    <span className={styles.badge}>{coach.role}</span>
                                    <button
                                        className={styles.dangerButton}
                                        onClick={() => handleRemoveCoach(coach.id, coach.email)}
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Pending Invitations Section */}
            {invitations.length > 0 && (
                <section className={styles.section}>
                    <h2>Pending Invitations ({invitations.filter(inv => inv.status === 'pending').length})</h2>

                    {invitations.filter(inv => inv.status === 'pending').length === 0 ? (
                        <p className={styles.empty}>No pending invitations.</p>
                    ) : (
                        <div className={styles.list}>
                            {invitations
                                .filter(inv => inv.status === 'pending')
                                .map((invitation) => (
                                    <div key={invitation.id} className={styles.item}>
                                        <div className={styles.itemContent}>
                                            <h3>{invitation.invitedEmail}</h3>
                                            <p>Role: {invitation.role}</p>
                                            <small>Sent {new Date(invitation.createdAt).toLocaleDateString()}</small>
                                        </div>
                                        <div className={styles.itemActions}>
                                            <span className={styles.badge + ' ' + styles.pending}>Pending</span>
                                            <button
                                                className={styles.dangerButton}
                                                onClick={() => handleRevokeInvitation(invitation.id)}
                                            >
                                                Revoke
                                            </button>
                                        </div>
                                    </div>
                                ))}
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
