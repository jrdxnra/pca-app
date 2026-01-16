"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

/**
 * React Query Provider
 * 
 * Provides React Query context to the app with optimized defaults:
 * - 5 minute stale time (data stays fresh for 5 min)
 * - 10 minute garbage collection time (cached data kept for 10 min)
 * - Automatic retry on failure (2 retries)
 * - DevTools in development
 */
export function QueryProvider({ children }: QueryProviderProps) {
  // Create QueryClient with stable instance (using useState to prevent recreation on re-renders)
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Data is considered fresh for 5 minutes
            // During this time, React Query won't refetch even if component remounts
            staleTime: 5 * 60 * 1000, // 5 minutes

            // Cached data is kept in memory for 10 minutes after last use
            // This allows instant loading when navigating back
            gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)

            // Retry failed requests 2 times
            retry: 2,

            // Retry delay increases exponentially
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

            // Refetch on window focus (keeps data fresh)
            refetchOnWindowFocus: true,

            // Don't refetch on reconnect (we'll handle this manually if needed)
            refetchOnReconnect: false,

            // Don't refetch on mount if data is fresh
            refetchOnMount: true,
          },
          mutations: {
            // Retry mutations once on failure
            retry: 1,

            // Retry delay for mutations
            retryDelay: 1000,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
