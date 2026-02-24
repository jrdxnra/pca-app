'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { getActiveMembership } from '@/lib/firebase/services/memberships';
import { provisionNewAccount, ensureAccountProvisioned } from '@/lib/firebase/services/cloning';

/**
 * Component that listens for auth changes and ensures the user has 
 * an active account and membership. If not, it provisions one.
 */
export function AuthRefreshListener({ children }: { children: React.ReactNode }) {
    const [provisioning, setProvisioning] = useState(false);

    useEffect(() => {
        let isMounted = true;

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user && isMounted) {
                try {
                    // Check if user has an account
                    const membership = await getActiveMembership(user.uid);

                    if (!isMounted) return;

                    if (!membership && !provisioning) {
                        console.log('No membership found for user, provisioning account...');
                        setProvisioning(true);
                        await provisionNewAccount(user.uid, user.displayName || 'Coach');
                        console.log('Account provisioned successfully');

                        if (isMounted) {
                            setProvisioning(false);
                            // Instead of reload, we rely on the state update to trigger 
                            // a re-check if needed, or just let the app proceed.
                            // The user might need one more manual refresh if Firestore 
                            // is slow, but at least it won't loop.
                        }
                    } else if (membership && !provisioning) {
                        // User has a membership, but let's check if the library is empty
                        if (membership.accountId !== 'master') {
                            setProvisioning(true);
                            await ensureAccountProvisioned(membership.accountId);
                            if (isMounted) setProvisioning(false);
                        }
                    }
                } catch (error) {
                    console.error('Error checking/provisioning account:', error);
                    if (isMounted) setProvisioning(false);
                }
            }
        });

        return () => {
            isMounted = false;
            unsubscribe();
        };
    }, []); // Only run once on mount

    if (provisioning) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-black">
                <div className="text-center">
                    <div className="mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-primary mx-auto"></div>
                    <p className="text-xl font-medium text-white">Preparing your library...</p>
                    <p className="mt-2 text-sm text-gray-400">Setting up your personal coaching workspace</p>
                </div>
            </div>
        );
    }

    return <>{children}</>;
}
