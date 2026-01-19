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

// Create QueryClient instance at module level (singleton pattern)
// This ensures it's always available and prevents recreation on re-renders
let queryClientInstance: QueryClient | undefined;

function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server-side: create new instance for each request
    return new QueryClient(queryClientConfig);
  }
  
  // Client-side: reuse singleton instance
  if (!queryClientInstance) {
    queryClientInstance = new QueryClient(queryClientConfig);
  }
  return queryClientInstance;
}

export function QueryProvider({ children }: QueryProviderProps) {
  // Use the singleton QueryClient
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Show React Query DevTools in development */}
      {isDevelopment && ReactQueryDevtools && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
