"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { Client } from '@/lib/types';
import { format } from 'date-fns';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { getAppTimezone } from '@/lib/utils/timezone';

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
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Use the provided date, with a stable fallback for SSR
  const safeSelectedDate = selectedDate || new Date(2024, 0, 1); // Stable fallback for SSR

  // Get events for the selected date with deduplication
  const dayEvents = React.useMemo(() => {
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
    
    return filteredEvents.filter(event => {
      // Skip if we've seen this ID
      if (seenIds.has(event.id)) return false;
      seenIds.add(event.id);
      
      // Also dedupe by time + summary (in case same event was created multiple times)
      const key = `${event.start.dateTime}-${event.summary}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      
      return true;
    });
  }, [events, safeSelectedDate, selectedClientId]);

  // Sort events by time
  const sortedEvents = [...dayEvents].sort((a, b) => {
    const timeA = new Date(a.start.dateTime).getTime();
    const timeB = new Date(b.start.dateTime).getTime();
    return timeA - timeB;
  });

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
  const getCategoryColor = (event: GoogleCalendarEvent): string => {
    // Check if this is a class session
    if (event.isClassSession) {
      return '#a855f7'; // Purple for class sessions
    }

    // Check if this is a coaching session (has client ID)
    const hasClient = event.preConfiguredClient || 
      event.description?.includes('client=') ||
      (event as any).extendedProperties?.private?.pcaClientId;
    
    const isCoaching = hasClient || event.isCoachingSession;
    
    // Priority 1: If event has a workout category from a period, use that color
    // (Note: We'd need workoutCategories from store to get the actual color,
    // but for now we'll use orange for coaching sessions with categories)
    if (event.preConfiguredCategory) {
      // If it's a coaching session with a category, we could look up the color
      // For now, keep it orange if it's coaching, otherwise use default
      if (isCoaching) {
        return '#f97316'; // Keep orange for coaching sessions
      }
      return '#3b82f6'; // Blue for non-coaching events with category
    }
    
    // Priority 2: Default colors based on event type
    if (isCoaching) {
      return '#f97316'; // Orange for coaching sessions
    }
    return '#3b82f6'; // Blue for other events
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
              const categoryColor = getCategoryColor(event);
              const eventClientId = getClientId(event);
              const hasClientAssigned = !!eventClientId;
              const hasWorkoutLinked = !!event.linkedWorkoutId;
              
              return (
                <div
                  key={event.id}
                  className="p-2 rounded border cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: categoryColor }}
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
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Status icons - same as calendar view */}
                      {hasWorkoutLinked ? (
                        <span title="Workout assigned" className="text-sm">💪</span>
                      ) : hasClientAssigned ? (
                        <span title="Client assigned (no workout yet)" className="text-sm">👤</span>
                      ) : (
                        <span title="Unassigned - click to assign client" className="text-gray-400 text-sm">○</span>
                      )}
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

