'use client';

import { useEffect, useRef, useState } from 'react';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Component that listens for auth changes and ensures the user has 
 * an active account and membership. If not, it provisions one.
 */
export function AuthRefreshListener({ children }: { children: React.ReactNode }) {
    const [provisioning, setProvisioning] = useState(false);
    const hasProvisionedRef = useRef(false);

    useEffect(() => {
        let isMounted = true;

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
                    throw new Error(errorBody.error || 'Failed to provision account');
                }
            } catch (error) {
                console.error('Error provisioning account via API:', error);
                hasProvisionedRef.current = false;
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
