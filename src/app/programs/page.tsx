"use client";

import { useEffect, useState, useCallback } from 'react';
import React from 'react';
import { useRouter } from 'next/navigation';
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
  Dumbbell,
  Save
} from 'lucide-react';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { ModernCalendarView } from '@/components/programs/ModernCalendarView';
import { CreateProgramDialog } from '@/components/programs/CreateProgramDialog';
import { PeriodManagementPanel } from '@/components/programs/PeriodManagementPanel';
import { WeekViewScheduleManager } from '@/components/programs/WeekViewScheduleManager';
import { MiniCalendarTooltip } from '@/components/programs/MiniCalendarTooltip';
import { DayEventList } from '@/components/programs/DayEventList';
import { AddAssignmentDropdown } from '@/components/programs/AddAssignmentDropdown';
import { CreateScheduleEventDialog } from '@/components/programs/CreateScheduleEventDialog';
import { PeriodListDialog } from '@/components/programs/PeriodListDialog';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { AssignProgramTemplateDialog } from '@/components/programs/AssignProgramTemplateDialog';
import { ScheduleEventEditDialog } from '@/components/programs/ScheduleEventEditDialog';
import { ClientProgram, ClientProgramPeriod } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createClientWorkout, fetchWorkoutsByDateRange, fetchClientWorkouts, updateClientWorkout, deleteClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

export default function ProgramsPage() {
  const router = useRouter();

  const {
    programs,
    scheduledWorkouts,
    selectedClient,
    currentDate,
    viewMode,
    calendarDate,
    loading,
    error,
    fetchPrograms,
    fetchProgramsByClient,
    fetchScheduledWorkoutsByClient,
    fetchAllScheduledWorkouts,
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

  const { clients, fetchClients } = useClientStore();

  // Configuration store
  const { periods, weekTemplates, workoutCategories, workoutStructureTemplates, fetchAll: fetchAllConfig } = useConfigurationStore();

  // Calendar store for events
  const { events: calendarEvents, createTestEvent, fetchEvents, updateEvent, deleteEvent, clearAllTestEvents, linkToWorkout } = useCalendarStore();

  // Selected date for mini calendar (defaults to calendarDate)
  const [selectedDate, setSelectedDate] = useState(calendarDate);

  const [includeWeekends, setIncludeWeekends] = useState(false);

  // Use the shared client programs hook - replaces local state and fetchClientPrograms function
  const {
    clientPrograms,
    isLoading: clientProgramsLoading,
    assignPeriod: hookAssignPeriod,
    assignProgramTemplate: hookAssignProgramTemplate,
    deletePeriod: hookDeletePeriod,
    clearAllPeriods: hookClearAllPeriods,
    fetchClientPrograms
  } = useClientPrograms(selectedClient);

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
  const [scheduleEventEditDialogOpen, setScheduleEventEditDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<GoogleCalendarEvent | null>(null);

  // Quick Workout Builder state
  const [workoutDate, setWorkoutDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [workoutTime, setWorkoutTime] = useState<string>('');
  const [workoutTitle, setWorkoutTitle] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSavingWorkout, setIsSavingWorkout] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);
  const [existingWorkout, setExistingWorkout] = useState<any>(null);
  const [pendingWorkoutData, setPendingWorkoutData] = useState<any>(null);
  const [moveToDate, setMoveToDate] = useState<string>('');

  const { findPeriodForDate } = useClientPrograms(selectedClient);


  useEffect(() => {
    fetchPrograms();
    fetchClients();
    fetchAllConfig();
  }, [fetchPrograms, fetchClients, fetchAllConfig]);

  // Always reset to current/next week on mount (client-side only)
  // If it's Saturday or Sunday, show next week instead
  useEffect(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
    
    let targetDate = today;
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // It's weekend - advance to Monday of next week
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday: +1, Saturday: +2
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() + daysUntilMonday);
      console.log('[Programs] Weekend detected, advancing to next week Monday:', targetDate.toISOString());
    } else {
      console.log('[Programs] Setting calendar to today:', today.toISOString());
    }
    
    setCalendarDate(targetDate);
  }, [setCalendarDate]);

  // Initialize selected client from localStorage after hydration
  useEffect(() => {
    initializeSelectedClient();
  }, [initializeSelectedClient]);

  // Fetch program data when client changes - hook auto-fetches clientPrograms
  useEffect(() => {
    if (selectedClient) {
      fetchProgramsByClient(selectedClient);
      fetchScheduledWorkoutsByClient(selectedClient);
    } else {
      fetchPrograms();
      fetchAllScheduledWorkouts();
    }
  }, [selectedClient, fetchProgramsByClient, fetchScheduledWorkoutsByClient, fetchAllScheduledWorkouts]);

  // Fetch calendar events when calendar date changes
  useEffect(() => {
    if (!calendarDate) return;
    
    // Get week range for the calendar view
    const startDate = new Date(calendarDate);
    startDate.setDate(calendarDate.getDate() - calendarDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    
    fetchEvents({ start: startDate, end: endDate });
  }, [calendarDate, fetchEvents]);

  // Update dialog periods when clientPrograms state changes
  useEffect(() => {
    if (selectedClient && periodListDialogOpen) {
      const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
      const periods = clientProgram?.periods || [];
      console.log('Updating dialog periods from state change:', {
        clientId: selectedClient,
        periodsCount: periods.length,
        periodIds: periods.map(p => p.id)
      });
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
    // Only week view is supported
    const weekStart = new Date(calendarDate);
    weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  // Update selected date when calendar date changes
  React.useEffect(() => {
    setSelectedDate(calendarDate);
  }, [calendarDate]);

  const handleMiniCalendarDateSelect = (date: Date) => {
    setSelectedDate(date);
    // Navigate to the week containing this date
    setCalendarDate(date);
  };

  const selectedClientData = selectedClient ? clients.find(c => c.id === selectedClient) : null;

  const handleEditStructure = (programId: string) => {
    router.push(`/programs/builder/${programId}`);
  };

  // Handler for assigning program templates - uses shared hook for consistent behavior
  const handleAssignProgramTemplate = async (assignment: {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
  }) => {
    try {
      // Use the shared hook for program template assignment
      // This handles creating/updating programs and removing overlapping periods
      await hookAssignProgramTemplate(assignment);
      console.log('Program template assigned successfully via shared hook:', assignment);
    } catch (error) {
      console.error('Error assigning program template:', error);
      throw error; // Re-throw so the dialog can handle the error
    }
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
    console.log('handleAssignPeriod called with:', {
      clientId: assignment.clientId,
      periodId: assignment.periodId,
      startDate: assignment.startDate.toISOString(),
      endDate: assignment.endDate.toISOString(),
      weekTemplateId: assignment.weekTemplateId,
      dayTimesCount: assignment.dayTimes?.length || 0
    });

    try {
      // Use the shared hook for period assignment
      // This handles creating periods, calendar events, and workouts consistently
      await hookAssignPeriod(assignment);
      
      console.log('Period assigned successfully via shared hook');

      // Page-specific refresh: Force calendar view to refresh
      if (selectedClient) {
        const weekStart = new Date(assignment.startDate);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        const weekEnd = new Date(assignment.endDate);
        weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));

        // Refresh calendar events
        await fetchEvents({ start: weekStart, end: weekEnd });

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
      console.log('Deleting period:', { periodId, selectedClient });

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

      console.log('Found client program:', {
        clientProgramId: clientProgram.id,
        periodsBeforeDelete: clientProgram.periods.length,
        periodToDelete: periodToDelete.periodName
      });

      // Fetch ALL events for the period's date range (not just visible week)
      const periodStart = safeToDate(periodToDelete.startDate);
      const periodEnd = safeToDate(periodToDelete.endDate);
      periodStart.setHours(0, 0, 0, 0);
      periodEnd.setHours(23, 59, 59, 999);

      console.log('Fetching all events for period date range:', {
        start: periodStart.toISOString(),
        end: periodEnd.toISOString()
      });

      // Fetch events for the entire period range
      await fetchEvents({ start: periodStart, end: periodEnd });

      // Wait a bit for store to update
      await new Promise(resolve => setTimeout(resolve, 300));

      // Now find events for this period from the freshly fetched events
      const eventsToDelete = findEventsForPeriod(periodToDelete, selectedClient);
      console.log(`Found ${eventsToDelete.length} calendar events to delete for period ${periodId}`);

      for (const event of eventsToDelete) {
        try {
          await deleteEvent(event.id);
          console.log(`Deleted calendar event ${event.id}`);
        } catch (eventError) {
          console.error(`Error deleting calendar event ${event.id}:`, eventError);
          // Continue with other events even if one fails
        }
      }

      // NEW: Also delete all Firebase workouts associated with this period
      // Strategy: Delete by date range to catch any workouts that might have missed the periodId link
      // This is more robust for "wiping the slate clean"
      console.log('Fetching and deleting associated Firebase workouts by date range...');
      try {
        const startTimestamp = Timestamp.fromDate(periodStart);
        const endTimestamp = Timestamp.fromDate(periodEnd);

        // Fetch by date range to ensure we catch everything in this period's timeframe
        const rangeWorkouts = await fetchWorkoutsByDateRange(selectedClient, startTimestamp, endTimestamp);
        console.log(`Found ${rangeWorkouts.length} Firebase workouts to delete in date range ${periodStart.toISOString()} - ${periodEnd.toISOString()}`);

        for (const workout of rangeWorkouts) {
          await deleteClientWorkout(workout.id);
          console.log(`Deleted Firebase workout ${workout.id}`);
        }
      } catch (workoutError) {
        console.error('Error deleting associated workouts:', workoutError);
      }

      // Delete the period from Firebase
      await deletePeriodFromClientProgram(clientProgram.id, periodId);
      console.log('Period deleted from Firebase');

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

      // Refresh calendar events and workouts
      await fetchScheduledWorkoutsByClient(selectedClient);
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      await fetchEvents({ start: weekStart, end: weekEnd });

      // Force calendar refresh
      setCalendarKey(prev => prev + 1);

      console.log('Period deletion complete and state refreshed');
    } catch (error) {
      console.error('Error deleting period:', error);
      throw error; // Re-throw so the dialog can handle it
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
      console.log('Fetching all events for client date range:', {
        start: dateRangeStart.toISOString(),
        end: dateRangeEnd.toISOString()
      });

      // Fetch events first
      await fetchEvents({ start: dateRangeStart, end: dateRangeEnd });

      // FIX: Access the store state directly to get the fresh events we just fetched
      const freshEvents = useCalendarStore.getState().events;

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

      console.log(`Found ${allClientEvents.length} calendar events to delete for client ${selectedClient} (${clientName})`);

      for (const event of allClientEvents) {
        try {
          await deleteEvent(event.id);
          console.log(`Deleted calendar event ${event.id}`);
        } catch (eventError) {
          console.error(`Error deleting calendar event ${event.id}:`, eventError);
        }
      }

      // Refresh calendar events for current week
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      await fetchEvents({ start: weekStart, end: weekEnd });

      // Force calendar refresh
      setCalendarKey(prev => prev + 1);

      console.log(`Successfully cleared ${allClientEvents.length} calendar events`);

      // -----------------------------------------------------------------------
      // DELETE FIREBASE WORKOUTS (including Quick Workouts)
      // This includes all workouts: period-based workouts AND quick workouts (no periodId)
      // Use fetchClientWorkouts to get ALL workouts regardless of date to ensure we catch everything
      // -----------------------------------------------------------------------
      console.log('Fetching all workouts (including quick workouts) for deletion...');
      const allWorkouts = await fetchClientWorkouts(selectedClient);
      
      // Filter by date range to match the calendar events we're deleting
      const workoutsToDelete = allWorkouts.filter(workout => {
        const workoutDate = workout.date instanceof Timestamp 
          ? workout.date.toDate() 
          : new Date(workout.date);
        return workoutDate >= dateRangeStart && workoutDate <= dateRangeEnd;
      });

      // Log breakdown of workouts being deleted
      const periodWorkouts = workoutsToDelete.filter(w => w.periodId);
      const quickWorkouts = workoutsToDelete.filter(w => !w.periodId);
      console.log(`Found ${workoutsToDelete.length} total workouts to delete for client ${selectedClient}:`, {
        periodWorkouts: periodWorkouts.length,
        quickWorkouts: quickWorkouts.length,
        quickWorkoutIds: quickWorkouts.map(w => w.id)
      });

      for (const workout of workoutsToDelete) {
        try {
          await deleteClientWorkout(workout.id);
          console.log(`Deleted workout ${workout.id} (${workout.periodId ? 'period-based' : 'quick workout'})`);
        } catch (workoutError) {
          console.error(`Error deleting workout ${workout.id}:`, workoutError);
        }
      }

      // Update the implementation to refresh workouts as well
      await fetchAllScheduledWorkouts();
      
      console.log(`Successfully cleared ${workoutsToDelete.length} workouts (${periodWorkouts.length} period-based, ${quickWorkouts.length} quick workouts)`);

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
        console.warn('No client program found for client:', selectedClient);
        // Even if no client program, we should still try to clear calendar events
        await handleClearAllCalendarEvents();
        return;
      }

      if (clientProgram.periods.length === 0) {
        console.log('No periods to clear, but clearing calendar events anyway');
        // Clear calendar events even if no periods
        await handleClearAllCalendarEvents();
        return;
      }

      console.log('Clearing all periods:', {
        clientId: selectedClient,
        clientProgramId: clientProgram.id,
        periodsCount: clientProgram.periods.length,
        periods: clientProgram.periods.map(p => ({
          id: p.id,
          name: p.periodName,
          startDate: format(safeToDate(p.startDate), 'yyyy-MM-dd'),
          endDate: format(safeToDate(p.endDate), 'yyyy-MM-dd'),
          daysCount: p.days?.length || 0
        }))
      });

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

      console.log(`Found ${allWorkoutsToDelete.length} total workouts to delete`);

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
        console.log('Fetching all events for overall period date range:', {
          start: overallStart.toISOString(),
          end: overallEnd.toISOString()
        });
        await fetchEvents({ start: overallStart, end: overallEnd });
        // Wait for store to update
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      // Find and collect all calendar events to delete for this client
      // First try to find events associated with periods
      const allEventsToDelete: GoogleCalendarEvent[] = [];
      for (const period of clientProgram.periods) {
        const periodEvents = findEventsForPeriod(period, selectedClient);
        allEventsToDelete.push(...periodEvents);
        console.log(`Found ${periodEvents.length} calendar events for period ${period.id} (${period.periodName})`);
      }

      // Also find ALL events for this client (in case some aren't associated with periods)
      const allClientEvents = findAllEventsForClient(selectedClient);
      const uniqueEvents = new Map<string, GoogleCalendarEvent>();

      // Add period events
      allEventsToDelete.forEach(event => uniqueEvents.set(event.id, event));
      // Add all client events (will overwrite duplicates)
      allClientEvents.forEach(event => uniqueEvents.set(event.id, event));

      const finalEventsToDelete = Array.from(uniqueEvents.values());
      console.log(`Found ${finalEventsToDelete.length} total calendar events to delete for client ${selectedClient}`);

      // Delete all calendar events
      for (const event of finalEventsToDelete) {
        try {
          await deleteEvent(event.id);
          console.log(`Deleted calendar event ${event.id}`);
        } catch (eventError) {
          console.error(`Error deleting calendar event ${event.id}:`, eventError);
          // Continue with other events even if one fails
        }
      }

      // Delete all workouts
      for (const workout of allWorkoutsToDelete) {
        try {
          await deleteClientWorkout(workout.id);
          console.log(`Deleted workout ${workout.id}`);
        } catch (workoutError) {
          console.error(`Error deleting workout ${workout.id}:`, workoutError);
          // Continue with other workouts even if one fails
        }
      }

      // Delete all periods in a single batch operation
      await deleteAllPeriodsFromClientProgram(clientProgram.id);
      console.log('Successfully deleted all periods from client program');

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

      // Verify the deletion
      const verifyPrograms = await getClientProgramsByClient(selectedClient);
      const verifyProgram = verifyPrograms.find(cp => cp.clientId === selectedClient);
      console.log('Verification after clear all:', {
        periodsRemaining: verifyProgram?.periods?.length || 0,
        periods: verifyProgram?.periods || []
      });

      // Refresh calendar events and workouts
      const weekStart = new Date(calendarDate);
      weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      await fetchEvents({ start: weekStart, end: weekEnd });

      // Force calendar refresh
      setCalendarKey(prev => prev + 1);

      console.log('Successfully cleared all periods and refreshed state');
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
        await fetchEvents({ start: weekStart, end: weekEnd });
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
      await fetchEvents({ start: weekStart, end: weekEnd });

      console.log('Schedule event updated successfully');
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

  // Handler for when schedule event cards are clicked - open scheduling manager
  const handleScheduleEventClick = (event: GoogleCalendarEvent) => {
    if (!selectedClient) return;

    const eventDate = new Date(event.start.dateTime);
    const eventTime = new Date(event.start.dateTime);

    // Find the period for this event's date
    const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
    if (!clientProgram) return;

    // Find period that contains this date
    const period = clientProgram.periods.find(p => {
      const periodStart = safeToDate(p.startDate);
      const periodEnd = safeToDate(p.endDate);
      return eventDate >= periodStart && eventDate <= periodEnd;
    });

    if (period) {
      setSelectedPeriod(period);
      setSelectedTimeSlot(eventTime);
      setWeekScheduleManagerOpen(true);
    } else {
      // If no period found, open event edit dialog instead
      setSelectedEventForEdit(event);
      setScheduleEventEditDialogOpen(true);
    }
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
        console.log('Removing event from', fromDate.toDateString());
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
            console.log('Creating Quick Workouts program template...');
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

  // Quick Workout Builder functions
  const checkForConflict = async (date: Date): Promise<any | null> => {
    if (!selectedClient) return null;
    
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const workouts = await fetchWorkoutsByDateRange(
      selectedClient,
      Timestamp.fromDate(startOfDay),
      Timestamp.fromDate(endOfDay)
    );
    
    const workoutForDate = workouts.find(w => {
      const workoutDate = safeToDate(w.date);
      return workoutDate.getDate() === date.getDate() &&
             workoutDate.getMonth() === date.getMonth() &&
             workoutDate.getFullYear() === date.getFullYear();
    });
    
    return workoutForDate || null;
  };

  const createQuickWorkout = async (workoutData: any) => {
    const createdWorkout = await createClientWorkout(workoutData);
    
    // Create calendar event for the workout if it has a time
    if (workoutData.time && workoutData.time.trim() !== '') {
      try {
        const client = clients.find(c => c.id === workoutData.clientId);
        const clientName = client?.name || 'Unknown Client';
        const date = workoutData.date instanceof Timestamp 
          ? workoutData.date.toDate() 
          : new Date(workoutData.date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const timeStr = workoutData.time;
        
        // Calculate end time (default 1 hour)
        const endTime = new Date(date);
        const [hours, minutes] = timeStr.split(':').map(Number);
        endTime.setHours(hours, minutes || 0, 0, 0);
        endTime.setHours(endTime.getHours() + 1);
        
        const event = await createTestEvent({
          summary: workoutData.title || `${workoutData.categoryName || 'Workout'} with ${clientName}`,
          date: dateStr,
          startTime: timeStr,
          endTime: format(endTime, 'HH:mm'),
          description: `Workout Category: ${workoutData.categoryName || 'Workout'}\n[Metadata: client=${workoutData.clientId}, category=${workoutData.categoryName || 'Workout'}, workoutId=${createdWorkout.id}, periodId=${workoutData.periodId || 'none'}]`,
        });

        // Link event to workout
        await linkToWorkout(event.id, createdWorkout.id);
        
        console.log('✅ Created calendar event for workout:', createdWorkout.id, event.id);
      } catch (error) {
        console.error('❌ Error creating calendar event for workout:', error);
        // Don't fail the workout creation if event creation fails
      }
    }
    
    // Reset form
    setWorkoutTitle('');
    setWorkoutTime('');
    setSelectedCategory('');
    setSelectedTemplate('');
    setWorkoutDate(format(new Date(), 'yyyy-MM-dd'));
    
    // Refresh calendar
    setCalendarKey(prev => prev + 1);
    
    // Refresh events
    const startDate = new Date(calendarDate);
    startDate.setDate(calendarDate.getDate() - calendarDate.getDay());
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    await fetchEvents({ start: startDate, end: endDate });
  };

  const handleQuickWorkoutSave = async () => {
    if (!selectedClient || !workoutTitle) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSavingWorkout(true);
    try {
      // Parse date string as local date to avoid timezone issues
      // workoutDate is in format 'YYYY-MM-DD', parse it as local date
      const [year, month, day] = workoutDate.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      const period = findPeriodForDate(date, selectedClient);
      const category = workoutCategories.find(cat => cat.name === selectedCategory);
      
      // Use selected template if provided, otherwise use category's linked template
      const linkedTemplateId = category?.linkedWorkoutStructureTemplateId;
      const templateIdToUse = selectedTemplate || linkedTemplateId;
      const appliedTemplateId = templateIdToUse && workoutStructureTemplates.find(t => t.id === templateIdToUse) 
        ? templateIdToUse 
        : undefined;

      const workoutData = {
        clientId: selectedClient,
        periodId: period?.id || null,
        date: Timestamp.fromDate(date),
        title: workoutTitle,
        notes: '',
        time: workoutTime || '',
        categoryName: selectedCategory || '',
        appliedTemplateId,
        rounds: [],
        warmups: []
      };
      
      const existing = await checkForConflict(date);
      if (existing) {
        setExistingWorkout(existing);
        setPendingWorkoutData(workoutData);
        setConflictDialogOpen(true);
        setIsSavingWorkout(false);
        return;
      }
      
      await createQuickWorkout(workoutData);
    } catch (error) {
      console.error('Error creating workout:', error);
      alert('Failed to create workout. Please try again.');
    } finally {
      setIsSavingWorkout(false);
    }
  };

  const handleConflictResolution = async (action: 'keep' | 'replace' | 'move' | 'cancel') => {
    if (action === 'cancel') {
      setConflictDialogOpen(false);
      setExistingWorkout(null);
      setPendingWorkoutData(null);
      setMoveToDate('');
      return;
    }

    if (!pendingWorkoutData) return;
    
    setIsSavingWorkout(true);
    setConflictDialogOpen(false);
    
    try {
      if (action === 'keep') {
        // Parse date string as local date to avoid timezone issues
        const [year, month, day] = workoutDate.split('-').map(Number);
        const dateForParam = new Date(year, month - 1, day);
        const dateParam = format(dateForParam, 'yyyy-MM-dd');
        router.push(`/workouts/builder?client=${selectedClient}&date=${dateParam}&workoutId=${existingWorkout.id}`);
      } else if (action === 'replace') {
        if (existingWorkout.id) {
          // Delete existing workout's calendar event if it exists
          const existingEvent = calendarEvents.find(e => e.linkedWorkoutId === existingWorkout.id);
          if (existingEvent) {
            try {
              await deleteEvent(existingEvent.id);
            } catch (error) {
              console.error('Error deleting existing event:', error);
            }
          }
          await deleteClientWorkout(existingWorkout.id);
        }
        await createQuickWorkout(pendingWorkoutData);
      } else if (action === 'move') {
        if (!moveToDate) {
          alert('Please select a date to move the existing workout to');
          setIsSavingWorkout(false);
          setConflictDialogOpen(true);
          return;
        }
        const newDate = new Date(moveToDate);
        const period = findPeriodForDate(newDate, selectedClient);
        await updateClientWorkout(existingWorkout.id, {
          date: Timestamp.fromDate(newDate),
          periodId: period?.id || null
        });
        // Update calendar event date if it exists
        const existingEvent = calendarEvents.find(e => e.linkedWorkoutId === existingWorkout.id);
        if (existingEvent && existingWorkout.time) {
          try {
            const dateStr = format(newDate, 'yyyy-MM-dd');
            const timeStr = existingWorkout.time;
            const endTime = new Date(newDate);
            const [hours, minutes] = timeStr.split(':').map(Number);
            endTime.setHours(hours, minutes || 0, 0, 0);
            endTime.setHours(endTime.getHours() + 1);
            
            await updateEvent(existingEvent.id, {
              start: {
                dateTime: `${dateStr}T${timeStr}:00`,
                timeZone: 'America/Los_Angeles',
              },
              end: {
                dateTime: `${dateStr}T${format(endTime, 'HH:mm')}:00`,
                timeZone: 'America/Los_Angeles',
              },
            });
          } catch (error) {
            console.error('Error updating event date:', error);
          }
        }
        await createQuickWorkout(pendingWorkoutData);
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      alert('Failed to resolve conflict. Please try again.');
    } finally {
      setIsSavingWorkout(false);
      setExistingWorkout(null);
      setPendingWorkoutData(null);
      setMoveToDate('');
    }
  };

  return (
    <div className="w-full px-1 py-4 space-y-2">
      {/* Filters and Controls */}
      <Card className="py-2">
        <CardContent className="py-1 px-2">
          {/* Navigation */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left aligned - Client Selector */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Client:</label>
              </div>
              <Select value={selectedClient || 'all'} onValueChange={handleClientChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedClient && (
                <>
                  <PeriodAssignmentDialog
                    clientId={selectedClient}
                    clientName={selectedClientData?.name || 'Unknown Client'}
                    periods={periods || []}
                    workoutCategories={workoutCategories || []}
                    weekTemplates={weekTemplates || []}
                    onAssignPeriod={handleAssignPeriod}
                    existingAssignments={clientPrograms.find(cp => cp.clientId === selectedClient)?.periods || []}
                  />
                  <AssignProgramTemplateDialog
                    programs={programs || []}
                    clients={clients || []}
                    onAssignProgram={handleAssignProgramTemplate}
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
                    <Calendar className="h-4 w-4" />
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
                  <ChevronLeft className="h-3 w-3 md:h-4 md:w-4" />
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
                  <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Quick Workout Builder - Inline with filters */}
          {selectedClient && (
            <div className="border-t mt-3 pt-3">
              <div className="flex items-center gap-2 mb-2">
                <Dumbbell className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Quick Workout Builder:</label>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[120px]">
                  <Label htmlFor="quick-workout-date" className="text-xs">Date *</Label>
                  <Input
                    id="quick-workout-date"
                    type="date"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[100px]">
                  <Label htmlFor="quick-workout-time" className="text-xs">Time</Label>
                  <Input
                    id="quick-workout-time"
                    type="time"
                    value={workoutTime}
                    onChange={(e) => setWorkoutTime(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[150px]">
                  <Label htmlFor="quick-workout-title" className="text-xs">Title *</Label>
                  <Input
                    id="quick-workout-title"
                    placeholder="e.g., Upper Body"
                    value={workoutTitle}
                    onChange={(e) => setWorkoutTitle(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="quick-workout-category" className="text-xs">Category</Label>
                  <select
                    id="quick-workout-category"
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      // Auto-select linked template when category changes
                      const category = workoutCategories.find(cat => cat.name === e.target.value);
                      setSelectedTemplate(category?.linkedWorkoutStructureTemplateId || '');
                    }}
                    className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">No category</option>
                    {workoutCategories.map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
                {selectedCategory && (
                  <div className="flex-1 min-w-[160px]">
                    <Label htmlFor="quick-workout-template" className="text-xs">Template</Label>
                    <select
                      id="quick-workout-template"
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full h-8 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">No template</option>
                      {workoutStructureTemplates.map((template) => {
                        const category = workoutCategories.find(cat => cat.name === selectedCategory);
                        const isLinked = category?.linkedWorkoutStructureTemplateId === template.id;
                        return (
                          <option key={template.id} value={template.id}>
                            {template.name}{isLinked ? ' (default)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                )}
                <Button 
                  onClick={handleQuickWorkoutSave} 
                  disabled={isSavingWorkout || !workoutTitle}
                  size="sm"
                  className="h-8"
                >
                  <Save className="h-3 w-3 mr-1.5" />
                  {isSavingWorkout ? 'Creating...' : 'Create'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar View and Current Day Schedule Sidebar */}
      {!loading && !clientProgramsLoading && (
        <div className="flex gap-1 mt-1">
          {/* Week View - Scrollable, constrained to leave space for sidebar */}
          <div className="flex-1 min-w-0 overflow-x-auto" style={{ maxWidth: 'calc(100% - 272px)' }}>
            {selectedClient ? (
              <ModernCalendarView
                key={`calendar-${calendarKey}`}
                viewMode="week"
                calendarDate={calendarDate}
                scheduledWorkouts={scheduledWorkouts}
                selectedClient={selectedClient}
                programs={programs}
                clients={clients}
                clientPrograms={clientPrograms}
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
              />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center text-muted-foreground">
                    Select a client to view their schedule
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Current Day Schedule - Side view - Always visible, fixed width */}
          <div className="w-64 flex-shrink-0 sticky top-2 self-start">
            <DayEventList
              selectedDate={selectedDate}
              events={calendarEvents}
              clients={clients}
              selectedClientId={selectedClient}
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
      )}

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

      {/* Loading State */}
      {(loading || clientProgramsLoading) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading programs...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Period Management Panel */}
      <PeriodManagementPanel
        isOpen={periodPanelOpen}
        onClose={handleClosePeriodPanel}
        selectedPeriod={selectedPeriod}
        clientName={selectedClientData?.name || 'Unknown Client'}
        onUpdatePeriod={handleUpdatePeriod}
        onDeletePeriod={handleDeletePeriod}
        onApplyWeekTemplate={handleApplyWeekTemplate}
        weekTemplates={weekTemplates}
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
          fetchEvents({ start: weekStart, end: weekEnd });
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
            // Only calculate periods when dialog is open or when we have a selected client
            // This prevents unnecessary calculations on every render
            if (!selectedClient || !periodListDialogOpen) return [];
            
            const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
            const statePeriods = clientProgram?.periods || [];

            // Use dialogPeriods if it has data, otherwise use state
            const periodsToUse = dialogPeriods.length > 0 ? dialogPeriods : statePeriods;

            return periodsToUse;
          }, [selectedClient, clientPrograms, dialogPeriods, periodListDialogOpen])}
          clientName={selectedClientData?.name || 'Unknown Client'}
          onDeletePeriod={handleDeletePeriod}
          onClearAll={handleClearAllPeriods}
          onClearAllCalendarEvents={handleClearAllCalendarEvents}
          onForceClearLocalEvents={handleForceClearLocalEvents}
          calendarEventsCount={React.useMemo(() => {
            if (!selectedClient) return 0;
            return calendarEvents.filter(event => {
              const hasMatchingClient = event.description?.includes(`client=${selectedClient}`) ||
                event.description?.includes(`client=${selectedClient},`) ||
                event.preConfiguredClient === selectedClient;

              if (hasMatchingClient) return true;

              const clientName = selectedClientData?.name;
              if (clientName && event.summary && event.summary.includes(clientName)) {
                return true;
              }

              return false;
            }).length;
          }, [selectedClient, calendarEvents, selectedClientData?.name])}
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

      {/* Conflict Resolution Dialog */}
      <Dialog open={conflictDialogOpen} onOpenChange={setConflictDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Workout Already Exists</DialogTitle>
            <DialogDescription>
              There's already a workout scheduled for {existingWorkout?.date ? format(safeToDate(existingWorkout.date), 'EEEE, MMMM d, yyyy') : (() => {
                const [year, month, day] = workoutDate.split('-').map(Number);
                return format(new Date(year, month - 1, day), 'EEEE, MMMM d, yyyy');
              })()}.
              <br />
              <strong>Existing:</strong> {existingWorkout?.title || existingWorkout?.categoryName || 'Untitled Workout'}
              <br />
              <strong>New:</strong> {workoutTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>What would you like to do?</Label>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleConflictResolution('keep')}
                  disabled={isSavingWorkout}
                >
                  Keep existing workout
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleConflictResolution('replace')}
                  disabled={isSavingWorkout}
                >
                  Replace with new workout
                </Button>
                <div className="space-y-2">
                  <Label htmlFor="move-to-date">Move existing workout to:</Label>
                  <div className="flex gap-2">
                    <Input
                      id="move-to-date"
                      type="date"
                      value={moveToDate}
                      onChange={(e) => setMoveToDate(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleConflictResolution('move')}
                      disabled={isSavingWorkout || !moveToDate}
                    >
                      Move
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleConflictResolution('cancel')}
              disabled={isSavingWorkout}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
