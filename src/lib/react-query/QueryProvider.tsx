"use client";

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useState, useEffect } from 'react';

// Dynamically import devtools only in development to avoid build errors
let ReactQueryDevtools: any = null;

// Check if we're in development mode (works in both client and server)
const isDevelopment = typeof window !== 'undefined' 
  ? (process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_NODE_ENV === 'development')
  : process.env.NODE_ENV === 'development';

if (isDevelopment) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const devtools = require('@tanstack/react-query-devtools');
    ReactQueryDevtools = devtools.ReactQueryDevtools;
  } catch {
    // Devtools not available, that's okay
  }
}

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
// Create QueryClient configuration
const queryClientConfig = {
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
      retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),

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
};

// Create QueryClient instance at module level (singleton pattern) - CLIENT-SIDE ONLY
// This ensures it's always available and prevents recreation on re-renders
let queryClientInstance: QueryClient | undefined;

function makeQueryClient(): QueryClient {
  return new QueryClient(queryClientConfig);
}

function getQueryClient(): QueryClient {
  // Only create on client-side
  if (typeof window === 'undefined') {
    // Server-side: return a new instance for each request (but this shouldn't be used)
    // In Next.js App Router, this component should only render on client
    return makeQueryClient();
  }
  
  // Client-side: reuse singleton instance
  if (!queryClientInstance) {
    queryClientInstance = makeQueryClient();
  }
  return queryClientInstance;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Use useState to ensure QueryClient is created only once on client-side mount
  const [queryClient] = useState(() => {
    try {
      return getQueryClient();
    } catch (error) {
      console.error('Failed to create QueryClient:', error);
      // Fallback: create a minimal QueryClient
      return new QueryClient();
    }
  });

  // Ensure we have a valid QueryClient
  if (!queryClient) {
    console.error('QueryClient is null - this should not happen');
    // Return children without provider as last resort (will cause React Query errors)
    return <>{children}</>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* ReactQueryDevtools disabled temporarily due to QueryClient initialization issues */}
      {/* TODO: Re-enable once QueryClient setup is stable */}
    </QueryClientProvider>
  );
}
