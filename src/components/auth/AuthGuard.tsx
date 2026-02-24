"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Loader2 } from 'lucide-react';

import { MASTER_UID } from '@/lib/firebase/services/memberships';

interface AuthGuardProps {
    children: React.ReactNode;
    requireMaster?: boolean;
}

export function AuthGuard({ children, requireMaster = false }: AuthGuardProps) {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [authenticated, setAuthenticated] = useState(false);
    const [isAuthorized, setIsAuthorized] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                if (requireMaster && user.uid !== MASTER_UID) {
                    setIsAuthorized(false);
                    router.push('/dashboard');
                    setLoading(false);
                    return;
                }

                setAuthenticated(true);
                // Check calendar connection once on mount/auth
                // This ensures the store is up to date for Dashboard and other components
                import('@/lib/stores/useCalendarStore').then(({ useCalendarStore }) => {
                    useCalendarStore.getState().checkGoogleCalendarConnection();
                });
            } else {
                router.push('/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [router, requireMaster]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">Checking authentication...</span>
            </div>
        );
    }

    if (!authenticated || !isAuthorized) {
        return null; // Will redirect via useEffect
    }

    return <>{children}</>;
}
