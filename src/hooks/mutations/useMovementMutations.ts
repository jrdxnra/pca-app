import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Movement } from '@/lib/types';
import {
  addMovement,
  updateMovement,
  deleteMovement,
  reorderMovementsInCategory,
} from '@/lib/firebase/services/movements';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for adding a new movement
 */
export function useAddMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (movementData: Omit<Movement, 'id' | 'createdAt' | 'updatedAt'>) => {
      // addMovement will calculate ordinal automatically if not provided
      return await addMovement(movementData);
    },
    onSuccess: (id, variables) => {
      // Invalidate movements list to refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });
      
      // Invalidate category-specific queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.movements.byCategory(variables.categoryId) 
      });

      toastSuccess('Movement added successfully');
    },
    onError: (error) => {
      console.error('Error adding movement:', error);
      toastError('Failed to add movement. Please try again.');
    },
  });
}

/**
 * Hook for updating a movement
 */
export function useUpdateMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<Movement, 'id' | 'createdAt'>> }) => {
      return await updateMovement(id, updates);
    },
    onSuccess: (_, variables) => {
      // Invalidate the specific movement
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.movements.detail(variables.id) 
      });
      
      // Invalidate movements list
      queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });

      // If category changed, invalidate both old and new category queries
      if (variables.updates.categoryId) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.movements.byCategory(variables.updates.categoryId) 
        });
      }

      toastSuccess('Movement updated successfully');
    },
    onError: (error) => {
      console.error('Error updating movement:', error);
      toastError('Failed to update movement. Please try again.');
    },
  });
}

/**
 * Hook for deleting a movement
 */
export function useDeleteMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await deleteMovement(id);
    },
    onSuccess: () => {
      // Invalidate all movement queries
      queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });

      toastSuccess('Movement deleted successfully');
    },
    onError: (error) => {
      console.error('Error deleting movement:', error);
      toastError('Failed to delete movement. Please try again.');
    },
  });
}

/**
 * Hook for reordering movements in a category
 */
export function useReorderMovements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      categoryId, 
      draggedIndex, 
      dropIndex 
    }: { 
      categoryId: string; 
      draggedIndex: number; 
      dropIndex: number;
    }) => {
      return await reorderMovementsInCategory(categoryId, draggedIndex, dropIndex);
    },
    onSuccess: (_, variables) => {
      // Invalidate category-specific queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.movements.byCategory(variables.categoryId) 
      });
      
      // Invalidate all movements list
      queryClient.invalidateQueries({ queryKey: queryKeys.movements.all });
    },
    onError: (error) => {
      console.error('Error reordering movements:', error);
      toastError('Failed to reorder movements. Please try again.');
    },
  });
}
