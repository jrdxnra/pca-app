import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { getCalendarEventsByDateRange } from '@/lib/firebase/services/calendarEvents';
import { queryKeys } from '@/lib/react-query/queryKeys';

/**
 * Hook to fetch calendar events by date range
 */
export function useCalendarEvents(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  options?: Omit<UseQueryOptions<GoogleCalendarEvent[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.calendarEvents.list({ start: startDate || undefined, end: endDate || undefined }),
    queryFn: () => {
      if (!startDate || !endDate) return Promise.resolve([]);
      return getCalendarEventsByDateRange(startDate, endDate);
    },
    enabled: !!startDate && !!endDate,
    retry: false, // Don't retry on error to prevent infinite loops
    retryOnMount: false, // Don't retry when component remounts
    ...options,
  });
}
