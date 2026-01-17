import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Client } from '@/lib/types';
import { getAllClients, getClient, searchClients } from '@/lib/firebase/services/clients';
import { queryKeys } from '@/lib/react-query/queryKeys';

/**
 * Hook to fetch all clients
 * 
 * @param includeDeleted - Whether to include deleted clients
 * @param options - Additional React Query options
 */
export function useClients(
  includeDeleted = false,
  options?: Omit<UseQueryOptions<Client[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.clients.list({ includeDeleted }),
    queryFn: () => getAllClients(includeDeleted),
    ...options,
  });
}

/**
 * Hook to fetch a single client
 * 
 * @param id - The client ID
 * @param options - Additional React Query options
 */
export function useClient(
  id: string | null | undefined,
  options?: Omit<UseQueryOptions<Client | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.clients.detail(id || ''),
    queryFn: () => (id ? getClient(id) : Promise.resolve(null)),
    enabled: !!id, // Only fetch if id is provided
    ...options,
  });
}

/**
 * Hook to search clients
 * 
 * @param searchTerm - The search term
 * @param includeDeleted - Whether to include deleted clients
 * @param options - Additional React Query options
 */
export function useSearchClients(
  searchTerm: string,
  includeDeleted = false,
  options?: Omit<UseQueryOptions<Client[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.clients.search(searchTerm, includeDeleted),
    queryFn: () => searchClients(searchTerm, includeDeleted),
    enabled: searchTerm.length > 0, // Only search if there's a term
    ...options,
  });
}
