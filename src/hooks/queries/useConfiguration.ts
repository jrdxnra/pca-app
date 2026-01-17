import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { fetchPeriods, Period } from '@/lib/firebase/services/periods';
import { fetchWorkoutCategories, WorkoutCategory } from '@/lib/firebase/services/workoutCategories';
import { queryKeys } from '@/lib/react-query/queryKeys';

/**
 * Hook to fetch periods
 */
export function usePeriods(
  options?: Omit<UseQueryOptions<Period[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.periods.lists(),
    queryFn: () => fetchPeriods(),
    ...options,
  });
}

/**
 * Hook to fetch workout categories
 */
export function useWorkoutCategories(
  options?: Omit<UseQueryOptions<WorkoutCategory[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.workoutCategories.lists(),
    queryFn: () => fetchWorkoutCategories(),
    ...options,
  });
}
