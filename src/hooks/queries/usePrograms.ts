import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Program, ScheduledWorkout } from '@/lib/types';
import { 
  getAllPrograms, 
  getProgram, 
  getProgramsByClient,
  getAllScheduledWorkouts,
  getScheduledWorkoutsByProgram,
  getScheduledWorkoutsByClient,
  getScheduledWorkoutsByDateRange,
} from '@/lib/firebase/services/programs';
import { queryKeys } from '@/lib/react-query/queryKeys';

/**
 * Hook to fetch all programs
 */
export function usePrograms(
  options?: Omit<UseQueryOptions<Program[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.programs.list(),
    queryFn: () => getAllPrograms(),
    ...options,
  });
}

/**
 * Hook to fetch a single program
 */
export function useProgram(
  id: string | null | undefined,
  options?: Omit<UseQueryOptions<Program | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.programs.detail(id || ''),
    queryFn: () => (id ? getProgram(id) : Promise.resolve(null)),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook to fetch programs by client
 */
export function useProgramsByClient(
  clientId: string | null | undefined,
  options?: Omit<UseQueryOptions<Program[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.programs.byClient(clientId || ''),
    queryFn: () => (clientId ? getProgramsByClient(clientId) : Promise.resolve([])),
    enabled: !!clientId,
    ...options,
  });
}

/**
 * Hook to fetch all scheduled workouts
 */
export function useScheduledWorkouts(
  options?: Omit<UseQueryOptions<ScheduledWorkout[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.scheduledWorkouts.list(),
    queryFn: () => getAllScheduledWorkouts(),
    ...options,
  });
}

/**
 * Hook to fetch scheduled workouts by program
 */
export function useScheduledWorkoutsByProgram(
  programId: string | null | undefined,
  options?: Omit<UseQueryOptions<ScheduledWorkout[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...queryKeys.scheduledWorkouts.all, 'program', programId || ''],
    queryFn: () => (programId ? getScheduledWorkoutsByProgram(programId) : Promise.resolve([])),
    enabled: !!programId,
    ...options,
  });
}

/**
 * Hook to fetch scheduled workouts by client
 */
export function useScheduledWorkoutsByClient(
  clientId: string | null | undefined,
  options?: Omit<UseQueryOptions<ScheduledWorkout[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...queryKeys.scheduledWorkouts.all, 'client', clientId || ''],
    queryFn: () => (clientId ? getScheduledWorkoutsByClient(clientId) : Promise.resolve([])),
    enabled: !!clientId,
    ...options,
  });
}

/**
 * Hook to fetch scheduled workouts by date range
 */
export function useScheduledWorkoutsByDateRange(
  startDate: Date | null | undefined,
  endDate: Date | null | undefined,
  options?: Omit<UseQueryOptions<ScheduledWorkout[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: [...queryKeys.scheduledWorkouts.all, 'dateRange', startDate?.toISOString() || '', endDate?.toISOString() || ''],
    queryFn: () => {
      if (!startDate || !endDate) return Promise.resolve([]);
      return getScheduledWorkoutsByDateRange(startDate, endDate);
    },
    enabled: !!startDate && !!endDate,
    ...options,
  });
}
