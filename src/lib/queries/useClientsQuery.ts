import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { 
  getAllClients, 
  createClient, 
  updateClient, 
  softDeleteClient,
  permanentDeleteClient,
  restoreClient,
  searchClients,
} from '@/lib/firebase/services/clients';
import { Client } from '@/lib/types';

/**
 * React Query hooks for client data
 * These can be used alongside or instead of Zustand stores
 */
export function useClientsQuery(includeDeleted = false) {
  return useQuery({
    queryKey: queryKeys.clients.list({ includeDeleted }),
    queryFn: () => getAllClients(includeDeleted),
    staleTime: 30 * 1000, // 30 seconds
  });
}

export function useSearchClientsQuery(term: string, includeDeleted = false, enabled = true) {
  return useQuery({
    queryKey: queryKeys.clients.search(term, includeDeleted),
    queryFn: () => searchClients(term, includeDeleted),
    enabled: enabled && term.trim() !== '',
    staleTime: 30 * 1000,
  });
}

export function useCreateClientMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'personalRecords'>) => 
      createClient(clientData),
    onSuccess: () => {
      // Invalidate all client queries to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useUpdateClientMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Omit<Client, 'id' | 'createdAt'>> }) => 
      updateClient(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}

export function useDeleteClientMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => softDeleteClient(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
    },
  });
}
