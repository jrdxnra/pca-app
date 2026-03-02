"use client";

import { useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCoachOnboardingStatus } from '@/hooks/queries/useCoachOnboardingStatus';
import { completeCoachOnboardingStep, CoachOnboardingStep } from '@/lib/firebase/services/coachOnboarding';
import { queryKeys } from '@/lib/react-query/queryKeys';

export function useSetupHubProgress(calendarReady: boolean, hasClients: boolean) {
  const queryClient = useQueryClient();
  const { data: status, isLoading } = useCoachOnboardingStatus();
  const inFlightRef = useRef<{ calendar: boolean; clients: boolean }>({ calendar: false, clients: false });

  useEffect(() => {
    if (!status || isLoading) {
      return;
    }

    const completeStep = async (step: CoachOnboardingStep) => {
      if (inFlightRef.current[step]) return;
      inFlightRef.current[step] = true;
      try {
        await completeCoachOnboardingStep(step);
        queryClient.invalidateQueries({ queryKey: queryKeys.coachOnboarding.status() });
      } catch (error) {
        console.error('[useSetupHubProgress] Failed to complete onboarding step', error);
      } finally {
        inFlightRef.current[step] = false;
      }
    };

    if (calendarReady && !status.calendarComplete) {
      completeStep('calendar');
    }

    if (hasClients && !status.clientsComplete) {
      completeStep('clients');
    }
  }, [calendarReady, hasClients, status, isLoading, queryClient]);

  const needsSetup = useMemo(() => {
    if (isLoading) {
      return undefined;
    }

    if (!status) return true;
    return !status.calendarComplete || !status.clientsComplete;
  }, [status, isLoading]);

  return {
    status,
    isLoading,
    needsSetup,
  };
}
