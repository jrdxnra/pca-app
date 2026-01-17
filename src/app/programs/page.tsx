"use client";

import dynamic from 'next/dynamic';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { ErrorBoundary } from '@/components/ErrorBoundary';

import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { safeToDate } from '@/lib/utils/dateHelpers';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Calendar as CalendarIcon,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Users,
  Layers,
  Grid3X3,
  List,
  Settings,
} from 'lucide-react';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
// React Query hooks
import { useClients } from '@/hooks/queries/useClients';
import { usePrograms, useProgramsByClient, useScheduledWorkoutsByClient, useScheduledWorkouts } from '@/hooks/queries/usePrograms';
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';
import { usePeriods, useWorkoutCategories } from '@/hooks/queries/useConfiguration';
import { useUpdateCalendarEvent, useDeleteCalendarEvent, useCreateCalendarEvent } from '@/hooks/mutations/useCalendarMutations';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
// Lazy load ModernCalendarView to prevent blocking initial render
const ModernCalendarView = dynamic(
  () => import('@/components/programs/ModernCalendarView').then(mod => ({ default: mod.ModernCalendarView })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
    ssr: false // Disable SSR for this heavy component
  }
);
import { CreateProgramDialog } from '@/components/programs/CreateProgramDialog';
import { PeriodManagementPanel } from '@/components/programs/PeriodManagementPanel';
import { WeekViewScheduleManager } from '@/components/programs/WeekViewScheduleManager';
import { MiniCalendarTooltip } from '@/components/programs/MiniCalendarTooltip';
import { DayEventList } from '@/components/programs/DayEventList';
import { AddAssignmentDropdown } from '@/components/programs/AddAssignmentDropdown';
import { CreateScheduleEventDialog } from '@/components/programs/CreateScheduleEventDialog';
import { PeriodListDialog } from '@/components/programs/PeriodListDialog';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { ScheduleEventEditDialog } from '@/components/programs/ScheduleEventEditDialog';
import { EventActionDialog } from '@/components/programs/EventActionDialog';
import { QuickWorkoutBuilderDialog } from '@/components/programs/QuickWorkoutBuilderDialog';
import { ClientProgram, ClientProgramPeriod } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { fetchWorkoutsByDateRange, fetchClientWorkouts, deleteClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { format } from 'date-fns';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import {
  createClientProgram,
  getClientProgramsByClient,
  updatePeriodInClientProgram,
  deletePeriodFromClientProgram,
  deleteAllPeriodsFromClientProgram,
  addPeriodToClientProgram
} from '@/lib/firebase/services/clientPrograms';
import { getAppTimezone, setAppTimezone, getBrowserTimezone, hasTimezoneChanged, formatTimezoneLabel } from '@/lib/utils/timezone';
import { toastSuccess } from '@/components/ui/toaster';

export default function ProgramsPage() {
  // Track render count to detect infinite loops
  const renderCountRef = React.useRef(0);
  renderCountRef.current += 1;
  const renderCount = renderCountRef.current;
  
  console.log(`[ProgramsPage] Component rendering (render #${renderCount})`);
  
  // Warn if we're rendering too many times
  if (renderCount > 10) {
    console.warn(`[ProgramsPage] WARNING: Component has rendered ${renderCount} times - possible infinite loop!`);
  }
  
  const router = useRouter();

  // UI State from stores (keeping for now)
  const {
    selectedClient,
    currentDate,
    viewMode,
    calendarDate,
    error,
    setSelectedClient,
    setViewMode,
    setCalendarDate,
    navigateMonth,
    navigateWeek,
    navigateDay,
    goToToday,
    clearError,
    initializeSelectedClient,
  } = useProgramStore();
  
  console.log('[ProgramsPage] Store state:', {
    selectedClient,
    viewMode,
    calendarDate: calendarDate?.toISOString(),
    hasError: !!error
  });

  // Data fetching with React Query
  console.log('[ProgramsPage] Calling React Query hooks...');
  const { data: clients = [], isLoading: clientsLoading } = useClients(false);
  const { data: allPrograms = [], isLoading: programsLoading } = usePrograms();
  const { data: programsByClient = [], isLoading: programsByClientLoading } = useProgramsByClient(selectedClient);
  const { data: scheduledWorkoutsByClient = [], isLoading: scheduledWorkoutsByClientLoading } = useScheduledWorkoutsByClient(selectedClient);
  const { data: allScheduledWorkouts = [], isLoading: allScheduledWorkoutsLoading } = useScheduledWorkouts();
  
  console.log('[ProgramsPage] React Query data loaded:', {
    clientsCount: clients.length,
    allProgramsCount: allPrograms.length,
    programsByClientCount: programsByClient.length,
    scheduledWorkoutsByClientCount: scheduledWorkoutsByClient.length,
    allScheduledWorkoutsCount: allScheduledWorkouts.length,
    clientsLoading,
    programsLoading,
    programsByClientLoading,
    scheduledWorkoutsByClientLoading,
    allScheduledWorkoutsLoading
  });
  
  // Use client-specific or all data based on selectedClient
  const programs = selectedClient ? programsByClient : allPrograms;
  const scheduledWorkouts = selectedClient ? scheduledWorkoutsByClient : allScheduledWorkouts;
  const loading = programsLoading || programsByClientLoading || scheduledWorkoutsByClientLoading || allScheduledWorkoutsLoading || clientsLoading;
  
  console.log('[ProgramsPage] Computed data:', {
    programsCount: programs.length,
    scheduledWorkoutsCount: scheduledWorkouts.length,
    loading
  });

  // Configuration data with React Query
  const { data: periods = [] } = usePeriods();
  const { data: workoutCategories = [] } = useWorkoutCategories();
  const { weekTemplates, workoutStructureTemplates, fetchAll: fetchAllConfig } = useConfigurationStore();

  // Calendar events with React Query - calculate date range for current week view
  
  // Calculate date range directly - no need for separate state
  // Use useMemo to create stable Date objects that only change when calendarDate actually changes
  const calendarDateRange = React.useMemo(() => {
    if (!calendarDate) return null;
    const startDate = new Date(calendarDate);
    startDate.setDate(calendarDate.getDate() - calendarDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    return { start: startDate, end: endDate };
  }, [calendarDate?.getTime()]); // Use timestamp for stable comparison - only recalc when date actually changes

  console.log('[ProgramsPage] Calling useCalendarEvents hook with:', {
    start: calendarDateRange?.start?.toISOString(),
    end: calendarDateRange?.end?.toISOString()
  });
  
  const { data: calendarEvents = [], isLoading: calendarEventsLoading } = useCalendarEvents(
    calendarDateRange?.start,
    calendarDateRange?.end
  );
  
  // Simply use calendarEvents directly - React Query handles memoization
  // Use length as stable dependency for useMemo to prevent infinite loops
  const stableCalendarEvents = calendarEvents;
  
  console.log('[ProgramsPage] Calendar events loaded:', {
    eventsCount: calendarEvents.length,
    isLoading: calendarEventsLoading
  });

  // Query client for invalidating queries
  const queryClient = useQueryClient();

  // Calendar mutations
  const updateCalendarEventMutation = useUpdateCalendarEvent();
  const deleteCalendarEventMutation = useDeleteCalendarEvent();
  const createCalendarEventMutation = useCreateCalendarEvent();

  // Wrapper functions for backward compatibility
  const updateEvent = async (eventId: string, updates: Partial<GoogleCalendarEvent>) => {
    await updateCalendarEventMutation.mutateAsync({ id: eventId, updates });
  };

  const deleteEvent = async (eventId: string) => {
    await deleteCalendarEventMutation.mutateAsync(eventId);
  };

  // Keep calendar store functions that aren't data fetching
  const { createTestEvent, clearAllTestEvents, linkToWorkout } = useCalendarStore();

  // Selected date for mini calendar (defaults to calendarDate)
  // Initialize with calendarDate to avoid null issues
  const [selectedDate, setSelectedDate] = useState<Date>(() => calendarDate || new Date());
  
  // Track mounted state to avoid hydration mismatch with date-dependent UI
  const [mounted, setMounted] = useState(false);
  
  console.log('[ProgramsPage] mounted state:', mounted);
  
  // Timezone notification state
  const [appTimezone, setAppTimezoneState] = useState<string>(() => {
    console.log('[ProgramsPage] Initializing appTimezone state');
    if (typeof window !== 'undefined') {
      const tz = getAppTimezone();
      console.log('[ProgramsPage] Got appTimezone from storage:', tz);
      return tz;
    }
    console.log('[ProgramsPage] window undefined, using default timezone');
    return 'America/Los_Angeles';
  });
  const [showTimezonePrompt, setShowTimezonePrompt] = useState(false);
  const TIMEZONE_DISMISS_KEY = 'pca-timezone-prompt-dismissed';
  
  useEffect(() => {
    console.log('[ProgramsPage] Mount effect running');
    setMounted(true);
    console.log('[ProgramsPage] Set mounted to true');
    
    // Check if timezone prompt was dismissed
    const wasDismissed = typeof window !== 'undefined' 
      ? localStorage.getItem(TIMEZONE_DISMISS_KEY) === 'true'
      : false;
    
    console.log('[ProgramsPage] Timezone prompt dismissed?', wasDismissed);
    
    // Check if browser timezone differs from app timezone
    if (!wasDismissed && hasTimezoneChanged()) {
      const savedTimezone = getAppTimezone();
      const browserTimezone = getBrowserTimezone();
      console.log('[ProgramsPage] Timezone check:', {
        savedTimezone,
        browserTimezone,
        hasChanged: hasTimezoneChanged()
      });
      // Only show prompt if timezone was previously set (not default)
      if (savedTimezone !== 'America/Los_Angeles' || browserTimezone !== 'America/Los_Angeles') {
        console.log('[ProgramsPage] Showing timezone prompt');
        setShowTimezonePrompt(true);
      }
    }
    
    return () => {
      console.log('[ProgramsPage] Mount effect cleanup');
    };
  }, []);

  // Sync selectedDate with calendarDate when it changes
  // Use ref to track if we've initialized to prevent unnecessary updates
  const hasInitializedSelectedDate = React.useRef(false);
  const lastCalendarDateRef = React.useRef<number | null>(null);
  
  useEffect(() => {
    const calendarDateTimestamp = calendarDate?.getTime() ?? null;
    
    if (!hasInitializedSelectedDate.current && calendarDate) {
      // Initialize once on mount
      console.log('[ProgramsPage] Initializing selectedDate from calendarDate');
      setSelectedDate(calendarDate);
      hasInitializedSelectedDate.current = true;
      lastCalendarDateRef.current = calendarDateTimestamp;
    } else if (hasInitializedSelectedDate.current && calendarDate && lastCalendarDateRef.current !== calendarDateTimestamp) {
      // Sync when calendarDate actually changes (by timestamp comparison)
      console.log('[ProgramsPage] Syncing selectedDate with calendarDate');
      setSelectedDate(calendarDate);
      lastCalendarDateRef.current = calendarDateTimestamp;
    }
  }, [calendarDate]); // Only depend on calendarDate

  const [includeWeekends, setIncludeWeekends] = useState(false);

  // Use the shared client programs hook - replaces local state and fetchClientPrograms function
  console.log('[ProgramsPage] Calling useClientPrograms hook with selectedClient:', selectedClient);
  const {
    clientPrograms,
    isLoading: clientProgramsLoading,
    assignPeriod: hookAssignPeriod,
    deletePeriod: hookDeletePeriod,
    clearAllPeriods: hookClearAllPeriods,
    fetchClientPrograms
  } = useClientPrograms(selectedClient);
  
  // Simply use clientPrograms directly
  const stableClientPrograms = clientPrograms;
  
  console.log('[ProgramsPage] useClientPrograms result:', {
    clientProgramsCount: clientPrograms.length,
    isLoading: clientProgramsLoading
  });

  const [selectedPeriod, setSelectedPeriod] = useState<ClientProgramPeriod | null>(null);
  const [periodPanelOpen, setPeriodPanelOpen] = useState(false);
  const [periodPanelPosition, setPeriodPanelPosition] = useState<{ x: number; y: number } | undefined>(undefined);
  const [weekScheduleManagerOpen, setWeekScheduleManagerOpen] = useState(false);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<Date | null>(null);
  const [calendarKey, setCalendarKey] = useState(0);
  const [createEventDialogOpen, setCreateEventDialogOpen] = useState(false);
  const [createEventDate, setCreateEventDate] = useState<Date | null>(null);
  const [createEventTime, setCreateEventTime] = useState<Date | null>(null);
  const [periodListDialogOpen, setPeriodListDialogOpen] = useState(false);
  const [dialogPeriods, setDialogPeriods] = useState<ClientProgramPeriod[]>([]);
  
  // Simply use dialogPeriods directly
  const stableDialogPeriods = dialogPeriods;
  const [scheduleEventEditDialogOpen, setScheduleEventEditDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<GoogleCalendarEvent | null>(null);
  const [eventActionDialogOpen, setEventActionDialogOpen] = useState(false);
  const [selectedEventForAction, setSelectedEventForAction] = useState<GoogleCalendarEvent | null>(null);



  // Fetch configuration data on mount
  useEffect(() => {
    console.log('[ProgramsPage] Fetching all config');
    fetchAllConfig();
    console.log('[ProgramsPage] Config fetch initiated');
  }, [fetchAllConfig]);

  // Calendar date is now managed by the store with localStorage persistence
  // No need to reset on mount - it preserves state between dashboard and programs pages

  // Initialize selected client from localStorage after hydration
  useEffect(() => {
    console.log('[ProgramsPage] Initializing selected client from localStorage');
    initializeSelectedClient();
    console.log('[ProgramsPage] Selected client initialized');
  }, [initializeSelectedClient]);

  // React Query handles data fetching automatically based on selectedClient
  // No need for manual fetch calls - hooks will refetch when dependencies change

// Track navigation to force refresh when returning to this page
  const pathname = usePathname();
  const lastFetchTimeRef = React.useRef(0); // Use ref instead of state to avoid re-renders
  
  // Fetch calendar events when calendar date changes or when navigating to this page
  // REMOVED: ModernCalendarView now handles its own event fetching to avoid duplicate requests
  // This prevents the double-fetch that was causing performance issues
  
  // Force refresh when page becomes visible or receives focus (user navigates back)
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    
    const refreshEvents = () => {
      if (!calendarDate) return;
      
      // Only refresh if it's been more than 1 second since last fetch (debounce)
      if (Date.now() - lastFetchTimeRef.current < 1000) return;
      
      const startDate = new Date(calendarDate);
      startDate.setDate(calendarDate.getDate() - calendarDate.getDay());
      const endDate = new Date(startDate);
      endDate.setDate(startDate.getDate() + 6);

      startDate.setHours(0, 0, 0, 0);
      endDate.setHours(23, 59, 59, 999);

      // React Query will automatically refetch when calendarDateRange changes
      // No manual fetch needed
      lastFetchTimeRef.current = Date.now(); // Update ref instead of state
    };
    
    // Refresh on visibility change (tab switch) and focus (window focus)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Debounce visibility refresh
        if (timeoutId) clearTimeout(timeoutId);
        timeoutId = setTimeout(refreshEvents, 100);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', refreshEvents);
    
    // Also refresh immediately on mount (handles Next.js navigation)
    // Use a small delay to avoid blocking initial render
    timeoutId = setTimeout(refreshEvents, 50);
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', refreshEvents);
    };
  }, [pathname, calendarDate]); // React Query handles refetching automatically

  // Update dialog periods when clientPrograms state changes
  useEffect(() => {
    if (selectedClient && periodListDialogOpen) {
      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      const periods = clientProgram?.periods || [];
      setDialogPeriods(periods);
    }
  }, [clientPrograms, selectedClient, periodListDialogOpen]);

  const handleClientChange = (clientId: string) => {
    setSelectedClient(clientId === 'all' ? null : clientId);
  };

  // Force week view - month and day views are removed
  React.useEffect(() => {
    if (viewMode !== 'week') {
      setViewMode('week');
    }
  }, [viewMode, setViewMode]);

  const handleViewModeChange = (mode: 'month' | 'week' | 'day') => {
    // Only allow week view
    setViewMode('week');
  };

  const handleNavigate = (direction: number) => {
    // Only week view is supported
    navigateWeek(direction);
  };


  const getNavigationLabel = () => {
    // Return placeholder during SSR to avoid hydration mismatch
    if (!mounted) return 'Loading...';
    
    // Only week view is supported
    const weekStart = new Date(calendarDate);
    weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  // REMOVED: Duplicate useEffect - already handled above

  const handleMiniCalendarDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Navigate to the week containing this date
    setCalendarDate(date);
  };

  const selectedClientData = selectedClient ? clients.find(c => c.id === selectedClient) : null;

  const handleEditStructure = (programId: string) => {
    router.push(`/programs/builder/${programId}`);
  };

  // Handler for assigning periods - uses shared hook for consistent behavior with builder tab
  const handleAssignPeriod = async (assignment: {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{ time?: string; isAllDay: boolean; category?: string; deleted?: boolean }>;
  }) => {
    try {
      // Use the shared hook for period assignment
      // This handles creating periods, calendar events, and workouts consistently
      await hookAssignPeriod(assignment);

      // Page-specific refresh: Force calendar view to refresh
      if (selectedClient) {
        const weekStart = new Date(assignment.startDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(assignment.endDate);
        weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));

        // Refresh calendar events
        // React Query will automatically refetch calendar events when date range changes

        // Force calendar view to refresh by updating the key
        setCalendarKey(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error assigning period:', error);
      throw error; // Re-throw to show error to user
    }
  };

  const handleUpdatePeriod = async (periodId: string, updates: Partial<ClientProgramPeriod>) => {
    try {
      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      if (!clientProgram) return;

      await updatePeriodInClientProgram(clientProgram.id, periodId, updates);

      // Refresh client programs from Firebase
      await fetchClientPrograms(selectedClient);
    } catch (error) {
      console.error('Error updating period:', error);
    }
  };

  // Helper function to find events that belong to a period
  const findEventsForPeriod = (period: ClientProgramPeriod, clientId: string): GoogleCalendarEvent[] => {
    const periodStart = safeToDate(period.startDate);
    const periodEnd = safeToDate(period.endDate);

    // Normalize dates to start/end of day for comparison
    const periodStartNormalized = new Date(periodStart);
    periodStartNormalized.setHours(0, 0, 0, 0);
    const periodEndNormalized = new Date(periodEnd);
    periodEndNormalized.setHours(23, 59, 59, 999);

    return calendarEvents.filter(event => {
      // Check if event has metadata with matching client ID
      const hasMatchingClient = event.description?.includes(`client=${clientId}`) ||
        event.description?.includes(`client=${clientId},`);

      if (!hasMatchingClient) return false;

      // Check if event date falls within period date range
      try {
        const eventDate = new Date(event.start.dateTime);
        const eventDateNormalized = new Date(eventDate);
        eventDateNormalized.setHours(0, 0, 0, 0);

        return eventDateNormalized >= periodStartNormalized &&
          eventDateNormalized <= periodEndNormalized;
      } catch (error) {
        console.warn('Error parsing event date:', event.start.dateTime, error);
        return false;
      }
    });
  };

  // Helper function to find ALL events for a client (regardless of periods)
  const findAllEventsForClient = (clientId: string): GoogleCalendarEvent[] => {
    return calendarEvents.filter(event => {
      // Check if event has metadata with matching client ID
      const hasMatchingClient = event.description?.includes(`client=${clientId}`) ||
        event.description?.includes(`client=${clientId},`) ||
        event.preConfiguredClient === clientId;

      return hasMatchingClient;
    });
  };

  const handleDeletePeriod = async (periodId: string) => {
    if (!selectedClient) {
      console.error('No client selected for delete period');
      return;
    }

    try {
      // Fetch fresh data first to ensure we have the latest
      const freshPrograms = await getClientProgramsByClient(selectedClient);
      const clientProgram = freshPrograms.find(cp => cp.clientId === selectedClient);

      if (!clientProgram) {
        console.error('Client program not found for client:', selectedClient);
        throw new Error('Client program not found');
      }

      const periodToDelete = clientProgram.periods.find(p => p.id === periodId);
      if (!periodToDelete) {
        console.error('Period not found:', periodId);
        throw new Error('Period not found');
      }

      // Fetch ALL events for the period's date range (not just visible week)
      const periodStart = safeToDate(periodToDelete.startDate);
      const periodEnd = safeToDate(periodToDelete.endDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(23, 59, 59, 999);

      // Fetch events for the entire period range
      // React Query will automatically refetch calendar events when date range changes

      // Wait a bit for store to update
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now find events for this period from the freshly fetched events
      const eventsToDelete = findEventsForPeriod(periodToDelete, selectedClient);

      for (const event of eventsToDelete) {
        try {
          await deleteEvent(event.id);
        } catch (eventError) {
          console.error(`Error deleting calendar event ${event.id}:`, eventError);
          // Continue with other events even if one fails
        }
      }

      // NEW: Also delete all Firebase workouts associated with this period
      // Strategy: Delete by date range to catch any workouts that might have missed the periodId link
      // This is more robust for "wiping the slate clean"
      try {
        const startTimestamp = Timestamp.fromDate(periodStart);
        const endTimestamp = Timestamp.fromDate(periodEnd);

        // Fetch by date range to ensure we catch everything in this period's timeframe
        const rangeWorkouts = await fetchWorkoutsByDateRange(selectedClient, startTimestamp, endTimestamp);

        for (const workout of rangeWorkouts) {
          await deleteClientWorkout(workout.id);
        }
      } catch (workoutError) {
        console.error('Error deleting associated workouts:', workoutError);
      }

      // Delete the period from Firebase
      await deletePeriodFromClientProgram(clientProgram.id, periodId);

      // Refresh client programs from Firebase - multiple times to ensure sync
      await fetchClientPrograms(selectedClient);
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchClientPrograms(selectedClient);

      // Also refresh dialog periods if dialog is open
      const updatedPrograms = await getClientProgramsByClient(selectedClient);
      const updatedProgram = updatedPrograms.find(cp => cp.clientId === selectedClient);
      if (updatedProgram) {
        setDialogPeriods(updatedProgram.periods || []);
      }

      // Refresh scheduled workouts via React Query
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledWorkouts.all });
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      // React Query will automatically refetch calendar events when date range changes

      // Force calendar refresh
      setCalendarKey(prev => prev + 1);
    } catch (error) {
      console.error('Error deleting period:', error);
      throw error; // Re-throw so the dialog can handle it
    }
  };

  // Handler to delete multiple periods at once (batch delete)
  const handleDeletePeriods = async (periodIds: string[]) => {
    if (!selectedClient || periodIds.length === 0) {
      console.error('No client selected or no periods to delete');
      return;
    }

    try {
      // Fetch fresh data first
      const freshPrograms = await getClientProgramsByClient(selectedClient);
      const clientProgram = freshPrograms.find(cp => cp.clientId === selectedClient);

      if (!clientProgram) {
        throw new Error('Client program not found');
      }

      // Find all periods to delete
      const periodsToDelete = clientProgram.periods.filter(p => periodIds.includes(p.id));
      
      if (periodsToDelete.length === 0) {
        return;
      }

      // Calculate the overall date range covering all periods
      let overallStart = new Date();
      let overallEnd = new Date();
      let initialized = false;

      for (const period of periodsToDelete) {
        const periodStart = safeToDate(period.startDate);
        const periodEnd = safeToDate(period.endDate);
        
        if (!initialized) {
          overallStart = periodStart;
          overallEnd = periodEnd;
          initialized = true;
        } else {
          if (periodStart < overallStart) overallStart = periodStart;
          if (periodEnd > overallEnd) overallEnd = periodEnd;
        }
      }

      overallStart.setHours(0, 0, 0, 0);
      overallEnd.setHours(23, 59, 59, 999);

      // Fetch all events in the overall date range
      // React Query will automatically refetch calendar events when date range changes
      await new Promise(resolve => setTimeout(resolve, 300));

      // Delete events for all periods
      for (const period of periodsToDelete) {
        const eventsToDelete = findEventsForPeriod(period, selectedClient);
        
        for (const event of eventsToDelete) {
          try {
            await deleteEvent(event.id);
          } catch (eventError) {
            console.error(`Error deleting event ${event.id}:`, eventError);
          }
        }
      }

      // Delete all workouts in the overall date range
      const startTimestamp = Timestamp.fromDate(overallStart);
      const endTimestamp = Timestamp.fromDate(overallEnd);
      const rangeWorkouts = await fetchWorkoutsByDateRange(selectedClient, startTimestamp, endTimestamp);
      
      for (const workout of rangeWorkouts) {
        try {
          await deleteClientWorkout(workout.id);
        } catch (workoutError) {
          console.error(`Error deleting workout ${workout.id}:`, workoutError);
        }
      }

      // Delete all periods from Firebase
      for (const periodId of periodIds) {
        try {
          await deletePeriodFromClientProgram(clientProgram.id, periodId);
        } catch (periodError) {
          console.error(`Error deleting period ${periodId}:`, periodError);
        }
      }

      // Refresh everything
      await fetchClientPrograms(selectedClient);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      const updatedPrograms = await getClientProgramsByClient(selectedClient);
      const updatedProgram = updatedPrograms.find(cp => cp.clientId === selectedClient);
      if (updatedProgram) {
        setDialogPeriods(updatedProgram.periods || []);
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledWorkouts.all });
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      // React Query will automatically refetch calendar events when date range changes

      setCalendarKey(prev => prev + 1);
    } catch (error) {
      console.error('Error in batch deletion:', error);
      throw error;
    }
  };

  // Handler to clear all calendar events for a client
  const handleClearAllCalendarEvents = async () => {
    if (!selectedClient) return;

    try {
      // First, try to get the date range from client programs to fetch all events
      const clientPrograms = await getClientProgramsByClient(selectedClient);
      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);

      // Expand date range significantly to catch legacy/future events
      let dateRangeStart = new Date();
      dateRangeStart.setFullYear(2000, 0, 1); // Start from 2000
      let dateRangeEnd = new Date();
      dateRangeEnd.setFullYear(2100, 11, 31); // End to 2100

      // If we have periods, check if they extend beyond our wide range (unlikely but safe)
      if (clientProgram && clientProgram.periods.length > 0) {
        for (const period of clientProgram.periods) {
          const periodStart = safeToDate(period.startDate);
          const periodEnd = safeToDate(period.endDate);

          if (periodStart < dateRangeStart) dateRangeStart = periodStart;
          if (periodEnd > dateRangeEnd) dateRangeEnd = periodEnd;
        }
      }

      // Fetch ALL events for the date range
      // Fetch events first
      // React Query will automatically refetch calendar events when date range changes

      // FIX: Access the store state directly to get the fresh events we just fetched
      // Use calendarEvents from React Query hook
      const freshEvents = calendarEvents;

      // key: Get client name for broader matching
      const clientName = selectedClientData?.name || '';

      // Now find all events for this client using the FRESH events list
      // BROADER FILTER: Match by ID metadata OR by client name in summary
      const allClientEvents = freshEvents.filter(event => {
        // 1. Strict metadata match
        const hasMatchingClientMetadata = event.description?.includes(`client=${selectedClient}`) ||
          event.description?.includes(`client=${selectedClient},`) ||
          event.preConfiguredClient === selectedClient;

        if (hasMatchingClientMetadata) return true;

        // 2. Name match in summary (if client name is valid)
        // Matches "Workout with Jordan", "Jordan - Workout", etc.
        if (clientName && event.summary && event.summary.includes(clientName)) {
          return true;
        }

        return false;
      });

      for (const event of allClientEvents) {
        try {
          await deleteEvent(event.id);
        } catch (eventError) {
          console.error(`Error deleting calendar event ${event.id}:`, eventError);
        }
      }

      // Refresh calendar events for current week
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      // React Query will automatically refetch calendar events when date range changes

      // Force calendar refresh
      setCalendarKey(prev => prev + 1);

      // -----------------------------------------------------------------------
      // DELETE FIREBASE WORKOUTS (including Quick Workouts)
      // This includes all workouts: period-based workouts AND quick workouts (no periodId)
      // Use fetchClientWorkouts to get ALL workouts regardless of date to ensure we catch everything
      // -----------------------------------------------------------------------
      const allWorkouts = await fetchClientWorkouts(selectedClient);
      
      // Filter by date range to match the calendar events we're deleting
      const workoutsToDelete = allWorkouts.filter(workout => {
        const workoutDate = workout.date instanceof Timestamp 
          ? workout.date.toDate() 
          : new Date(workout.date);
        return workoutDate >= dateRangeStart && workoutDate <= dateRangeEnd;
      });

      for (const workout of workoutsToDelete) {
        try {
          await deleteClientWorkout(workout.id);
        } catch (workoutError) {
          console.error(`Error deleting workout ${workout.id}:`, workoutError);
        }
      }

      // Refresh scheduled workouts via React Query
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduledWorkouts.all });
    } catch (error) {
      console.error('Error clearing events/workouts:', error);
      throw error;
    }
  };

  const handleClearAllPeriods = async () => {
    if (!selectedClient) return;

    try {
      // Fetch the latest client program from Firebase to ensure we have all periods
      const freshClientPrograms = await getClientProgramsByClient(selectedClient);
      const clientProgram = freshClientPrograms.find(cp => cp.clientId === selectedClient);

      if (!clientProgram) {
        // Even if no client program, we should still try to clear calendar events
        await handleClearAllCalendarEvents();
        return;
      }

      if (clientProgram.periods.length === 0) {
        // Clear calendar events even if no periods
        await handleClearAllCalendarEvents();
        return;
      }

      // First, collect all workouts to delete across all periods
      const allWorkoutsToDelete: Array<{ id: string; periodId: string }> = [];

      for (const period of clientProgram.periods) {
        try {
          // Get the date range for this period
          const periodStart = safeToDate(period.startDate);
          const periodEnd = safeToDate(period.endDate);

          // Fetch workouts in this date range
          const workouts = await fetchWorkoutsByDateRange(
            selectedClient,
            Timestamp.fromDate(periodStart),
            Timestamp.fromDate(periodEnd)
          );

          // Collect workouts that match this period's date range (Robust Deletion)
          // We intentionally include ALL workouts in the range, even if not explicitly linked by ID,
          // to ensure "phantom" workouts are cleared.
          allWorkoutsToDelete.push(...workouts.map(w => ({ id: w.id, periodId: period.id })));
        } catch (error) {
          console.error(`Error fetching workouts for period ${period.id}:`, error);
          // Continue with other periods
        }
      }

      // Find the overall date range covering all periods
      let overallStart = new Date();
      let overallEnd = new Date();
      let hasPeriods = false;

      for (const period of clientProgram.periods) {
        const periodStart = safeToDate(period.startDate);
        const periodEnd = safeToDate(period.endDate);
        periodStart.setHours(0, 0, 0, 0);
        periodEnd.setHours(23, 59, 59, 999);

        if (!hasPeriods) {
          overallStart = periodStart;
          overallEnd = periodEnd;
          hasPeriods = true;
        } else {
          if (periodStart < overallStart) overallStart = periodStart;
          if (periodEnd > overallEnd) overallEnd = periodEnd;
        }
      }

      // Fetch ALL events for the entire date range covering all periods
      if (hasPeriods) {
        // React Query will automatically refetch calendar events when date range changes
        // Wait for store to update
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Find and collect all calendar events to delete for this client
      // First try to find events associated with periods
      const allEventsToDelete: GoogleCalendarEvent[] = [];
      for (const period of clientProgram.periods) {
        const periodEvents = findEventsForPeriod(period, selectedClient);
        allEventsToDelete.push(...periodEvents);
      }

      // Also find ALL events for this client (in case some aren't associated with periods)
      const allClientEvents = findAllEventsForClient(selectedClient);
      const uniqueEvents = new Map<string, GoogleCalendarEvent>();

      // Add period events
      allEventsToDelete.forEach(event => uniqueEvents.set(event.id, event));
      // Add all client events (will overwrite duplicates)
      allClientEvents.forEach(event => uniqueEvents.set(event.id, event));

      const finalEventsToDelete = Array.from(uniqueEvents.values());

      // Delete all calendar events
      for (const event of finalEventsToDelete) {
        try {
          await deleteEvent(event.id);
        } catch (eventError) {
          console.error(`Error deleting calendar event ${event.id}:`, eventError);
          // Continue with other events even if one fails
        }
      }

      // Delete all workouts
      for (const workout of allWorkoutsToDelete) {
        try {
          await deleteClientWorkout(workout.id);
        } catch (workoutError) {
          console.error(`Error deleting workout ${workout.id}:`, workoutError);
          // Continue with other workouts even if one fails
        }
      }

      // Delete all periods in a single batch operation
      await deleteAllPeriodsFromClientProgram(clientProgram.id);

      // Clear dialog periods immediately
      setDialogPeriods([]);

      // Refresh client programs from Firebase - do this multiple times to ensure state is updated
      await fetchClientPrograms(selectedClient);

      // Wait a bit to ensure Firebase has processed the update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh again to ensure we have the latest state
      await fetchClientPrograms(selectedClient);

      // Wait and refresh one more time
      await new Promise(resolve => setTimeout(resolve, 300));
      await fetchClientPrograms(selectedClient);

      // Refresh calendar events and workouts
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      // React Query will automatically refetch calendar events when date range changes

      // Force calendar refresh
      setCalendarKey(prev => prev + 1);
    } catch (error) {
      console.error('Error clearing all periods:', error);
      throw error;
    }
  };

  const handleForceClearLocalEvents = async () => {
    try {
      await clearAllTestEvents();

      // Refresh events
      if (selectedClient) {
        const weekStart = new Date(calendarDate);
        weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        // React Query will automatically refetch calendar events when date range changes
      }

      setCalendarKey(prev => prev + 1);
    } catch (error) {
      console.error('Error force clearing local events:', error);
      throw error;
    }
  };

  const handleUpdateScheduleEvent = async (updates: {
    date: Date;
    time: string;
    category: string;
    extendPeriod?: {
      newEndDate: Date;
    };
  }) => {
    if (!selectedEventForEdit || !selectedClient) return;

    try {
      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      if (!clientProgram) {
        throw new Error('Client program not found');
      }

      // Find the period that contains the original event date
      const originalEventDate = new Date(selectedEventForEdit.start.dateTime);
      const period = clientProgram.periods.find(p => {
        const startDate = safeToDate(p.startDate);
        const endDate = safeToDate(p.endDate);
        return originalEventDate >= startDate && originalEventDate <= endDate;
      });

      if (!period) {
        throw new Error('Period not found for this event');
      }

      // Update the period day for the original date
      const updatedDays = period.days.map(day => {
        const dayDate = safeToDate(day.date);
        if (dayDate.toDateString() === originalEventDate.toDateString()) {
          // Update this day's category and time
          const category = workoutCategories.find(wc => wc.name === updates.category);
          return {
            ...day,
            workoutCategory: updates.category,
            workoutCategoryColor: category?.color || '#6b7280',
            time: updates.category === 'Rest Day' ? undefined : updates.time,
            date: Timestamp.fromDate(updates.date) // Update to new date
          };
        }
        return day;
      });

      // If date changed, we might need to add a new day or update the period range
      const dateChanged = originalEventDate.toDateString() !== updates.date.toDateString();

      if (dateChanged) {
        // Check if the new date is within the period range
        const periodStart = safeToDate(period.startDate);
        const periodEnd = safeToDate(period.endDate);

        if (updates.date < periodStart || updates.date > periodEnd) {
          // Date is outside period range - need to extend period
          const newStartDate = updates.date < periodStart ? updates.date : periodStart;
          const newEndDate = updates.extendPeriod?.newEndDate ||
            (updates.date > periodEnd ? updates.date : periodEnd);

          // Update period dates
          await updatePeriodInClientProgram(clientProgram.id, period.id, {
            startDate: Timestamp.fromDate(newStartDate),
            endDate: Timestamp.fromDate(newEndDate),
            days: updatedDays
          });
        } else {
          // Date is within range, just update days
          await updatePeriodInClientProgram(clientProgram.id, period.id, {
            days: updatedDays
          });
        }
      } else {
        // Just update the day
        await updatePeriodInClientProgram(clientProgram.id, period.id, {
          days: updatedDays
        });
      }

      // Update the Google Calendar event
      const [hours, minutes] = updates.time.split(':').map(Number);
      const newEventStart = new Date(updates.date);
      newEventStart.setHours(hours, minutes, 0, 0);
      const newEventEnd = new Date(newEventStart);
      newEventEnd.setHours(hours + 1, minutes, 0, 0);

      const updatedEvent: Partial<GoogleCalendarEvent> = {
        ...selectedEventForEdit,
        summary: `${updates.category} Session with ${selectedClientData?.name || 'Client'}`,
        description: `Workout Category: ${updates.category}\n[Metadata: client=${selectedClient}, category=${updates.category}]`,
        start: {
          dateTime: newEventStart.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        end: {
          dateTime: newEventEnd.toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        },
        preConfiguredCategory: updates.category
      };

      await updateEvent(selectedEventForEdit.id, updatedEvent);

      // Refresh everything
      await fetchClientPrograms(selectedClient);
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      // React Query will automatically refetch calendar events when date range changes
    } catch (error) {
      console.error('Error updating schedule event:', error);
      throw error;
    }
  };

  const handleApplyWeekTemplate = async (periodId: string, weekTemplateId: string) => {
    try {
      const weekTemplate = weekTemplates.find(wt => wt.id === weekTemplateId);
      if (!weekTemplate) return;

      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      if (!clientProgram) return;

      const period = clientProgram.periods.find(p => p.id === periodId);
      if (!period) return;

      // Generate days for the period
      const days = [];
      const currentDate = new Date(period.startDate.toDate());
      const endDate = new Date(period.endDate.toDate());

      while (currentDate <= endDate) {
        const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
        const templateDay = weekTemplate.days.find(d => d.day === dayOfWeek);

        if (templateDay) {
          const category = workoutCategories.find(wc => wc.name === templateDay.workoutCategory);
          days.push({
            date: Timestamp.fromDate(new Date(currentDate)),
            workoutCategory: templateDay.workoutCategory,
            workoutCategoryColor: category?.color || '#6b7280'
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Update period in Firebase
      await updatePeriodInClientProgram(clientProgram.id, periodId, {
        weekTemplateId,
        days
      });

      // Refresh client programs from Firebase
      await fetchClientPrograms(selectedClient);
    } catch (error) {
      console.error('Error applying week template:', error);
    }
  };

  const handlePeriodClick = (period: ClientProgramPeriod, position: { x: number; y: number }) => {
    setSelectedPeriod(period);
    setPeriodPanelPosition(position);
    setPeriodPanelOpen(true);
  };

  const handleClosePeriodPanel = () => {
    setPeriodPanelOpen(false);
    setSelectedPeriod(null);
    setPeriodPanelPosition(undefined);
  };

  const handleDateClick = (date: Date, targetViewMode: 'week' | 'day') => {
    // Set the calendar date to the clicked date
    setCalendarDate(date);

    // Switch to the target view mode
    setViewMode(targetViewMode);
  };

  const handleWeekCellClick = (date: Date, timeSlot: Date, period?: ClientProgramPeriod) => {
    if (period) {
      setSelectedPeriod(period);
      setSelectedTimeSlot(timeSlot);
      setWeekScheduleManagerOpen(true);
    } else {
      // Open create event dialog for empty cells
      setCreateEventDate(date);
      setCreateEventTime(timeSlot);
      setCreateEventDialogOpen(true);
    }
  };

  // Handler for when schedule event cards are clicked - show action dialog
  const handleScheduleEventClick = (event: GoogleCalendarEvent) => {
    setSelectedEventForAction(event);
    setEventActionDialogOpen(true);
  };

  const handleMoveWorkoutCategory = async (fromDate: Date, toDate: Date, category: string) => {
    console.log('handleMoveWorkoutCategory called:', { fromDate: fromDate.toDateString(), toDate: toDate.toDateString(), category, selectedClient });

    if (!selectedClient) {
      console.error('No selectedClient found');
      return;
    }

    try {
      // Handle remove action
      if (category === '__REMOVE__') {
        await handleRemoveEvent(fromDate);
        return;
      }

      // Find the client program, create "Quick Workouts" program if none exists
      let clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      if (!clientProgram) {
        try {
          // First, ensure "Quick Workouts" program template exists
          const { createProgram, getAllPrograms } = await import('@/lib/firebase/services/programs');
          const allPrograms = await getAllPrograms();
          let quickWorkoutsTemplate = allPrograms.find(p => p.name === 'Quick Workouts' && p.isTemplate);

          if (!quickWorkoutsTemplate) {
            const templateId = await createProgram({
              name: 'Quick Workouts',
              description: 'Template for unplanned workouts and one-off sessions',
              isTemplate: true,
              createdBy: 'system'
            });
            quickWorkoutsTemplate = { id: templateId, name: 'Quick Workouts', isTemplate: true } as any;
          }

          // Create a dedicated "Quick Workouts" program for unplanned sessions
          const now = Timestamp.now();
          const farFuture = Timestamp.fromDate(new Date(2099, 11, 31));

          // quickWorkoutsTemplate is guaranteed to be defined after the if block above
          if (!quickWorkoutsTemplate) {
            console.error('Failed to create or find Quick Workouts template');
            return;
          }

          const quickWorkoutsProgram = {
            clientId: selectedClient,
            programTemplateId: quickWorkoutsTemplate.id,
            startDate: now,
            endDate: farFuture,
            status: 'active' as const,
            createdBy: 'system',
            periods: [{
              id: `quick-period-${Date.now()}-${selectedClient}`,
              periodConfigId: 'quick-workouts-config',
              periodName: 'Ongoing',
              periodColor: '#10b981', // Green color for ongoing
              startDate: now,
              endDate: farFuture,
              days: [] // Empty days array - workouts will be added as needed
            }]
          };

          clientProgram = await createClientProgram(quickWorkoutsProgram);

          if (!clientProgram) {
            console.error('Failed to create client program');
            return;
          }

          // Ensure periods array exists
          if (!clientProgram.periods) {
            clientProgram.periods = [];
          }

          // Refresh client programs from Firestore to get properly formatted data
          await fetchClientPrograms(selectedClient);

          // Get the freshly created program from Firestore
          const refreshedPrograms = await getClientProgramsByClient(selectedClient);
          clientProgram = refreshedPrograms.find(cp => cp.clientId === selectedClient);

          if (!clientProgram) {
            console.error('Failed to find created program after refresh');
            return;
          }
          // Refresh state from hook
          await fetchClientPrograms(selectedClient);
        } catch (error) {
          console.error('Failed to create client program:', error);
          return;
        }
      }

      if (!clientProgram || !clientProgram.periods || clientProgram.periods.length === 0) {
        console.error('Client program is invalid or has no periods array', { periodsCount: clientProgram?.periods?.length || 0 });
        return;
      }
      console.log('Client program periods:', clientProgram.periods);
      console.log('Looking for date:', fromDate.toISOString());

      // Find the period that contains the fromDate
      const period = clientProgram.periods.find(p => {
        // Handle Firestore Timestamp conversion
        let startDate: Date;
        let endDate: Date;

        if (p.startDate && typeof p.startDate === 'object') {
          if (p.startDate.toDate) {
            startDate = p.startDate.toDate();
          } else if (p.startDate.seconds) {
            startDate = new Date(p.startDate.seconds * 1000);
          } else {
            startDate = new Date(p.startDate as any);
          }
        } else {
          startDate = new Date(p.startDate as any);
        }

        if (p.endDate && typeof p.endDate === 'object') {
          if (p.endDate.toDate) {
            endDate = p.endDate.toDate();
          } else if (p.endDate.seconds) {
            endDate = new Date(p.endDate.seconds * 1000);
          } else {
            endDate = new Date(p.endDate as any);
          }
        } else {
          endDate = new Date(p.endDate as any);
        }

        // Normalize dates to start of day for comparison
        const fromDateNormalized = new Date(fromDate);
        fromDateNormalized.setHours(0, 0, 0, 0);
        const startDateNormalized = new Date(startDate);
        startDateNormalized.setHours(0, 0, 0, 0);
        const endDateNormalized = new Date(endDate);
        endDateNormalized.setHours(23, 59, 59, 999);

        const isInRange = fromDateNormalized >= startDateNormalized && fromDateNormalized <= endDateNormalized;

        console.log('Period check:', {
          periodName: p.periodName,
          periodId: p.id,
          fromDate: fromDateNormalized.toISOString(),
          startDate: startDateNormalized.toISOString(),
          endDate: endDateNormalized.toISOString(),
          isInRange,
          rawStartDate: p.startDate,
          rawEndDate: p.endDate
        });

        return isInRange;
      });

      // If no period exists, create a one-off event
      if (!period) {
        console.log('No period found, creating one-off event');
        await handleCreateOneOffEvent(clientProgram, fromDate, category);
        return;
      }

      // Find the day to move from
      const fromDayIndex = period.days.findIndex(d => {
        const dayDate = d.date.toDate ? d.date.toDate() : new Date(d.date.seconds * 1000);
        return dayDate.toDateString() === fromDate.toDateString();
      });

      // If day doesn't exist in period, create a new day entry
      if (fromDayIndex === -1) {
        console.log('Day not found in period, creating new day entry');
        const newDayEntry = {
          date: Timestamp.fromDate(fromDate),
          workoutCategory: category,
          workoutCategoryColor: getCategoryColor(category),
          time: undefined,
          isAllDay: true
        };

        const updatedDays = [...period.days, newDayEntry];

        // OPTIMISTIC UPDATE: Update local state immediately
        const updatedClientPrograms = clientPrograms.map(cp => {
          if (cp.id === clientProgram.id) {
            const updatedPeriods = cp.periods.map(p => {
              if (p.id === period.id) {
                return { ...p, days: updatedDays };
              }
              return p;
            });
            return { ...cp, periods: updatedPeriods };
          }
          return cp;
        });
        // SYNC TO FIREBASE first
        await updatePeriodInClientProgram(clientProgram.id, period.id, { days: updatedDays });
        console.log('Added new day to existing period');

        // Refresh state from hook
        fetchClientPrograms(selectedClient);
        setCalendarKey(prev => prev + 1);
        return;
      }

      // Update the days array
      const updatedDays = [...period.days];
      const movedDay = updatedDays[fromDayIndex];

      // Check if this is a category change (same date) or a move (different date)
      const isCategoryChange = fromDate.toDateString() === toDate.toDateString();

      if (isCategoryChange) {
        // Category change: update the existing day entry
        updatedDays[fromDayIndex] = {
          ...movedDay,
          workoutCategory: category,
          workoutCategoryColor: getCategoryColor(category)
        };
        console.log(`Changed category to ${category} on ${fromDate.toDateString()}`);
      } else {
        // Move: remove from source and add to target
        updatedDays.splice(fromDayIndex, 1);

        // Add new day entry for the target date with the moved category
        const newDayEntry = {
          date: Timestamp.fromDate(toDate),
          workoutCategory: category,
          workoutCategoryColor: getCategoryColor(category), // Use the new category's color
          time: movedDay.time,
          isAllDay: movedDay.isAllDay
        };

        updatedDays.push(newDayEntry);
        console.log(`Moved ${category} from ${fromDate.toDateString()} to ${toDate.toDateString()}`);
      }

      // SYNC TO FIREBASE first, then refresh state
      try {
        await updatePeriodInClientProgram(clientProgram.id, period.id, {
          days: updatedDays
        });
        console.log('Successfully synced to Firebase');

        // Refresh state from hook after successful sync
        await fetchClientPrograms(selectedClient);
        setCalendarKey(prev => prev + 1); // Force calendar re-render
      } catch (firebaseError) {
        console.error('Failed to sync to Firebase:', firebaseError);
        // Refresh to get latest state on error too
        await fetchClientPrograms(selectedClient);
      }

    } catch (error) {
      console.error('Error moving/changing workout category:', error);
      // Refresh on any error
      await fetchClientPrograms(selectedClient);
    }
  };

  // Helper function to remove events
  const handleRemoveEvent = async (date: Date) => {
    if (!selectedClient) return;

    try {
      // Find the client program
      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      if (!clientProgram) return;

      // Find the period that contains the date (using same logic as period finding)
      const period = clientProgram.periods.find(p => {
        // Handle Firestore Timestamp conversion
        let startDate: Date;
        let endDate: Date;

        if (p.startDate && typeof p.startDate === 'object') {
          if (p.startDate.toDate) {
            startDate = p.startDate.toDate();
          } else if (p.startDate.seconds) {
            startDate = new Date(p.startDate.seconds * 1000);
          } else {
            startDate = new Date(p.startDate as any);
          }
        } else {
          startDate = new Date(p.startDate as any);
        }

        if (p.endDate && typeof p.endDate === 'object') {
          if (p.endDate.toDate) {
            endDate = p.endDate.toDate();
          } else if (p.endDate.seconds) {
            endDate = new Date(p.endDate.seconds * 1000);
          } else {
            endDate = new Date(p.endDate as any);
          }
        } else {
          endDate = new Date(p.endDate as any);
        }

        // Normalize dates to start of day for comparison
        const dateNormalized = new Date(date);
        dateNormalized.setHours(0, 0, 0, 0);
        const startDateNormalized = new Date(startDate);
        startDateNormalized.setHours(0, 0, 0, 0);
        const endDateNormalized = new Date(endDate);
        endDateNormalized.setHours(23, 59, 59, 999);

        return dateNormalized >= startDateNormalized && dateNormalized <= endDateNormalized;
      });

      if (!period) {
        console.log('No period found for removal. Available periods:', clientProgram.periods.map(p => ({
          id: p.id,
          name: p.periodName,
          startDate: p.startDate,
          endDate: p.endDate
        })));
        return;
      }

      // Find the day to remove
      const dayIndex = period.days.findIndex(d => {
        // Handle Firestore Timestamp conversion
        let dayDate: Date;
        if (d.date && typeof d.date === 'object') {
          if (d.date.toDate) {
            dayDate = d.date.toDate();
          } else if (d.date.seconds) {
            dayDate = new Date(d.date.seconds * 1000);
          } else {
            dayDate = new Date(d.date as any);
          }
        } else {
          dayDate = new Date(d.date as any);
        }
        return dayDate.toDateString() === date.toDateString();
      });

      if (dayIndex === -1) {
        console.log('No day found for removal');
        return;
      }

      // Remove the day from the period
      const updatedDays = [...period.days];
      updatedDays.splice(dayIndex, 1);

      // If this was a one-off period with only one day, delete the entire period
      if (period.periodName.startsWith('One-off:') && updatedDays.length === 0) {
        console.log('Removing one-off period entirely');
        await deletePeriodFromClientProgram(clientProgram.id, period.id);
      } else {
        // Update the period with the remaining days
        await updatePeriodInClientProgram(clientProgram.id, period.id, {
          days: updatedDays
        });
      }

      // Refresh state from hook after Firebase update
      await fetchClientPrograms(selectedClient);
      setCalendarKey(prev => prev + 1);
      console.log('Successfully removed event');

    } catch (error) {
      console.error('Failed to remove event:', error);
      // Refresh from Firebase on error
      await fetchClientPrograms(selectedClient);
    }
  };

  // Helper function to create one-off events
  const handleCreateOneOffEvent = async (clientProgram: ClientProgram, date: Date, category: string) => {
    try {
      // Create a new standalone period for this single day
      const oneOffPeriod = {
        id: `oneoff-${Date.now()}`,
        periodConfigId: '', // No period config for one-off events
        periodName: `One-off: ${category}`,
        periodColor: getCategoryColor(category),
        startDate: Timestamp.fromDate(date),
        endDate: Timestamp.fromDate(date),
        weekTemplateId: '', // No template for one-off events
        days: [{
          date: Timestamp.fromDate(date),
          workoutCategory: category,
          workoutCategoryColor: getCategoryColor(category),
          time: undefined,
          isAllDay: true
        }]
      };

      // Add the one-off period to the client program
      await addPeriodToClientProgram(clientProgram.id, oneOffPeriod);

      // Refresh client programs from Firestore to ensure everything is in sync
      await fetchClientPrograms(clientProgram.clientId);
      console.log('After refresh, clientPrograms:', clientPrograms);
      setCalendarKey(prev => prev + 1);
      console.log('Calendar key updated, should trigger re-render');

      // Ensure period panel stays closed for one-off events
      setPeriodPanelOpen(false);
      setSelectedPeriod(null);

      console.log('Created one-off event and updated local state');

    } catch (error) {
      console.error('Failed to create one-off event:', error);
      // Refresh from Firebase on error
      await fetchClientPrograms(selectedClient);
    }
  };

  // Helper function to get category color
  const getCategoryColor = (category: string): string => {
    const categoryColors: { [key: string]: string } = {
      'Workout': '#3b82f6',
      'Cardio Day': '#ef4444',
      'Conditioning': '#f59e0b',
      'Rest Day': '#6b7280',
      'Recovery': '#10b981',
      'Strength': '#8b5cf6',
      'Power': '#f97316',
      'Endurance': '#06b6d4'
    };
    return categoryColors[category] || '#6b7280';
  };

  // Callback for refreshing calendar after workout creation
  const handleWorkoutCreated = async () => {
    setCalendarKey(prev => prev + 1);
    // React Query will automatically refetch calendar events when mutations invalidate queries
  };

  // Prevent rendering if critical data isn't ready (prevents freeze)
  // Also wait for initial data to load before rendering calendar
  if (!mounted || (clientProgramsLoading && clientPrograms.length === 0)) {
    return <PageSkeleton />;
  }

  return (
    <div className="w-full px-1 pt-1 pb-4 space-y-2">
      {/* Timezone Change Notification */}
      {showTimezonePrompt && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-amber-900 mb-1">
                  Timezone Change Detected
                </h3>
                <p className="text-sm text-amber-700 mb-3">
                  Your browser timezone ({formatTimezoneLabel(getBrowserTimezone())}) differs from 
                  the app timezone ({formatTimezoneLabel(appTimezone)}). 
                  Would you like to update the app timezone to match your current location?
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      const browserTz = getBrowserTimezone();
                      setAppTimezone(browserTz);
                      setAppTimezoneState(browserTz);
                      setShowTimezonePrompt(false);
                      localStorage.setItem(TIMEZONE_DISMISS_KEY, 'true');
                      toastSuccess(`Timezone updated to ${formatTimezoneLabel(browserTz)}`);
                      setTimeout(() => {
                        window.location.reload();
                      }, 500);
                    }}
                    className="bg-amber-600 hover:bg-amber-700"
                  >
                    Update to {formatTimezoneLabel(getBrowserTimezone())}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowTimezonePrompt(false);
                      localStorage.setItem(TIMEZONE_DISMISS_KEY, 'true');
                    }}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Keep Current ({formatTimezoneLabel(appTimezone)})
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      router.push('/configure?tab=app');
                    }}
                    className="text-amber-700 hover:bg-amber-100"
                  >
                    Change in Settings
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowTimezonePrompt(false);
                      localStorage.setItem(TIMEZONE_DISMISS_KEY, 'true');
                    }}
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  >
                    Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters and Controls */}
      <Card className="py-2">
        <CardContent className="py-1 px-2">
          {/* Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left aligned - Client Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 icon-clients" />
                <label className="text-sm font-medium">Client:</label>
              </div>
              <Select value={selectedClient || 'all'} onValueChange={handleClientChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients
                    .filter(client => !client.isDeleted)
                    .map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {selectedClient && (
                <>
                  <QuickWorkoutBuilderDialog
                    clientId={selectedClient}
                    clientName={selectedClientData?.name || 'Unknown Client'}
                    onWorkoutCreated={handleWorkoutCreated}
                  />
                  <PeriodAssignmentDialog
                    clientId={selectedClient}
                    clientName={selectedClientData?.name || 'Unknown Client'}
                    periods={periods || []}
                    workoutCategories={workoutCategories || []}
                    weekTemplates={weekTemplates || []}
                    onAssignPeriod={handleAssignPeriod}
                    existingAssignments={clientPrograms.find(cp => cp.clientId === selectedClient)?.periods || []}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      // Fetch fresh periods before opening dialog
                      if (selectedClient) {
                        console.log('Fetching periods before opening dialog for client:', selectedClient);
                        const freshPrograms = await getClientProgramsByClient(selectedClient);
                        const freshClientProgram = freshPrograms.find(cp => cp.clientId === selectedClient);
                        const freshPeriods = freshClientProgram?.periods || [];

                        console.log('Fetched periods before opening:', {
                          clientId: selectedClient,
                          periodsCount: freshPeriods.length,
                          periods: freshPeriods.map(p => ({
                            id: p.id,
                            name: p.periodName,
                            startDate: format(safeToDate(p.startDate), 'yyyy-MM-dd'),
                            endDate: format(safeToDate(p.endDate), 'yyyy-MM-dd')
                          }))
                        });

                        setDialogPeriods(freshPeriods);
                        // Also update main state
                        await fetchClientPrograms(selectedClient);
                      }
                      setPeriodListDialogOpen(true);
                    }}
                    className="gap-2"
                  >
                    <Calendar className="h-4 w-4 icon-schedule" />
                    Manage Periods
                    {clientPrograms.find(cp => cp.clientId === selectedClient)?.periods.length ? (
                      <span className="ml-1 bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-xs">
                        {clientPrograms.find(cp => cp.clientId === selectedClient)?.periods.length}
                      </span>
                    ) : null}
                  </Button>
                </>
              )}
            </div>

            {/* Right aligned - Sat/Sun > Week Selector */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Weekend Toggle */}
              <div className="flex items-center gap-1">
                <input
                  type="checkbox"
                  id="includeWeekends"
                  checked={includeWeekends}
                  onChange={(e) => setIncludeWeekends(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="includeWeekends" className="text-xs text-muted-foreground">
                  Sat/Sun
                </label>
              </div>

              {/* Week Selector */}
              <div className="flex items-center gap-1 md:gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigate(-1)}
                  className="p-1 md:p-2"
                >
                  <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 icon-schedule" />
                </Button>
                <div className="min-w-[110px] md:min-w-[140px] text-center font-medium text-sm">
                  {getNavigationLabel()}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleNavigate(1)}
                  className="p-1 md:p-2"
                >
                  <ChevronRight className="h-3 w-3 md:h-4 md:w-4 icon-schedule" />
                </Button>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Calendar View and Current Day Schedule Sidebar - Always rendered to prevent flashing */}
        <div className="flex gap-1 mt-1">
          {/* Week View - Scrollable, constrained to leave space for sidebar */}
          <div className="flex-1 min-w-0 overflow-x-auto" style={{ maxWidth: 'calc(100% - 272px)' }}>
            <ErrorBoundary fallback={<div className="p-4 text-center text-destructive">Error loading calendar. Please refresh the page.</div>}>
              <React.Suspense fallback={<PageSkeleton />}>
                <ModernCalendarView
                  viewMode="week"
                  calendarDate={calendarDate}
                  scheduledWorkouts={scheduledWorkouts}
                  selectedClient={selectedClient}
                  programs={programs}
                  clients={clients}
                  clientPrograms={stableClientPrograms}
                  includeWeekends={includeWeekends}
                  refreshKey={calendarKey}
                  onPeriodClick={handlePeriodClick}
                  onDateClick={handleDateClick}
                  onScheduleCellClick={handleWeekCellClick}
                  onWorkoutCellClick={(date: Date, timeSlot: Date, period?: ClientProgramPeriod) => {
                    // When clicking workout cell, navigate to builder
                    const dateParam = format(date, 'yyyy-MM-dd');
                    const clientParam = selectedClient ? `client=${selectedClient}&` : '';

                    // Navigate to builder - if there's a period, the builder will handle it
                    const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}`;
                    window.location.href = buildWorkoutUrl;
                  }}
                  onMoveWorkoutCategory={handleMoveWorkoutCategory}
                  onEventClick={handleScheduleEventClick}
                />
              </React.Suspense>
            </ErrorBoundary>
          </div>

          {/* Current Day Schedule - Side view - Always visible, fixed width */}
          {/* Note: selectedClientId is null to show ALL events for the day, regardless of client selection */}
          <div className="w-64 flex-shrink-0 sticky top-2 self-start">
            <DayEventList
              selectedDate={selectedDate}
              events={stableCalendarEvents}
              clients={clients}
              selectedClientId={null}
              headerActions={
                <MiniCalendarTooltip
                  currentDate={calendarDate}
                  selectedDate={selectedDate}
                  onDateSelect={handleMiniCalendarDateSelect}
                />
              }
              onEventClick={handleScheduleEventClick}
            />
          </div>
        </div>

      {/* Error Display */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State - Only show on initial load, not on client switches */}
      {/* Removed to prevent schedule from disappearing during client changes */}

      {/* Period Management Panel */}
      <PeriodManagementPanel
        isOpen={periodPanelOpen}
        onClose={handleClosePeriodPanel}
        selectedPeriod={selectedPeriod}
        clientName={selectedClientData?.name || 'Unknown Client'}
        onUpdatePeriod={handleUpdatePeriod}
        onDeletePeriod={handleDeletePeriod}
        onApplyWeekTemplate={handleApplyWeekTemplate}
        weekTemplates={weekTemplates as any}
        workoutCategories={workoutCategories}
        position={periodPanelPosition}
      />

      {/* Week View Schedule Manager */}
      <WeekViewScheduleManager
        selectedDate={calendarDate}
        selectedTimeSlot={selectedTimeSlot}
        selectedPeriod={selectedPeriod}
        workoutCategories={workoutCategories}
        onUpdatePeriod={handleUpdatePeriod}
        isOpen={weekScheduleManagerOpen}
        onClose={() => {
          setWeekScheduleManagerOpen(false);
          setSelectedTimeSlot(null);
        }}
      />

      {/* Create Schedule Event Dialog */}
      <CreateScheduleEventDialog
        open={!!createEventDate && createEventDialogOpen}
        onOpenChange={setCreateEventDialogOpen}
        selectedDate={createEventDate || new Date()}
        selectedTime={createEventTime || undefined}
        onEventCreated={() => {
          // Refresh calendar events
          const weekStart = new Date(calendarDate);
          weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6);
          // React Query will automatically refetch calendar events when date range changes
        }}
      />

      {/* Period List Dialog - Always rendered to keep portal DOM persistent */}
      <PeriodListDialog
        open={!!selectedClient && periodListDialogOpen}
        onOpenChange={async (open) => {
          setPeriodListDialogOpen(open);
          // Always fetch fresh data when dialog opens to ensure we have latest
          if (open && selectedClient) {
            console.log('Dialog opening, fetching fresh client programs for:', selectedClient);
            const freshPrograms = await getClientProgramsByClient(selectedClient);
            const freshClientProgram = freshPrograms.find(cp => cp.clientId === selectedClient);
            const freshPeriods = freshClientProgram?.periods || [];

            console.log('Fresh data from Firebase when dialog opens:', {
              clientId: selectedClient,
              programsFound: freshPrograms.length,
              clientProgramFound: !!freshClientProgram,
              clientProgramId: freshClientProgram?.id,
              periodsCount: freshPeriods.length,
              periods: freshPeriods.map(p => ({
                id: p.id,
                name: p.periodName,
                startDate: format(safeToDate(p.startDate), 'yyyy-MM-dd'),
                endDate: format(safeToDate(p.endDate), 'yyyy-MM-dd'),
                daysCount: p.days?.length || 0
              }))
            });

            // Always update dialog periods with fresh data
            setDialogPeriods(freshPeriods);

            // Also refresh main state to keep it in sync
            await fetchClientPrograms(selectedClient);
          } else {
            // Clear dialog periods when closing
            setDialogPeriods([]);
          }
        }}
        periods={React.useMemo(() => {
            // Calculate periods - use stable dependencies to prevent infinite loops
            if (!selectedClient || !periodListDialogOpen) {
              return [];
            }
            
            const clientProgram = stableClientPrograms.find(cp => cp.clientId === selectedClient);
            const statePeriods = clientProgram?.periods || [];
            const result = stableDialogPeriods.length > 0 ? stableDialogPeriods : statePeriods;
            
            // Return a stable reference - only create new array if content actually changed
            return result;
          }, [selectedClient, periodListDialogOpen, stableClientPrograms.length, stableDialogPeriods.length])}
          clientName={selectedClientData?.name || 'Unknown Client'}
          onDeletePeriod={handleDeletePeriod}
          onDeletePeriods={handleDeletePeriods}
          onClearAll={handleClearAllPeriods}
          onClearAllCalendarEvents={handleClearAllCalendarEvents}
          onForceClearLocalEvents={handleForceClearLocalEvents}
          calendarEventsCount={(() => {
            // IMPORTANT: Calculate directly without useMemo
            // Using useMemo with array.length dependencies causes React error #310 during rapid re-renders
            // because React sees hooks being called in different orders. Simple calculations don't need memoization.
            if (!selectedClient) return 0;
            
            const clientName = selectedClientData?.name;
            return stableCalendarEvents.filter(event => {
              const hasMatchingClient = event.description?.includes(`client=${selectedClient}`) ||
                event.description?.includes(`client=${selectedClient},`) ||
                event.preConfiguredClient === selectedClient;

              if (hasMatchingClient) return true;

              if (clientName && event.summary && event.summary.includes(clientName)) {
                return true;
              }

              return false;
            }).length;
          })()}
        />

      {/* Schedule Event Edit Dialog */}
      {selectedClient && (
        <ScheduleEventEditDialog
          open={scheduleEventEditDialogOpen}
          onOpenChange={setScheduleEventEditDialogOpen}
          event={selectedEventForEdit}
          clientId={selectedClient}
          clientPrograms={clientPrograms}
          workoutCategories={workoutCategories}
          onUpdateEvent={handleUpdateScheduleEvent}
        />
      )}

      {selectedEventForAction && (
        <EventActionDialog
          open={eventActionDialogOpen}
          onOpenChange={setEventActionDialogOpen}
          event={selectedEventForAction}
          clientId={selectedClient || undefined}
          allEvents={stableCalendarEvents}
          clients={clients}
          clientPrograms={clientPrograms}
          fetchEvents={async (dateRange: { start: Date; end: Date }) => {
            // React Query handles refetching automatically when date range changes
            queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
          }}
          onClientAssigned={async () => {
            // Clear the selected event so it gets fresh data when clicked again
            setSelectedEventForAction(null);
            
            // Refresh calendar events after client assignment/unassignment
            const weekStart = new Date(calendarDate);
            weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            // React Query will automatically refetch calendar events when date range changes
            
            // Force calendar view to refresh
            setCalendarKey(prev => prev + 1);
          }}
        />
      )}

    </div>
  );
}
