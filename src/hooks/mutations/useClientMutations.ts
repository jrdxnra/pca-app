import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Client } from '@/lib/types';
import {
  createClient,
  updateClient,
  softDeleteClient,
  permanentDeleteClient,
  restoreClient,
  updatePersonalRecord,
} from '@/lib/firebase/services/clients';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for adding a new client
 */
export function useAddClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clientData: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'personalRecords'>) => {
      return await createClient(clientData);
    },
    onMutate: async (newClient) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.clients.all });

      // Snapshot previous value
      const previousClients = queryClient.getQueryData<Client[]>(queryKeys.clients.list({ includeDeleted: false }));

      // Optimistically update
      const optimisticClient: Client = {
        id: `temp-${Date.now()}`,
        ...newClient,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
        isDeleted: false,
        personalRecords: {},
      };

      queryClient.setQueryData<Client[]>(
        queryKeys.clients.list({ includeDeleted: false }),
        (old = []) => [...old, optimisticClient]
      );

      return { previousClients };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousClients) {
        queryClient.setQueryData(queryKeys.clients.list({ includeDeleted: false }), context.previousClients);
      }
      console.error('Error adding client:', error);
      toastError('Failed to add client. Please try again.');
    },
    onSuccess: (id, variables) => {
      // Invalidate to refetch with real data
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toastSuccess('Client added successfully');
    },
  });
}

/**
 * Hook for updating a client
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Client, 'id' | 'createdAt'>> }) => {
      return await updateClient(id, updates);
    },
    onMutate: async ({ id, updates }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.clients.all });

      // Snapshot previous values
      const previousClient = queryClient.getQueryData<Client>(queryKeys.clients.detail(id));
      const previousClients = queryClient.getQueryData<Client[]>(queryKeys.clients.list({ includeDeleted: false }));

      // Optimistically update
      queryClient.setQueryData<Client>(
        queryKeys.clients.detail(id),
        (old) => (old ? { ...old, ...updates } : old)
      );

      queryClient.setQueryData<Client[]>(
        queryKeys.clients.list({ includeDeleted: false }),
        (old = []) => old.map(client => client.id === id ? { ...client, ...updates } : client)
      );

      return { previousClient, previousClients };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousClient) {
        queryClient.setQueryData(queryKeys.clients.detail(variables.id), context.previousClient);
      }
      if (context?.previousClients) {
        queryClient.setQueryData(queryKeys.clients.list({ includeDeleted: false }), context.previousClients);
      }
      console.error('Error updating client:', error);
      toastError('Failed to update client. Please try again.');
    },
    onSuccess: (_, variables) => {
      // Invalidate to refetch with real data
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toastSuccess('Client updated successfully');
    },
  });
}

/**
 * Hook for soft deleting a client
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await softDeleteClient(id);
    },
    onMutate: async (id) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.clients.all });

      // Snapshot previous value
      const previousClients = queryClient.getQueryData<Client[]>(queryKeys.clients.list({ includeDeleted: false }));

      // Optimistically remove
      queryClient.setQueryData<Client[]>(
        queryKeys.clients.list({ includeDeleted: false }),
        (old = []) => old.filter(client => client.id !== id)
      );

      return { previousClients };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousClients) {
        queryClient.setQueryData(queryKeys.clients.list({ includeDeleted: false }), context.previousClients);
      }
      console.error('Error deleting client:', error);
      toastError('Failed to delete client. Please try again.');
    },
    onSuccess: () => {
      // Invalidate to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toastSuccess('Client deleted successfully');
    },
  });
}

/**
 * Hook for permanently deleting a client
 */
export function usePermanentDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await permanentDeleteClient(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toastSuccess('Client permanently deleted');
    },
    onError: (error) => {
      console.error('Error permanently deleting client:', error);
      toastError('Failed to permanently delete client. Please try again.');
    },
  });
}

/**
 * Hook for restoring a client
 */
export function useRestoreClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await restoreClient(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toastSuccess('Client restored successfully');
    },
    onError: (error) => {
      console.error('Error restoring client:', error);
      toastError('Failed to restore client. Please try again.');
    },
  });
}

/**
 * Hook for updating a personal record
 */
export function useUpdatePersonalRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      clientId, 
      movementId, 
      oneRepMax, 
      method 
    }: { 
      clientId: string; 
      movementId: string; 
      oneRepMax: number; 
      method?: 'tested' | 'estimated' 
    }) => {
      return await updatePersonalRecord(clientId, movementId, oneRepMax, method);
    },
    onSuccess: (_, variables) => {
      // Invalidate client queries to refetch with updated PR
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.detail(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.clients.all });
      toastSuccess('Personal record updated successfully');
    },
    onError: (error) => {
      console.error('Error updating personal record:', error);
      toastError('Failed to update personal record. Please try again.');
    },
  });
}
