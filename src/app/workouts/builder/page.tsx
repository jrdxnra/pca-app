"use client";

import dynamic from 'next/dynamic';
import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
// Lazy load heavy components for code splitting
const ModernCalendarView = dynamic(
  () => import('@/components/programs/ModernCalendarView').then(mod => ({ default: mod.ModernCalendarView })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
  }
);

const PeriodAssignmentDialog = dynamic(
  () => import('@/components/programs/PeriodAssignmentDialog').then(mod => ({ default: mod.PeriodAssignmentDialog }))
);

const QuickWorkoutBuilderDialog = dynamic(
  () => import('@/components/programs/QuickWorkoutBuilderDialog').then(mod => ({ default: mod.QuickWorkoutBuilderDialog }))
);

const WorkoutEditor = dynamic(
  () => import('@/components/workouts/WorkoutEditor').then(mod => ({ default: mod.WorkoutEditor })),
  {
    loading: () => <div className="flex items-center justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
  }
);

import type { WorkoutEditorHandle } from '@/components/workouts/WorkoutEditor';
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
import { toastSuccess, toastError } from '@/components/ui/toaster';

export default function BuilderPage() {
  const router = useRouter();

  // Use Next.js useSearchParams for reactive URL param reading
  // This properly updates when navigating to this page with new params
  const searchParams = useSearchParams();
  
  // Extract URL params - these update reactively when URL changes
  const urlClientId = searchParams.get('client');
  const dateParam = searchParams.get('date');
  const workoutId = searchParams.get('workoutId');
  const eventId = searchParams.get('eventId');
  const structureId = searchParams.get('structure');
  const categoryParam = searchParams.get('category');
  
  // Log URL params for debugging
  useEffect(() => {
    console.log('[Builder] ========================================');
    console.log('[Builder] URL params (from useSearchParams):');
    console.log('[Builder] client:', urlClientId);
    console.log('[Builder] date:', dateParam);
    console.log('[Builder] workoutId:', workoutId);
    console.log('[Builder] eventId:', eventId);
    console.log('[Builder] ========================================');
  }, [urlClientId, dateParam, workoutId, eventId]);

  // Calendar store for linking events to workouts
  const { linkToWorkout, updateEvent, deleteEvent, events: calendarEvents } = useCalendarStore();

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


  // Client selection state - initialized from URL or localStorage
  // This is the PRIMARY source of truth for client selection (not the URL)
  const [clientIdImmediate, setClientIdImmediate] = useState<string | null>(() => {
    // First check URL, then localStorage
    if (urlClientId) return urlClientId;
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedClient');
    }
    return null;
  });
  
  // Use deferred value to keep old UI visible while new data loads
  // This prevents the schedule from "flashing" during client switches
  const clientId = useDeferredValue(clientIdImmediate);
  

  // Client programs hook - uses local client state (not URL) to avoid reloads
  const {
    clientPrograms,
    isLoading: clientProgramsLoading,
    assignPeriod: hookAssignPeriod,
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
  
  // Refs to workout editors for triggering save from header buttons
  const editorRefs = useRef<Record<string, WorkoutEditorHandle | null>>({});
  
  // Track which workoutIds we've already opened (to prevent re-opening after close)
  const processedWorkoutIds = useRef<Set<string>>(new Set());
  
  // Track which editors are currently saving (for button state)
  const [savingEditors, setSavingEditors] = useState<Set<string>>(new Set());

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

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDialogData, setDeleteDialogData] = useState<{
    workoutId: string;
    dateKey: string;
    linkedEventId?: string;
    currentCategory?: string;
  } | null>(null);
  const [deleteDialogNewCategory, setDeleteDialogNewCategory] = useState<string>('');
  const [showCategorySelector, setShowCategorySelector] = useState(false);

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

  // Use store data directly - fetch in parallel, stores handle caching
  useEffect(() => {
    const loadData = async () => {
      try {
        // Check if stores already have data
        const hasClients = storeClients.length > 0;
        const hasPrograms = storePrograms.length > 0;

        // Only set loading if we need to fetch core data
        const needsFetch = !hasClients || !hasPrograms;
        
        if (needsFetch) {
          setLoading(true);
        }

        // Fetch everything in parallel - stores handle deduplication/caching
        await Promise.all([
          fetchAllConfig(),
          fetchClients(),
          fetchPrograms(),
          fetchAllScheduledWorkouts()
        ]);
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [fetchAllConfig, fetchClients, fetchPrograms, fetchAllScheduledWorkouts]);

  // Load and open workout when workoutId is provided in URL
  useEffect(() => {
    const loadWorkoutById = async () => {
      console.log('[Builder] ========================================');
      console.log('[Builder] loadWorkoutById effect running');
      console.log('[Builder] workoutId:', workoutId);
      console.log('[Builder] loading:', loading);
      console.log('[Builder] clientId:', clientId);
      console.log('[Builder] ========================================');
      
      if (!workoutId) {
        console.log('[Builder] SKIP - no workoutId in URL');
        return;
      }
      
      // Check if we've already processed this workoutId (prevents re-opening after close)
      if (processedWorkoutIds.current.has(workoutId)) {
        console.log('[Builder] SKIP - workoutId already processed (was closed by user)');
        return;
      }
      
      if (loading) {
        console.log('[Builder] SKIP - still loading initial data');
        return;
      }

      try {
        console.log('[Builder] Fetching workout from Firebase:', workoutId);
        const workout = await getClientWorkout(workoutId);
        console.log('[Builder] Got workout result:', workout ? 'SUCCESS' : 'NULL');
        
        if (workout) {
          console.log('[Builder] Workout details:', {
            id: workout.id,
            clientId: workout.clientId,
            date: workout.date,
            categoryName: workout.categoryName
          });
          
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

          // Switch to day view and directly open the editor (bypass autoOpenWorkout to avoid race conditions)
          console.log('[Builder] Setting viewMode to day and opening editor directly');
          setViewMode('day');
          
          // Get dateKey for this workout
          const dateKey = `${normalizedDate.getFullYear()}-${String(normalizedDate.getMonth() + 1).padStart(2, '0')}-${String(normalizedDate.getDate()).padStart(2, '0')}`;
          
          // Directly set editing state - this ensures the workout opens in EDIT mode (red X, delete works)
          setEditingWorkouts(prev => ({
            ...prev,
            [dateKey]: workout
          }));
          setOpenDates(prev => new Set([...prev, dateKey]));
          console.log('[Builder] ✅ Workout opened in EDIT mode for dateKey:', dateKey);
        } else {
          console.error('[Builder] ERROR - Workout not found for ID:', workoutId);
        }
      } catch (error) {
        console.error('[Builder] ERROR loading workout:', error);
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
  // IMPORTANT: Don't change viewMode if we're loading a specific workout (workoutId is present)
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
          
          // Only switch to week view if NOT loading a specific workout
          // When workoutId is present, let loadWorkoutById effect control the view
          if (!workoutId) {
            setViewMode('week');
            console.log('Set period and switched to week view');
          } else {
            console.log('Set period but keeping day view for workout editing');
          }

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
  }, [clientId, dateParam, clientPrograms, workoutId]);


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
    
    // Save to localStorage for persistence
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedClient', newClientId);
    }
    
    // Just update state - don't touch URL at all
    // useDeferredValue will keep old UI visible while new data loads
    setClientIdImmediate(newClientId);
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

    return undefined;
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

  // Auto-open workout editor when navigating to day view with a workout to edit
  useEffect(() => {
    console.log('[Builder] Auto-open effect:', { viewMode, autoOpenWorkout, hasAutoOpen: !!autoOpenWorkout });
    
    if (viewMode === 'day' && autoOpenWorkout) {
      const { date, workout, categoryInfo } = autoOpenWorkout;
      const dateKey = getDateKey(date);
      console.log('[Builder] Processing auto-open for dateKey:', dateKey, 'workout:', workout?.id);

      // Don't auto-open if editor is already open
      if (openDates.has(dateKey)) {
        console.log('[Builder] Editor already open for this date, skipping');
        setAutoOpenWorkout(null);
        return;
      }

      // Small delay to ensure the view has rendered, then open the editor
      const timer = setTimeout(() => {
        console.log('[Builder] Timer fired, opening editor directly');
        
        if (workout) {
          // Directly set state to open the editor (avoid calling handleEditWorkout which has toggle logic)
          console.log('[Builder] Opening editor for workout:', workout.id);
          setEditingWorkouts(prev => ({
            ...prev,
            [dateKey]: workout
          }));
          setOpenDates(prev => new Set([...prev, dateKey]));
        } else if (categoryInfo) {
          // For creating new workout
          console.log('[Builder] Opening creator for category:', categoryInfo.category);
          setCreatingWorkouts(prev => ({
            ...prev,
            [dateKey]: { date, category: categoryInfo.category, color: categoryInfo.color }
          }));
          setOpenDates(prev => new Set([...prev, dateKey]));
        }

        // Clear the auto-open flag
        setAutoOpenWorkout(null);
      }, 150);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode, autoOpenWorkout, openDates]);

  // State for Quick Workout dialog when coming from calendar event
  const [quickWorkoutDialogOpen, setQuickWorkoutDialogOpen] = useState(false);
  const [quickWorkoutInitialData, setQuickWorkoutInitialData] = useState<{
    date?: string;
    category?: string;
    time?: string;
    eventId?: string;
  }>({});
  
  // Open workout editor when coming from a calendar event (eventId in URL)
  // Track if we've already processed this eventId
  const processedEventIdRef = useRef<string | null>(null);
  
  useEffect(() => {
    if (!eventId || loading) return;
    
    // Wait for calendar events to load
    if (calendarEvents.length === 0) return;
    
    // Don't process the same eventId twice
    if (processedEventIdRef.current === eventId) return;
    
    const event = calendarEvents.find(e => e.id === eventId);
    if (!event) return;
    
    // If event already has a linked workout, let the workoutId effect handle it
    if (event.linkedWorkoutId) {
      console.log('[Builder] Event has linked workout, skipping');
      processedEventIdRef.current = eventId;
      return;
    }
    
    // Get client from event
    const eventClientId = event.preConfiguredClient ||
      (event.description?.match(/\[Metadata:.*client=([^,}]+)/)?.[1]?.trim());

    if (eventClientId && eventClientId !== 'none' && !clientId) {
      handleClientChange(eventClientId);
    }
    
    // Get event details
    const eventDate = new Date(event.start.dateTime);
    
    // Set calendar date
    setCalendarDate(eventDate);
    
    // Get the category from URL or event
    const category = categoryParam || event.preConfiguredCategory || 
      (event.description?.match(/category=([^,\s}\]]+)/)?.[1]);
    
    // If event is already assigned to a client, open inline editor directly instead of Quick Workout dialog
    const hasAssignedClient = eventClientId && eventClientId !== 'none';
    const effectiveClientId = clientId || eventClientId;
    
    if (hasAssignedClient && effectiveClientId) {
      console.log('[Builder] Event is assigned, opening inline editor directly');
      processedEventIdRef.current = eventId;
      
      const dateKey = getDateKey(eventDate);
      
      // Check if there's a draft or if we should create new
      const draftKey = `${dateKey}-${effectiveClientId}-new`;
      const hasDraft = localStorage.getItem(`pca-workout-draft-${draftKey}`);
      
      // Open the inline editor for this date
      setCreatingWorkouts(prev => ({
        ...prev,
        [dateKey]: {
          date: eventDate,
          category: category || '',
          color: workoutCategories.find(c => c.name === category)?.color || '#3B82F6'
        }
      }));
      setOpenDates(prev => new Set(prev).add(dateKey));
      
      console.log('[Builder] Opened inline editor for', dateKey, 'with category:', category, 'hasDraft:', !!hasDraft);
      return;
    }
    
    // No assigned client - open Quick Workout dialog
    const eventTime = event.start.dateTime ? 
      new Date(event.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    
    console.log('[Builder] No client assigned, opening Quick Workout dialog with:', { 
      date: dateParam, 
      category: categoryParam, 
      eventId 
    });
    
    processedEventIdRef.current = eventId;
    
    setQuickWorkoutInitialData({
      date: dateParam || undefined,
      category: category || undefined,
      time: eventTime || undefined,
      eventId: eventId
    });
    setQuickWorkoutDialogOpen(true);
    
  }, [eventId, loading, calendarEvents.length, clientId, categoryParam, dateParam, workoutCategories]);

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

        // Link to calendar event if eventId is provided (from URL or found for this workout)
        const workoutEventId = eventId || getEventIdForWorkout(null, dateKey);
        console.log('[handleSaveWorkout] Creating workout, eventId:', workoutEventId, 'workoutId:', createdWorkout.id);
        if (workoutEventId && createdWorkout.id) {
          try {
            await linkToWorkout(workoutEventId, createdWorkout.id);
            console.log('Successfully linked workout to calendar event:', workoutEventId);
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

        // If editing and workout has an event linked, update the event description with links
        const workoutEventId = getEventIdForWorkout(editingWorkout, dateKey);
        console.log('[handleSaveWorkout] Updating workout, eventId:', workoutEventId, 'workoutId:', editingWorkout.id);
        if (workoutEventId && editingWorkout.id) {
          try {
            await linkToWorkout(workoutEventId, editingWorkout.id);
            console.log('Successfully updated workout links on calendar event:', workoutEventId);
          } catch (error) {
            console.error('Failed to update workout links on calendar event:', error);
          }
        }

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

  const handleCloseEditor = useCallback((dateKey: string, closedWorkoutId?: string) => {
    // Mark the workoutId as processed to prevent re-opening from URL
    if (closedWorkoutId) {
      processedWorkoutIds.current.add(closedWorkoutId);
    }
    
    // Also check for workoutId in URL and mark it as processed
    const currentUrl = new URL(window.location.href);
    const urlWorkoutId = currentUrl.searchParams.get('workoutId');
    if (urlWorkoutId) {
      processedWorkoutIds.current.add(urlWorkoutId);
    }
    
    // Always update all three states to ensure editor closes
    // Use functional updates and always create new objects/sets
    setCreatingWorkouts(prev => {
      const newState = { ...prev };
      delete newState[dateKey];
      return newState;
    });

    setEditingWorkouts(prev => {
      // Also mark any workout being closed as processed
      if (prev[dateKey]?.id) {
        processedWorkoutIds.current.add(prev[dateKey].id);
      }
      const newState = { ...prev };
      delete newState[dateKey];
      return newState;
    });

    // Close this specific date - always create a new Set
    setOpenDates(prev => {
      const newSet = new Set(prev);
      newSet.delete(dateKey);
      return newSet;
    });
    
    // Clear workoutId from URL to prevent useEffect from re-opening the editor
    if (currentUrl.searchParams.has('workoutId')) {
      currentUrl.searchParams.delete('workoutId');
      currentUrl.searchParams.delete('eventId');
      router.replace(currentUrl.pathname + currentUrl.search, { scroll: false });
    }
  }, [router]);

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

  // Show delete confirmation dialog
  const showDeleteConfirmation = (workoutId: string | undefined, dateKey: string) => {
    console.log('showDeleteConfirmation called', { workoutId, dateKey });

    if (!workoutId) {
      console.log('No workoutId, just closing editor');
      // If no ID, it's a new workout that hasn't been saved yet, just close editor
      handleCloseEditor(dateKey);
      return;
    }

    // Find if there's a linked calendar event
    const linkedEvent = calendarEvents.find(e => e.linkedWorkoutId === workoutId);
    
    setDeleteDialogData({
      workoutId,
      dateKey,
      linkedEventId: linkedEvent?.id,
      currentCategory: linkedEvent?.preConfiguredCategory
    });
    setDeleteDialogNewCategory('');
    setShowCategorySelector(false);
    setDeleteDialogOpen(true);
  };

  // Delete workout only (unlink from event but keep event)
  const handleDeleteWorkoutKeepEvent = async () => {
    if (!deleteDialogData) return;
    const { workoutId, dateKey, linkedEventId } = deleteDialogData;

    try {
      setLoading(true);
      console.log('Deleting workout and keeping event...', { workoutId, linkedEventId });

      // First unlink the event if there is one
      if (linkedEventId) {
        await updateEvent(linkedEventId, { linkedWorkoutId: undefined });
        console.log('Unlinked event from workout');
      }

      // Delete the workout
      await deleteClientWorkout(workoutId);
      console.log('Workout deleted');

      // Remove from local state
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));

      // Close editor and dialog
      handleCloseEditor(dateKey, workoutId);
      setDeleteDialogOpen(false);
      setDeleteDialogData(null);
      setShowCategorySelector(false);

      // Refresh scheduled workouts
      await fetchAllScheduledWorkouts();

      console.log('Workout deleted, event kept');
    } catch (error) {
      console.error('Error deleting workout:', error);
      toastError('Failed to delete workout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete workout and change event category
  const handleDeleteWorkoutChangeCategory = async () => {
    if (!deleteDialogData || !deleteDialogNewCategory) return;
    const { workoutId, dateKey, linkedEventId } = deleteDialogData;

    try {
      setLoading(true);
      console.log('Deleting workout and changing event category...', { workoutId, linkedEventId, newCategory: deleteDialogNewCategory });

      // Update event with new category and unlink workout
      if (linkedEventId) {
        await updateEvent(linkedEventId, { 
          linkedWorkoutId: undefined,
          preConfiguredCategory: deleteDialogNewCategory 
        });
        console.log('Updated event category and unlinked workout');
      }

      // Delete the workout
      await deleteClientWorkout(workoutId);
      console.log('Workout deleted');

      // Remove from local state
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));

      // Close editor and dialog
      handleCloseEditor(dateKey, workoutId);
      setDeleteDialogOpen(false);
      setDeleteDialogData(null);
      setDeleteDialogNewCategory('');
      setShowCategorySelector(false);

      // Refresh scheduled workouts
      await fetchAllScheduledWorkouts();

      console.log('Workout deleted, event category changed');
    } catch (error) {
      console.error('Error deleting workout:', error);
      toastError('Failed to delete workout. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Delete both workout and linked event
  const handleDeleteWorkoutAndEvent = async () => {
    if (!deleteDialogData) return;
    const { workoutId, dateKey, linkedEventId } = deleteDialogData;

    try {
      setLoading(true);
      console.log('Deleting workout and event...', { workoutId, linkedEventId });

      // Delete the event first if there is one
      if (linkedEventId) {
        await deleteEvent(linkedEventId);
        console.log('Event deleted');
      }

      // Delete the workout
      await deleteClientWorkout(workoutId);
      console.log('Workout deleted');

      // Remove from local state
      setWorkouts(prev => prev.filter(w => w.id !== workoutId));

      // Close editor and dialog
      handleCloseEditor(dateKey, workoutId);
      setDeleteDialogOpen(false);
      setDeleteDialogData(null);

      // Refresh scheduled workouts
      await fetchAllScheduledWorkouts();

      console.log('Both workout and event deleted');
    } catch (error) {
      console.error('Error deleting workout and event:', error);
      toastError('Failed to delete. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Legacy handler for simple delete (no event linked)
  const handleDeleteWorkout = async (workoutId: string | undefined, dateKey: string) => {
    console.log('handleDeleteWorkout called', { workoutId, dateKey });

    if (!workoutId) {
      console.log('No workoutId, just closing editor');
      handleCloseEditor(dateKey);
      return;
    }

    // Check if there's a linked event
    const linkedEvent = calendarEvents.find(e => e.linkedWorkoutId === workoutId);
    
    if (linkedEvent) {
      // If there's a linked event, show the dialog instead
      showDeleteConfirmation(workoutId, dateKey);
      return;
    }

    // No linked event, just delete the workout directly
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
      handleCloseEditor(dateKey, workoutId);

      // Also refresh scheduled workouts to keep data in sync
      console.log('Refreshing scheduled workouts...');
      await fetchAllScheduledWorkouts();

      console.log('Workout deleted successfully and state updated');
    } catch (error) {
      console.error('Error deleting workout:', error);
      toastError('Failed to delete workout. Please try again.');
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
      <div className="w-full px-1 pt-1 pb-4 space-y-2">
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
                  <Select 
                    value={clientIdImmediate || undefined} 
                    onValueChange={handleClientChange} 
                    disabled={loading}
                  >
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Select client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        client.id && (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        )
                      ))}
                    </SelectContent>
                  </Select>
                  {clientId && (
                    <QuickWorkoutBuilderDialog
                      clientId={clientId}
                      clientName={clients.find(c => c.id === clientId)?.name || 'Unknown Client'}
                      onWorkoutCreated={() => {
                        // Force re-fetch by updating calendarDate (triggers useEffect)
                        setCalendarDate(new Date(calendarDate));
                      }}
                    />
                  )}
                  <PeriodAssignmentDialog
                    clientId={clientId || ''}
                    clientName={clientId ? (clients.find(c => c.id === clientId)?.name || 'Unknown Client') : ''}
                    periods={periods}
                    workoutCategories={workoutCategories}
                    weekTemplates={weekTemplates}
                    onAssignPeriod={handleAssignPeriod}
                    existingAssignments={clientId ? (clientPrograms.find(cp => cp.clientId === clientId)?.periods || []) : []}
                  />
                </div>

                {/* Right aligned - Week Selector (matches Schedule page) */}
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
                    <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 icon-builder" />
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
                    <ChevronRight className="h-3 w-3 md:h-4 md:w-4 icon-builder" />
                  </Button>
                </div>
              </div>

              {/* Workout Building Actions */}
              {!clientId && (
                <div className="col-span-full text-center py-8 text-muted-foreground">
                  Please select a client to start building workouts.
                </div>
              )}

              {/* Second Row - Column Toggle, Category Filter, Week Order */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-2">
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

                {/* Right side - Week Order */}
                <div className="flex items-center gap-2">
                  <label htmlFor="weekOrder" className="text-sm font-medium">Week order:</label>
                  <Select 
                    value={weekSettings.weekOrder} 
                    onValueChange={(value) => setWeekSettings(prev => ({
                      ...prev,
                      weekOrder: value as 'ascending' | 'descending'
                    }))}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ascending">Ascending</SelectItem>
                      <SelectItem value="descending">Descending</SelectItem>
                    </SelectContent>
                  </Select>
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

                // Find the week index that contains calendarDate
                const targetWeekIndex = calculatedWeeks.findIndex(week => {
                  const weekStart = new Date(week[0]);
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(week[6]);
                  weekEnd.setHours(23, 59, 59, 999);
                  const normalizedCalendarDate = new Date(calendarDate);
                  normalizedCalendarDate.setHours(12, 0, 0, 0);
                  return normalizedCalendarDate >= weekStart && normalizedCalendarDate <= weekEnd;
                });

                // Show 1 week before, current week, and 2 weeks after (4 weeks total)
                let weeksToDisplay: Date[][];
                if (targetWeekIndex >= 0) {
                  // Get range: 1 week before to 2 weeks after
                  const startIdx = Math.max(0, targetWeekIndex - 1);
                  const endIdx = Math.min(calculatedWeeks.length, targetWeekIndex + 3);
                  weeksToDisplay = calculatedWeeks.slice(startIdx, endIdx);
                } else {
                  // Generate weeks around calendarDate if not in calculated weeks
                  const weekStart = new Date(calendarDate);
                  const dayOfWeek = weekStart.getDay();
                  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                  weekStart.setDate(weekStart.getDate() + diff);
                  weekStart.setHours(12, 0, 0, 0);

                  // Generate 4 weeks: 1 before, current, 2 after
                  const generatedWeeks: Date[][] = [];
                  for (let w = -1; w <= 2; w++) {
                    const week: Date[] = [];
                    for (let i = 0; i < 7; i++) {
                      const day = new Date(weekStart);
                      day.setDate(weekStart.getDate() + (w * 7) + i);
                      week.push(day);
                    }
                    generatedWeeks.push(week);
                  }
                  weeksToDisplay = generatedWeeks;
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

                  // Determine if this is the current week (contains TODAY, not calendarDate)
                  const weekStart = new Date(week[0]);
                  weekStart.setHours(0, 0, 0, 0);
                  const weekEnd = new Date(week[6]);
                  weekEnd.setHours(23, 59, 59, 999);
                  const today = new Date();
                  today.setHours(12, 0, 0, 0);
                  const isCurrentWeek = today >= weekStart && today <= weekEnd;
                  const isPastWeek = weekEnd < today;
                  
                  // Determine if this is the viewed week (contains calendarDate - the week user navigated to)
                  const viewedDate = new Date(calendarDate);
                  viewedDate.setHours(12, 0, 0, 0);
                  const isViewedWeek = viewedDate >= weekStart && viewedDate <= weekEnd;
                  // Only show viewed indicator if it's different from current week
                  const showViewedIndicator = isViewedWeek && !isCurrentWeek;
                  
                  // Calculate weeks offset from TODAY's week (not the viewed week)
                  // Get the start of the week containing TODAY
                  const todayWeekStart = new Date();
                  const dayOfWeek = todayWeekStart.getDay();
                  // Adjust to Monday (day 1), treating Sunday (0) as end of week
                  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                  todayWeekStart.setDate(todayWeekStart.getDate() - daysFromMonday);
                  todayWeekStart.setHours(0, 0, 0, 0);
                  
                  // Calculate difference in weeks from TODAY
                  const msPerDay = 24 * 60 * 60 * 1000;
                  const daysDiff = Math.round((weekStart.getTime() - todayWeekStart.getTime()) / msPerDay);
                  const weekDiff = Math.round(daysDiff / 7);
                  
                  // Get week label based on offset
                  const getWeekLabel = () => {
                    if (isCurrentWeek) return 'Current Week';
                    if (weekDiff === -1) return 'Last Week';
                    if (weekDiff === 1) return '1 Week Out';
                    if (weekDiff === 2) return '2 Weeks Out';
                    if (weekDiff < 0) return `${Math.abs(weekDiff)} Weeks Ago`;
                    return `${weekDiff} Weeks Out`;
                  };

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
                      className={`bg-white rounded-lg shadow-sm border overflow-hidden ${
                        isCurrentWeek 
                          ? 'border-blue-400 ring-2 ring-blue-100' 
                          : showViewedIndicator
                            ? 'border-purple-400 ring-2 ring-purple-100'
                            : isPastWeek 
                              ? 'border-gray-200 opacity-75' 
                              : 'border-gray-200'
                      }`}
                    >
                      {/* Week Header */}
                      <div className={`border-b border-gray-200 px-4 py-2 ${
                        isCurrentWeek 
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100' 
                          : showViewedIndicator
                            ? 'bg-gradient-to-r from-purple-50 to-purple-100'
                            : isPastWeek
                              ? 'bg-gradient-to-r from-gray-100 to-gray-150'
                              : 'bg-gradient-to-r from-gray-50 to-gray-100'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className={`text-sm ${
                              isCurrentWeek 
                                ? 'font-bold text-blue-800' 
                                : showViewedIndicator 
                                  ? 'font-bold text-purple-800'
                                  : 'font-semibold text-gray-800'
                            }`}>
                              {week[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week[week.length - 1]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </h3>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isCurrentWeek 
                                ? 'bg-blue-500 text-white font-bold' 
                                : showViewedIndicator
                                  ? 'bg-purple-500 text-white font-bold'
                                  : isPastWeek
                                    ? 'bg-gray-400 text-white font-medium'
                                    : 'bg-gray-200 text-gray-600 font-medium'
                            }`}>
                              {getWeekLabel()}
                              {showViewedIndicator && ' • Viewing'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
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
                              <div key={dayIndex} className={`min-h-[160px] relative ${
                                isEditingThisDate && !isToday 
                                  ? 'bg-amber-50 border-2 border-amber-400' 
                                  : isToday 
                                    ? 'bg-blue-50 border-2 border-blue-300' 
                                    : inPeriod 
                                      ? 'bg-white' 
                                      : 'bg-gray-50'
                              } ${!inPeriod && !isToday && !isEditingThisDate ? 'opacity-60' : ''}`}>

                                {/* Date Header */}
                                <div className={`px-3 py-2 border-b border-gray-100 ${
                                  isEditingThisDate && !isToday
                                    ? 'bg-amber-100'
                                    : isToday 
                                      ? 'bg-blue-100' 
                                      : 'bg-gray-50'
                                }`}>
                                  <div className={`text-sm font-semibold ${
                                    isEditingThisDate && !isToday
                                      ? 'text-amber-800 font-bold'
                                      : isToday 
                                        ? 'text-blue-700 font-bold' 
                                        : 'text-gray-700'
                                  }`}>
                                    {date.getDate()}
                                  </div>
                                  {isEditingThisDate && (
                                    <div className={`text-xs font-medium ${
                                      isToday ? 'text-blue-600' : 'text-amber-700'
                                    }`}>
                                      ✏️ Editing {editingWorkout?.categoryName || createWorkoutData?.category || ''}
                                    </div>
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
                                      {/* Show workout's actual category (prioritize over period's category) */}
                                      {workout.categoryName ? (
                                        <div
                                          className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                                          style={{ 
                                            backgroundColor: workoutCategories.find((wc: any) => wc.name === workout.categoryName)?.color || categoryInfo?.color || '#6b7280'
                                          }}
                                        >
                                          {workout.categoryName}
                                        </div>
                                      ) : categoryInfo ? (
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
                                        <Plus className="w-3 h-3 icon-add" />
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
                          {/* Editors Horizontal Scroll - Optimized for 2 workouts side-by-side */}
                          <div className="p-2 overflow-x-auto">
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
                                      className={`flex-shrink-0 w-[560px] bg-white shadow-lg overflow-visible ${!isLast ? 'border-r border-gray-200' : ''
                                        }`}
                                    >
                                      <div className="border-b px-3 py-1.5 flex items-center justify-between bg-gray-50 border-gray-200 sticky top-0 z-20">
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
                                        <div className="flex items-center gap-1 relative z-30">
                                          {/* Cancel button */}
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              handleCloseEditor(dateKey, workout?.id);
                                            }}
                                            className="h-6 text-xs px-2 relative z-30"
                                          >
                                            Cancel
                                          </Button>
                                          {/* Save button */}
                                          <Button
                                            type="button"
                                            size="sm"
                                            onClick={async (e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              const editor = editorRefs.current[dateKey];
                                              if (editor) {
                                                setSavingEditors(prev => new Set(prev).add(dateKey));
                                                try {
                                                  await editor.save();
                                                } finally {
                                                  setSavingEditors(prev => {
                                                    const next = new Set(prev);
                                                    next.delete(dateKey);
                                                    return next;
                                                  });
                                                }
                                              }
                                            }}
                                            disabled={savingEditors.has(dateKey)}
                                            className="h-6 text-xs px-2 relative z-30"
                                          >
                                            {savingEditors.has(dateKey) ? 'Saving...' : 'Save'}
                                          </Button>
                                          {/* Delete/Discard button */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              if (isEditing && workout?.id) {
                                                showDeleteConfirmation(workout.id, dateKey);
                                              } else {
                                                handleCloseEditor(dateKey, workout?.id);
                                              }
                                            }}
                                            className={`p-1 rounded cursor-pointer relative z-30 ${isEditing ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
                                            title={isEditing ? 'Delete workout' : 'Discard'}
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                      <div className="p-0 relative z-10">
                                        <WorkoutEditor
                                          ref={(el) => { editorRefs.current[dateKey] = el; }}
                                          workout={workout}
                                          isOpen={true}
                                          onClose={() => handleCloseEditor(dateKey, workout?.id)}
                                          onSave={(workoutData) => handleSaveWorkout(workoutData, dateKey)}
                                          onDelete={() => handleDeleteWorkout(workout?.id, dateKey)}
                                          isCreating={!isEditing}
                                          expandedInline={true}
                                          hideTopActionBar={true}
                                          initialRounds={createData ? generateInitialRounds(createData?.appliedTemplateId) : undefined}
                                          appliedTemplateId={createData?.appliedTemplateId}
                                          eventId={getEventIdForWorkout(workout, dateKey)}
                                          externalVisibleColumns={visibleColumns}
                                          onExternalColumnVisibilityChange={handleColumnVisibilityChange}
                                          draftKey={clientId ? `${dateKey}-${clientId}${workout?.id ? `-${workout.id}` : '-new'}` : undefined}
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

      {/* Delete Workout Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={(open) => {
        setDeleteDialogOpen(open);
        if (!open) {
          setShowCategorySelector(false);
          setDeleteDialogNewCategory('');
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Workout</DialogTitle>
            <DialogDescription>
              {deleteDialogData?.linkedEventId 
                ? 'This workout is linked to a calendar event. What would you like to do?'
                : 'Are you sure you want to delete this workout? This cannot be undone.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {deleteDialogData?.linkedEventId ? (
              <>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={handleDeleteWorkoutKeepEvent}
                  disabled={loading}
                >
                  <div>
                    <div className="font-medium">Delete workout only</div>
                    <div className="text-xs text-gray-500">Keep the calendar event with current category - you can link a new workout later</div>
                  </div>
                </Button>

                {/* Change category option */}
                {!showCategorySelector ? (
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left h-auto py-3"
                    onClick={() => setShowCategorySelector(true)}
                    disabled={loading}
                  >
                    <div>
                      <div className="font-medium">Delete workout and change event category</div>
                      <div className="text-xs text-gray-500">
                        Keep the event but assign a different workout category
                        {deleteDialogData.currentCategory && (
                          <span className="block mt-1">Current: <strong>{deleteDialogData.currentCategory}</strong></span>
                        )}
                      </div>
                    </div>
                  </Button>
                ) : (
                  <div className="border rounded-lg p-3 space-y-3">
                    <div className="text-sm font-medium">Select new category:</div>
                    <Select 
                      value={deleteDialogNewCategory} 
                      onValueChange={setDeleteDialogNewCategory}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose a category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workoutCategories.map((cat) => (
                          cat.name && (
                            <SelectItem key={cat.id} value={cat.name}>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: cat.color }}
                                />
                                {cat.name}
                              </div>
                            </SelectItem>
                          )
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setShowCategorySelector(false);
                          setDeleteDialogNewCategory('');
                        }}
                        disabled={loading}
                      >
                        Back
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleDeleteWorkoutChangeCategory}
                        disabled={loading || !deleteDialogNewCategory}
                      >
                        {loading ? 'Saving...' : 'Confirm'}
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3 border-red-200 hover:bg-red-50"
                  onClick={handleDeleteWorkoutAndEvent}
                  disabled={loading}
                >
                  <div>
                    <div className="font-medium text-red-600">Delete workout and event</div>
                    <div className="text-xs text-gray-500">Remove both the workout and the linked calendar event</div>
                  </div>
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleDeleteWorkoutKeepEvent}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Workout'}
              </Button>
            )}
          </div>

          <DialogFooter>
            <Button 
              variant="ghost" 
              onClick={() => {
                setDeleteDialogOpen(false);
                setDeleteDialogData(null);
                setShowCategorySelector(false);
                setDeleteDialogNewCategory('');
              }}
              disabled={loading}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Workout Dialog - opens when coming from calendar event */}
      {clientId && quickWorkoutDialogOpen && (
        <QuickWorkoutBuilderDialog
          clientId={clientId}
          clientName={clients.find(c => c.id === clientId)?.name || 'Unknown Client'}
          initialOpen={quickWorkoutDialogOpen}
          initialDate={quickWorkoutInitialData.date}
          initialCategory={quickWorkoutInitialData.category}
          initialTime={quickWorkoutInitialData.time}
          eventId={quickWorkoutInitialData.eventId}
          onWorkoutCreated={() => {
            setQuickWorkoutDialogOpen(false);
            setQuickWorkoutInitialData({});
            // Force re-fetch by updating calendarDate (triggers useEffect)
            setCalendarDate(new Date(calendarDate));
          }}
          onClose={() => {
            setQuickWorkoutDialogOpen(false);
            setQuickWorkoutInitialData({});
          }}
        />
      )}
    </div>
  );
}