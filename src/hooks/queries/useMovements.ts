import { useQuery, UseQueryOptions } from '@tanstack/react-query';
import { Movement } from '@/lib/types';
import { getAllMovements, getMovementsByCategory, getMovement, searchMovements } from '@/lib/firebase/services/movements';
import { queryKeys } from '@/lib/react-query/queryKeys';

/**
 * Hook to fetch all movements
 * 
 * @param includeCategory - Whether to include category data
 * @param options - Additional React Query options
 */
export function useMovements(
  includeCategory = false,
  options?: Omit<UseQueryOptions<Movement[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.movements.list({ includeCategory }),
    queryFn: () => getAllMovements(includeCategory),
    ...options,
  });
}

/**
 * Hook to fetch movements by category
 * 
 * @param categoryId - The category ID to filter by
 * @param includeCategory - Whether to include category data
 * @param options - Additional React Query options
 */
export function useMovementsByCategory(
  categoryId: string,
  includeCategory = false,
  options?: Omit<UseQueryOptions<Movement[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.movements.byCategory(categoryId),
    queryFn: () => getMovementsByCategory(categoryId, includeCategory),
    enabled: !!categoryId, // Only fetch if categoryId is provided
    ...options,
  });
}

/**
 * Hook to fetch a single movement
 * 
 * @param id - The movement ID
 * @param includeCategory - Whether to include category data
 * @param options - Additional React Query options
 */
export function useMovement(
  id: string | null | undefined,
  includeCategory = false,
  options?: Omit<UseQueryOptions<Movement | null, Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.movements.detail(id || ''),
    queryFn: () => (id ? getMovement(id, includeCategory) : Promise.resolve(null)),
    enabled: !!id, // Only fetch if id is provided
    ...options,
  });
}

/**
 * Hook to search movements
 * 
 * @param searchTerm - The search term
 * @param includeCategory - Whether to include category data
 * @param options - Additional React Query options
 */
export function useSearchMovements(
  searchTerm: string,
  includeCategory = false,
  options?: Omit<UseQueryOptions<Movement[], Error>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: queryKeys.movements.search(searchTerm),
    queryFn: () => searchMovements(searchTerm, includeCategory),
    enabled: searchTerm.length > 0, // Only search if there's a term
    ...options,
  });
}
