/**
 * Hook for accessing client-event matching functionality
 * 
 * This hook provides utilities for matching calendar events to clients
 * using the guest email metadata synced from the work calendar.
 */

'use client';

import { useMemo } from 'react';
import { useClients } from '@/hooks/queries/useClients';
import { useCalendarConfig } from '@/hooks/queries/useCalendarConfig';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { Client } from '@/lib/types';
import { 
  matchEventToClient, 
  matchEventsToClients,
  matchEventToAllClients,
  matchEventsToAllClients,
  getUnmatchedEvents,
  getMatchingStats,
  getExcludedEvents,
  extractAttendeeNames,
  type ClientMatchResult,
  type MultiClientMatchResult
} from '@/lib/services/clientMatching';

export interface UseClientMatchingResult {
  // Single-client matching functions
  matchEvent: (event: GoogleCalendarEvent | Record<string, unknown>) => ClientMatchResult | null;
  matchEvents: (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => Map<string, ClientMatchResult>;
  
  // Multi-client matching functions
  matchEventToAll: (event: GoogleCalendarEvent | Record<string, unknown>) => MultiClientMatchResult | null;
  matchEventsToAll: (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => Map<string, MultiClientMatchResult>;
  
  // Analysis functions
  getUnmatched: (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => Array<{ 
    event: GoogleCalendarEvent | Record<string, unknown>; 
    attendeeNames: string[] 
  }>;  
  getExcluded: (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => Array<{
    event: GoogleCalendarEvent | Record<string, unknown>;
    reason: string;
  }>;
  getStats: (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => {
    totalEvents: number;
    eventsWithAttendees: number;
    matchedEvents: number;
    unmatchedEvents: number;
    matchRate: number;
  };
  
  // Utility functions
  extractEmails: (event: GoogleCalendarEvent | Record<string, unknown>) => string[];
  
  // State
  clients: Client[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for client-event matching functionality
 */
export function useClientMatching(): UseClientMatchingResult {
  const { data: clients = [], isLoading, error } = useClients(false);
  const { data: calendarConfig } = useCalendarConfig();
  
  const coachingKeywords = useMemo(
    () => calendarConfig?.coachingKeywords || [],
    [calendarConfig?.coachingKeywords]
  );
  
  const classKeywords = useMemo(
    () => calendarConfig?.classKeywords || [],
    [calendarConfig?.classKeywords]
  );
  
  const exclusionKeywords = useMemo(
    () => calendarConfig?.exclusionKeywords || [],
    [calendarConfig?.exclusionKeywords]
  );
  
  const coachPatterns = useMemo(
    () => calendarConfig?.coachEmailPatterns || [],
    [calendarConfig?.coachEmailPatterns]
  );
  
  const matchEvent = useMemo(
    () => (event: GoogleCalendarEvent | Record<string, unknown>) => matchEventToClient(event, clients),
    [clients]
  );
  
  const matchEventsFunc = useMemo(
    () => (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => matchEventsToClients(events, clients),
    [clients]
  );
  
  const matchEventToAll = useMemo(
    () => (event: GoogleCalendarEvent | Record<string, unknown>) => 
      matchEventToAllClients(event, clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns),
    [clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns]
  );
  
  const matchEventsToAll = useMemo(
    () => (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => 
      matchEventsToAllClients(events, clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns),
    [clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns]
  );
  
  const getUnmatched = useMemo(
    () => (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => 
      getUnmatchedEvents(events, clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns),
    [clients, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns]
  );
  
  const getExcluded = useMemo(
    () => (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => 
      getExcludedEvents(events, coachingKeywords, classKeywords, exclusionKeywords, coachPatterns),
    [coachingKeywords, classKeywords, exclusionKeywords, coachPatterns]
  );
  
  const getStats = useMemo(
    () => (events: (GoogleCalendarEvent | Record<string, unknown>)[]) => getMatchingStats(events, clients),
    [clients]
  );
  
  const extractEmails = useMemo(
    () => (event: GoogleCalendarEvent | Record<string, unknown>) => extractAttendeeNames(event, coachPatterns),
    [coachPatterns]
  );
  
  return {
    matchEvent,
    matchEvents: matchEventsFunc,
    matchEventToAll,
    matchEventsToAll,
    getUnmatched,
    getExcluded,
    getStats,
    extractEmails,
    clients,
    isLoading,
    error,
  };
}
