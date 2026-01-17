import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/firebase/services/calendarEvents';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for creating a calendar event
 */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<GoogleCalendarEvent, 'id'>) => {
      return await createCalendarEvent(event);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
      toastSuccess('Calendar event created successfully');
    },
    onError: (error) => {
      console.error('Error creating calendar event:', error);
      toastError('Failed to create calendar event. Please try again.');
    },
  });
}

/**
 * Hook for updating a calendar event
 */
export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<GoogleCalendarEvent> }) => {
      return await updateCalendarEvent(id, updates);
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarEvents.all });
      
      // Get all matching queries and snapshot their data
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({ queryKey: queryKeys.calendarEvents.all });
      const previousEvents = queries.map(query => [query.queryKey, query.state.data] as const);

      // Optimistically update all event queries
      queries.forEach(query => {
        const oldData = query.state.data as GoogleCalendarEvent[] | undefined;
        if (oldData) {
          queryClient.setQueryData<GoogleCalendarEvent[]>(
            query.queryKey,
            oldData.map(event => event.id === id ? { ...event, ...updates } : event)
          );
        }
      });

      return { previousEvents };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(queryKey, data);
          }
        });
      }
      console.error('Error updating calendar event:', error);
      toastError('Failed to update calendar event. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
      toastSuccess('Calendar event updated successfully');
    },
  });
}

/**
 * Hook for deleting a calendar event
 */
export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return await deleteCalendarEvent(id);
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarEvents.all });
      
      // Get all matching queries and snapshot their data
      const queryCache = queryClient.getQueryCache();
      const queries = queryCache.findAll({ queryKey: queryKeys.calendarEvents.all });
      const previousEvents = queries.map(query => [query.queryKey, query.state.data] as const);

      // Optimistically remove from all event queries
      queries.forEach(query => {
        const oldData = query.state.data as GoogleCalendarEvent[] | undefined;
        if (oldData) {
          queryClient.setQueryData<GoogleCalendarEvent[]>(
            query.queryKey,
            oldData.filter(event => event.id !== id)
          );
        }
      });

      return { previousEvents };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          if (data !== undefined) {
            queryClient.setQueryData(queryKey, data);
          }
        });
      }
      console.error('Error deleting calendar event:', error);
      toastError('Failed to delete calendar event. Please try again.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
      toastSuccess('Calendar event deleted successfully');
    },
  });
}
