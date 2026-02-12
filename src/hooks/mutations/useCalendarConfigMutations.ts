import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CalendarSyncConfig } from '@/lib/google-calendar/types';
import { updateCalendarSyncConfig } from '@/lib/firebase/services/calendarConfig';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for updating calendar sync configuration via React Query
 * NOTE: The Configure page uses Zustand's updateConfig directly instead of this
 */
export function useUpdateCalendarConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<CalendarSyncConfig>) => {
      return await updateCalendarSyncConfig(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarConfig.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
      toastSuccess('Calendar configuration updated successfully');
    },
    onError: (error) => {
      console.error('Error updating calendar config:', error);
      toastError('Failed to update calendar configuration. Please try again.');
    },
  });
}

