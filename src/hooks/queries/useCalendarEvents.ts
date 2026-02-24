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
    queryKey: queryKeys.calendarEvents.list({ start: startDateString || '', end: endDateString || '' }),
    queryFn: () => {
      if (!startDate || !endDate) return Promise.resolve([]);
      return getCalendarEventsByDateRange(startDate, endDate);
    },
    enabled: !!startDate && !!endDate,
    retry: 2, // Retry twice for transient auth failures (auth state not ready yet)
    retryDelay: 1000, // Wait 1s between retries to give auth time to resolve
    refetchOnMount: true, // Always refetch when navigating to a page
    // Calendar events don't change often, use longer cache time
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes (keep in cache longer)
    ...options,
  });
}
