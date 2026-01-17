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
      const previousEvents = queryClient.getQueriesData<GoogleCalendarEvent[]>({ 
        queryKey: queryKeys.calendarEvents.all 
      });

      // Optimistically update all event queries
      queryClient.setQueriesData<GoogleCalendarEvent[]>(
        { queryKey: queryKeys.calendarEvents.all },
        (old = []) => old.map(event => event.id === id ? { ...event, ...updates } : event)
      );

      return { previousEvents };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
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
      const previousEvents = queryClient.getQueriesData<GoogleCalendarEvent[]>({ 
        queryKey: queryKeys.calendarEvents.all 
      });

      // Optimistically remove
      queryClient.setQueriesData<GoogleCalendarEvent[]>(
        { queryKey: queryKeys.calendarEvents.all },
        (old = []) => old.filter(event => event.id !== id)
      );

      return { previousEvents };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousEvents) {
        context.previousEvents.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
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
