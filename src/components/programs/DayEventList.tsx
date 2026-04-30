"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { Client } from '@/lib/types';
import { format } from 'date-fns';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { getAppTimezone } from '@/lib/utils/timezone';
import { getLinkedWorkoutId, getEventClientId, getEventCategory } from '@/lib/utils/event-patterns';
import { logger } from '@/lib/utils/logger';

interface DayEventListProps {
  selectedDate: Date;
  events: GoogleCalendarEvent[];
  clients: Client[];
  selectedClientId?: string | null; // Optional: filter events by client
  onEventClick?: (event: GoogleCalendarEvent) => void;
  headerActions?: React.ReactNode; // Icons/actions to display in top right
}

export function DayEventList({
  selectedDate,
  events,
  clients,
  selectedClientId,
  onEventClick,
  headerActions
}: DayEventListProps) {
  // Track if we're mounted on client to avoid hydration issues with dates
  const [mounted, setMounted] = useState(false);
  const [resolvedWorkoutIds, setResolvedWorkoutIds] = useState<Record<string, string>>({});
  const [resolvedWorkoutColors, setResolvedWorkoutColors] = useState<Record<string, string>>({});
  const configWorkoutCategories = useConfigurationStore(state => state.workoutCategories);
  const calendarConfig = useCalendarStore(state => state.config);
  const workoutLookupKeyRef = React.useRef<string>('');
  
  useEffect(() => {
    setMounted(true);
    return () => {
      // Cleanup on unmount
    };
  }, []);
  
  // Use the provided date, with a fallback to today
  // Note: Both parent pages pass `selectedDate || calendarDate`, so this fallback should rarely be needed
  const safeSelectedDate = selectedDate || new Date();

  const normalizeCategoryKey = (value?: string): string => {
    return (value || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^a-z0-9 ]/g, '');
  };

  const getConfiguredWorkoutCategoryColor = (categoryName?: string): string | null => {
    if (!categoryName) return null;

    const direct = configWorkoutCategories.find(
      c => c.name.toLowerCase().trim() === categoryName.toLowerCase().trim()
    );
    if (direct?.color) {
      return direct.color;
    }

    const normalizedInput = normalizeCategoryKey(categoryName);
    if (!normalizedInput) return null;

    const normalized = configWorkoutCategories.find(
      c => normalizeCategoryKey(c.name) === normalizedInput
    );
    return normalized?.color || null;
  };

  const getEventWorkoutId = (event: GoogleCalendarEvent): string | null => {
    const fromPattern = getLinkedWorkoutId(event);
    if (fromPattern) return fromPattern;

    const fromExtended = (event as any).extendedProperties?.private?.pcaWorkoutId;
    if (fromExtended && fromExtended !== 'none') {
      return String(fromExtended).trim();
    }

    return null;
  };

  const getEventWorkoutCategory = (event: GoogleCalendarEvent): string | null => {
    const fromPattern = getEventCategory(event) || event.preConfiguredCategory;
    if (fromPattern) return fromPattern;

    const fromExtended = (event as any).extendedProperties?.private?.pcaCategory;
    if (fromExtended && fromExtended !== 'none') {
      return String(fromExtended).trim();
    }

    return null;
  };

  // Get events for the selected date with deduplication
  // Calculate directly without useMemo to avoid dependency issues
  const filteredEvents = events.filter(event => {
    try {
      const eventDate = new Date(event.start.dateTime);
      // Normalize both dates to start of day for comparison
      const normalizedEventDate = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      const normalizedSelectedDate = new Date(safeSelectedDate.getFullYear(), safeSelectedDate.getMonth(), safeSelectedDate.getDate());
      
      const dateMatches = normalizedEventDate.getTime() === normalizedSelectedDate.getTime();
      
      if (!dateMatches) return false;
      
      // If a client is selected, filter by client
      if (selectedClientId) {
        // Check preConfiguredClient
        if (event.preConfiguredClient) {
          return event.preConfiguredClient === selectedClientId;
        }
        
        // Check description metadata
        if (event.description) {
          const clientMatch = event.description.match(/\[Metadata:.*client=([^,}]+)/);
          if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
            return clientMatch[1].trim() === selectedClientId;
          }
        }
        
        // Check extended properties (from Google Calendar API)
        if ((event as any).extendedProperties?.private?.pcaClientId) {
          return (event as any).extendedProperties.private.pcaClientId === selectedClientId;
        }
        
        // If event has no client info and we're viewing a specific client, don't show it
        // (Only show events that belong to the selected client)
        return false;
      }
      
      // If no client is selected, show all events for the date
      return true;
    } catch (error) {
      console.warn('Error filtering event in DayEventList:', event, error);
      return false;
    }
  });
  
  // Deduplicate by ID first, then by time+summary combination
  const seenIds = new Set<string>();
  const seenKeys = new Set<string>();
  
  const dayEvents = filteredEvents.filter(event => {
    // Skip if we've seen this ID
    if (seenIds.has(event.id)) return false;
    seenIds.add(event.id);
    
    // Also dedupe by time + summary (in case same event was created multiple times)
    const key = `${event.start.dateTime}-${event.summary}`;
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    
    return true;
  });
  
  logger.debug('[DayEventList] dayEvents calculated:', {
    dayEventsCount: dayEvents.length,
    eventsCount: events.length,
    filteredCount: filteredEvents.length,
    safeSelectedDate: safeSelectedDate.toISOString(),
    selectedClientId
  });

  // Sort events by time
  const sortedEvents = [...dayEvents].sort((a, b) => {
    const timeA = new Date(a.start.dateTime).getTime();
    const timeB = new Date(b.start.dateTime).getTime();
    return timeA - timeB;
  });

  // Infer linked workouts from backend (client + selected day) for events where
  // Google event metadata has not propagated yet.
  useEffect(() => {
    const categoryKey = configWorkoutCategories
      .map(c => `${c.name}:${c.color}`)
      .sort()
      .join('|');

    const lookupKey = `${format(safeSelectedDate, 'yyyy-MM-dd')}|${dayEvents
      .map(e => `${e.id}:${getEventClientId(e) || ''}:${getEventWorkoutId(e) || ''}`)
      .join('|')}|${categoryKey}`;

    if (workoutLookupKeyRef.current === lookupKey) {
      return;
    }

    const inferLinks = async () => {
      const nextMap: Record<string, string> = {};
      const nextColorMap: Record<string, string> = {};

      const unresolvedEventIds = dayEvents
        .filter(event => !getEventWorkoutId(event))
        .map(event => event.id);

      if (unresolvedEventIds.length > 0) {
        try {
          const { getEventWorkoutLinksByEventIds } = await import('@/lib/firebase/services/eventWorkoutLinks');
          const trackerLinks = await getEventWorkoutLinksByEventIds(unresolvedEventIds);

          for (const eventId of unresolvedEventIds) {
            const link = trackerLinks[eventId];
            if (link?.workoutId) {
              nextMap[eventId] = link.workoutId;
            }
          }
        } catch {
          // If tracker read fails, continue with legacy fallback behavior.
        }
      }

      // Prime colors from event category metadata for all currently visible events.
      for (const event of dayEvents) {
        const resolvedCategory = getEventWorkoutCategory(event);
        const colorFromEventCategory = getConfiguredWorkoutCategoryColor(resolvedCategory || undefined);
        if (colorFromEventCategory) {
          nextColorMap[event.id] = colorFromEventCategory;
        }
      }

      // Final fallback for color: resolve from linked workout document by workoutId.
      // This covers events where link exists but event metadata lacks category.
      const eventWorkoutPairs = dayEvents
        .map(event => ({
          eventId: event.id,
          workoutId: getEventWorkoutId(event) || nextMap[event.id],
        }))
        .filter(pair => !!pair.workoutId && !nextColorMap[pair.eventId]);

      if (eventWorkoutPairs.length > 0) {
        try {
          const { getClientWorkout } = await import('@/lib/firebase/services/clientWorkouts');
          const { getScheduledWorkout } = await import('@/lib/firebase/services/programs');
          const workoutColorCache = new Map<string, string | null>();

          for (const pair of eventWorkoutPairs) {
            const workoutId = pair.workoutId as string;

            if (!workoutColorCache.has(workoutId)) {
              const clientWorkout = await getClientWorkout(workoutId);
              let workoutCategoryName = clientWorkout?.categoryName;

              // Legacy/alternate flows may store linked workouts in scheduled-workouts.
              if (!workoutCategoryName) {
                const scheduledWorkout = await getScheduledWorkout(workoutId);
                workoutCategoryName = scheduledWorkout?.sessionType;
              }

              const workoutColor = getConfiguredWorkoutCategoryColor(workoutCategoryName || undefined);
              workoutColorCache.set(workoutId, workoutColor);
            }

            const color = workoutColorCache.get(workoutId);
            if (color) {
              nextColorMap[pair.eventId] = color;
            }
          }
        } catch {
          // Keep existing fallback behavior when workout lookup fails.
        }
      }

      setResolvedWorkoutIds(nextMap);
      setResolvedWorkoutColors(nextColorMap);
      workoutLookupKeyRef.current = lookupKey;
    };

    inferLinks().catch(() => {
      // Keep key unchanged on failure so next render can retry lookup.
    });
  }, [dayEvents, safeSelectedDate, clients, configWorkoutCategories]);



  // Helper to get client ID from event
  const getClientId = (event: GoogleCalendarEvent): string | null => {
    if (event.preConfiguredClient) {
      return event.preConfiguredClient;
    }
    
    if ((event as any).extendedProperties?.private?.pcaClientId) {
      return (event as any).extendedProperties.private.pcaClientId;
    }
    
    if (event.description) {
      const clientMatch = event.description.match(/\[Metadata:.*client=([^,\s}\]]+)/);
      if (clientMatch && clientMatch[1] && clientMatch[1] !== 'none') {
        return clientMatch[1].trim();
      }
      
      const altMatch = event.description.match(/client=([^,\s\n]+)/);
      if (altMatch && altMatch[1] && altMatch[1] !== 'none') {
        return altMatch[1].trim();
      }
    }
    
    return null;
  };

  // Helper to get client name from event
  const getClientName = (event: GoogleCalendarEvent): string => {
    const clientId = getClientId(event);
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client) return client.name;
    }
    
    const summary = event.summary || '';
    const withMatch = summary.match(/with\s+([^-]+?)(?:\s*-\s|$)/i);
    if (withMatch) {
      return withMatch[1].trim();
    }
    
    return summary.split(' - ')[0].split(' with ')[0] || 'Session';
  };

  // Helper to get category color
  const getEventDetectionColor = (event: GoogleCalendarEvent): string => {
    const resolveConfiguredColor = (colorName?: string): string | null => {
      if (!colorName) return null;
      const colorMap: Record<string, string> = {
        blue: '#3b82f6',
        purple: '#a855f7',
        green: '#22c55e',
        orange: '#f97316',
        pink: '#ec4899',
      };
      return colorMap[colorName] || colorName;
    };

    // Check if this is a coaching session (has client ID)
    const hasClient = event.preConfiguredClient || 
      event.description?.includes('client=') ||
      (event as any).extendedProperties?.private?.pcaClientId;
    
    const isCoaching = hasClient || event.isCoachingSession;
    
    // Priority 1: Resolve category from event metadata/patterns and map to configured color.
    const resolvedCategory = getEventCategory(event) || event.preConfiguredCategory;
    if (resolvedCategory) {
      const category = configWorkoutCategories.find(
        c => c.name.toLowerCase() === resolvedCategory.toLowerCase()
      );
      if (category?.color) {
        return category.color;
      }
    }

    // Priority 2: Class session color from calendar config.
    if (event.isClassSession) {
      return resolveConfiguredColor(calendarConfig.classColor) || '#a855f7';
    }
    
    // Priority 3: Coaching session color from calendar config.
    if (isCoaching) {
      return resolveConfiguredColor(calendarConfig.coachingColor) || '#f97316';
    }

    // Priority 4: Generic default for personal/other events.
    return '#3b82f6'; // Blue for other events
  };

  const getWorkoutCategoryCircleColor = (
    event: GoogleCalendarEvent,
    eventId: string,
    eventDetectionColor: string
  ): string | null => {
    const resolvedCategory = getEventWorkoutCategory(event);
    if (resolvedCategory) {
      const color = getConfiguredWorkoutCategoryColor(resolvedCategory);
      if (color) {
        return color;
      }

      // Category exists but did not map to a configured color. Use event color as fallback
      // so categorized rows do not appear as unassigned gray.
      return eventDetectionColor;
    }

    return resolvedWorkoutColors[eventId] || null;
  };

  return (
    <Card className="py-1 gap-1">
      <CardHeader className="pb-1 px-2 pt-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {mounted ? format(safeSelectedDate, 'EEEE, MMMM d') : 'Loading...'}
          </CardTitle>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-2 pb-2">
        {sortedEvents.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-3">
            No events scheduled
          </div>
        ) : (
          <div className="space-y-2 max-h-[750px] overflow-y-auto">
            {sortedEvents.map((event) => {
              const eventTime = new Date(event.start.dateTime);
              const clientName = getClientName(event);
              const eventDetectionColor = getEventDetectionColor(event);
              const linkedWorkoutId = getEventWorkoutId(event);
              const resolvedWorkoutId = linkedWorkoutId || resolvedWorkoutIds[event.id];
              const workoutCategoryColor = getWorkoutCategoryCircleColor(event, event.id, eventDetectionColor);
              
              // All event clicks go to the parent handler (dashboard/programs)
              // which has the routing logic for builder/dialog
              const handleEventContainerClick = () => {
                onEventClick?.(event);
              };
              
              return (
                <div
                  key={event.id}
                  className="p-2 rounded border cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={handleEventContainerClick}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: eventDetectionColor }}
                        />
                        <span className="text-sm font-medium truncate">
                          {clientName}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {eventTime.toLocaleTimeString('en-US', { 
                          hour: 'numeric', 
                          minute: '2-digit',
                          hour12: true,
                          timeZone: getAppTimezone()
                        })}
                        {event.location && (() => {
                          const displayLocation = useCalendarStore.getState().getLocationDisplay(event.location);
                          return displayLocation ? ` @ ${displayLocation}` : '';
                        })()}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-1">
                      {/* Workout status marker uses the same dot styling as the left event marker; only color source differs. */}
                      <div
                        title={workoutCategoryColor ? 'Workout category detected' : 'No workout category detected'}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor: workoutCategoryColor || '#d1d5db',
                        }}
                        role="button"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

