"use client";

import React, { useState, useEffect, useCallback, useTransition } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  ChevronLeft,
  ChevronRight,
  Users,
  Layers,
  Grid3X3,
  List,
  Calendar as CalendarIcon,
  Wrench,
  Settings,
  Plus
} from 'lucide-react';
import { Client, Program, ScheduledWorkout, ClientProgramPeriod, WorkoutStructureTemplate, ClientWorkoutRound, ClientWorkout } from '@/lib/types';
import { ModernCalendarView } from '@/components/programs/ModernCalendarView';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { AssignProgramTemplateDialog } from '@/components/programs/AssignProgramTemplateDialog';
import { WorkoutEditor } from '@/components/workouts/WorkoutEditor';
import { ColumnVisibilityToggle } from '@/components/workouts/ColumnVisibilityToggle';
import { CategoryFilter } from '@/components/workouts/CategoryFilter';
import { Timestamp } from 'firebase/firestore';
import { createClientWorkout, updateClientWorkout, deleteClientWorkout, getClientWorkout, fetchWorkoutsByDateRange } from '@/lib/firebase/services/clientWorkouts';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { WorkoutType } from '@/lib/firebase/services/workoutTypes';

export default function BuilderPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Calendar store for linking events to workouts
  const { linkToWorkout, events: calendarEvents } = useCalendarStore();

  // Configuration store - shared periods, templates, categories
  const { 
    periods, 
    weekTemplates, 
    workoutCategories, 
    workoutStructureTemplates, 
    workoutTypes,
    fetchAll: fetchAllConfig 
  } = useConfigurationStore();

  // Client and Program stores - use cached data
  const { clients: storeClients, fetchClients } = useClientStore();
  const { programs: storePrograms, scheduledWorkouts: storeScheduledWorkouts, fetchPrograms, fetchAllScheduledWorkouts } = useProgramStore();

  // Get URL params once (used for initial load and deep links)
  const urlClientId = searchParams.get('client');
  const dateParam = searchParams.get('date');
  const workoutId = searchParams.get('workoutId');
  const eventId = searchParams.get('eventId');
  const structureId = searchParams.get('structure');

  // Client selection state - initialized from URL or localStorage
  // This is the PRIMARY source of truth for client selection (not the URL)
  const [clientId, setClientId] = useState<string | null>(() => {
    // First check URL, then localStorage
    if (urlClientId) return urlClientId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedClient');
    }
    return null;
  });
  
  // Use transition to make client switches non-blocking (keeps UI responsive)
  const [isPending, startTransition] = useTransition();

  // Client programs hook - uses local client state (not URL) to avoid reloads
  const {
    clientPrograms,
    isLoading: clientProgramsLoading,
    assignPeriod: hookAssignPeriod,
    assignProgramTemplate: hookAssignProgramTemplate,
    fetchClientPrograms
  } = useClientPrograms(clientId);

  // Simple local state - only day view is supported now
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('day');
  const [calendarDate, setCalendarDate] = useState(new Date());
  
  // Use store data directly - no need for local state
  const clients = storeClients;
  const programs = storePrograms;
  const scheduledWorkouts = storeScheduledWorkouts;
  
  const [loading, setLoading] = useState(false); // Start with false since we use cached data

  // Workout building state
  const [selectedPeriod, setSelectedPeriod] = useState<ClientProgramPeriod | null>(null);
  const [weeks, setWeeks] = useState<Date[][]>([]);
  const [workouts, setWorkouts] = useState<any[]>([]);
  // Support multiple open days
  const [editingWorkouts, setEditingWorkouts] = useState<Record<string, any>>({});
  const [creatingWorkouts, setCreatingWorkouts] = useState<Record<string, {
    date: Date;
    category: string;
    color: string;
    appliedTemplateId?: string;
  }>>({});
  const [openDates, setOpenDates] = useState<Set<string>>(new Set());

  // Track if we should auto-open workout editor when navigating to day view
  const [autoOpenWorkout, setAutoOpenWorkout] = useState<{ date: Date, workout?: any, categoryInfo?: { category: string, color: string } } | null>(null);

  // Week settings
  const [weekSettings, setWeekSettings] = useState({
    showWeekNumbers: true,
    highlightToday: true,
    showWeekends: false,
    weekOrder: 'ascending' as 'ascending' | 'descending'
  });
  const [additionalWeeks, setAdditionalWeeks] = useState(0);

  // Column visibility settings (applies to all workouts in view)
  const [visibleColumns, setVisibleColumns] = useState<{
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  }>({});

  // Category filter for multi-day editing
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const handleColumnVisibilityChange = (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => {
    setVisibleColumns(prev => ({
      ...prev,
      [column]: visible
    }));
  };

  const [localCalendarDate, setLocalCalendarDate] = useState(() => {
    if (dateParam) {
      // Parse date string (YYYY-MM-DD) and create date in local timezone
      // This avoids timezone issues where '2024-12-03' would be parsed as UTC midnight
      // which could display as the previous day in some timezones
      const [year, month, day] = dateParam.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      date.setHours(0, 0, 0, 0);
      return date;
    }
    return new Date();
  });

  // Sync URL when client changes (for bookmarking/sharing only)
  useEffect(() => {
    if (clientId && typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      if (currentUrl.searchParams.get('client') !== clientId) {
        const newUrl = `/workouts/builder?client=${clientId}`;
        window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
      }
    }
  }, [clientId]);

  // Always reset to current/next week on mount (client-side only)
  // If it's Saturday or Sunday, show next week instead
  useEffect(() => {
    if (!dateParam) {
      const today = new Date();
      const dayOfWeek = today.getDay(); // 0 = Sunday, 6 = Saturday
      
      let targetDate = today;
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // It's weekend - advance to Monday of next week
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 2; // Sunday: +1, Saturday: +2
        targetDate = new Date(today);
        targetDate.setDate(today.getDate() + daysUntilMonday);
        console.log('[Builder] Weekend detected, advancing to next week Monday:', targetDate.toISOString());
      } else {
        console.log('[Builder] Setting calendar to today:', today.toISOString());
      }
      
      setCalendarDate(targetDate);
    }
  }, [dateParam]);

  // Force day view - month and week views are removed
  useEffect(() => {
    if (viewMode !== 'day') {
      setViewMode('day');
    }
  }, [viewMode]);

  // Auto-open disabled for day view - users can manually select multiple workouts to edit and compare
  // This allows for multi-workout editing and comparison functionality

  // Use store data directly - only fetch if stores are empty
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if stores already have data
        const hasClients = storeClients.length > 0;
        const hasPrograms = storePrograms.length > 0;
        const hasScheduledWorkouts = storeScheduledWorkouts.length > 0;

        // Only set loading if we need to fetch
        const needsFetch = !hasClients || !hasPrograms;
        
        if (needsFetch) {
          setLoading(true);
        }

        // Fetch config if needed (it's lightweight and cached)
        await fetchAllConfig();

        // Fetch only if store is empty
        if (!hasClients) {
          await fetchClients();
        }

        if (!hasPrograms) {
          await fetchPrograms();
        }

        if (!hasScheduledWorkouts) {
          await fetchAllScheduledWorkouts();
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchAllConfig, fetchClients, fetchPrograms, fetchAllScheduledWorkouts, storeClients.length, storePrograms.length, storeScheduledWorkouts.length]);

  // Load and open workout when workoutId is provided in URL
  useEffect(() => {
    const loadWorkoutById = async () => {
      console.log('[Builder] loadWorkoutById effect:', { workoutId, loading, clientId });
      
      if (!workoutId || loading) {
        console.log('[Builder] Skipping workout load - no workoutId or still loading');
        return;
      }

      try {
        console.log('[Builder] Fetching workout:', workoutId);
        const workout = await getClientWorkout(workoutId);
        console.log('[Builder] Got workout:', workout);
        
        if (workout) {
          // Set the workout in the workouts array if not already there
          setWorkouts(prev => {
            const exists = prev.find(w => w.id === workout.id);
            return exists ? prev : [...prev, workout];
          });

          // Set the calendar date to the workout's date
          // Normalize to local midnight to ensure correct date display
          const workoutDate = safeToDate(workout.date);
          const normalizedDate = new Date(workoutDate);
          normalizedDate.setHours(0, 0, 0, 0);
          console.log('[Builder] Setting calendar date to:', normalizedDate.toISOString());
          setCalendarDate(normalizedDate);

          // If client not in URL, update URL with workout's client
          if (workout.clientId && !clientId) {
            console.log('[Builder] Updating URL with client from workout:', workout.clientId);
            // Use replace to not add to history since we're just filling in missing info
            router.replace(`/workouts/builder?client=${workout.clientId}&date=${dateParam}&workoutId=${workoutId}`, { scroll: false });
          }

          // Switch to day view and auto-open the workout
          console.log('[Builder] Setting autoOpenWorkout');
          setViewMode('day');
          setAutoOpenWorkout({
            date: normalizedDate,
            workout: workout
          });
        }
      } catch (error) {
        console.error('Error loading workout:', error);
      }
    };

    loadWorkoutById();
  }, [workoutId, loading, clientId]);

  // Helper function to create date key for tracking open days
  const getDateKey = (date: Date): string => {
    // Use local date to avoid timezone issues
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper to add opacity to hex color
  const addOpacityToColor = (color: string, opacity: number): string => {
    // If color is already in rgba format, extract the rgb part
    if (color.startsWith('rgba')) {
      const rgb = color.match(/rgba?\(([^)]+)\)/)?.[1];
      if (rgb) {
        const [r, g, b] = rgb.split(',').map(v => v.trim());
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
      }
    }
    // If color is hex, convert to rgba
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
    // Fallback: try to parse as is
    return color;
  };

  // Helper function to generate initial rounds from template
  const generateInitialRounds = (templateId?: string): ClientWorkoutRound[] => {
    if (!templateId) {
      // Default single round
      return [{
        ordinal: 1,
        sets: 1,
        movementUsages: [{
          ordinal: 1,
          movementId: '',
          categoryId: '',
          note: '',
          targetWorkload: {
            useWeight: false,
            weightMeasure: 'lbs',
            useReps: false,
            useTempo: false,
            useTime: false,
            useDistance: false,
            distanceMeasure: 'mi',
            usePace: false,
            paceMeasure: 'mi',
            usePercentage: false,
            useRPE: false,
            unilateral: false,
          }
        }]
      }];
    }

    const template = workoutStructureTemplates.find(t => t.id === templateId);
    if (!template) {
      return generateInitialRounds(); // Fallback to default
    }

    // Create rounds from template sections
    return template.sections
      .sort((a, b) => a.order - b.order)
      .map((section, index) => ({
        ordinal: index + 1,
        sets: 1,
        sectionName: section.workoutTypeName,
        sectionColor: workoutTypes.find(wt => wt.id === section.workoutTypeId)?.color || '#6b7280',
        workoutTypeId: section.workoutTypeId,
        movementUsages: [{
          ordinal: 1,
          movementId: '',
          categoryId: '',
          note: '',
          targetWorkload: {
            useWeight: false,
            weightMeasure: 'lbs',
            useReps: false,
            useTempo: false,
            useTime: false,
            useDistance: false,
            distanceMeasure: 'mi',
            usePace: false,
            paceMeasure: 'mi',
            usePercentage: false,
            useRPE: false,
            unilateral: false,
          }
        }]
      }));
  };

  // Helper function to safely convert various date formats to Date object
  const safeToDate = (dateValue: unknown): Date => {
    if (dateValue instanceof Date) {
      return dateValue;
    }
    if (dateValue && typeof dateValue === 'object') {
      if ('toDate' in dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
      }
      if ('seconds' in dateValue && typeof dateValue.seconds === 'number') {
        return new Date(dateValue.seconds * 1000);
      }
    }
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    return new Date();
  };

  // Calculate weeks from start to end date (limited to 12 weeks max)
  function calculateWeeks(startDate: Date, endDate: Date, periodName?: string): Date[][] {
    const weeks: Date[][] = [];
    const current = new Date(startDate);
    current.setHours(12, 0, 0, 0);

    // Go to the start of the week (Monday)
    const dayOfWeek = current.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    current.setDate(current.getDate() + diff);

    // For "Ongoing" periods or very long periods, limit to 12 weeks (3 months) from start
    const maxWeeks = 12;
    let effectiveEndDate: Date;

    if (periodName === 'Ongoing' || endDate.getFullYear() > 2100) {
      // Limit to 12 weeks from start date for ongoing periods
      effectiveEndDate = new Date(current);
      effectiveEndDate.setDate(effectiveEndDate.getDate() + (maxWeeks * 7) - 1);
    } else {
      // For regular periods, use the actual end date but still cap at 12 weeks
      const periodWeeks = Math.ceil((endDate.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000));
      if (periodWeeks > maxWeeks) {
        effectiveEndDate = new Date(current);
        effectiveEndDate.setDate(effectiveEndDate.getDate() + (maxWeeks * 7) - 1);
      } else {
        effectiveEndDate = new Date(endDate);
      }
    }

    // Calculate the extended end date including additional weeks
    const extendedEndDate = new Date(effectiveEndDate);
    extendedEndDate.setDate(extendedEndDate.getDate() + (additionalWeeks * 7));

    // Limit total weeks to maxWeeks
    let weekCount = 0;
    while (current <= extendedEndDate && weekCount < maxWeeks) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
      weekCount++;
    }

    return weeks;
  }

  function getWorkoutForDate(date: Date): any | null {
    // Return first workout for this date (for backward compatibility)
    return getWorkoutsForDate(date)[0] || null;
  }

  function getWorkoutsForDate(date: Date): any[] {
    // Return all workouts for this date for the selected client
    if (!clientId) return [];
    
    const allWorkouts = workouts.filter(w => {
      const workoutDate = safeToDate(w.date);
      const dateMatches = (
        workoutDate.getFullYear() === date.getFullYear() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getDate() === date.getDate()
      );
      return dateMatches && w.clientId === clientId;
    });
    
    return allWorkouts;
  }

  // Check if date is in period range
  function isDateInPeriod(date: Date): boolean {
    if (!selectedPeriod) return false;
    const start = safeToDate(selectedPeriod.startDate);
    const end = safeToDate(selectedPeriod.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  }

  // Get category info for a specific date
  function getCategoryForDate(date: Date): { category: string; color: string } | null {
    if (!selectedPeriod || !isDateInPeriod(date)) return null;

    const day = selectedPeriod.days?.find(d => {
      const dayDate = safeToDate(d.date);
      return dayDate.toDateString() === date.toDateString();
    });

    if (day) {
      return {
        category: day.workoutCategory,
        color: day.workoutCategoryColor
      };
    }

    return null;
  }

  // Auto-detect period and set up week view when client and date are provided
  // Auto-detect period and set up week view when client and date are provided
  useEffect(() => {
    if (clientId && dateParam && clientPrograms.length > 0) {
      console.log('Auto-detecting period for client:', clientId, 'date:', dateParam);
      console.log('Available client programs:', clientPrograms);

      const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
      console.log('Found client program:', clientProgram);

      if (clientProgram) {
        const targetDate = new Date(dateParam);
        console.log('Target date:', targetDate);

        const period = clientProgram.periods.find(p => {
          const start = safeToDate(p.startDate);
          const end = safeToDate(p.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          console.log('Checking period:', p.id, 'start:', start, 'end:', end);
          return targetDate >= start && targetDate <= end;
        });

        console.log('Found period:', period);

        if (period) {
          setSelectedPeriod(period);
          const start = safeToDate(period.startDate);
          const end = safeToDate(period.endDate);
          const calculatedWeeks = calculateWeeks(start, end, period.periodName);
          setWeeks(calculatedWeeks);
          setViewMode('week');
          console.log('Set period and switched to week view');

          // Load workouts for this period (we'll load them separately)
          // const periodWorkouts = workouts.filter(w => {
          //   const workoutDate = safeToDate(w.date);
          //   return workoutDate >= start && workoutDate <= end;
          // });
          // setWorkouts(periodWorkouts);
        } else {
          console.log('No period found for the target date');
        }
      } else {
        console.log('No client program found for client:', clientId);
      }
    }
  }, [clientId, dateParam, clientPrograms]);


  // Recalculate weeks when additionalWeeks changes and fetch workouts
  useEffect(() => {
    let start: Date;
    let end: Date;

    if (selectedPeriod) {
      start = safeToDate(selectedPeriod.startDate);
      end = safeToDate(selectedPeriod.endDate);
      const calculatedWeeks = calculateWeeks(start, end, selectedPeriod.periodName);
      setWeeks(calculatedWeeks);
    } else {
      // No period - show next 12 weeks from calendarDate (or today)
      const startDate = calendarDate || new Date();
      start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      end = new Date(startDate);
      end.setDate(startDate.getDate() + (12 * 7));
      end.setHours(23, 59, 59, 999);
      const calculatedWeeks = calculateWeeks(start, end);
      setWeeks(calculatedWeeks);
    }

    // Fetch workouts for the date range (only if client is selected)
    const fetchWorkouts = async () => {
      if (!clientId) {
        // No client selected - clear workouts
        setWorkouts([]);
        return;
      }
      
      try {
        const fetchedWorkouts = await fetchWorkoutsByDateRange(
          clientId,
          Timestamp.fromDate(start),
          Timestamp.fromDate(end)
        );
        setWorkouts(fetchedWorkouts);
      } catch (error) {
        console.error('Error fetching workouts:', error);
      }
    };

    fetchWorkouts();
  }, [additionalWeeks, selectedPeriod, clientId, calendarDate]);

  const handleClientChange = (newClientId: string) => {
    console.log('Client changed to:', newClientId);
    
    // Save to localStorage immediately
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedClient', newClientId);
      
      // Update URL without triggering Next.js navigation (just for bookmarking/sharing)
      const newUrl = `/workouts/builder?client=${newClientId}`;
      window.history.replaceState({ ...window.history.state, as: newUrl, url: newUrl }, '', newUrl);
    }
    
    // Use startTransition to make this a non-blocking update
    // This keeps the current UI visible while the new client data loads
    startTransition(() => {
      setClientId(newClientId);
    });
  };

  // Auto-detect and set selectedPeriod when client changes or clientPrograms loads
  useEffect(() => {
    console.log('[Builder] Period detection effect running:', {
      clientId,
      clientProgramsLength: clientPrograms.length,
      clientProgramsClientIds: clientPrograms.map(cp => cp.clientId),
      clientProgramsLoading
    });

    // Wait for loading to complete
    if (clientProgramsLoading) {
      console.log('[Builder] Still loading client programs, waiting...');
      return;
    }

    if (!clientId) {
      console.log('[Builder] No client selected, clearing period');
      setSelectedPeriod(null);
      return;
    }

    // Find the client program for this client
    const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
    console.log('[Builder] Found client program:', clientProgram ? {
      id: clientProgram.id,
      clientId: clientProgram.clientId,
      periodsCount: clientProgram.periods.length,
      periods: clientProgram.periods.map(p => ({ id: p.id, name: p.periodName, start: safeToDate(p.startDate).toISOString(), end: safeToDate(p.endDate).toISOString() }))
    } : null);

    if (!clientProgram || clientProgram.periods.length === 0) {
      console.log('[Builder] No client program or no periods, clearing period');
      setSelectedPeriod(null);
      return;
    }

    // Find the period that contains today's date
    const today = new Date();
    today.setHours(12, 0, 0, 0); // Normalize to midday to avoid timezone edge cases
    console.log('[Builder] Looking for period containing today:', today.toISOString());

    const currentPeriod = clientProgram.periods.find(p => {
      const start = safeToDate(p.startDate);
      const end = safeToDate(p.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const contains = today >= start && today <= end;
      console.log('[Builder] Checking period:', p.periodName, 'start:', start.toISOString(), 'end:', end.toISOString(), 'contains today:', contains);
      return contains;
    });

    if (currentPeriod) {
      console.log('[Builder] Auto-detected current period:', currentPeriod.periodName);
      setSelectedPeriod(currentPeriod);
    } else {
      // No period contains today - use the most recent or upcoming period
      const sortedPeriods = [...clientProgram.periods].sort((a, b) => {
        const aStart = safeToDate(a.startDate).getTime();
        const bStart = safeToDate(b.startDate).getTime();
        return aStart - bStart;
      });

      // Find the first period that starts after today, or use the last period
      const upcomingPeriod = sortedPeriods.find(p => safeToDate(p.startDate) > today);
      const fallbackPeriod = upcomingPeriod || sortedPeriods[sortedPeriods.length - 1];

      if (fallbackPeriod) {
        console.log('[Builder] Using fallback period:', fallbackPeriod.periodName);
        setSelectedPeriod(fallbackPeriod);
      } else {
        console.log('[Builder] No fallback period found');
        setSelectedPeriod(null);
      }
    }
  }, [clientId, clientPrograms, clientProgramsLoading]);

  const handleViewModeChange = (mode: 'month' | 'week' | 'day') => {
    setViewMode(mode);

    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('builder_viewMode', mode);
    }

    // When switching to week or day view, set up the workout builder interface
    if ((mode === 'week' || mode === 'day') && clientId && !dateParam) {
      // If no specific date is provided, use today's date
      const today = new Date();
      setLocalCalendarDate(today);

      // Find the period that contains today's date
      const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
      if (clientProgram) {
        const period = clientProgram.periods.find(p => {
          const start = safeToDate(p.startDate);
          const end = safeToDate(p.endDate);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          return today >= start && today <= end;
        });

        if (period) {
          setSelectedPeriod(period);
          const start = safeToDate(period.startDate);
          const end = safeToDate(period.endDate);
          const calculatedWeeks = calculateWeeks(start, end, period.periodName);
          setWeeks(calculatedWeeks);
        } else {
          // No period found - show next 12 weeks from today
          const today = new Date();
          const twelveWeeksLater = new Date(today);
          twelveWeeksLater.setDate(twelveWeeksLater.getDate() + (12 * 7));
          const calculatedWeeks = calculateWeeks(today, twelveWeeksLater);
          setWeeks(calculatedWeeks);
        }
      }
    }
  };



  const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
    const newDate = new Date(calendarDate);

    switch (direction) {
      case 'prev':
        // Only day view is supported - navigate by week (since we show workouts for the week)
        newDate.setDate(newDate.getDate() - 7);
        break;
      case 'next':
        // Only day view is supported - navigate by week (since we show workouts for the week)
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'today':
        return setCalendarDate(new Date());
    }

    setCalendarDate(newDate);
  };

  // Handler for assigning periods - uses shared hook for consistent behavior with schedule tab
  const handleAssignPeriod = useCallback(async (assignment: {
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
      await hookAssignPeriod(assignment);
      console.log('Period assigned successfully via shared hook');
    } catch (error) {
      console.error('Error assigning period:', error);
    }
  }, [hookAssignPeriod]);

  // Handler for assigning program templates - uses shared hook for consistent behavior
  const handleAssignProgramTemplate = useCallback(async (assignment: {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
  }) => {
    try {
      await hookAssignProgramTemplate(assignment);
      console.log('Program template assigned successfully via shared hook');
    } catch (error) {
      console.error('Error assigning program template:', error);
    }
  }, [hookAssignProgramTemplate]);

  // Workout management functions
  const handleCreateWorkout = (date: Date, category: string, color: string, structureId?: string) => {
    const dateKey = getDateKey(date);

    // Toggle: if already open, close it; otherwise open it
    if (openDates.has(dateKey)) {
      setOpenDates(prev => {
        const newSet = new Set(prev);
        newSet.delete(dateKey);
        return newSet;
      });
      setCreatingWorkouts(prev => {
        const newState = { ...prev };
        delete newState[dateKey];
        return newState;
      });
    } else {
      let appliedTemplateId: string | undefined;

      // Use provided structureId if available, otherwise find linked template for this category
      if (structureId) {
        appliedTemplateId = structureId;
      } else {
        const workoutCategory = workoutCategories.find(wc => wc.name === category);
        const linkedTemplateId = workoutCategory?.linkedWorkoutStructureTemplateId;

        if (linkedTemplateId) {
          const template = workoutStructureTemplates.find(t => t.id === linkedTemplateId);
          if (template) {
            appliedTemplateId = template.id;
          }
        }
      }

      setCreatingWorkouts(prev => ({
        ...prev,
        [dateKey]: { date, category, color, appliedTemplateId }
      }));
      setOpenDates(prev => new Set([...prev, dateKey]));
    }
  };

  // Helper to get eventId for a workout
  const getEventIdForWorkout = (workout: ClientWorkout | null, dateKey: string): string | undefined => {
    // For new workouts, use eventId from URL if available
    if (!workout && eventId) {
      return eventId;
    }

    // For existing workouts, find the linked event
    if (workout?.id) {
      const linkedEvent = calendarEvents.find(e => e.linkedWorkoutId === workout.id);
      if (linkedEvent) {
        return linkedEvent.id;
      }
    }

    // Check if this date has an event (for new workouts from calendar)
    const createData = creatingWorkouts[dateKey];
    if (createData && eventId) {
      return eventId;
    }

    return undefined;

    // If no workout but we have a date, try to find an event for this date and client
    if (!workout && clientId) {
      const [year, month, day] = dateKey.split("-").map(Number);
      const targetDate = new Date(year, month - 1, day);

      const eventForDate = calendarEvents.find(e => {
        if (!e.start.dateTime) return false;
        const eventDate = new Date(e.start.dateTime);
        return (
          eventDate.getFullYear() === targetDate.getFullYear() &&
          eventDate.getMonth() === targetDate.getMonth() &&
          eventDate.getDate() === targetDate.getDate()
        );
      });

      if (eventForDate) {
        return eventForDate.id;
      }
    }
  };

  const handleEditWorkout = (workout: any) => {

    const date = safeToDate(workout.date);
    const dateKey = getDateKey(date);

    // Toggle: if already open, close it; otherwise open it
    if (openDates.has(dateKey)) {
      setOpenDates(prev => {
        const newSet = new Set(prev);
        newSet.delete(dateKey);
        return newSet;
      });
      setEditingWorkouts(prev => {
        const newState = { ...prev };
        delete newState[dateKey];
        return newState;
      });
    } else {
      setEditingWorkouts(prev => ({
        ...prev,
        [dateKey]: workout
      }));
      setOpenDates(prev => new Set([...prev, dateKey]));
    }
  };

  // Auto-open workout editor when navigating to day view from week view
  useEffect(() => {
    console.log('[Builder] Auto-open effect:', { viewMode, autoOpenWorkout, hasAutoOpen: !!autoOpenWorkout });
    
    if (viewMode === 'day' && autoOpenWorkout) {
      const { date, workout, categoryInfo } = autoOpenWorkout;
      const dateKey = getDateKey(date);
      console.log('[Builder] Processing auto-open for dateKey:', dateKey, 'workout:', workout?.id);

      // Don't auto-open if editor is already open or was just closed
      if (openDates.has(dateKey)) {
        console.log('[Builder] Editor already open for this date, skipping');
        setAutoOpenWorkout(null);
        return;
      }

      // Small delay to ensure the view has rendered
      const timer = setTimeout(() => {
        console.log('[Builder] Timer fired, opening editor');
        // Double-check it's still not open (user might have closed it)
        // Use a function to get the latest state
        setOpenDates(currentOpenDates => {
          if (!currentOpenDates.has(dateKey)) {
            if (workout) {
              console.log('[Builder] Calling handleEditWorkout');
              handleEditWorkout(workout);
            } else if (categoryInfo) {
              console.log('[Builder] Calling handleCreateWorkout');
              handleCreateWorkout(date, categoryInfo.category, categoryInfo.color);
            }
          }
          return currentOpenDates;
        });

        // Clear the auto-open flag
        setAutoOpenWorkout(null);
      }, 150);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, autoOpenWorkout]);

  // Auto-open create workout dialog when eventId is in URL
  useEffect(() => {
    if (eventId && !loading && calendarEvents.length > 0) {
      const event = calendarEvents.find(e => e.id === eventId);
      if (event && !event.linkedWorkoutId) {
        // Event exists and doesn't have a linked workout yet
        const eventDate = new Date(event.start.dateTime);
        const dateKey = getDateKey(eventDate);

        // Get client from event metadata or preConfiguredClient
        const eventClientId = event.preConfiguredClient ||
          (event.description?.match(/\[Metadata:.*client=([^,}]+)/)?.[1]?.trim());

        // Set client if available and not already set
        if (eventClientId && eventClientId !== 'none' && !clientId) {
          handleClientChange(eventClientId);
        }

        // Only proceed if we have a client (either from event or already selected)
        if (clientId || eventClientId) {
          // Check if we already have this date open
          if (!openDates.has(dateKey)) {
            // Get category from event or use default
            const eventCategory = event.preConfiguredCategory;
            const category = workoutCategories.find((c: any) => c.name === eventCategory);
            const categoryName = category?.name || 'General';
            const categoryColor = category?.color || '#6b7280';

            // Get structure template if event has one
            const structureId = event.preConfiguredStructure;

            // Set calendar date and switch to day view
            setCalendarDate(eventDate);
            setViewMode('day');

            // Small delay to ensure view has rendered and client is set
            const timer = setTimeout(() => {
              const finalClientId = clientId || eventClientId;
              if (finalClientId) {
                handleCreateWorkout(eventDate, categoryName, categoryColor, structureId);
              }
            }, 300);

            return () => clearTimeout(timer);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, loading, calendarEvents, clientId, openDates, workoutCategories]);

  const handleSaveWorkout = async (workoutData: any, dateKey: string) => {
    try {
      const createWorkoutData = creatingWorkouts[dateKey];
      const editingWorkout = editingWorkouts[dateKey];

      if (createWorkoutData) {
        // Create new workout
        const newWorkout = {
          ...workoutData,
          date: Timestamp.fromDate(createWorkoutData.date),
          clientId: clientId,
          periodId: selectedPeriod?.id,
          categoryName: createWorkoutData.category,
          appliedTemplateId: createWorkoutData.appliedTemplateId
        };

        const createdWorkout = await createClientWorkout(newWorkout);
        setWorkouts(prev => [...prev, createdWorkout]);

        // Link to calendar event if eventId is provided
        if (eventId && createdWorkout.id) {
          try {
            await linkToWorkout(eventId, createdWorkout.id);
            console.log('Successfully linked workout to calendar event:', eventId);
          } catch (error) {
            console.error('Failed to link workout to calendar event:', error);
          }
        }

        // Remove from creating state
        setCreatingWorkouts(prev => {
          const newState = { ...prev };
          delete newState[dateKey];
          return newState;
        });
      } else if (editingWorkout) {
        // Update existing workout
        const updatedWorkout = {
          ...editingWorkout,
          ...workoutData
        };

        await updateClientWorkout(editingWorkout.id, workoutData);
        setWorkouts(prev => prev.map(w => w.id === editingWorkout.id ? updatedWorkout : w));

        // Remove from editing state
        setEditingWorkouts(prev => {
          const newState = { ...prev };
          delete newState[dateKey];
          return newState;
        });
      }

      // Close this specific date
      setOpenDates(prev => {
        const newSet = new Set(prev);
        newSet.delete(dateKey);
        return newSet;
      });
    } catch (error) {
      console.error('Error saving workout:', error);
    }
  };

  const handleCloseEditor = useCallback((dateKey: string) => {
    // Use React.startTransition to ensure state updates are processed together
    // Always create new objects/sets to ensure React detects the change
    setCreatingWorkouts(prev => {
      if (!prev[dateKey]) return prev;
      const newState = { ...prev };
      delete newState[dateKey];
      return newState;
    });

    setEditingWorkouts(prev => {
      if (!prev[dateKey]) return prev;
      const newState = { ...prev };
      delete newState[dateKey];
      return newState;
    });

    // Close this specific date - always create a new Set
    setOpenDates(prev => {
      if (!prev.has(dateKey)) return prev;
      const newSet = new Set(prev);
      newSet.delete(dateKey);
      return newSet;
    });
  }, []);

  const handleCloseAllEditors = useCallback((dateKeys: string[]) => {
    console.log('=== CLOSE ALL CALLED ===');
    console.log('DateKeys to close:', dateKeys);
    console.log('Current creatingWorkouts:', Object.keys(creatingWorkouts));
    console.log('Current editingWorkouts:', Object.keys(editingWorkouts));
    console.log('Current openDates:', Array.from(openDates));

    // Force update all state - always return new objects/sets
    setCreatingWorkouts(prev => {
      const newState = { ...prev };
      dateKeys.forEach(dateKey => {
        delete newState[dateKey];
      });
      console.log('New creatingWorkouts keys:', Object.keys(newState));
      return newState;
    });

    setEditingWorkouts(prev => {
      const newState = { ...prev };
      dateKeys.forEach(dateKey => {
        delete newState[dateKey];
      });
      console.log('New editingWorkouts keys:', Object.keys(newState));
      return newState;
    });

    setOpenDates(prev => {
      const newSet = new Set(prev);
      dateKeys.forEach(dateKey => {
        newSet.delete(dateKey);
      });
      console.log('New openDates:', Array.from(newSet));
      return newSet;
    });

    console.log('=== STATE UPDATES CALLED ===');
  }, [creatingWorkouts, editingWorkouts, openDates]);

  // Delete handler
  const handleDeleteWorkout = async (workoutId: string | undefined, dateKey: string) => {
    console.log('handleDeleteWorkout called', { workoutId, dateKey });

    if (!workoutId) {
      console.log('No workoutId, just closing editor');
      // If no ID, it's a new workout that hasn't been saved yet, just close editor
      handleCloseEditor(dateKey);
      return;
    }

    try {
      setLoading(true);
      console.log('Calling deleteClientWorkout...');
      await deleteClientWorkout(workoutId);
      console.log('deleteClientWorkout resolved');

      // Remove from local state
      setWorkouts(prev => {
        const activeWorkouts = prev.filter(w => w.id !== workoutId);
        console.log('Updated local workouts state, count:', activeWorkouts.length);
        return activeWorkouts;
      });

      // Close editor
      handleCloseEditor(dateKey);

      // Also refresh scheduled workouts to keep data in sync
      console.log('Refreshing scheduled workouts...');
      const updatedScheduledWorkouts = await getAllScheduledWorkouts();
      setScheduledWorkouts(updatedScheduledWorkouts);

      console.log('Workout deleted successfully and state updated');
    } catch (error) {
      console.error('Error deleting workout:', error);
      alert('Failed to delete workout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getNavigationLabel = () => {
    // Only day view is supported - show week range since we display workouts for the week
    const weekStart = new Date(calendarDate);
    weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                  <select
                    className="w-[200px] px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={clientId || ''}
                    onChange={(e) => handleClientChange(e.target.value)}
                    disabled={loading}
                  >
                    <option value="" disabled>Select a client...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                  <PeriodAssignmentDialog
                    clientId={clientId || ''}
                    clientName={clientId ? (clients.find(c => c.id === clientId)?.name || 'Unknown Client') : ''}
                    periods={periods}
                    workoutCategories={workoutCategories}
                    weekTemplates={weekTemplates}
                    onAssignPeriod={handleAssignPeriod}
                    existingAssignments={clientId ? (clientPrograms.find(cp => cp.clientId === clientId)?.periods || []) : []}
                  />
                  <AssignProgramTemplateDialog
                    programs={programs}
                    clients={clients}
                    onAssignProgram={handleAssignProgramTemplate}
                  />
                </div>

                {/* Right aligned - Week Order */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-2">
                    <label htmlFor="weekOrder" className="text-sm font-medium">Week order:</label>
                    <select
                      id="weekOrder"
                      className="px-2 py-1 border rounded text-sm"
                      value={weekSettings.weekOrder}
                      onChange={(e) => setWeekSettings(prev => ({
                        ...prev,
                        weekOrder: e.target.value as 'ascending' | 'descending'
                      }))}
                    >
                      <option value="ascending">Ascending</option>
                      <option value="descending">Descending</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Workout Building Actions */}
              {!clientId && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Please select a client to start building workouts.
                </div>
              )}

              {/* Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Left side - Column Toggle and Category Filter */}
                <div className="flex items-center gap-2">
                  <ColumnVisibilityToggle
                    visibleColumns={visibleColumns}
                    availableColumns={{
                      tempo: true,
                      distance: true,
                      rpe: true,
                      percentage: true
                    }}
                    onToggle={handleColumnVisibilityChange}
                  />
                  {viewMode === 'day' && workoutCategories.length > 0 && (
                    <CategoryFilter
                      categories={workoutCategories}
                      selectedCategories={selectedCategories}
                      onSelectionChange={setSelectedCategories}
                    />
                  )}
                </div>

                {/* Right side navigation group */}
                <div className="flex items-center gap-3">
                  {/* Navigation */}
                  <div className="flex items-center gap-1 md:gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleNavigate('today')} className="text-xs md:text-sm px-2">
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleNavigate('prev')}
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
                      onClick={() => handleNavigate('next')}
                      className="p-1 md:p-2"
                    >
                      <ChevronRight className="h-3 w-3 md:h-4 md:w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

        {/* Content - Structure always visible, only cell data loads */}
        <>
          {/* Only day view is supported - show workouts for the selected week */}
          {/* Day View - Optimized for 2 workouts side-by-side */}
          <div className="space-y-6">
              {(() => {
                // Always show the schedule structure - never return null
                // Calculate weeks based on period if available, otherwise use calendarDate
                let start: Date;
                let end: Date;

                if (selectedPeriod) {
                  start = safeToDate(selectedPeriod.startDate);
                  end = safeToDate(selectedPeriod.endDate);
                } else {
                  // No period selected - calculate weeks around calendarDate
                  start = new Date(calendarDate);
                  start.setDate(calendarDate.getDate() - calendarDate.getDay()); // Start of week
                  end = new Date(start);
                  end.setDate(start.getDate() + (12 * 7) - 1); // 12 weeks ahead
                }

                const calculatedWeeks = calculateWeeks(start, end, selectedPeriod?.periodName);

                // Find the week that contains calendarDate
                const targetWeek = calculatedWeeks.find(week => {
                  const weekStart = new Date(week[0]);
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(week[6]);
                  weekEnd.setHours(23, 59, 59, 999);
                  const normalizedCalendarDate = new Date(calendarDate);
                  normalizedCalendarDate.setHours(12, 0, 0, 0);
                  return normalizedCalendarDate >= weekStart && normalizedCalendarDate <= weekEnd;
                });

                // If we found a matching week, show only that week; otherwise generate a week for calendarDate
                let weeksToDisplay: Date[][];
                if (targetWeek) {
                  weeksToDisplay = [targetWeek];
                } else {
                  // Generate a week for the calendarDate if it's not in the calculated weeks
                  const weekStart = new Date(calendarDate);
                  const dayOfWeek = weekStart.getDay();
                  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  weekStart.setDate(weekStart.getDate() + diff);
                  weekStart.setHours(12, 0, 0, 0);

                  const generatedWeek: Date[] = [];
                  for (let i = 0; i < 7; i++) {
                    const day = new Date(weekStart);
                    day.setDate(weekStart.getDate() + i);
                    generatedWeek.push(day);
                  }
                  weeksToDisplay = [generatedWeek];
                }

                const orderedWeeks = weekSettings.weekOrder === 'descending'
                  ? [...weeksToDisplay].reverse()
                  : weeksToDisplay;

                return orderedWeeks.map((week, weekIndex) => {
                  // Find the original index in calculatedWeeks to get the correct week number
                  const originalIndex = calculatedWeeks.findIndex(w =>
                    w[0].toDateString() === week[0].toDateString()
                  );
                  // If week not found in calculatedWeeks (generated week), use a placeholder number
                  const displayWeekNumber = originalIndex >= 0
                    ? (weekSettings.weekOrder === 'descending'
                      ? calculatedWeeks.length - originalIndex
                      : originalIndex + 1)
                    : 1; // Default to 1 for generated weeks

                  // Check if this week has any active editors
                  // Convert to arrays to ensure we get fresh data on each render
                  const weekEditingWorkouts = Object.entries(editingWorkouts).filter(([dateKey]) => {
                    return week.some(weekDate => getDateKey(weekDate) === dateKey);
                  });

                  const weekCreatingWorkouts = Object.entries(creatingWorkouts).filter(([dateKey]) => {
                    return week.some(weekDate => getDateKey(weekDate) === dateKey);
                  });

                  // Also check openDates to ensure we have the latest state
                  const weekOpenDates = week.filter(weekDate => {
                    const dateKey = getDateKey(weekDate);
                    return openDates.has(dateKey);
                  });

                  const hasActiveEditors = weekEditingWorkouts.length > 0 || weekCreatingWorkouts.length > 0 || weekOpenDates.length > 0;

                  // Debug log
                  if (weekEditingWorkouts.length > 0 || weekCreatingWorkouts.length > 0) {
                    console.log(`Week ${displayWeekNumber} hasActiveEditors:`, hasActiveEditors, {
                      editing: weekEditingWorkouts.length,
                      creating: weekCreatingWorkouts.length,
                      openDates: weekOpenDates.length
                    });
                  }

                  return (
                    <div
                      key={`week-${weekIndex}-${Object.keys(editingWorkouts).length}-${Object.keys(creatingWorkouts).length}-${openDates.size}`}
                      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                    >
                      {/* Week Header */}
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b border-gray-200 px-4 py-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-gray-800">Week {displayWeekNumber}</h3>
                          <div className="flex items-center gap-3">
                            <div className="text-xs text-gray-500">
                              {week[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week[week.length - 1]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </div>
                            {hasActiveEditors && (
                              <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium">
                                {weekEditingWorkouts.length + weekCreatingWorkouts.length} editing
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Days Grid */}
                      <div className={`grid ${weekSettings.showWeekends ? 'grid-cols-7' : 'grid-cols-5'} divide-x divide-gray-200`}>
                        {/* Day Headers */}
                        {(weekSettings.showWeekends
                          ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
                        ).map((day, index) => (
                          <div key={index} className="bg-gray-50 text-center text-xs font-semibold text-gray-700 py-3 border-b border-gray-200">
                            <div className="hidden sm:block">{day}</div>
                            <div className="sm:hidden">{day.slice(0, 3)}</div>
                          </div>
                        ))}

                        {/* Day Cells */}
                        {week
                          .filter((date) => {
                            if (weekSettings.showWeekends) return true;
                            const dayOfWeek = date.getDay();
                            return dayOfWeek !== 0 && dayOfWeek !== 6;
                          })
                          .map((date, dayIndex) => {
                            const workout = getWorkoutForDate(date);
                            const inPeriod = isDateInPeriod(date);
                            const categoryInfo = getCategoryForDate(date);
                            const dateKey = getDateKey(date);
                            const isEditingThisDate = openDates.has(dateKey);
                            const editingWorkout = editingWorkouts[dateKey];
                            const createWorkoutData = creatingWorkouts[dateKey];
                            const isToday = date.toDateString() === new Date().toDateString();

                            // Filter by selected categories
                            const shouldShow = !categoryInfo || selectedCategories.length === 0 || selectedCategories.includes(categoryInfo.category);

                            if (!shouldShow) {
                              return (
                                <div key={dayIndex} className="min-h-[160px] bg-gray-50 opacity-30">
                                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                                    <div className="text-sm font-semibold text-gray-400">{date.getDate()}</div>
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={dayIndex} className={`min-h-[160px] relative ${isToday ? 'bg-blue-50 border-2 border-blue-300' : (
                                inPeriod ? 'bg-white' : 'bg-gray-50'
                              )
                                } ${isEditingThisDate && !isToday ? 'bg-gray-50' : ''} ${!inPeriod && !isToday ? 'opacity-60' : ''}`}>

                                {/* Date Header */}
                                <div className={`px-3 py-2 border-b border-gray-100 ${isToday ? 'bg-blue-100' : 'bg-gray-50'
                                  }`}>
                                  <div className={`text-sm font-semibold ${isToday ? 'text-blue-700 font-bold' : 'text-gray-700'
                                    }`}>
                                    {date.getDate()}
                                  </div>
                                  {isEditingThisDate && (
                                    <div className="text-xs text-gray-600 font-medium">✏️ Editing</div>
                                  )}
                                </div>

                                {/* Workout Content - Show workout or empty state (no loading skeleton) */}
                                {workout ? (
                                  // Show workout title - clicking toggles editor
                                  <div>
                                    <button
                                      className="w-full text-left p-0.5 hover:bg-gray-50 transition-colors"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditWorkout(workout);
                                      }}
                                    >
                                      {/* Show applied template indicator */}
                                      {workout.appliedTemplateId && (
                                        <div className="text-[8px] text-gray-500 px-1">
                                          {workoutStructureTemplates.find(t => t.id === workout.appliedTemplateId)?.name}
                                        </div>
                                      )}
                                      {categoryInfo ? (
                                        <div
                                          className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                                          style={{ backgroundColor: categoryInfo.color }}
                                        >
                                          {categoryInfo.category}
                                        </div>
                                      ) : null}
                                      <div className="text-xs text-gray-700 font-medium px-1">
                                        {workout.title || 'Untitled'}
                                      </div>
                                    </button>
                                  </div>
                                ) : categoryInfo ? (
                                  // Show category with + button - clicking creates/toggles editor
                                  <div>
                                    <button
                                      className="w-full text-left p-0.5 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCreateWorkout(date, categoryInfo.category, categoryInfo.color);
                                      }}
                                    >
                                      <div
                                        className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5 flex items-center justify-between"
                                        style={{ backgroundColor: categoryInfo.color }}
                                      >
                                        <span>{categoryInfo.category}</span>
                                        {workoutCategories.find((wc: any) => wc.name === categoryInfo.category)?.linkedWorkoutStructureTemplateId && (
                                          <span className="text-[8px] opacity-75">★</span>
                                        )}
                                      </div>
                                      <div className="flex items-center justify-center text-gray-400 mt-0.5">
                                        <Plus className="w-3 h-3" />
                                      </div>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="p-3 flex flex-col items-center justify-center text-center h-full">
                                    <div className="text-gray-400 text-xs">
                                      {inPeriod ? (
                                        <>
                                          <div className="text-lg mb-1">📅</div>
                                          <div>No category assigned</div>
                                        </>
                                      ) : (
                                        <>
                                          <div className="text-lg mb-1">🚫</div>
                                          <div>Outside training period</div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>

                      {/* Expandable Editors Section - Only show if this week has active editors */}
                      {hasActiveEditors && (
                        <div className="border-t border-gray-200 bg-gray-50">
                          <div className="px-4 py-3 border-b border-gray-200 bg-gray-100">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-gray-800">
                                Editing Week {displayWeekNumber} ({weekEditingWorkouts.length + weekCreatingWorkouts.length} workouts)
                              </h4>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  const allEditors = [...weekEditingWorkouts, ...weekCreatingWorkouts];
                                  const dateKeys = allEditors.map(([dateKey]) => dateKey);
                                  handleCloseAllEditors(dateKeys);
                                }}
                                className="text-xs text-gray-600 hover:text-gray-800 px-2 py-1 hover:bg-gray-200 rounded cursor-pointer"
                              >
                                Close All
                              </button>
                            </div>
                          </div>

                          {/* Editors Horizontal Scroll - Optimized for 2 workouts side-by-side */}
                          <div className="p-4 overflow-x-auto">
                            <div className="flex gap-4 min-w-max border border-gray-200" style={{ maxWidth: 'calc(2 * 560px + 1rem)' }}>
                              {/* All Editors in Chronological Order - Show max 2 at a time */}
                              {[...weekEditingWorkouts, ...weekCreatingWorkouts]
                                .sort(([dateKeyA], [dateKeyB]) => new Date(dateKeyA).getTime() - new Date(dateKeyB).getTime())
                                .slice(0, 2) // Limit to 2 workouts for optimal viewing
                                .map(([dateKey, workoutOrCreateData], index, array) => {
                                  const isEditing = weekEditingWorkouts.some(([key]) => key === dateKey);
                                  const workout = isEditing ? workoutOrCreateData : null;
                                  const createData = !isEditing ? workoutOrCreateData : null;
                                  const isLast = index === array.length - 1;

                                  return (
                                    <div
                                      key={isEditing ? `editing-${dateKey}` : `creating-${dateKey}`}
                                      className={`flex-shrink-0 w-[560px] bg-white shadow-lg overflow-hidden ${!isLast ? 'border-r border-gray-200' : ''
                                        }`}
                                    >
                                      <div className="border-b px-3 py-2 flex items-center justify-between bg-gray-50 border-gray-200">
                                        <h3 className="text-sm font-semibold text-gray-900">
                                          {isEditing ? '📝 Edit' : '➕ Create'} - {(() => {
                                            // Parse dateKey (YYYY-MM-DD) as local date to avoid timezone issues
                                            const [year, month, day] = dateKey.split('-').map(Number);
                                            const date = new Date(year, month - 1, day);
                                            return date.toLocaleDateString('en-US', {
                                              weekday: 'short',
                                              month: 'short',
                                              day: 'numeric'
                                            });
                                          })()}
                                        </h3>
                                        <button
                                          type="button"
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            // Delete button - only show for existing workouts
                                            if (isEditing && workout?.id) {
                                              if (confirm('Are you sure you want to delete this workout? This cannot be undone.')) {
                                                await handleDeleteWorkout(workout.id, dateKey);
                                              }
                                            } else {
                                              // For new workouts, just close (discard)
                                              handleCloseEditor(dateKey);
                                            }
                                          }}
                                          className={`p-1 rounded cursor-pointer ${isEditing ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
                                          title={isEditing ? 'Delete workout' : 'Discard'}
                                        >
                                          ✕
                                        </button>
                                      </div>
                                      <div className="p-0">
                                        <WorkoutEditor
                                          workout={workout}
                                          isOpen={true}
                                          onClose={() => handleCloseEditor(dateKey)}
                                          onSave={(workoutData) => handleSaveWorkout(workoutData, dateKey)}
                                          onDelete={() => handleDeleteWorkout(workout?.id, dateKey)}
                                          isCreating={!isEditing}
                                          expandedInline={true}
                                          initialRounds={createData ? generateInitialRounds(createData?.appliedTemplateId) : undefined}
                                          appliedTemplateId={createData?.appliedTemplateId}
                                          eventId={getEventIdForWorkout(workout, dateKey)}
                                          externalVisibleColumns={visibleColumns}
                                          onExternalColumnVisibilityChange={handleColumnVisibilityChange}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </>

      </div>
    </div>
  );
}