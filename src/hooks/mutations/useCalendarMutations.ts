import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import {
  createSingleCalendarEvent,
  updateCalendarEvent as updateGoogleCalendarEvent,
  deleteCalendarEvent as deleteGoogleCalendarEvent,
} from '@/lib/google-calendar/api-client';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { toastSuccess, toastError } from '@/components/ui/toaster';

/**
 * Hook for creating a calendar event
 * Creates in Google Calendar API (single source of truth)
 */
export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (event: Omit<GoogleCalendarEvent, 'id'>) => {
      // Create in Google Calendar API
      const result = await createSingleCalendarEvent({
        summary: event.summary,
        startDateTime: event.start.dateTime,
        endDateTime: event.end.dateTime,
        clientId: event.preConfiguredClient || undefined,
        categoryName: event.preConfiguredCategory || undefined,
        workoutId: event.linkedWorkoutId || undefined,
        description: event.description || undefined,
        location: event.location || undefined,
        timeZone: event.start.timeZone || 'America/Los_Angeles',
        calendarId: 'primary', // TODO: Get from config
      });
      return result.event;
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
      // Update in Google Calendar API
      const googleUpdates: Record<string, unknown> = {};
      if (updates.summary) googleUpdates.summary = updates.summary;
      if (updates.description !== undefined) googleUpdates.description = updates.description;
      if (updates.location) googleUpdates.location = updates.location;
      if (updates.start?.dateTime) googleUpdates.start = updates.start;
      if (updates.end?.dateTime) googleUpdates.end = updates.end;
      
      // Get instanceDate from updates or use current date
      const instanceDate = updates.start?.dateTime || new Date().toISOString();
      
      await updateGoogleCalendarEvent({
        eventId: id,
        instanceDate,
        updateType: 'single',
        updates: googleUpdates,
        calendarId: 'primary', // TODO: Get from config
      });
      
      // Return updated event (we don't get it back from API, so construct it)
      return { id, ...updates } as GoogleCalendarEvent;
    },
    onMutate: async ({ id, updates }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarEvents.all });
      
      // Snapshot previous data for rollback
      const previousData: Array<[readonly unknown[], GoogleCalendarEvent[] | undefined]> = [];
      
      // Update all matching queries optimistically
      queryClient.getQueriesData({ queryKey: queryKeys.calendarEvents.all }).forEach(([queryKey, data]) => {
        previousData.push([queryKey as readonly unknown[], data as GoogleCalendarEvent[] | undefined]);
        
        if (data) {
          const updatedData = (data as GoogleCalendarEvent[]).map(event => 
            event.id === id ? { ...event, ...updates } : event
          );
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
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
      // Delete from Google Calendar API
      await deleteGoogleCalendarEvent(id, undefined, 'primary'); // TODO: Get calendarId from config
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.calendarEvents.all });
      
      // Snapshot previous data for rollback
      const previousData: Array<[readonly unknown[], GoogleCalendarEvent[] | undefined]> = [];
      
      // Update all matching queries optimistically
      queryClient.getQueriesData({ queryKey: queryKeys.calendarEvents.all }).forEach(([queryKey, data]) => {
        previousData.push([queryKey as readonly unknown[], data as GoogleCalendarEvent[] | undefined]);
        
        if (data) {
          const updatedData = (data as GoogleCalendarEvent[]).filter(event => event.id !== id);
          queryClient.setQueryData(queryKey, updatedData);
        }
      });

      return { previousData };
    },
    onError: (error, variables, context) => {
      // Rollback on error
      if (context?.previousData) {
        context.previousData.forEach(([queryKey, data]) => {
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
