"use client";

import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { Client, ClientProgram, ClientProgramPeriod, ClientWorkout } from '@/lib/types';
import { format } from 'date-fns';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { getAppTimezone } from '@/lib/utils/timezone';

// Helper to get a valid IANA timezone, falling back to app timezone if invalid
// Google Calendar sometimes returns formats like "GMT-08:00" which aren't valid IANA names
function getValidTimezone(tz: string | undefined, fallback: string): string {
  if (!tz) return fallback;
  
  // Check if it's a GMT offset format (not valid for toLocaleDateString)
  if (tz.startsWith('GMT') || tz.startsWith('UTC') || /^[+-]\d{2}:\d{2}$/.test(tz)) {
    return fallback;
  }
  
  // Try to use the timezone - if it fails, return fallback
  try {
    new Date().toLocaleDateString('en-US', { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

interface TwoColumnWeekViewProps {
  calendarDate: Date;
  calendarEvents: GoogleCalendarEvent[];
  workouts: ClientWorkout[];
  selectedClient: string | null;
  clients: Client[];
  clientPrograms: ClientProgram[];
  includeWeekends?: boolean;
  onDateClick?: (date: Date) => void;
  onScheduleCellClick?: (date: Date, timeSlot: Date, period?: ClientProgramPeriod) => void;
  onWorkoutCellClick?: (date: Date, timeSlot: Date, period?: ClientProgramPeriod) => void;
  onEventClick?: (event: GoogleCalendarEvent) => void;
  onWorkoutClick?: (workout: ClientWorkout) => void;
}

// Helper to get client ID from event - defined outside component to avoid minification issues
function getEventClientId(event: GoogleCalendarEvent): string | null {
  // Check preConfiguredClient first (highest priority)
  if (event.preConfiguredClient) {
    return event.preConfiguredClient;
  }
  
  // Check extended properties (from Google Calendar API)
  if ((event as any).extendedProperties?.private?.pcaClientId) {
    return (event as any).extendedProperties.private.pcaClientId;
  }
  
  // Check description metadata - try multiple patterns
  if (event.description) {
    // Pattern 1: [Metadata: ... client=...]
    let clientMatch = event.description.match(/\[Metadata:.*client=([^,\s}\]]+)/);
    if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
      return clientMatch[1].trim();
    }
    
    // Pattern 2: client=... (without Metadata wrapper)
    clientMatch = event.description.match(/client=([^,\s\n]+)/);
    if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
      return clientMatch[1].trim();
    }
  }
  
  return null;
}

// Helper to detect if an event is an all-day event - defined outside component to avoid minification issues
function isAllDayEvent(event: GoogleCalendarEvent): boolean {
  // Check if event uses date instead of dateTime (Google Calendar all-day format)
  if (event.start.date && !event.start.dateTime) {
    return true;
  }
  // Check if start and end times are the same (broken all-day event)
  if (event.start.dateTime && event.end?.dateTime) {
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    if (start.getTime() === end.getTime()) {
      return true;
    }
    // Also check for events spanning more than 12 hours (likely all-day or multi-day)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
    if (durationHours >= 12) {
      return true;
    }
  }
  return false;
}

// Memoize the component to prevent re-rendering the structure when only data changes
export const TwoColumnWeekView = React.memo(function TwoColumnWeekView({
  calendarDate,
  calendarEvents: allCalendarEvents,
  workouts,
  selectedClient,
  clients,
  clientPrograms,
  includeWeekends = false,
  onDateClick,
  onScheduleCellClick,
  onWorkoutCellClick,
  onEventClick,
  onWorkoutClick
}: TwoColumnWeekViewProps) {
  // All hooks must be called first, in the same order every render
  const { workoutCategories: configWorkoutCategories, businessHours } = useConfigurationStore();
  const { config: calendarConfig } = useCalendarStore();
  const router = useRouter();
  const [allDayCollapsed, setAllDayCollapsed] = useState(true);
  const [mounted, setMounted] = useState(false);
  
  // Get app timezone (defaults to Pacific)
  const appTimezone = getAppTimezone();

  // Filter events by client - use length to detect changes, access array from closure
  // This prevents infinite loops from array reference changes
  const calendarEvents = React.useMemo(() => {
    if (!selectedClient) {
      // "All Clients" - show ALL events so coach can see their full schedule
      return allCalendarEvents;
    } else {
      // Specific client selected - show only events for that client
      return allCalendarEvents.filter(event => {
        const eventClientId = getEventClientId(event);
        if (!eventClientId) return false; // Hide events without client metadata
        return String(eventClientId).trim() === String(selectedClient).trim();
      });
    }
    // Use length instead of array reference to prevent infinite loops
  }, [allCalendarEvents.length, selectedClient]);
  
  // Track when component is mounted to avoid hydration mismatch with dates
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Separate all-day events from timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: GoogleCalendarEvent[] = [];
    const timed: GoogleCalendarEvent[] = [];
    
    calendarEvents.forEach(event => {
      if (isAllDayEvent(event)) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });
    
    return { allDayEvents: allDay, timedEvents: timed };
  }, [calendarEvents]);
  
  const dayColumnsRef = useRef<HTMLDivElement>(null);

  // Helper to safely convert dates
  const safeToDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
    if (dateValue.seconds !== undefined) return new Date(dateValue.seconds * 1000);
    if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
  };

  // Memoize week calculation to prevent unnecessary recalculations
  // Use getTime() for stable comparison to prevent infinite loops
  const calendarDateTimestamp = calendarDate ? (() => {
    const normalized = new Date(calendarDate);
    normalized.setHours(0, 0, 0, 0);
    return normalized.getTime();
  })() : 0;
  
  const { weekStart, weekDays } = useMemo(() => {
    // Use UTC-based calculation to avoid timezone issues between server and client
    // Extract year, month, day from calendarDate to create a consistent local date
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const date = calendarDate.getDate();
    
    // Create a new date from components (this will be consistent)
    const normalizedCalendarDate = new Date(year, month, date, 12, 0, 0, 0);
    
    const start = new Date(normalizedCalendarDate);
    start.setDate(normalizedCalendarDate.getDate() - normalizedCalendarDate.getDay());
    start.setHours(12, 0, 0, 0); // Use noon to avoid DST edge cases
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      day.setHours(12, 0, 0, 0); // Use noon to avoid DST edge cases
      const dayOfWeek = day.getDay();
      
      // Filter out weekends if includeWeekends is false
      // When includeWeekends is true, include ALL days (0-6)
      // When includeWeekends is false, exclude Sunday (0) and Saturday (6)
      if (includeWeekends || (dayOfWeek !== 0 && dayOfWeek !== 6)) {
        days.push(day);
      }
    }
    
    return { weekStart: start, weekDays: days };
  }, [calendarDateTimestamp, includeWeekends]); // Use stable timestamp instead of Date object
  
  // Ensure weekDays is properly populated
  React.useEffect(() => {
    if (includeWeekends && weekDays.length !== 7) {
      console.warn('WeekDays count mismatch when weekends included:', {
        includeWeekends,
        weekDaysCount: weekDays.length,
        expected: 7,
        days: weekDays.map(d => ({
          date: d.toISOString().split('T')[0],
          dayName: d.toLocaleDateString('en-US', { weekday: 'long' }),
          dayOfWeek: d.getDay()
        }))
      });
    }
    if (!includeWeekends && weekDays.length !== 5) {
      console.warn('WeekDays count mismatch when weekends excluded:', {
        includeWeekends,
        weekDaysCount: weekDays.length,
        expected: 5
      });
    }
  }, [includeWeekends, weekDays.length]);
  

  // Helper to format time slot hour in app timezone (for display)
  const formatTimeSlotInAppTimezone = (timeSlot: Date): string => {
    return timeSlot.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: appTimezone
    });
  };

  // Memoize time slots to prevent unnecessary recalculations
  // Use app timezone to ensure consistent hour calculation
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    
    // Get min/max hours across all selected days
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
    
    // Create time slots in app timezone
    for (let hour = minHour; hour < maxHour; hour++) {
      // Create date in app timezone - use a reference date and set hours
      const timeSlot1 = new Date();
      // Set hours in local time (will be converted to app timezone when displayed)
      timeSlot1.setHours(hour, 0, 0, 0);
      slots.push(timeSlot1);
      // Add half hour (except for last hour)
      if (hour < maxHour - 1) {
        const timeSlot2 = new Date();
        timeSlot2.setHours(hour, 30, 0, 0);
        slots.push(timeSlot2);
      }
    }
    return slots;
  }, [businessHours]);

  // Helper to get hours/minutes in app timezone for comparison
  const getAppTimezoneTime = (date: Date): { hour: number; minute: number } => {
    const formatter = new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: false,
      timeZone: appTimezone
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
    return { hour, minute };
  };

  // Helper to get calendar events for a time slot (with deduplication)
  // Note: timedEvents is already filtered by client and excludes all-day events
  const getCalendarEventsForTimeSlot = (date: Date, timeSlot: Date): GoogleCalendarEvent[] => {
    // Normalize dates to avoid timezone issues - use app timezone for date comparison
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0); // Use noon to avoid DST issues
    const targetDateStr = targetDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      timeZone: appTimezone
    });
    
    // Get slot time in app timezone
    const slotAppTime = getAppTimezoneTime(timeSlot);
    const slotHour = slotAppTime.hour;
    const slotMinute = slotAppTime.minute;
    
    const matchingEvents = timedEvents.filter(event => {
      try {
        const eventStart = new Date(event.start.dateTime);
        
        // Compare dates in app timezone (use helper to handle invalid timezone formats)
        const eventTimezone = getValidTimezone(event.start.timeZone, appTimezone);
        const eventDateStr = eventStart.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: '2-digit', 
          day: '2-digit',
          timeZone: eventTimezone
        });
        
        // First check if the date matches (in app timezone)
        if (eventDateStr !== targetDateStr) {
          return false;
        }
        
        // Get event time in app timezone (convert from event's timezone to app timezone)
        const eventAppTime = getAppTimezoneTime(eventStart);
        const eventHour = eventAppTime.hour;
        const eventMinute = eventAppTime.minute;
        
        // If event starts at a full hour (minute === 0), it should appear in the first slot (full hour)
        // and span to the next slot (half hour). So only show it in the full hour slot.
        if (eventMinute === 0 && slotMinute === 0) {
          return eventHour === slotHour;
        }
        
        // For events starting at half hour, show them in the half hour slot
        if (eventMinute === 30 && slotMinute === 30) {
          return eventHour === slotHour;
        }
        
        // For events starting at other times, check if they start within this 30-minute slot
        return eventHour === slotHour && 
               (eventMinute >= slotMinute && eventMinute < slotMinute + 30);
      } catch (error) {
        console.warn('Error parsing event in getCalendarEventsForTimeSlot:', event, error);
        return false;
      }
    });
    
    // Deduplicate by ID and by time+summary
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    
    return matchingEvents.filter(event => {
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);
      
      const key = `${event.start.dateTime}-${event.summary}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      
      return true;
    });
  };
  
  // Helper to calculate how many 30-minute slots an event spans
  const getEventSlotCount = (event: GoogleCalendarEvent): number => {
    try {
      // All-day events should be handled separately, but just in case
      if (isAllDayEvent(event)) {
        return 1;
      }
      
      const eventStart = new Date(event.start.dateTime);
      const eventEnd = new Date(event.end.dateTime);
      const durationMs = eventEnd.getTime() - eventStart.getTime();
      const durationMinutes = durationMs / (1000 * 60);
      
      // Each slot is 30 minutes, minimum 1 slot, max 8 slots (4 hours)
      // This prevents events from taking over the whole view
      return Math.min(8, Math.max(1, Math.ceil(durationMinutes / 30)));
    } catch (error) {
      return 1;
    }
  };

  // Helper to get all-day events for a specific date
  const getAllDayEventsForDate = (date: Date): GoogleCalendarEvent[] => {
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const targetDateStr = targetDate.toDateString();
    
    return allDayEvents.filter(event => {
      try {
        // For all-day events with date property
        if (event.start.date) {
          const eventDate = new Date(event.start.date + 'T00:00:00');
          return eventDate.toDateString() === targetDateStr;
        }
        // For all-day events with dateTime
        if (event.start.dateTime) {
          const eventDate = new Date(event.start.dateTime);
          eventDate.setHours(0, 0, 0, 0);
          return eventDate.toDateString() === targetDateStr;
        }
        return false;
      } catch {
        return false;
      }
    });
  };

  // Helper to get workouts for a time slot
  const getWorkoutsForTimeSlot = (date: Date, timeSlot: Date): ClientWorkout[] => {
    // Normalize dates to avoid timezone issues - use Pacific timezone for date comparison
    const targetDate = new Date(date);
    targetDate.setHours(12, 0, 0, 0); // Use noon to avoid DST issues
    const targetDateStr = targetDate.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      timeZone: appTimezone
    }).replace(/\//g, '-'); // Convert to YYYY-MM-DD format
    
    // Get slot time in app timezone
    const slotAppTime = getAppTimezoneTime(timeSlot);
    const slotHour = slotAppTime.hour;
    const slotMinute = slotAppTime.minute;
    
    const matchingWorkouts = workouts.filter(workout => {
      const workoutDate = safeToDate(workout.date);
      workoutDate.setHours(12, 0, 0, 0); // Use noon to avoid DST issues
      const workoutDateStr = workoutDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit',
        timeZone: appTimezone
      }).replace(/\//g, '-'); // Convert to YYYY-MM-DD format
      
      // Match date first - use normalized date strings (app timezone)
      if (workoutDateStr !== targetDateStr) {
        return false;
      }
      
      // If workout has no time, don't show it (or handle differently)
      if (!workout.time) {
        console.warn('⚠️ Workout has no time field:', workout.id, workout.categoryName);
        return false;
      }
      
      // Parse workout time (format: "HH:mm" or "HH:mm:ss")
      // Remove any AM/PM if present
      let timeStr = workout.time.trim();
      if (timeStr.includes('AM') || timeStr.includes('PM')) {
        const [timePart, ampm] = timeStr.split(/\s*(AM|PM)/i);
        const [h, m] = timePart.split(':').map(Number);
        const hours = ampm.toUpperCase() === 'PM' && h !== 12 ? h + 12 : (ampm.toUpperCase() === 'AM' && h === 12 ? 0 : h);
        timeStr = `${String(hours).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
      }
      
      const timeParts = timeStr.split(':');
      const workoutHour = parseInt(timeParts[0], 10);
      const workoutMinute = parseInt(timeParts[1] || '0', 10);
      
      // If workout starts at a full hour (minute === 0), only show it in the full hour slot (not the half hour slot)
      // This allows it to span both rows visually
      if (workoutMinute === 0) {
        return workoutHour === slotHour && slotMinute === 0;
      }
      
      // For workouts starting at half hour, show them in the half hour slot
      if (workoutMinute === 30) {
        return workoutHour === slotHour && slotMinute === 30;
      }
      
      // For workouts starting at other times, check if they start within this 30-minute slot
      return workoutHour === slotHour && 
             (workoutMinute >= slotMinute && workoutMinute < slotMinute + 30);
    });
    
    // Deduplicate by ID and by time+category
    const seenIds = new Set<string>();
    const seenKeys = new Set<string>();
    
    const deduplicatedWorkouts = matchingWorkouts.filter(workout => {
      if (seenIds.has(workout.id)) return false;
      seenIds.add(workout.id);
      
      const key = `${workout.time}-${workout.categoryName}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      
      return true;
    });
    
    return deduplicatedWorkouts;
  };

  // Helper to get client name from event
  const getClientNameFromEvent = (event: GoogleCalendarEvent): string => {
    if (event.preConfiguredClient) {
      const client = clients.find(c => c.id === event.preConfiguredClient);
      if (client) return client.name;
    }
    
    if (event.description) {
      const clientMatch = event.description.match(/\[Metadata:.*client=([^,}]+)/);
      if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
        const clientId = clientMatch[1].trim();
        const client = clients.find(c => c.id === clientId);
        if (client) return client.name;
      }
    }
    
    const summary = event.summary || '';
    const withMatch = summary.match(/with\s+([^-]+?)(?:\s*-\s|$)/i);
    if (withMatch) return withMatch[1].trim();
    
    return summary.split(' - ')[0].split(' with ')[0] || 'Session';
  };

  // Helper to get period for a date
  const getPeriodForDate = (date: Date, clientId: string): ClientProgramPeriod | null => {
    if (!clientId) return null;
    
    const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
    if (!clientProgram) return null;
    
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

  // Helper to get workout category for a date
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
    
    return null;
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
    if (event.preConfiguredCategory) {
      const category = configWorkoutCategories.find(wc => wc.name === event.preConfiguredCategory);
      if (category) {
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
    if (isCoaching) {
      if (calendarConfig.coachingColor) {
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
    
    // Check if this is a class session (after coaching check)
    // Note: getEventCategoryColor logic in ModernCalendarView had class check first. 
    // Here logic order was different in original code (class check at top), but I am replacing the END of the function.
    // The original function had class check at the very top. I should leave that or update it if I can match the whole function.
    // Let's stick to replacing the last part.
    
    return '#3b82f6'; // Blue for other events
  };
  
  // Helper to get category color for workout
  const getWorkoutCategoryColor = (workout: ClientWorkout): string => {
    if (workout.categoryName) {
      const category = configWorkoutCategories.find(wc => wc.name === workout.categoryName);
      return category?.color || '#10b981';
    }
    return '#10b981';
  };

  // Sort events by time
  const sortEventsByTime = (events: GoogleCalendarEvent[]): GoogleCalendarEvent[] => {
    return [...events].sort((a, b) => {
      const timeA = new Date(a.start.dateTime).getTime();
      const timeB = new Date(b.start.dateTime).getTime();
      return timeA - timeB;
    });
  };

  return (
    <Card className="py-1 gap-1" style={{ display: 'block', overflow: 'visible' }}>
      <CardContent className="p-0 pt-1" style={{ overflow: 'visible' }}>
        <div className="relative">
          {/* Scrollable container for day columns */}
          <div className="overflow-x-auto" style={{ maxWidth: '100%' }}>
            <div style={{ minWidth: `${40 + weekDays.length * 200}px`, width: 'max-content' }}>
                {/* Header row - Time + Day headers */}
                <div className="flex border-b bg-gray-50">
                  {/* Time header */}
                  <div className="flex-shrink-0 w-[40px] border-r bg-gray-50 flex flex-col">
                    <div className="px-0.5 py-0.5 text-center text-[10px] font-medium text-gray-500 flex-shrink-0" style={{ minHeight: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Time
                    </div>
                    <div className="border-t bg-gray-50 flex-shrink-0" style={{ minHeight: '14px' }}></div>
                  </div>
                  
                  {/* Day headers */}
                  <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 200px)` }}>
                {weekDays.map((date, dayIndex) => {
                  // Use date components directly to avoid timezone issues
                  // The date object from weekDays should already be normalized
                  const year = date.getFullYear();
                  const month = date.getMonth();
                  const day = date.getDate();
                  const dayNumber = day;
                  
                  // Get weekday using a consistent lookup
                  const weekdayIndex = date.getDay();
                  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const weekdayStr = weekdays[weekdayIndex];
                  
                  // Only compare with today after mount to avoid hydration mismatch
                  // Server and client may have different "today" due to timezone
                  const isToday = mounted ? (() => {
                    const today = new Date();
                    return year === today.getFullYear() && month === today.getMonth() && day === today.getDate();
                  })() : false;
                  
                  // Create normalized date for period calculations
                  const normalizedDate = new Date(year, month, day);
                  const period = getPeriodForDate(normalizedDate, selectedClient || '');
                  const isLastDay = dayIndex === weekDays.length - 1;
                  
                  return (
                    <div 
                      key={`header-${normalizedDate.toISOString()}-${dayIndex}`} 
                      className={`flex flex-col ${isLastDay ? '' : 'border-r'}`}
                    >
                      <div 
                        className={`px-0.5 py-0.5 text-center cursor-pointer transition-colors flex-shrink-0 relative ${isToday ? 'bg-blue-100 rounded' : 'hover:bg-gray-100'}`}
                        style={{ minHeight: '38px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}
                        onClick={() => onDateClick?.(normalizedDate)}
                      >
                        {period && period.periodName !== 'Ongoing' && (
                          <div 
                            className="absolute rounded-full opacity-20"
                            style={{ 
                              backgroundColor: period.periodColor,
                              width: '32px',
                              height: '32px',
                              top: '50%',
                              left: '50%',
                              transform: 'translate(-50%, -50%)'
                            }}
                          />
                        )}
                        <div 
                          className={`text-[10px] relative z-10 ${isToday ? 'text-blue-600 font-bold' : 'text-gray-900'}`}
                          suppressHydrationWarning
                        >
                          {weekdayStr}
                        </div>
                        <div 
                          className={`text-sm font-bold relative z-10 ${isToday ? 'text-blue-600' : 'text-gray-900'}`}
                          suppressHydrationWarning
                        >
                          {dayNumber}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 border-t text-[9px] font-medium text-gray-500 flex-shrink-0" style={{ minHeight: '14px' }}>
                        <div className="px-0.5 py-0 text-center bg-gray-100">Schedule</div>
                        <div className="px-0.5 py-0 text-center bg-gray-100">Workout</div>
                      </div>
                    </div>
                  );
                })}
              </div>
                </div>

            {/* All-day events section (collapsible) */}
            {allDayEvents.length > 0 && (
              <div className="border-b border-gray-300 bg-gray-50">
                <div className="flex">
                  {/* All-day label with collapse toggle */}
                  <div 
                    className="w-[40px] flex-shrink-0 flex items-center justify-center cursor-pointer hover:bg-gray-100 border-r border-gray-200 bg-gray-50"
                    onClick={() => setAllDayCollapsed(!allDayCollapsed)}
                    style={{ minHeight: '26px' }}
                  >
                    <div className="flex items-center gap-0.5 text-[9px] font-medium text-gray-500">
                      {allDayCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      <span>All</span>
                    </div>
                  </div>
                  
                  {/* All-day events grid */}
                  <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${weekDays.length}, 200px)` }}>
                    {weekDays.map((date, dayIndex) => {
                      const normalizedDate = new Date(date);
                      normalizedDate.setHours(0, 0, 0, 0);
                      const dayAllDayEvents = getAllDayEventsForDate(normalizedDate);
                      const isLastDay = dayIndex === weekDays.length - 1;
                      
                      return (
                        <div 
                          key={`allday-${normalizedDate.toISOString()}-${dayIndex}`}
                          className={`${isLastDay ? '' : 'border-r'} border-gray-200 p-0.5`}
                          style={{ minHeight: '26px' }}
                        >
                          {!allDayCollapsed && dayAllDayEvents.map((event, eventIdx) => {
                            const eventClientId = getEventClientId(event);
                            const hasClientAssigned = !!eventClientId;
                            
                            return (
                              <div
                                key={`allday-event-${event.id}-${eventIdx}`}
                                className="text-[9px] px-1 py-0.5 rounded text-white font-medium cursor-pointer hover:opacity-80 transition-opacity truncate mb-0.5"
                                style={{ backgroundColor: hasClientAssigned ? '#f97316' : '#3b82f6' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEventClick?.(event);
                                }}
                                title={event.summary}
                              >
                                {event.summary}
                              </div>
                            );
                          })}
                          {allDayCollapsed && dayAllDayEvents.length > 0 && (
                            <div className="text-[9px] text-gray-500 text-center">
                              {dayAllDayEvents.length} event{dayAllDayEvents.length > 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Time slot rows - each row contains time cell + all day cells */}
            <div 
              ref={dayColumnsRef} 
              className="overflow-y-auto" 
              style={{ maxHeight: 'calc(100vh - 150px)' }}
            >
              {timeSlots.map((timeSlot, index) => {
                const isFullHourSlot = timeSlot.getMinutes() === 0;
                
                return (
                  <div 
                    key={`timeslot-${index}-${weekDays.length}`} 
                    className="flex border-b hover:bg-gray-50"
                    style={{ height: '24px', minWidth: `${40 + weekDays.length * 200}px`, width: 'max-content' }}
                  >
                    {/* Time cell */}
                    <div 
                      className="flex-shrink-0 w-[40px] border-r px-0.5 text-[10px] text-gray-500 text-right bg-gray-50 flex items-center justify-end"
                      style={{ 
                        height: '24px'
                      }}
                    >
                      {isFullHourSlot
                        ? formatTimeSlotInAppTimezone(timeSlot)
                        : ''
                      }
                    </div>
                    
                    {/* Day cells */}
                    <div 
                      className="flex-1 grid" 
                      style={{ gridTemplateColumns: `repeat(${weekDays.length}, 200px)` }}
                    >
                  
                  {/* Day columns - each day has two sub-columns */}
                  {weekDays.map((date, dayIndex) => {
                    // Ensure date is normalized
                    const normalizedDate = new Date(date);
                    normalizedDate.setHours(0, 0, 0, 0);
                    
                    const calendarEventsForSlot = getCalendarEventsForTimeSlot(normalizedDate, timeSlot);
                    const workoutsForSlot = getWorkoutsForTimeSlot(normalizedDate, timeSlot);
                    const period = getPeriodForDate(normalizedDate, selectedClient || '');
                    const isLastDay = dayIndex === weekDays.length - 1;
                    
                    
                    return (
                      <div 
                        key={`cell-${normalizedDate.toISOString()}-${dayIndex}-${timeSlot.getTime()}`} 
                        className={`grid grid-cols-2 ${isLastDay ? '' : 'border-r'}`}
                        style={{ 
                          minWidth: '200px',
                          gridColumn: dayIndex + 1,
                          width: '100%'
                        }}
                        data-day-index={dayIndex}
                        data-day-name={normalizedDate.toLocaleDateString('en-US', { weekday: 'short' })}
                      >
                        {/* Schedule column (left) */}
                        <div 
                          className="border-r p-0 cursor-pointer transition-colors relative overflow-visible"
                          style={{ height: '24px' }}
                          onClick={() => onScheduleCellClick?.(normalizedDate, timeSlot, period || undefined)}
                        >
                          {calendarEventsForSlot.length > 0 ? (
                            <div className="space-y-0.5 relative">
                              {sortEventsByTime(calendarEventsForSlot).map((event) => {
                                const eventDate = new Date(event.start.dateTime);
                                const dateParam = eventDate.toISOString().split('T')[0];
                                const eventIdParam = `&eventId=${event.id}`;
                                const clientParam = selectedClient ? `client=${selectedClient}&` : '';
                                const buildWorkoutUrl = `/workouts/builder?${clientParam}date=${dateParam}${eventIdParam}`;
                                const clientName = getClientNameFromEvent(event);
                                const categoryColor = getEventCategoryColor(event);
                                const eventTime = new Date(event.start.dateTime).toLocaleTimeString('en-US', { 
                                  hour: 'numeric', 
                                  minute: '2-digit',
                                  hour12: true,
                                  timeZone: appTimezone
                                });
                                
                                // Calculate how many 30-minute slots this event spans
                                const slotCount = getEventSlotCount(event);
                                const shouldSpan = slotCount > 1;
                                // Height is 24px per slot (matching height of each time slot row)
                                const spanHeight = slotCount * 24;
                                
                                // Check assignment status for icons
                                const eventClientId = getEventClientId(event);
                                const hasClientAssigned = !!eventClientId;
                                const hasWorkoutLinked = !!event.linkedWorkoutId;
                                
                                // Get assigned client name if in "All Clients" mode
                                const assignedClientName = hasClientAssigned && !selectedClient
                                  ? clients.find(c => c.id === eventClientId)?.name || 'Client'
                                  : null;
                                
                                return (
                                  <div
                                    key={event.id}
                                    className="text-[10px] px-1 py-0.5 rounded text-white font-medium cursor-pointer hover:opacity-80 transition-opacity leading-tight"
                                    style={{ 
                                      backgroundColor: categoryColor,
                                      ...(shouldSpan ? {
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: `${spanHeight}px`,
                                        zIndex: 10
                                      } : {
                                        position: 'relative'
                                      }),
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      // Always use onEventClick if provided (it should handle opening scheduling manager)
                                      if (onEventClick) {
                                        onEventClick(event);
                                      } else if (event.linkedWorkoutId) {
                                        const workoutUrl = `/workouts/builder?${clientParam}date=${dateParam}&workoutId=${event.linkedWorkoutId}`;
                                        router.push(workoutUrl);
                                      } else if (event.isCoachingSession && selectedClient) {
                                        router.push(buildWorkoutUrl);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-0.5">
                                      <span className="truncate flex-1">
                                        {assignedClientName || clientName}
                                      </span>
                                      <div className="flex items-center gap-0.5 flex-shrink-0 text-[8px]">
                                        {/* Status icons */}
                                        {hasWorkoutLinked ? (
                                          <span title="Workout assigned" className="bg-white/30 rounded px-0.5">💪</span>
                                        ) : hasClientAssigned ? (
                                          <span title="Client assigned (no workout yet)" className="bg-white/30 rounded px-0.5">👤</span>
                                        ) : (
                                          <span title="Unassigned - click to assign client" className="opacity-60">○</span>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-[8px] truncate">
                                      <span className="font-bold opacity-100" style={{ fontWeight: 700 }}>{eventTime}</span>
                                      {event.location && (() => {
                                        const { getLocationDisplay } = useCalendarStore.getState();
                                        const displayLocation = getLocationDisplay(event.location);
                                        return displayLocation ? (
                                          <>
                                            <span className="mx-0.5 opacity-90">@</span>
                                            <span className="font-bold opacity-100" style={{ fontWeight: 700 }}>{displayLocation}</span>
                                          </>
                                        ) : null;
                                      })()}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-400 text-center py-0.5">
                              Available
                            </div>
                          )}
                        </div>
                        
                        {/* Workout column (right) */}
                        <div
                          className="p-0 cursor-pointer transition-colors relative overflow-visible"
                          style={{ height: '24px' }}
                          onClick={() => onWorkoutCellClick?.(normalizedDate, timeSlot, period || undefined)}
                        >
                          {workoutsForSlot.length > 0 ? (
                            <div className="relative">
                              {workoutsForSlot.map((workout) => {
                                const workoutDate = safeToDate(workout.date);
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
                                
                                const categoryColor = getWorkoutCategoryColor(workout);
                                const workoutTime = workout.time ? (() => {
                                  // workout.time is stored as "HH:MM" in Pacific timezone
                                  // Convert to AM/PM format (timezone is already correct, just formatting)
                                  const [hours, minutes] = workout.time.split(':').map(Number);
                                  const mins = String(minutes).padStart(2, '0');
                                  if (hours === 0) return `12:${mins} AM`;
                                  if (hours < 12) return `${hours}:${mins} AM`;
                                  if (hours === 12) return `12:${mins} PM`;
                                  return `${hours - 12}:${mins} PM`;
                                })() : '';
                                
                                // Calculate how many 30-minute slots this workout spans based on duration
                                const workoutSlotCount = workout.duration ? Math.max(1, Math.ceil(workout.duration / 30)) : 1;
                                const workoutShouldSpan = workoutSlotCount > 1;
                                // Height is 24px per slot (matching height of each time slot row)
                                const workoutSpanHeight = workoutSlotCount * 24;
                                
                                return (
                                  <div
                                    key={workout.id}
                                    className="text-[10px] px-1 py-0.5 rounded text-white font-medium cursor-pointer hover:opacity-80 transition-opacity leading-tight"
                                    style={{ 
                                      backgroundColor: categoryColor,
                                      ...(workoutShouldSpan ? {
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        right: 0,
                                        height: `${workoutSpanHeight}px`,
                                        zIndex: 10
                                      } : {
                                        position: 'relative'
                                      }),
                                      display: 'flex',
                                      flexDirection: 'column',
                                      justifyContent: 'center'
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onWorkoutClick) {
                                        onWorkoutClick(workout);
                                      } else {
                                        router.push(workoutUrl);
                                      }
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-0.5">
                                      <span className="truncate flex-1">{workout.categoryName || 'Workout'}</span>
                                      {workout.title && (
                                        <span className="text-[8px] opacity-90 truncate ml-1" title={workout.title}>
                                          {workout.title.length > 10 ? workout.title.substring(0, 10) + '...' : workout.title}
                                        </span>
                                      )}
                                    </div>
                                    {workoutTime && (
                                      <div className="text-[8px] truncate">
                                        <span className="font-bold opacity-100" style={{ fontWeight: 700 }}>{workoutTime}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-[10px] text-gray-400 text-center py-0.5">
                              -
                            </div>
                          )}
                        </div>
                      </div>
                    );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: re-render when structure or data changes
  // Structure changes: calendar date, weekend inclusion
  // Data changes: events, workouts, selected client, client programs
  
  const structureChanged = (
    prevProps.calendarDate?.getTime() !== nextProps.calendarDate?.getTime() ||
    prevProps.includeWeekends !== nextProps.includeWeekends
  );
  
  const dataChanged = (
    prevProps.selectedClient !== nextProps.selectedClient ||
    prevProps.calendarEvents !== nextProps.calendarEvents ||
    prevProps.calendarEvents.length !== nextProps.calendarEvents.length ||
    prevProps.workouts !== nextProps.workouts ||
    prevProps.workouts.length !== nextProps.workouts.length ||
    prevProps.clientPrograms !== nextProps.clientPrograms
  );
  
  // If structure or data changed, allow re-render
  if (structureChanged || dataChanged) return false;
  
  // Skip re-render only if nothing important changed
  return true;
});

