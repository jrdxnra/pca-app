"use client";

import { useQuery } from '@tanstack/react-query';
import { getCoachOnboardingStatus } from '@/lib/firebase/services/coachOnboarding';
import { queryKeys } from '@/lib/react-query/queryKeys';

export function useCoachOnboardingStatus(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.coachOnboarding.status(),
    queryFn: getCoachOnboardingStatus,
    enabled,
    staleTime: 60 * 1000,
  });
}
