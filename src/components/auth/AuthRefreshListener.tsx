'use client';

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { browserLocalPersistence, onAuthStateChanged, setPersistence } from 'firebase/auth';

/**
 * Component that listens for auth changes and ensures the user has 
 * an active account and membership. If not, it provisions one.
 */
export function AuthRefreshListener({ children }: { children: React.ReactNode }) {
    const [provisioning, setProvisioning] = useState(false);
    const hasProvisionedRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

        // Persist auth state across browser restarts/tabs until explicit sign-out.
        setPersistence(auth, browserLocalPersistence).catch((error) => {
            console.warn('Failed to set local auth persistence:', error);
        });

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!isMounted) return;

            if (!user) {
                hasProvisionedRef.current = false;
                setProvisioning(false);
                return;
            }

            if (hasProvisionedRef.current) {
                return;
            }

            hasProvisionedRef.current = true;
            setProvisioning(true);

            try {
                const token = await user.getIdToken();
                const response = await fetch('/api/accounts/provision', {
                    method: 'POST',
                    headers: {
                        authorization: `Bearer ${token}`,
                    },
                });

                if (!response.ok) {
                    const errorBody = await response.json().catch(() => ({}));
                    console.warn('Account provisioning returned non-OK response:', {
                        status: response.status,
                        error: errorBody.error || 'Failed to provision account',
                    });
                }
            } catch (error) {
                // Provisioning is best-effort; auth/session should continue even when provisioning fails.
                console.warn('Error provisioning account via API (continuing without blocking):', error);
            } finally {
                if (isMounted) {
                    setProvisioning(false);
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
