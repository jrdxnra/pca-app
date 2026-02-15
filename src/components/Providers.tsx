"use client";

import { ReactNode } from 'react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import { QueryProvider } from '@/lib/react-query/QueryProvider';

import { AuthRefreshListener } from '@/components/auth/AuthRefreshListener';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Client-side providers wrapper for the app.
 * Includes Error Boundary, React Query, and Toast notifications.
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <AuthRefreshListener />
        {children}
        <Toaster />
      </QueryProvider>
    </ErrorBoundary>
  );
}





