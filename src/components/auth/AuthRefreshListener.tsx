"use client";

import { useEffect, useRef } from 'react';
import { auth } from '@/lib/firebase/config';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useDashboardStore } from '@/lib/stores/useDashboardStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';

/**
 * AuthRefreshListener
 * Listens for auth state changes and triggers store re-fetches.
 * This ensures that when a user logs in, the data is isolated to their UID.
 */
export function AuthRefreshListener() {
    const lastUserId = useRef<string | null>(null);

    const fetchClients = useClientStore(state => state.fetchClients);
    const fetchPrograms = useProgramStore(state => state.fetchPrograms);
    const fetchDashboardData = useDashboardStore(state => state.fetchDashboardData);
    const fetchMovements = useMovementStore(state => state.fetchMovements);
    const fetchCategories = useMovementCategoryStore(state => state.fetchCategories);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            const currentUserId = user?.uid || null;

            // Only re-fetch if the user has changed (to avoid redundant fetches)
            if (currentUserId !== lastUserId.current) {
                lastUserId.current = currentUserId;

                if (currentUserId) {
                    console.log('[AuthRefreshListener] User changed/logged in, refreshing stores...', currentUserId);

                    // Trigger re-fetches for all stores
                    // We force re-fetch to ignore cache since owner identity changed
                    fetchClients(true).catch(console.error);
                    fetchPrograms(true).catch(console.error);
                    fetchDashboardData().catch(console.error);
                    fetchMovements().catch(console.error);
                    fetchCategories().catch(console.error);
                } else {
                    console.log('[AuthRefreshListener] User logged out, clearing or keeping empty stores.');
                    // You might want to clear stores here if needed
                }
            }
        });

        return () => unsubscribe();
    }, [fetchClients, fetchPrograms, fetchDashboardData, fetchMovements, fetchCategories]);

    return null; // This component doesn't render anything
}
