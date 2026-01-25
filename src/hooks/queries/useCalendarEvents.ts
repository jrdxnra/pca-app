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
  // Convert dates to ISO strings for stable query key (Date objects have different references each render)
  const startDateString = startDate?.toISOString();
  const endDateString = endDate?.toISOString();
  
  return useQuery({
    queryKey: queryKeys.calendarEvents.list({ start: startDateString, end: endDateString }),
    queryFn: () => {
      if (!startDate || !endDate) return Promise.resolve([]);
      return getCalendarEventsByDateRange(startDate, endDate);
    },
    enabled: !!startDate && !!endDate,
    retry: false, // Don't retry on error to prevent infinite loops
    retryOnMount: false, // Don't retry when component remounts
    // Calendar events don't change often, use longer cache time
    staleTime: 10 * 60 * 1000, // 10 minutes (longer than default 5 min)
    gcTime: 30 * 60 * 1000, // 30 minutes (keep in cache longer)
    ...options,
  });
}
