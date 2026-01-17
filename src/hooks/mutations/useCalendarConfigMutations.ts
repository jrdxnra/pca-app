import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarSyncConfig } from '@/lib/google-calendar/types';
import { updateCalendarSyncConfig } from '@/lib/firebase/services/calendarConfig';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for updating calendar sync configuration
 */
export function useUpdateCalendarConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CalendarSyncConfig>) => {
      return await updateCalendarSyncConfig(updates);
    },
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarConfig.all });
      const previousConfig = queryClient.getQueryData<CalendarSyncConfig>(queryKeys.calendarConfig.current());

      // Optimistically update
      queryClient.setQueryData<CalendarSyncConfig>(
        queryKeys.calendarConfig.current(),
        (old) => (old ? { ...old, ...updates } : old)
      );

      return { previousConfig };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousConfig) {
        queryClient.setQueryData(queryKeys.calendarConfig.current(), context.previousConfig);
      }
      console.error('Error updating calendar config:', error);
      toastError('Failed to update calendar configuration. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConfig.all });
      toastSuccess('Calendar configuration updated successfully');
    },
  });
}
