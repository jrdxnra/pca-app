import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { ClientProgram } from '@/lib/types';
import { getClientProgramsByClient, getAllClientPrograms } from '@/lib/firebase/services/clientPrograms';
import { queryKeys } from '@/lib/react-query/queryKeys';

/**
 * Hook to fetch client programs by client ID
 */
export function useClientProgramsByClient(
  clientId: string | null | undefined,
  options?: Omit<UseQueryOptions<ClientProgram[], Error>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  return useQuery({
    queryKey: queryKeys.clientPrograms.byClient(clientId || ''),
    queryFn: () => {
      if (!clientId) return Promise.resolve([]);
      return getClientProgramsByClient(clientId);
    },
    enabled: !!clientId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

/**
 * Hook to fetch all client programs (when no client is selected)
 */
export function useAllClientPrograms(
  options?: Omit<UseQueryOptions<ClientProgram[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.clientPrograms.all,
    queryFn: () => getAllClientPrograms(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    ...options,
  });
}

/**
 * Hook to fetch client programs - automatically switches between client-specific and all programs
 * based on whether a clientId is provided
 */
export function useClientPrograms(
  selectedClientId?: string | null,
  options?: Omit<UseQueryOptions<ClientProgram[], Error>, 'queryKey' | 'queryFn' | 'enabled'>
) {
  const clientProgramsQuery = useClientProgramsByClient(selectedClientId || undefined, {
    enabled: !!selectedClientId,
    ...options,
  });
  
  const allProgramsQuery = useAllClientPrograms({
    enabled: !selectedClientId,
    ...options,
  });

  // Return the appropriate query based on whether a client is selected
  if (selectedClientId) {
    return clientProgramsQuery;
  } else {
    return allProgramsQuery;
  }
}
