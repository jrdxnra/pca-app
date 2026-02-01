import { QueryClient } from '@tanstack/react-query';

/**
 * Global queryClient instance reference
 * This is set by QueryProvider and allows Zustand stores to invalidate React Query caches
 * without creating circular dependency issues
 */
let globalQueryClient: QueryClient | null = null;

export function setGlobalQueryClient(queryClient: QueryClient) {
  globalQueryClient = queryClient;
}

export function getGlobalQueryClient(): QueryClient | null {
  return globalQueryClient;
}
