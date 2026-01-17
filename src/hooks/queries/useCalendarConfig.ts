import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { CalendarSyncConfig } from '@/lib/google-calendar/types';
import { getCalendarSyncConfig } from '@/lib/firebase/services/calendarConfig';
import { queryKeys } from '@/lib/react-query/queryKeys';

const defaultConfig: CalendarSyncConfig = {
  selectedCalendarId: undefined,
  coachingKeywords: [],
  coachingColor: undefined,
  classKeywords: [],
  classColor: undefined,
  locationAbbreviations: [],
  lastSyncTime: undefined,
};

/**
 * Hook to fetch calendar sync configuration
 */
export function useCalendarConfig(
  options?: Omit<UseQueryOptions<CalendarSyncConfig, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.calendarConfig.current(),
    queryFn: () => getCalendarSyncConfig(defaultConfig),
    ...options,
  });
}
