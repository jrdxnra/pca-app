'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { getActiveMembership } from '@/lib/firebase/services/memberships';
import styles from './admin.module.css';
import type { KnowledgeEntry } from '@/app/api/admin/knowledge/route';

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
    const [activeTab, setActiveTab] = useState<'team' | 'knowledge'>('team');

    // Knowledge state
    const [knowledgeEntries, setKnowledgeEntries] = useState<KnowledgeEntry[]>([]);
    const [knowledgeLoading, setKnowledgeLoading] = useState(false);
    const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
    const [showKnowledgeForm, setShowKnowledgeForm] = useState(false);
    const [knowledgeSaving, setKnowledgeSaving] = useState(false);
    const emptyEntry = (): KnowledgeEntry => ({
        title: '',
        summary: '',
        useWhen: [''],
        avoidWhen: [''],
        decisionRules: [''],
        movementBias: [''],
        loadingGuidance: [''],
        coachingNotes: [''],
    });

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

    const loadKnowledge = async () => {
        if (!idToken) return;
        setKnowledgeLoading(true);
        try {
            const res = await fetch('/api/admin/knowledge', {
                headers: { authorization: `Bearer ${idToken}` },
            });
            const data = await res.json();
            setKnowledgeEntries(data.entries || []);
        } catch {
            // silently fail — knowledge dir may not exist yet
        } finally {
            setKnowledgeLoading(false);
        }
    };

    const handleSaveKnowledge = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingEntry || !idToken) return;
        setKnowledgeSaving(true);
        try {
            const res = await fetch('/api/admin/knowledge', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    authorization: `Bearer ${idToken}`,
                },
                body: JSON.stringify(editingEntry),
            });
            if (!res.ok) throw new Error('Failed to save');
            setSuccess('Knowledge entry saved.');
            setShowKnowledgeForm(false);
            setEditingEntry(null);
            await loadKnowledge();
        } catch {
            setError('Failed to save knowledge entry.');
        } finally {
            setKnowledgeSaving(false);
        }
    };

    const handleDeleteKnowledge = async (id: string) => {
        if (!idToken || !window.confirm('Delete this knowledge entry?')) return;
        try {
            const res = await fetch(`/api/admin/knowledge?id=${encodeURIComponent(id)}`, {
                method: 'DELETE',
                headers: { authorization: `Bearer ${idToken}` },
            });
            if (!res.ok) throw new Error('Failed to delete');
            setSuccess('Entry deleted.');
            setKnowledgeEntries((prev) => prev.filter((e) => e.id !== id));
        } catch {
            setError('Failed to delete entry.');
        }
    };

    const updateListField = (field: keyof KnowledgeEntry, index: number, value: string) => {
        if (!editingEntry) return;
        const list = [...((editingEntry[field] as string[]) || [])];
        list[index] = value;
        setEditingEntry({ ...editingEntry, [field]: list });
    };

    const addListItem = (field: keyof KnowledgeEntry) => {
        if (!editingEntry) return;
        setEditingEntry({ ...editingEntry, [field]: [...((editingEntry[field] as string[]) || []), ''] });
    };

    const removeListItem = (field: keyof KnowledgeEntry, index: number) => {
        if (!editingEntry) return;
        const list = ((editingEntry[field] as string[]) || []).filter((_, i) => i !== index);
        setEditingEntry({ ...editingEntry, [field]: list });
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
                <p>Manage coaches, team members, and training knowledge</p>
            </div>

            {error && <div className={styles.alert + ' ' + styles.error}>{error}</div>}
            {success && <div className={styles.alert + ' ' + styles.success}>{success}</div>}

            {/* Tab Navigation */}
            <div className={styles.tabNav}>
                <button
                    className={styles.tabButton + (activeTab === 'team' ? ' ' + styles.tabButtonActive : '')}
                    onClick={() => setActiveTab('team')}
                >
                    Team
                </button>
                <button
                    className={styles.tabButton + (activeTab === 'knowledge' ? ' ' + styles.tabButtonActive : '')}
                    onClick={() => {
                        setActiveTab('knowledge');
                        if (knowledgeEntries.length === 0) loadKnowledge();
                    }}
                >
                    Training Knowledge
                </button>
            </div>

            {activeTab === 'team' && (<>
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
            </>)}

            {activeTab === 'knowledge' && (
                <section className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <div>
                            <h2>Training Knowledge</h2>
                            <p className={styles.sectionDescription}>
                                Author your programming principles, movement rules, and coaching style. This library guides workout generation.
                            </p>
                        </div>
                        <button
                            className={styles.primaryButton}
                            onClick={() => { setEditingEntry(emptyEntry()); setShowKnowledgeForm(true); }}
                        >
                            + Add Principle
                        </button>
                    </div>

                    {showKnowledgeForm && editingEntry && (
                        <form className={styles.knowledgeForm} onSubmit={handleSaveKnowledge}>
                            <h3 className={styles.formTitle}>{editingEntry.id ? 'Edit Principle' : 'New Principle'}</h3>

                            <div className={styles.formGroup}>
                                <label>Title *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Strength Block Progression"
                                    value={editingEntry.title}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                                    required
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Summary</label>
                                <textarea
                                    placeholder="One paragraph explaining the principle..."
                                    value={editingEntry.summary || ''}
                                    onChange={(e) => setEditingEntry({ ...editingEntry, summary: e.target.value })}
                                    rows={3}
                                />
                            </div>

                            {(
                                [
                                    { field: 'useWhen' as const, label: 'Use When', placeholder: 'e.g. Goal: hypertrophy, Phase: accumulation' },
                                    { field: 'avoidWhen' as const, label: 'Avoid When', placeholder: 'e.g. Recovery week, Injury: lower back' },
                                    { field: 'decisionRules' as const, label: 'Decision Rules', placeholder: 'e.g. If strength phase → prefer compound lifts first' },
                                    { field: 'movementBias' as const, label: 'Movement Bias', placeholder: 'e.g. Primary: hinge, squat, push, pull' },
                                    { field: 'loadingGuidance' as const, label: 'Loading Guidance', placeholder: 'e.g. Intensity: 70-85% 1RM, Volume: 3-5 sets x 3-6 reps' },
                                    { field: 'coachingNotes' as const, label: 'Coaching Notes', placeholder: 'e.g. Cue: brace before descent' },
                                ] as const
                            ).map(({ field, label, placeholder }) => (
                                <div key={field} className={styles.formGroup}>
                                    <label>{label}</label>
                                    {(editingEntry[field] as string[] || []).map((item, i) => (
                                        <div key={i} className={styles.listInputRow}>
                                            <input
                                                type="text"
                                                placeholder={placeholder}
                                                value={item}
                                                onChange={(e) => updateListField(field, i, e.target.value)}
                                            />
                                            <button type="button" className={styles.removeItemButton} onClick={() => removeListItem(field, i)}>×</button>
                                        </div>
                                    ))}
                                    <button type="button" className={styles.addItemButton} onClick={() => addListItem(field)}>+ Add</button>
                                </div>
                            ))}

                            <div className={styles.formActions}>
                                <button type="submit" className={styles.primaryButton} disabled={knowledgeSaving}>
                                    {knowledgeSaving ? 'Saving...' : 'Save Principle'}
                                </button>
                                <button type="button" className={styles.secondaryButton} onClick={() => { setShowKnowledgeForm(false); setEditingEntry(null); }}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    )}

                    {knowledgeLoading ? (
                        <p className={styles.empty}>Loading...</p>
                    ) : knowledgeEntries.length === 0 && !showKnowledgeForm ? (
                        <p className={styles.empty}>No principles yet. Click &quot;+ Add Principle&quot; to start building your training knowledge base.</p>
                    ) : (
                        <div className={styles.list}>
                            {knowledgeEntries.map((entry) => (
                                <div key={entry.id} className={styles.knowledgeItem}>
                                    <div className={styles.itemContent}>
                                        <h3>{entry.title}</h3>
                                        {entry.summary && <p>{entry.summary}</p>}
                                        {(entry.decisionRules?.filter(Boolean).length ?? 0) > 0 && (
                                            <ul className={styles.rulePreview}>
                                                {entry.decisionRules!.filter(Boolean).slice(0, 2).map((rule, i) => (
                                                    <li key={i}>{rule}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                    <div className={styles.itemActions}>
                                        <button
                                            className={styles.secondaryButton}
                                            onClick={() => { setEditingEntry({ ...entry }); setShowKnowledgeForm(true); }}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className={styles.dangerButton}
                                            onClick={() => handleDeleteKnowledge(entry.id!)}
                                        >
                                            Delete
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
