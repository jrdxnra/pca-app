"use client";

import React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Dumbbell, Settings, ExternalLink, ToggleLeft, ToggleRight, Eye, PlusCircle } from 'lucide-react';
import { Program, ScheduledWorkout, Client, ClientProgram, ClientProgramPeriod } from '@/lib/types';
import { ScheduleWorkoutDialog } from './ScheduleWorkoutDialog';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { GoogleCalendarEventCard } from './GoogleCalendarEventCard';
import { QuickWorkoutCreationDialog } from './QuickWorkoutCreationDialog';

import { TwoColumnWeekView } from './TwoColumnWeekView';
import { fetchWorkoutsByDateRange, fetchAllWorkoutsByDateRange } from '@/lib/firebase/services/clientWorkouts';
import { Timestamp } from 'firebase/firestore';
import { ClientWorkout } from '@/lib/types';
import { format } from 'date-fns';
import { getAppTimezone } from '@/lib/utils/timezone';
import { safeToDate } from '@/lib/utils/dateHelpers';
import { getEventClientId } from '@/lib/utils/event-patterns';
import { UnifiedDayCard } from './UnifiedDayCard';

interface ModernCalendarViewProps {
  viewMode: 'month' | 'week' | 'day';
  calendarDate: Date;
  scheduledWorkouts: ScheduledWorkout[];
  selectedClient: string | null;
  programs: Program[];
  clients: Client[];
  clientPrograms: ClientProgram[];
  includeWeekends?: boolean;
  refreshKey?: string | number; // Key to force refresh when workouts are created
  onPeriodClick?: (period: ClientProgramPeriod, position: { x: number; y: number }) => void;
  onDateClick?: (date: Date, viewMode: 'week' | 'day') => void;
  onWeekCellClick?: (date: Date, timeSlot: Date, period?: ClientProgramPeriod) => void;
  onScheduleCellClick?: (date: Date, timeSlot: Date, period?: ClientProgramPeriod) => void;
  onWorkoutCellClick?: (date: Date, timeSlot: Date, period?: ClientProgramPeriod) => void;
  onMoveWorkoutCategory?: (fromDate: Date, toDate: Date, category: string) => void;
  onEventClick?: (event: GoogleCalendarEvent) => void;
}

export function ModernCalendarView({
  viewMode,
  calendarDate,
  scheduledWorkouts,
  selectedClient,
  programs,
  clients,
  clientPrograms,
  includeWeekends = false,
  refreshKey,
  onPeriodClick,
  onDateClick,
  onWeekCellClick,
  onScheduleCellClick,
  onWorkoutCellClick,
  onMoveWorkoutCategory,
  onEventClick
}: ModernCalendarViewProps) {

  const router = useRouter();

  // Category selection state
  const [selectedCategory, setSelectedCategory] = React.useState<{ category: string, fromDate: Date, position: { x: number, y: number }, eventId?: string } | null>(null);

  // Quick workout creation dialog state
  const [quickWorkoutDialogOpen, setQuickWorkoutDialogOpen] = React.useState(false);
  const [selectedEventForWorkout, setSelectedEventForWorkout] = React.useState<GoogleCalendarEvent | null>(null);

  // Workouts state - persistent across client switches, filter by client/date when rendering
  const [allWorkouts, setAllWorkouts] = React.useState<ClientWorkout[]>([]);

  // Calendar store for Google Calendar events
  const {
    events: calendarEvents,
    config: calendarConfig,
    loading: calendarLoading,
    fetchEvents,
    markAsCoachingSession,
    linkToWorkout,
    updateEvent
  } = useCalendarStore();

  // Pre-fetch calendar events and workouts for current week + adjacent weeks
  // This keeps the calendar cells always populated, reducing perceived loading time
  React.useEffect(() => {
    if (viewMode !== 'week') return;

    let cancelled = false; // Request cancellation flag
    let timeoutId: NodeJS.Timeout | null = null;

    const fetchData = () => {
      if (cancelled) return;

      try {
        // Get current week range
        const currentWeekStart = new Date(calendarDate);
        currentWeekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
        const currentWeekEnd = new Date(currentWeekStart);
        currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

        // Pre-fetch adjacent weeks for smoother navigation
        const previousWeekStart = new Date(currentWeekStart);
        previousWeekStart.setDate(currentWeekStart.getDate() - 7);
        const previousWeekEnd = new Date(previousWeekStart);
        previousWeekEnd.setDate(previousWeekStart.getDate() + 6);

        const nextWeekStart = new Date(currentWeekStart);
        nextWeekStart.setDate(currentWeekStart.getDate() + 7);
        const nextWeekEnd = new Date(nextWeekStart);
        nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

        // Normalize all dates
        [currentWeekStart, currentWeekEnd, previousWeekStart, previousWeekEnd, nextWeekStart, nextWeekEnd].forEach(date => {
          date.setHours(0, 0, 0, 0);
        });
        currentWeekEnd.setHours(23, 59, 59, 999);
        previousWeekEnd.setHours(23, 59, 59, 999);
        nextWeekEnd.setHours(23, 59, 59, 999);

        // Fetch events for all three weeks (pre-fetch adjacent weeks)
        const expandedStart = previousWeekStart;
        const expandedEnd = nextWeekEnd;
        
        if (!cancelled) {
          fetchEvents({ start: expandedStart, end: expandedEnd });
        }

        // Fetch workouts for all three weeks
        // Keep all workouts in persistent state, filter by client/date when rendering
        if (selectedClient && !cancelled) {
          // Specific client selected - fetch workouts for that client
          fetchWorkoutsByDateRange(
            selectedClient,
            Timestamp.fromDate(expandedStart),
            Timestamp.fromDate(expandedEnd)
          )
            .then(async (freshWorkouts) => {
              if (cancelled) return; // Don't update state if cancelled
              
              // Replace workouts for this client in this date range (handles deletions properly)
              setAllWorkouts(prev => {
                // Remove old workouts for this client in the fetched date range
                const workoutsOutsideRange = prev.filter(w => {
                  // Keep workouts from other clients
                  if (w.clientId !== selectedClient) return true;
                  
                  // Check if workout is outside the fetched date range
                  const workoutDate = safeToDate(w.date);
                  
                  // Keep workouts outside the fetched range (they haven't been re-fetched)
                  return workoutDate < expandedStart || workoutDate > expandedEnd;
                });
                
                // Combine: workouts outside range + fresh workouts from fetch
                const newWorkouts = [...workoutsOutsideRange, ...freshWorkouts];
                
                // Only update if the data actually changed (prevent infinite loops)
                // Compare by creating a set of IDs for efficient comparison
                const prevIds = new Set(prev.map(w => w.id));
                const newIds = new Set(newWorkouts.map(w => w.id));
                
                if (prevIds.size === newIds.size && 
                    Array.from(prevIds).every(id => newIds.has(id))) {
                  // Same workouts, return previous reference to prevent re-render
                  return prev;
                }
                
                return newWorkouts;
              });
            })
            .catch(error => {
              if (!cancelled) {
                console.error('Error fetching workouts for client:', error);
              }
            });
        } else if (!selectedClient && !cancelled) {
          // "All Clients" selected - fetch workouts for ALL clients in date range
          fetchAllWorkoutsByDateRange(
            Timestamp.fromDate(expandedStart),
            Timestamp.fromDate(expandedEnd)
          )
            .then(async (freshWorkouts) => {
              if (cancelled) return; // Don't update state if cancelled
              
              // Replace all workouts in this date range
              setAllWorkouts(prev => {
                // Remove old workouts in the fetched date range
                const workoutsOutsideRange = prev.filter(w => {
                  const workoutDate = safeToDate(w.date);
                  
                  return workoutDate < expandedStart || workoutDate > expandedEnd;
                });
                
                // Combine: workouts outside range + fresh workouts from fetch
                const newWorkouts = [...workoutsOutsideRange, ...freshWorkouts];
                
                // Only update if the data actually changed (prevent infinite loops)
                // Compare by creating a set of IDs for efficient comparison
                const prevIds = new Set(prev.map(w => w.id));
                const newIds = new Set(newWorkouts.map(w => w.id));
                
                if (prevIds.size === newIds.size && 
                    Array.from(prevIds).every(id => newIds.has(id))) {
                  // Same workouts, return previous reference to prevent re-render
                  return prev;
                }
                
                return newWorkouts;
              });
            })
            .catch(error => {
              if (!cancelled) {
                console.error('Error fetching all workouts:', error);
              }
            });
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Error in fetchData:', error);
        }
      }
    };

    // Debounce to prevent rapid-fire requests
    timeoutId = setTimeout(fetchData, 100);

    return () => {
      cancelled = true; // Cancel any pending operations
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarDate, viewMode, selectedClient, refreshKey]);

  // Filter workouts for current view - get date range for current + adjacent weeks
  // Memoize the date range calculation to prevent infinite loops
  // Use a stable key based on the date's time value to prevent unnecessary recalculations
  // CRITICAL: Use getTime() for stable comparison - Date objects are compared by reference
  const calendarDateKey = React.useMemo(() => {
    if (!calendarDate) return null;
    // Create a stable key from the date's timestamp (normalized to start of day)
    const normalizedDate = new Date(calendarDate);
    normalizedDate.setHours(0, 0, 0, 0);
    return normalizedDate.getTime().toString();
  }, [calendarDate ? calendarDate.getTime() : null]); // Use getTime() for stable comparison

  // Calculate date range timestamps directly (avoid object recreation)
  const dateRangeTimestamps = React.useMemo(() => {
    if (!calendarDate) return { startTime: 0, endTime: 0 };
    
    const currentWeekStart = new Date(calendarDate);
    currentWeekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(currentWeekStart.getDate() - 7);
    const nextWeekEnd = new Date(currentWeekStart);
    nextWeekEnd.setDate(currentWeekStart.getDate() + 13); // Current week + next week
    
    previousWeekStart.setHours(0, 0, 0, 0);
    nextWeekEnd.setHours(23, 59, 59, 999);
    
    return { 
      startTime: previousWeekStart.getTime(), 
      endTime: nextWeekEnd.getTime() 
    };
  }, [calendarDateKey]); // Use stable key

  // Filter workouts - CRITICAL FIX: Avoid useMemo infinite loops
  // Use useMemo with a guard to prevent infinite re-computation
  // Store previous result and only recompute when inputs actually change
  const filteredWorkoutsRef = React.useRef<ClientWorkout[]>([]);
  const lastFilterParamsRef = React.useRef<string>('');
  
  const filteredWorkouts = React.useMemo(() => {
    // Create a stable key from all inputs
    const filterKey = `${allWorkouts.length}-${selectedClient || 'all'}-${dateRangeTimestamps.startTime}-${dateRangeTimestamps.endTime}`;
    
    // If inputs haven't changed, return cached result
    if (filterKey === lastFilterParamsRef.current && filteredWorkoutsRef.current.length >= 0) {
      return filteredWorkoutsRef.current;
    }
    
    // Early return if no workouts to avoid unnecessary computation
    if (!allWorkouts || allWorkouts.length === 0 || dateRangeTimestamps.startTime === 0) {
      filteredWorkoutsRef.current = [];
      lastFilterParamsRef.current = filterKey;
      return [];
    }
    
    try {
      const startDate = new Date(dateRangeTimestamps.startTime);
      const endDate = new Date(dateRangeTimestamps.endTime);
      
      const filtered = allWorkouts.filter(workout => {
        // If a specific client is selected, filter by that client
        if (selectedClient && workout.clientId !== selectedClient) return false;
        
        const workoutDate = safeToDate(workout.date);
        
        return workoutDate >= startDate && workoutDate <= endDate;
      });
      
      // Cache the result
      filteredWorkoutsRef.current = filtered;
      lastFilterParamsRef.current = filterKey;
      
      return filtered;
    } catch (error) {
      console.error('Error filtering workouts:', error);
      return [];
    }
    // Depend on stable values - the ref guard prevents infinite loops
  }, [allWorkouts.length, selectedClient, dateRangeTimestamps.startTime, dateRangeTimestamps.endTime]);

  // Helper to get calendar events for a specific date
  const getCalendarEventsForDate = (date: Date): GoogleCalendarEvent[] => {
    const targetDate = date.toDateString();
    return calendarEvents.filter(event => {
      const eventDate = new Date(event.start.dateTime).toDateString();
      if (eventDate !== targetDate) return false;
      
      // If a client is selected, filter by client
      if (selectedClient) {
        // Check preConfiguredClient
        if (event.preConfiguredClient) {
          return event.preConfiguredClient === selectedClient;
        }
        
        // Check description metadata
        if (event.description) {
          const clientMatch = event.description.match(/\[Metadata:.*client=([^,}]+)/);
          if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
            return clientMatch[1].trim() === selectedClient;
          }
        }
        
        // Check extended properties (from Google Calendar API)
        if ((event as any).extendedProperties?.private?.pcaClientId) {
          return (event as any).extendedProperties.private.pcaClientId === selectedClient;
        }
        
        // If event has no client info and we're viewing a specific client, don't show it
        // (unless it's a general event that should be visible to all)
        return false;
      }
      
      // No client selected, show all events
      return true;
    });
  };

  // Helper to extract client name from event
  const getClientNameFromEvent = (event: GoogleCalendarEvent): string => {
    // First check if event has preConfiguredClient
    if (event.preConfiguredClient) {
      const client = clients.find(c => c.id === event.preConfiguredClient);
      if (client) return client.name;
    }

    // Check description metadata for client ID (format: [Metadata: client=xxx, ...])
    if (event.description) {
      const clientMatch = event.description.match(/\[Metadata:.*client=([^,}]+)/);
      if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
        const clientId = clientMatch[1].trim();
        const client = clients.find(c => c.id === clientId);
        if (client) return client.name;
      }
    }

    // Try to extract from summary (format: "Event Title with Client Name")
    // Look for patterns like "with Client Name" or "Client Name -"
    const summary = event.summary || '';
    const withMatch = summary.match(/with\s+([^-]+?)(?:\s*-\s|$)/i);
    if (withMatch) {
      return withMatch[1].trim();
    }

    // Fallback: return first part of summary or "Session"
    return summary.split(' - ')[0].split(' with ')[0] || 'Session';
  };

  // Helper to get category color for event
  const getEventCategoryColor = (event: GoogleCalendarEvent): string => {
    // Check if this is a class session
    if (event.isClassSession) {
      if (calendarConfig.classColor) {
        const colorMap: Record<string, string> = {
          'blue': '#3b82f6',
          'purple': '#a855f7',
          'green': '#22c55e',
          'orange': '#f97316',
          'pink': '#ec4899',
        };
        return colorMap[calendarConfig.classColor] || calendarConfig.classColor;
      }
      return '#a855f7'; // Purple for class sessions
    }

    // Check if this is a coaching session (has client ID)
    const hasClient = event.preConfiguredClient || 
      event.description?.includes('client=') ||
      (event as any).extendedProperties?.private?.pcaClientId;
    
    const isCoaching = hasClient || event.isCoachingSession;
    
    // Priority 1: If event has a workout category from a period, use that color
    // BUT: Keep coaching sessions orange unless the category color is explicitly set and different
    if (event.preConfiguredCategory) {
      const category = configWorkoutCategories.find(c => c.name === event.preConfiguredCategory);
      if (category) {
        // Use the category color from the period
        // This allows period events to show their assigned category color
        return category.color;
      }
    }

    // Priority 2: Check if there's a workout category for this date from period
    const eventDate = new Date(event.start.dateTime);
    const categoryInfo = getWorkoutCategoryForDate(eventDate, selectedClient || '');
    if (categoryInfo) {
      return categoryInfo.color;
    }

    // Priority 3: Default colors based on event type
    // Coaching sessions default to orange
    if (isCoaching) {
      // Use configured coaching color if available, otherwise default to orange
      if (calendarConfig.coachingColor) {
        // Map simple color names to hex/tailwind colors if needed, or use as is
        // For simplicity, we'll map the standard colors to their Tailwind hex values
        const colorMap: Record<string, string> = {
          'blue': '#3b82f6',
          'purple': '#a855f7',
          'green': '#22c55e',
          'orange': '#f97316',
          'pink': '#ec4899',
        };
        return colorMap[calendarConfig.coachingColor] || calendarConfig.coachingColor;
      }
      return '#f97316'; // Orange for coaching sessions without category
    }
    
    // Class sessions default to purple
    if (event.isClassSession) {
      if (calendarConfig.classColor) {
        const colorMap: Record<string, string> = {
          'blue': '#3b82f6',
          'purple': '#a855f7',
          'green': '#22c55e',
          'orange': '#f97316',
          'pink': '#ec4899',
        };
        return colorMap[calendarConfig.classColor] || calendarConfig.classColor;
      }
      return '#a855f7';
    }
    
    return '#3b82f6'; // Blue for other events
  };

  // Helper to sort events by time
  const sortEventsByTime = (events: GoogleCalendarEvent[]): GoogleCalendarEvent[] => {
    return [...events].sort((a, b) => {
      const timeA = new Date(a.start.dateTime).getTime();
      const timeB = new Date(b.start.dateTime).getTime();
      return timeA - timeB;
    });
  };

  // Helper to format event time in the app timezone
  const formatEventTimeInAppTimezone = (event: GoogleCalendarEvent): string => {
    // All-day events
    if (event.start?.date) return 'All day';
    if (!event.start?.dateTime) return '';

    const appTimeZone = getAppTimezone();
    const date = new Date(event.start.dateTime);

    try {
      return new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: appTimeZone
      }).format(date);
    } catch {
      // Fallback if the runtime doesn't support the timezone option
      return format(date, 'h:mm a');
    }
  };

  // Helper to find period for a given date
  const findPeriodForDate = (date: Date): ClientProgramPeriod | null => {
    if (!selectedClient) return null;

    const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
    if (!clientProgram) return null;

    return clientProgram.periods.find(period => {
      try {
        // Handle different date formats
        let start: Date;
        let end: Date;

        if (period.startDate instanceof Date) {
          start = period.startDate;
        } else if (period.startDate && typeof period.startDate.toDate === 'function') {
          start = period.startDate.toDate();
        } else if (period.startDate && typeof period.startDate === 'object' && period.startDate.seconds) {
          // Handle Firestore Timestamp object format {seconds: number, nanoseconds: number}
          start = new Date(period.startDate.seconds * 1000);
        } else if (period.startDate && typeof period.startDate === 'string') {
          start = new Date(period.startDate);
        } else {
          console.warn('Unknown startDate format:', period.startDate);
          return false;
        }

        if (period.endDate instanceof Date) {
          end = period.endDate;
        } else if (period.endDate && typeof period.endDate.toDate === 'function') {
          end = period.endDate.toDate();
        } else if (period.endDate && typeof period.endDate === 'object' && period.endDate.seconds) {
          // Handle Firestore Timestamp object format {seconds: number, nanoseconds: number}
          end = new Date(period.endDate.seconds * 1000);
        } else if (period.endDate && typeof period.endDate === 'string') {
          end = new Date(period.endDate);
        } else {
          console.warn('Unknown endDate format:', period.endDate);
          return false;
        }

        const startCopy = new Date(start);
        const endCopy = new Date(end);
        startCopy.setHours(0, 0, 0, 0);
        endCopy.setHours(23, 59, 59, 999);
        return date >= startCopy && date <= endCopy;
      } catch (error) {
        console.error('Error processing period dates:', error, period);
        return false;
      }
    }) || null;
  };

  // Navigate to workout plan view
  const navigateToWorkoutPlanView = (date: Date) => {
    console.log('navigateToWorkoutPlanView called with:', { date, selectedClient });

    if (!selectedClient) {
      console.warn('No client selected');
      alert('Please select a client first');
      return;
    }

    const period = findPeriodForDate(date);
    console.log('Found period:', period);

    if (period) {
      const url = `/programs/${selectedClient}/period/${period.id}`;
      console.log('Navigating to:', url);
      router.push(url);
    } else {
      console.warn('No period found for date:', date);
      alert('No period found for this date. Please assign a period first.');
    }
  };

  // Get actual workout categories and structure templates from configuration store
  const {
    workoutCategories: configWorkoutCategories,
    workoutStructureTemplates,
    businessHours,
    fetchWorkoutCategories,
    fetchWorkoutStructureTemplates
  } = useConfigurationStore();

  // Load workout categories and structure templates on mount
  React.useEffect(() => {
    fetchWorkoutCategories();
    fetchWorkoutStructureTemplates();
  }, [fetchWorkoutCategories, fetchWorkoutStructureTemplates]);


  // Convert workout categories to the format we need
  const workoutCategories = configWorkoutCategories.map(cat => ({
    name: cat.name,
    color: cat.color
  }));

  // Helper function to determine if a category needs a workout assigned
  const categoryNeedsWorkout = (categoryName: string) => {
    const category = configWorkoutCategories.find(cat => cat.name === categoryName);
    if (!category || !category.linkedWorkoutStructureTemplateId) {
      return false;
    }

    // For now, always return true since workout assignment is not implemented yet
    // In the future, this would check if a workout is actually assigned to this day
    return true;
  };

  // Helper function to get the appropriate background color
  const getCategoryBackgroundColor = (categoryName: string, baseColor: string) => {
    if (categoryNeedsWorkout(categoryName)) {
      // Make the color brighter/more saturated to indicate it needs a workout
      return baseColor + 'CC'; // Add opacity to make it brighter
    }
    return baseColor;
  };

  // Category selection handlers
  const handleCategoryClick = (category: string, fromDate: Date, e: React.MouseEvent) => {
    e.stopPropagation();

    // If clicking the same category that's already selected, close it
    if (selectedCategory?.category === category &&
      selectedCategory?.fromDate.toDateString() === fromDate.toDateString()) {
      setSelectedCategory(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.bottom + 5
    };

    setSelectedCategory({
      category,
      fromDate,
      position
    });
  };

  const handleCategoryChange = async (newCategory: string) => {
    console.log('handleCategoryChange called:', { newCategory, selectedCategory, selectedClient });

    if (!selectedCategory) {
      setSelectedCategory(null);
      return;
    }

    // If this is for a calendar event, update the event directly
    if (selectedCategory.eventId) {
      if (newCategory === '__REMOVE__') {
        // Remove category from event
        try {
          await updateEvent(selectedCategory.eventId, {
            preConfiguredCategory: undefined
          });
        } catch (error) {
          console.error('Failed to remove category from event:', error);
        }
      } else {
        // Update event category
        try {
          await updateEvent(selectedCategory.eventId, {
            preConfiguredCategory: newCategory
          });
        } catch (error) {
          console.error('Failed to update event category:', error);
        }
      }
      setSelectedCategory(null);
      return;
    }

    // Otherwise, handle workout category changes (existing logic)
    if (selectedClient) {
      // Handle remove action
      if (newCategory === '__REMOVE__') {
        if (onMoveWorkoutCategory) {
          onMoveWorkoutCategory(selectedCategory.fromDate, selectedCategory.fromDate, '__REMOVE__');
        }
        setSelectedCategory(null);
        return;
      }

      // Find the category info
      console.log('Looking for category:', newCategory, 'Available categories:', workoutCategories.map(c => c.name));
      const categoryInfo = workoutCategories.find(cat => cat.name === newCategory);
      console.log('Category info found:', categoryInfo);

      if (categoryInfo) {
        console.log('Calling onMoveWorkoutCategory with:', { fromDate: selectedCategory.fromDate, toDate: selectedCategory.fromDate, category: newCategory });
        if (selectedCategory.category === '__ADD_NEW__') {
          // This is adding a new one-off event
          if (onMoveWorkoutCategory) {
            onMoveWorkoutCategory(selectedCategory.fromDate, selectedCategory.fromDate, newCategory);
          } else {
            console.error('onMoveWorkoutCategory is not defined!');
          }
        } else {
          // This is changing an existing category
          if (onMoveWorkoutCategory) {
            onMoveWorkoutCategory(selectedCategory.fromDate, selectedCategory.fromDate, newCategory);
          } else {
            console.error('onMoveWorkoutCategory is not defined!');
          }
        }
      } else {
        console.error('Category not found in workoutCategories! Category:', newCategory, 'Available:', workoutCategories.map(c => c.name));
        alert(`ERROR: Category "${newCategory}" not found in workout categories. Available: ${workoutCategories.map(c => c.name).join(', ')}`);
      }
    }
    setSelectedCategory(null);
  };

  const handleAddCategoryClick = (date: Date, e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('handleAddCategoryClick called:', { date: date.toDateString(), selectedClient });

    if (!selectedClient) {
      return;
    }

    // If clicking the same date that's already selected for adding, close it
    if (selectedCategory?.category === '__ADD_NEW__' &&
      selectedCategory?.fromDate.toDateString() === date.toDateString()) {
      setSelectedCategory(null);
      return;
    }

    // Set selected category to trigger the staircase options
    // Use a placeholder category name since we're adding, not changing
    const rect = e.currentTarget.getBoundingClientRect();
    setSelectedCategory({
      category: '__ADD_NEW__', // Special placeholder to indicate we're adding
      fromDate: date,
      position: {
        x: rect.left + rect.width / 2,
        y: rect.top - 10 // Position above the dumbbell button
      }
    });
  };

  const handleDayClick = (targetDate: Date) => {
    if (selectedCategory && onMoveWorkoutCategory && selectedClient) {
      // Only move if it's a different date
      if (selectedCategory.fromDate.toDateString() !== targetDate.toDateString()) {
        onMoveWorkoutCategory(selectedCategory.fromDate, targetDate, selectedCategory.category);
        setSelectedCategory(null); // Clear selection after move
      } else {
        setSelectedCategory(null); // Clear selection
      }
    }
  };


  const formatTime = (date: Date, timeZone?: string) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone || getAppTimezone()
    });
  };

  const getWorkoutsForDate = (date: Date): ScheduledWorkout[] => {
    const targetDate = date.toDateString();
    return scheduledWorkouts.filter(workout => {
      const workoutDate = safeToDate(workout.date).toDateString();
      return workoutDate === targetDate;
    });
  };

  const getClientName = (clientId: string): string => {
    const client = clients.find(c => c.id === clientId);
    return client ? client.name : 'Unknown Client';
  };

  // Helper functions for period assignments
  const getPeriodForDate = (date: Date, clientId: string) => {
    if (!clientId) return null;

    const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
    if (!clientProgram) return null;

    // Use local date string to avoid timezone issues
    const dateStr = date.getFullYear() + '-' +
      String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');

    for (const period of clientProgram.periods) {
      const startDateObj = safeToDate(period.startDate);
      const endDateObj = safeToDate(period.endDate);

      const startDate = startDateObj.getFullYear() + '-' +
        String(startDateObj.getMonth() + 1).padStart(2, '0') + '-' +
        String(startDateObj.getDate()).padStart(2, '0');

      const endDate = endDateObj.getFullYear() + '-' +
        String(endDateObj.getMonth() + 1).padStart(2, '0') + '-' +
        String(endDateObj.getDate()).padStart(2, '0');


      if (dateStr >= startDate && dateStr <= endDate) {
        return period;
      }
    }

    return null;
  };

  const getWorkoutCategoryForDate = (date: Date, clientId: string) => {
    const period = getPeriodForDate(date, clientId);
    if (!period) return null;

    // First, try to find an exact date match
    const exactDateMatch = period.days.find(d => {
      const dayDate = safeToDate(d.date);
      return dayDate.toDateString() === date.toDateString();
    });

    if (exactDateMatch) {
      return {
        category: exactDateMatch.workoutCategory,
        color: exactDateMatch.workoutCategoryColor,
        time: exactDateMatch.time,
        isAllDay: exactDateMatch.isAllDay
      };
    }

    // Only use weekday matching for template-based periods (those with weekTemplateId)
    // For one-off events or manually added days, only exact date matching should be used
    if (period.weekTemplateId) {
      const dayOfWeek = date.getDay();
      const weekdayIndex = (dayOfWeek + 6) % 7;

      const weekdayMatch = period.days.find(d => {
        const dayDate = safeToDate(d.date);
        const dayDayOfWeek = dayDate.getDay();
        const dayWeekdayIndex = (dayDayOfWeek + 6) % 7;
        return dayWeekdayIndex === weekdayIndex;
      });

      return weekdayMatch ? {
        category: weekdayMatch.workoutCategory,
        color: weekdayMatch.workoutCategoryColor,
        time: weekdayMatch.time,
        isAllDay: weekdayMatch.isAllDay
      } : null;
    }

    // No match found for non-template periods
    return null;
  };

  const renderMonthView = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();


    // Get first day of month and calculate calendar grid
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: React.ReactElement[] = [];
    const currentDate = new Date(startDate);

    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      // Create a new date object for this day to avoid mutation issues
      const dayDate = new Date(currentDate);
      const isToday = dayDate.toDateString() === new Date().toDateString();
      const isCurrentMonth = dayDate.getMonth() === month;

      // Determine which workouts to use (State ClientWorkouts or Prop ScheduledWorkouts)
      let dayWorkouts: any[] = [];
      if (selectedClient && filteredWorkouts.length > 0) {
        // Use the fetched ClientWorkouts from state (which have more data like time)
        const targetDateStr = dayDate.toDateString();
        dayWorkouts = filteredWorkouts.filter(w => safeToDate(w.date).toDateString() === targetDateStr);
      } else {
        // Fallback to the passed in scheduledWorkouts (from props)
        dayWorkouts = getWorkoutsForDate(dayDate);
      }

      const period = getPeriodForDate(dayDate, selectedClient || '');
      const workoutCategory = getWorkoutCategoryForDate(dayDate, selectedClient || '');
      const calendarEventsForDay = getCalendarEventsForDate(dayDate);

      // Calculate unified items for this day
      const unifiedItems: { type: 'unified' | 'event' | 'workout', event?: GoogleCalendarEvent, workout?: any, sortTime: number }[] = [];
      const usedWorkoutIds = new Set<string>();

      // 1. Process Events (and try to link workouts)
      calendarEventsForDay.forEach(event => {
        let matchedWorkout: any | undefined;

        // A. Direct Link by ID
        if (event.linkedWorkoutId) {
          matchedWorkout = dayWorkouts.find(w => w.id === event.linkedWorkoutId);
        }

        // B. Heuristic Link (same client, approximate time match or just day match)
        if (!matchedWorkout) {
          // Extract client from event
          const eventClientId = event.preConfiguredClient ||
            (event.description?.match(/\[Metadata:.*client=([^,}]+)/)?.[1]?.trim());

          if (eventClientId) {
            matchedWorkout = dayWorkouts.find(w => w.clientId === eventClientId && !usedWorkoutIds.has(w.id));
          } else if (selectedClient) {
            matchedWorkout = dayWorkouts.find(w => w.clientId === selectedClient && !usedWorkoutIds.has(w.id));
          }
        }

        if (matchedWorkout) {
          usedWorkoutIds.add(matchedWorkout.id);
          unifiedItems.push({
            type: 'unified',
            event,
            workout: matchedWorkout,
            sortTime: new Date(event.start.dateTime).getTime()
          });
        } else {
          unifiedItems.push({
            type: 'event',
            event,
            sortTime: new Date(event.start.dateTime).getTime()
          });
        }
      });

      // 2. Process Remaining Workouts
      dayWorkouts.forEach(workout => {
        if (!usedWorkoutIds.has(workout.id)) {
          let sortTime = 0;
          // Check for time property (exists on ClientWorkout, optional on ScheduledWorkout/ProgramWorkout)
          // Use type checking or safe access
          const wTime = workout.time || (workout as any).startTime;

          if (typeof wTime === 'string' && wTime.includes(':')) {
            const [hours, mins] = wTime.split(':').map(Number);
            const d = new Date(dayDate);
            d.setHours(hours, mins, 0, 0);
            sortTime = d.getTime();
          } else {
            // Default to end of day if no time
            sortTime = dayDate.getTime() + (18 * 60 * 60 * 1000);
          }

          unifiedItems.push({
            type: 'workout',
            workout,
            sortTime
          });
        }
      });

      // Sort items by time
      unifiedItems.sort((a, b) => a.sortTime - b.sortTime);

      const dayElement = (
        <div
          key={dayDate.toISOString()}
          className={`
            min-h-[120px] p-1 border-r border-b border-gray-200
            ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'} 
            ${isToday ? 'bg-blue-50 border-blue-200' : ''}
            ${selectedCategory ? 'hover:bg-green-100 hover:border-green-300' : 'hover:bg-gray-50'} 
            transition-all duration-300 cursor-pointer
            relative
            ${selectedCategory?.fromDate.toDateString() === dayDate.toDateString() ? 'overflow-visible z-50' : 'overflow-hidden'}
          `}
          style={period && period.periodName !== 'Ongoing' ? {
            backgroundColor: period.periodColor + '08',
            boxShadow: `inset 0 0 8px ${period.periodColor}30, inset 0 0 16px ${period.periodColor}15`,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          } : undefined}
          onClick={(e) => {
            // Only navigate if clicking the day cell itself, not on events or other interactive elements
            const target = e.target as HTMLElement;
            const isEvent = target.closest('[data-event-id]') !== null;
            const isColorDot = target.closest('.color-dot') !== null;
            const isInteractive = target.closest('button') !== null ||
              target.closest('a') !== null ||
              target.closest('input') !== null;

            if (!isEvent && !isColorDot && !isInteractive) {
              // Navigate to week view with expanding effect
              if (onDateClick) {
                onDateClick(dayDate, 'week');
              }
            } else {
              // Handle category moving if category is selected
              handleDayClick(dayDate);
            }
          }}
        >
          {/* Day header */}
          <div className="flex items-center justify-between mb-0.5">
            <span 
              className={`text-sm font-medium ${isToday ? 'text-blue-600' : 'text-gray-900'}`}
              suppressHydrationWarning
            >
              {dayDate.getDate()}
            </span>

            {/* Period indicator - hide for one-off events and Quick Workouts "Ongoing" periods */}
            {period && isCurrentMonth &&
              !period.periodName.startsWith('One-off:') &&
              period.periodName !== 'Ongoing' && (
                <div className="flex items-center gap-1">
                  <span
                    className="text-xs font-medium cursor-pointer hover:underline"
                    style={{ color: period.periodColor }}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onPeriodClick) {
                        const rect = e.currentTarget.getBoundingClientRect();
                        onPeriodClick(period, {
                          x: rect.right + 10,
                          y: rect.top
                        });
                      }
                    }}
                  >
                    {period.periodName.replace(' Phase', '')}
                  </span>
                </div>
              )}
          </div>

          {/* UNIFIED ITEMS LIST */}
          {unifiedItems.length > 0 && isCurrentMonth && (
            <div className="space-y-1 mt-1">
              {unifiedItems.map((item, index) => {
                // If UNIFIED (Event + Workout)
                if (item.type === 'unified' && item.event && item.workout) {
                  const { event, workout } = item;
                  const eventDate = new Date(event.start.dateTime);
                  const dateParam = eventDate.toISOString().split('T')[0];
                  const eventIdParam = `&eventId=${event.id}`;
                  const clientParam = `client=${workout.clientId}&`;
                  const categoryColor = getEventCategoryColor(event);
                  const eventTime = formatEventTimeInAppTimezone(event);

                  const workoutTitle = workout.sessionType || workout.categoryName || workout.title || 'Workout';

                  return (
                    <div
                      key={`unified-${event.id}-${workout.id}`}
                      className="flex border rounded overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow group text-[10px]"
                    >
                      {/* LEFT: Event Side */}
                      <div
                        className="flex-1 p-1 bg-gray-50 hover:bg-gray-100 cursor-pointer flex items-center gap-1 border-r border-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}${eventIdParam}`;
                          router.push(buildWorkoutUrl);
                        }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: categoryColor }} />
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-gray-700 truncate leading-tight">
                            {event.summary}
                          </span>
                          <span className="text-gray-500 text-[9px] leading-tight">
                            {eventTime}
                          </span>
                        </div>
                      </div>

                      {/* RIGHT: Workout Side */}
                      <div
                        className="flex-1 p-1 bg-teal-50 hover:bg-teal-100 cursor-pointer flex items-center justify-between gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}${eventIdParam}&workoutId=${workout.id}`;
                          router.push(buildWorkoutUrl);
                        }}
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium text-teal-800 truncate leading-tight">
                            {workoutTitle}
                          </span>
                          <span className="text-teal-600 text-[9px] leading-tight">
                            View Plan →
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }

                // If EVENT ONLY
                if (item.type === 'event' && item.event) {
                  const { event } = item;
                  const eventDate = new Date(event.start.dateTime);
                  const dateParam = eventDate.toISOString().split('T')[0];
                  const eventIdParam = `&eventId=${event.id}`;
                  const clientName = getClientNameFromEvent(event);
                  const categoryColor = getEventCategoryColor(event);
                  const eventTime = formatEventTimeInAppTimezone(event);

                  const eventClientId = event.preConfiguredClient ||
                    (event.description?.match(/\[Metadata:.*client=([^,}]+)/)?.[1]?.trim());
                  const clientToUse = eventClientId && eventClientId !== 'none' ? eventClientId : selectedClient;
                  const clientParam = clientToUse ? `client=${clientToUse}&` : '';

                  return (
                    <div
                      key={`event-${event.id}`}
                      data-event-id={event.id}
                      className="flex items-center gap-1 text-[10px] bg-white border border-l-4 hover:bg-gray-50 rounded px-1 py-0.5 cursor-pointer shadow-sm"
                      style={{ borderLeftColor: categoryColor }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `/workouts/builder?${clientParam}date=${dateParam}${eventIdParam}`;
                        router.push(url);
                      }}
                    >
                      <span className="flex-1 truncate font-medium text-gray-700">
                        {clientName}
                      </span>
                      <span className="text-gray-500 text-[9px]">
                        {eventTime}
                      </span>
                      <span title="No Linked Workout" className="text-gray-300">○</span>
                    </div>
                  );
                }

                // If WORKOUT ONLY
                if (item.type === 'workout' && item.workout) {
                  const { workout } = item;
                  const dateParam = dayDate.toISOString().split('T')[0];
                  const clientParam = `client=${workout.clientId}&`;
                  const workoutTitle = workout.sessionType || workout.categoryName || workout.title || 'Workout';

                  return (
                    <div
                      key={`workout-${workout.id}`}
                      className="flex items-center justify-between text-[10px] bg-teal-50 border border-teal-100 hover:bg-teal-100 rounded px-1 py-0.5 cursor-pointer shadow-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        const url = `/workouts/builder?${clientParam}date=${dateParam}&workoutId=${workout.id}`;
                        router.push(url);
                      }}
                    >
                      <div className="flex items-center gap-1 min-w-0">
                        <Dumbbell className="h-3 w-3 text-teal-600 flex-shrink-0" />
                        <span className="font-medium text-teal-800 truncate">
                          {getClientName(workout.clientId)}
                        </span>
                      </div>
                      <span className="text-teal-600 font-medium whitespace-nowrap ml-1">
                        {workoutTitle}
                      </span>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          )}

          {/* Workout category block - show when no items but category exists */}
          {workoutCategory && isCurrentMonth && unifiedItems.length === 0 && (
            <div className="relative">
              <div
                className={`text-xs px-2 py-1 rounded text-white font-medium mb-0.5 cursor-pointer hover:opacity-80 transition-opacity ${selectedCategory?.category === workoutCategory.category &&
                  selectedCategory?.fromDate.toDateString() === dayDate.toDateString()
                  ? 'ring-2 ring-blue-500 ring-offset-1'
                  : ''
                  }`}
                style={{ backgroundColor: getCategoryBackgroundColor(workoutCategory.category, workoutCategory.color) }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategoryClick(workoutCategory.category, dayDate, e);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  navigateToWorkoutPlanView(dayDate);
                }}
                title="Double-click to view workout plan"
              >
                <div className="flex items-center justify-between">
                  <span>{workoutCategory.category}</span>
                </div>
                <div
                  className="opacity-75 text-[10px] mt-0.5 cursor-pointer hover:opacity-100 underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    const clientId = selectedClient;
                    const dateParam = dayDate.toISOString().split('T')[0];
                    window.location.href = `/workouts/builder?client=${clientId}&date=${dateParam}`;
                  }}
                  title="Click to build workout"
                >
                  Build Workout
                </div>
                {workoutCategory.time && (
                  <div className="opacity-90 text-xs">
                    {formatTime(new Date(`2000-01-01T${workoutCategory.time}`))}
                  </div>
                )}
              </div>
            </div>
          )}


          {/* Diagonal staircase options - show for existing category changes, events, OR when adding new */}
          {(() => {
            if (!selectedCategory || selectedCategory.fromDate.toDateString() !== dayDate.toDateString()) {
              return false;
            }

            // If eventId is specified, check if this event is on this day
            if (selectedCategory.eventId) {
              const eventOnThisDay = calendarEventsForDay.find(e => e.id === selectedCategory.eventId);
              return !!eventOnThisDay;
            }

            // Check if it matches workout category
            if (selectedCategory.category === workoutCategory?.category) {
              return true;
            }

            // Check if it matches any event's category on this day
            const eventMatches = calendarEventsForDay.some(event => {
              const eventCategory = event.preConfiguredCategory ||
                (workoutCategory ? workoutCategory.category : null);
              return selectedCategory.category === eventCategory;
            });

            // Show if it's for adding new or matches an event
            return selectedCategory.category === '__ADD_NEW__' || eventMatches;
          })() && (
              <div className="absolute top-3 left-12 z-50">
                {(() => {
                  // Create a compact list of options without gaps
                  const allOptions = [];

                  // Get current category (from workout category or event category)
                  let currentCategory = workoutCategory?.category;

                  // If eventId is specified, get category from that specific event
                  if (selectedCategory?.eventId) {
                    const event = calendarEventsForDay.find(e => e.id === selectedCategory.eventId);
                    if (event) {
                      currentCategory = event.preConfiguredCategory || workoutCategory?.category;
                    }
                  } else if (calendarEventsForDay.length > 0 && selectedCategory?.category !== '__ADD_NEW__') {
                    currentCategory = selectedCategory?.category;
                  }

                  // Add all categories except the current one
                  workoutCategories.forEach(category => {
                    if (category.name !== currentCategory) {
                      allOptions.push({
                        type: 'category',
                        name: category.name,
                        color: category.color
                      });
                    }
                  });

                  // Add remove option for existing categories (not when adding new events)
                  let isExistingCategory = false;

                  if (selectedCategory?.eventId) {
                    // For events, show remove if event has a category
                    const event = calendarEventsForDay.find(e => e.id === selectedCategory.eventId);
                    isExistingCategory = !!(event?.preConfiguredCategory);
                  } else {
                    // For workout categories
                    isExistingCategory = selectedCategory?.category !== '__ADD_NEW__' &&
                      !!(workoutCategory || (calendarEventsForDay.length > 0 && selectedCategory?.category));
                  }

                  if (isExistingCategory) {
                    allOptions.push({
                      type: 'remove',
                      name: 'Remove',
                      color: '#ef4444'
                    });
                  }

                  return allOptions.map((option, index) => {
                    // Compact staircase pattern - smaller spacing
                    const x = 5 + (index * 12); // Reduced horizontal spacing
                    const y = 5 + (index * 18); // Reduced vertical spacing

                    return (
                      <button
                        key={option.name}
                        className="absolute text-xs px-3 py-2 rounded-lg text-white font-medium shadow-lg hover:scale-110 hover:-translate-y-1 hover:shadow-xl transition-all duration-200 z-50"
                        style={{
                          backgroundColor: option.color,
                          left: x,
                          top: y,
                          transform: 'translate(0, 0)',
                          animation: `fadeIn 0.15s ease-out ${index * 0.03}s forwards`,
                          minWidth: '75px',
                          maxWidth: '90px'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (option.type === 'remove') {
                            handleCategoryChange('__REMOVE__');
                          } else {
                            handleCategoryChange(option.name);
                          }
                        }}
                      >
                        {option.name}
                      </button>
                    );
                  });
                })()}
              </div>
            )}

          {/* Add workout button - show when no period or when period is "Ongoing" (Quick Workouts) */}
          {isCurrentMonth && selectedClient && (!period || period.periodName === 'Ongoing') && (
            <div className="absolute top-1 right-1">
              <ScheduleWorkoutDialog
                date={currentDate}
                clientId={selectedClient}
                programs={programs}
                trigger={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-teal-100"
                    title="Schedule workout"
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                }
                onSchedule={() => {
                  // Refresh or update state as needed
                }}
              />
            </div>
          )}
        </div>
      );

      days.push(dayElement);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 icon-schedule" />
            {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-2 text-center text-sm font-medium text-gray-500 bg-gray-50 border-b border-gray-200">
                {day}
              </div>
            ))}
            {/* Calendar days */}
            {days}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWeekView = () => {
    // Get week start (Sunday)
    const weekStart = new Date(calendarDate);
    weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
    weekStart.setHours(0, 0, 0, 0); // Normalize to midnight

    const weekDays: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      day.setHours(0, 0, 0, 0); // Normalize each day to midnight
      weekDays.push(day);
    }

    // Helper to format time slot hour (for display)
    // The hour is already in app timezone, so we just format it
    const formatTimeSlotInAppTimezone = (hour: number): string => {
      if (hour === 0) return '12 AM';
      if (hour < 12) return `${hour} AM`;
      if (hour === 12) return '12 PM';
      return `${hour - 12} PM`;
    };

    // Helper to format event time in app timezone
    // Properly handles the event's original timezone
    const formatEventTimeInAppTimezone = (event: GoogleCalendarEvent): string => {
      const eventStart = new Date(event.start.dateTime);
      // Convert to app timezone for display
      return eventStart.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: getAppTimezone()
      });
    };

    // Helper to format time in app timezone (for non-event dates)
    const formatTimeInAppTimezone = (date: Date): string => {
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: getAppTimezone()
      });
    };

    // Helper to get hour in app timezone from a Date object
    const getHourInAppTimezone = (date: Date): number => {
      const formatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        hour12: false,
        timeZone: getAppTimezone()
      });
      const parts = formatter.formatToParts(date);
      return parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    };

    // Helper to parse event dateTime and get hour in app timezone
    // This properly handles the event's original timezone
    const getEventHourInAppTimezone = (event: GoogleCalendarEvent): number => {
      const eventStart = new Date(event.start.dateTime);
      // The dateTime is already in UTC or includes timezone info, so we can directly convert to app timezone
      return getHourInAppTimezone(eventStart);
    };

    // Generate time slots based on business hours - find min/max across all selected days
    let minHour = 24;
    let maxHour = 0;
    
    if (businessHours?.daysOfWeek && businessHours.daysOfWeek.length > 0) {
      businessHours.daysOfWeek.forEach(dayIndex => {
        const dayHour = businessHours.dayHours?.[dayIndex];
        if (dayHour) {
          minHour = Math.min(minHour, dayHour.startHour);
          maxHour = Math.max(maxHour, dayHour.endHour);
        }
      });
    }
    
    // Fallback to defaults if no valid hours
    if (minHour === 24 || maxHour === 0) {
      minHour = 7;
      maxHour = 20;
    }
    
    const timeSlotHours: number[] = [];
    for (let hour = minHour; hour < maxHour; hour++) {
      timeSlotHours.push(hour);
    }

    const getWorkoutsForTimeSlot = (date: Date, slotHour: number): ScheduledWorkout[] => {
      const appTimezone = getAppTimezone();
      const targetDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: appTimezone
      });

      return scheduledWorkouts.filter(workout => {
        const workoutDate = safeToDate(workout.date);
        const workoutDateStr = workoutDate.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          timeZone: appTimezone
        });
        const workoutHour = getHourInAppTimezone(workoutDate);
        return workoutDateStr === targetDate && workoutHour === slotHour;
      });
    };

    // Helper to get calendar events for a time slot
    const getCalendarEventsForTimeSlot = (date: Date, slotHour: number): GoogleCalendarEvent[] => {
      const appTimezone = getAppTimezone();
      const targetDate = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: appTimezone
      });

      return calendarEvents.filter(event => {
        try {
          // Parse the event dateTime - handle both ISO string and Date object
          const eventStart = new Date(event.start.dateTime);

          // Check if event is on the same date (in app timezone)
          const eventDateStr = eventStart.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: '2-digit', 
            day: '2-digit',
            timeZone: event.start.timeZone || appTimezone
          });
          if (eventDateStr !== targetDate) {
            return false;
          }

          // Check if event hour matches the slot hour (in app timezone)
          // Events at 10:00, 10:15, 10:30, etc. all show in 10:00 slot
          const eventHour = getEventHourInAppTimezone(event);
          if (eventHour !== slotHour) {
            return false;
          }

          const eventClientId = getEventClientId(event);

          // If a client is selected, show only events for that client
          if (selectedClient) {
            // When a client is selected, show ONLY events that belong to that client
            // Events without client metadata should be hidden
            if (!eventClientId) {
              // Event has no client - hide it when a client is selected
            return false;
            }
            // Compare as strings to ensure exact match
            return String(eventClientId).trim() === String(selectedClient).trim();
          }

          // "All Clients" selected - show only coach's personal events (events NOT linked to any client)
          return eventClientId === null;
        } catch (error) {
          console.warn('Error parsing event dateTime:', event.start.dateTime, error);
          return false;
        }
      });
    };

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 icon-schedule" />
            Week of {weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Day headers */}
              <div className="grid grid-cols-8 border-b bg-gray-50">
                <div className="p-2 text-center text-sm font-medium text-gray-500 border-r">
                  Time
                </div>
                {weekDays.map((date) => {
                  // Normalize today's date to midnight for accurate comparison
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const normalizedDate = new Date(date);
                  normalizedDate.setHours(0, 0, 0, 0);
                  const isToday = normalizedDate.toDateString() === today.toDateString();
                  const period = getPeriodForDate(date, selectedClient || '');
                  const workoutCategory = getWorkoutCategoryForDate(date, selectedClient || '');

                  return (
                    <div
                      key={date.toISOString()}
                      className="p-2 text-center border-r cursor-pointer hover:bg-gray-100 transition-colors"
                      onClick={() => {
                        if (onDateClick) {
                          onDateClick(date, 'day');
                        }
                      }}
                    >
                      <div 
                        className={`${isToday ? 'text-blue-600 font-bold' : 'text-gray-900'}`}
                        suppressHydrationWarning
                      >
                        {date.toLocaleDateString('en-US', { weekday: 'short' })}
                      </div>
                      <div 
                        className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}
                        suppressHydrationWarning
                      >
                        {date.getDate()}
                      </div>

                      {/* Period indicator */}
                      {period && period.periodName !== 'Ongoing' && (
                        <div className="mt-1">
                          <div
                            className="text-xs font-medium"
                            style={{ color: period.periodColor }}
                          >
                            {period.periodName.replace(' Phase', '')}
                          </div>
                        </div>
                      )}

                      {/* All-day events */}
                      {workoutCategory && workoutCategory.isAllDay && (
                        <div
                          className="text-xs px-2 py-1 rounded text-white mt-1"
                          style={{ backgroundColor: getCategoryBackgroundColor(workoutCategory.category, workoutCategory.color) }}
                        >
                          {workoutCategory.category}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Time slots */}
              <div className="max-h-[600px] overflow-y-auto">
                {timeSlotHours.map((slotHour, index) => (
                  <div key={index} className="grid grid-cols-8 border-b hover:bg-gray-50">
                    {/* Time column */}
                    <div className="p-2 text-sm text-gray-500 border-r text-right bg-gray-50">
                      {formatTimeSlotInAppTimezone(slotHour)}
                    </div>

                    {/* Day columns */}
                    {weekDays.map((date) => {
                      const workouts = getWorkoutsForTimeSlot(date, slotHour);
                      const calendarEventsForSlot = getCalendarEventsForTimeSlot(date, slotHour);
                      // Normalize today's date to midnight for accurate comparison
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const normalizedDate = new Date(date);
                      normalizedDate.setHours(0, 0, 0, 0);
                      const isToday = normalizedDate.toDateString() === today.toDateString();
                      const period = getPeriodForDate(date, selectedClient || '');
                      const workoutCategory = getWorkoutCategoryForDate(date, selectedClient || '');

                      // Check if this time slot should show the workout category
                      const timeSlotFormatted = `${String(slotHour).padStart(2, '0')}:00`;
                      const workoutTimeFormatted = workoutCategory?.time;
                      const timeSlotPadded = timeSlotFormatted;

                      const shouldShowWorkoutCategory = workoutCategory && !workoutCategory.isAllDay &&
                        workoutCategory.time &&
                        timeSlotPadded === workoutTimeFormatted &&
                        calendarEventsForSlot.length === 0 &&
                        filteredWorkouts.length === 0;

                      return (
                        <div
                          key={date.toISOString()}
                          className="min-h-[60px] border-r p-2 cursor-pointer transition-colors"
                          onClick={() => {
                            if (onWeekCellClick) {
                              const timeSlot = new Date(date);
                              timeSlot.setHours(slotHour, 0, 0, 0);
                              onWeekCellClick(date, timeSlot, period || undefined);
                            }
                          }}
                        >
                          {/* Show calendar events first (they take priority) */}
                          {calendarEventsForSlot.length > 0 ? (
                            <div className="space-y-1">
                              {sortEventsByTime(calendarEventsForSlot).map((event) => {
                                const eventDate = new Date(event.start.dateTime);
                                const dateParam = eventDate.toISOString().split('T')[0];
                                const eventIdParam = `&eventId=${event.id}`;
                                const clientParam = selectedClient ? `client=${selectedClient}&` : '';
                                const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}${eventIdParam}`;
                                const clientName = getClientNameFromEvent(event);
                                const categoryColor = getEventCategoryColor(event);
                                const eventTime = formatEventTimeInAppTimezone(event);

                                return (
                                  <div
                                    key={event.id}
                                    className="text-xs px-2 py-1 rounded text-white font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: categoryColor }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (event.linkedWorkoutId) {
                                        const workoutUrl = `/workouts/builder?${clientParam}date=${dateParam}&workoutId=${event.linkedWorkoutId}`;
                                        router.push(workoutUrl);
                                      } else if (event.isCoachingSession && selectedClient) {
                                        router.push(buildWorkoutUrl);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="truncate flex-1">{clientName}</span>
                                      <div className="flex items-center gap-0.5 flex-shrink-0">
                                        {event.isCoachingSession && <span title="Coaching Session">🏋️</span>}
                                        {event.linkedWorkoutId && <span title="Linked to Workout">✓</span>}
                                      </div>
                                    </div>
                                    <div className="text-[9px] opacity-90 mt-0.5">
                                      {eventTime}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : workouts.length > 0 ? (
                            <div className="space-y-1">
                              {workouts.map((workout) => {
                                // Get category color for this workout's date
                                const workoutDate = safeToDate(workout.date);
                                const workoutCategoryInfo = getWorkoutCategoryForDate(workoutDate, selectedClient || '');
                                const categoryColor = workoutCategoryInfo
                                  ? getCategoryBackgroundColor(workoutCategoryInfo.category, workoutCategoryInfo.color)
                                  : '#3b82f6'; // Default blue if no category

                                // workout.time is stored as "HH:MM" in Pacific timezone
                                const workoutTime = (workout.time || (workout as any).startTime) ? (() => {
                                  const timeStr = workout.time || (workout as any).startTime;
                                  const [hours, minutes] = timeStr.split(':').map(Number);
                                  const mins = String(minutes || 0).padStart(2, '0');
                                  if (hours === 0) return `12:${mins} AM`;
                                  if (hours < 12) return `${hours}:${mins} AM`;
                                  if (hours === 12) return `12:${mins} PM`;
                                  return `${hours - 12}:${mins} PM`;
                                })() : '';

                                return (
                                  <div
                                    key={workout.id}
                                    className="text-xs px-2 py-1 rounded text-white font-medium cursor-pointer hover:opacity-80 transition-opacity"
                                    style={{ backgroundColor: categoryColor }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Normalize to local midnight to avoid timezone issues
                                      const normalizedDate = new Date(workoutDate);
                                      normalizedDate.setHours(0, 0, 0, 0);
                                      // Format as YYYY-MM-DD in local timezone to avoid UTC conversion issues
                                      const year = normalizedDate.getFullYear();
                                      const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
                                      const day = String(normalizedDate.getDate()).padStart(2, '0');
                                      const dateParam = `${year}-${month}-${day}`;
                                      const clientParam = selectedClient ? `client=${selectedClient}&` : '';
                                      const workoutUrl = `/workouts/builder?${clientParam}date=${dateParam}&workoutId=${workout.id}`;
                                      router.push(workoutUrl);
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-1">
                                      <span className="truncate flex-1">{workout.sessionType}</span>
                                    </div>
                                    <div className="text-[9px] opacity-90 mt-0.5">
                                      {workoutTime}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : shouldShowWorkoutCategory ? (
                            <div className="text-xs px-2 py-1 rounded text-white font-medium"
                              style={{ backgroundColor: getCategoryBackgroundColor(workoutCategory.category, workoutCategory.color) }}
                            >
                              {workoutCategory.category}
                            </div>
                          ) : (
                            <div className="text-xs text-gray-400 text-center py-2">
                              Available
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDayView = () => {
    // Filter workouts for the selected date from allWorkouts
    const workouts = filteredWorkouts.filter(w => {
      const workoutDate = safeToDate(w.date);
      return workoutDate.toDateString() === calendarDate.toDateString();
    });
    const isToday = calendarDate.toDateString() === new Date().toDateString();
    const period = getPeriodForDate(calendarDate, selectedClient || '');
    const workoutCategory = getWorkoutCategoryForDate(calendarDate, selectedClient || '');

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 icon-schedule" />
              {calendarDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric'
              })}
              {isToday && <Badge variant="default">Today</Badge>}
              {period && period.periodName !== 'Ongoing' && (
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: period.periodColor + '20',
                    borderColor: period.periodColor,
                    color: period.periodColor
                  }}
                >
                  {period.periodName.replace(' Phase', '')}
                </Badge>
              )}
              {workoutCategory && (
                <Badge
                  variant="outline"
                  style={{
                    backgroundColor: workoutCategory.color + '20',
                    borderColor: workoutCategory.color,
                    color: workoutCategory.color
                  }}
                >
                  {workoutCategory.category}
                  {workoutCategory.time && (
                    <span className="ml-2">
                      • {formatTime(new Date(`2000-01-01T${workoutCategory.time}`))}
                    </span>
                  )}
                </Badge>
              )}
            </div>
            {selectedClient && (
              <ScheduleWorkoutDialog
                date={calendarDate}
                clientId={selectedClient}
                programs={programs}
                trigger={
                  <Button>
                    <Plus className="h-4 w-4 mr-1.5 icon-add" />
                    Schedule Workout
                  </Button>
                }
              />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12">
          {filteredWorkouts.length === 0 ? (
            <div className="text-center">
              <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No workouts scheduled</h3>
              <p className="text-gray-500 mb-4">
                {selectedClient
                  ? "Schedule a workout for this day to get started."
                  : "Select a client to view and schedule workouts."
                }
              </p>

              {/* Show period information if available */}
              {period && period.periodName !== 'Ongoing' && (
                <div className="mb-6 p-4 rounded-lg border" style={{
                  backgroundColor: period.periodColor + '10',
                  borderColor: period.periodColor + '30'
                }}>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: period.periodColor }}
                    />
                    {period.periodName !== 'Ongoing' && (
                      <span className="font-medium" style={{ color: period.periodColor }}>
                        {period.periodName.replace(' Phase', '')}
                      </span>
                    )}
                  </div>
                  {workoutCategory && (
                    <div className="text-sm text-gray-600">
                      Assigned: <span style={{ color: workoutCategory.color, fontWeight: '500' }}>
                        {workoutCategory.category}
                      </span>
                      {workoutCategory.time && (
                        <span className="ml-2">
                          • {formatTime(new Date(`2000-01-01T${workoutCategory.time}`))}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {selectedClient && (
                <ScheduleWorkoutDialog
                  date={calendarDate}
                  clientId={selectedClient}
                  programs={programs}
                  trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-1.5 icon-add" />
                      Schedule Workout
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredWorkouts.map((workout) => (
                <div key={workout.id} className="p-4 border rounded-lg bg-teal-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{getClientName(workout.clientId)}</h4>
                      <p className="text-sm text-gray-600">{workout.title || workout.categoryName || 'Workout'}</p>
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatTime(safeToDate(workout.date))}
                      {typeof (workout as any).duration === 'number' ? ` • ${(workout as any).duration}min` : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Only render week view - month and day views are removed
  if (viewMode !== 'week') {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          Week view is the only supported view mode.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="relative">
      <TwoColumnWeekView
        calendarDate={calendarDate}
        calendarEvents={calendarEvents}
        workouts={filteredWorkouts}
        selectedClient={selectedClient}
        clients={clients}
        clientPrograms={clientPrograms}
        includeWeekends={includeWeekends}
        onDateClick={(date) => {
          // Navigate to that week
          if (onDateClick) {
            onDateClick(date, 'week');
          }
        }}
        onScheduleCellClick={onScheduleCellClick || onWeekCellClick}
        onWorkoutCellClick={onWorkoutCellClick || ((date, timeSlot, period) => {
          // When clicking empty workout cell, navigate to builder
          const dateParam = format(date, 'yyyy-MM-dd');
          const clientParam = selectedClient ? `client=${selectedClient}&` : '';
          const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}`;
          router.push(buildWorkoutUrl);
        })}
        onEventClick={(event) => {
          // If onEventClick prop is provided, use it (for dialog)
          if (onEventClick) {
            onEventClick(event);
            return;
          }

          // Fallback: Always try to open scheduling manager first if onScheduleCellClick is provided
          if (onScheduleCellClick && selectedClient) {
            const eventDate = new Date(event.start.dateTime);
            const eventTime = new Date(event.start.dateTime);

            // Find the period for this event's date
            const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClient);
            if (clientProgram) {
              const period = clientProgram.periods.find(p => {
                const periodStart = safeToDate(p.startDate);
                const periodEnd = safeToDate(p.endDate);
                return eventDate >= periodStart && eventDate <= periodEnd;
              });

              if (period) {
                // Open scheduling manager with this period
                onScheduleCellClick(eventDate, eventTime, period);
                return;
              }
            }
          }

          // Fallback: navigate to builder if event has linked workout
          const eventDate = new Date(event.start.dateTime);
          const dateParam = eventDate.toISOString().split('T')[0];
          
          // Get client ID from event first, fall back to selectedClient
          const eventClientId = getEventClientId(event);
          const clientIdToUse = eventClientId || selectedClient;
          const clientParam = clientIdToUse ? `client=${clientIdToUse}&` : '';

          if (event.linkedWorkoutId) {
            const workoutUrl = `/workouts/builder?${clientParam}date=${dateParam}&workoutId=${event.linkedWorkoutId}`;
            router.push(workoutUrl);
          } else if (event.isCoachingSession && clientIdToUse) {
            const eventIdParam = `&eventId=${event.id}`;
            const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}${eventIdParam}`;
            router.push(buildWorkoutUrl);
          }
        }}
        onWorkoutClick={(workout) => {
          const workoutDate = safeToDate(workout.date);
          const dateParam = workoutDate.toISOString().split('T')[0];
          // Prefer the workout's clientId so the builder preselects the correct client,
          // even when "All Clients" is selected in the calendar filter.
          const clientIdToUse = workout.clientId || selectedClient;
          const clientParam = clientIdToUse ? `client=${clientIdToUse}&` : '';
          const workoutUrl = `/workouts/builder?${clientParam}date=${dateParam}&workoutId=${workout.id}`;
          router.push(workoutUrl);
        }}
      />

      {/* Backdrop to close popup */}
      {selectedCategory && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setSelectedCategory(null)}
        />
      )}

      {/* Quick Workout Creation Dialog */}
      <QuickWorkoutCreationDialog
        open={quickWorkoutDialogOpen}
        onOpenChange={setQuickWorkoutDialogOpen}
        event={selectedEventForWorkout}
        onCreateWorkout={(clientId, workoutStructureId, eventId) => {
          // This will be handled by the dialog itself - it navigates to the builder
          console.log('Creating workout:', { clientId, workoutStructureId, eventId });
        }}
      />
    </div>
  );
}
