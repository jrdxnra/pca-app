'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientProgram } from '@/lib/types';
import { ExternalLink, Dumbbell, Plus, Calendar, UserPlus, Users, ArrowRight, Tag, UserMinus, Trash2, Repeat, Search, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { getAppTimezone } from '@/lib/utils/timezone';
import { 
  getEventClientId, 
  findAllPatternsWithEvents, 
  PatternMatchResult,
  getTotalEventCount,
  getEventCategory,
  getLinkedWorkoutId
} from '@/lib/utils/event-patterns';
import { assignClientToEvents, BulkAssignmentResult, unassignClientFromEvent } from '@/lib/firebase/services/eventAssignment';
import { deleteCalendarEvent } from '@/lib/google-calendar/api-client';
import { BulkAssignmentConfirmDialog } from './BulkAssignmentConfirmDialog';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';

interface Client {
  id: string;
  name: string;
}

interface WorkoutCategory {
  id: string;
  name: string;
  color: string;
}

interface EventActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: GoogleCalendarEvent;
  clientId?: string;
  // New props for bulk assignment
  allEvents?: GoogleCalendarEvent[];
  clients?: Client[];
  clientPrograms?: ClientProgram[];
  onClientAssigned?: () => void;
  fetchEvents?: (dateRange: { start: Date; end: Date }) => Promise<void>; // For fetching extended date range
}

export function EventActionDialog({
  open,
  onOpenChange,
  event,
  clientId,
  allEvents = [],
  clients = [],
  clientPrograms = [],
  onClientAssigned,
  fetchEvents
}: EventActionDialogProps) {
  const router = useRouter();
  
  // Get workout categories from store
  const { workoutCategories, fetchWorkoutCategories } = useConfigurationStore();
  
  // Get fetchEvents from calendar store if not provided as prop
  const storeFetchEvents = useCalendarStore(state => state.fetchEvents);
  const storeEvents = useCalendarStore(state => state.events);
  const effectiveFetchEvents = fetchEvents || storeFetchEvents;
  
  // Use storeEvents if available (has extended range), otherwise fall back to allEvents prop
  const eventsForDetection = storeEvents.length > allEvents.length ? storeEvents : allEvents;
  
  // Fetch categories on mount
  useEffect(() => {
    if (workoutCategories.length === 0) {
      fetchWorkoutCategories();
    }
  }, [workoutCategories.length, fetchWorkoutCategories]);
  
  // Fetch extended events when dialog opens (up to 2 months in future)
  useEffect(() => {
    if (open && effectiveFetchEvents && event.start?.dateTime) {
      const eventDate = new Date(event.start.dateTime);
      const startDate = new Date(eventDate);
      startDate.setHours(0, 0, 0, 0);
      
      // Calculate 2 months in the future
      const endDate = new Date(eventDate);
      endDate.setMonth(endDate.getMonth() + 2);
      endDate.setHours(23, 59, 59, 999);
      
      setIsFetchingExtendedEvents(true);
      effectiveFetchEvents({ start: startDate, end: endDate })
        .then(() => {
          // Events will be in store, we'll use them in handleDetectEvents
          setIsFetchingExtendedEvents(false);
        })
        .catch(error => {
          console.error('Error fetching extended events:', error);
          setIsFetchingExtendedEvents(false);
        });
    }
  }, [open, effectiveFetchEvents, event.start?.dateTime]);
  
  // State for client assignment
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [patternResults, setPatternResults] = useState<PatternMatchResult[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);
  const [isAssigningAndGo, setIsAssigningAndGo] = useState(false); // Separate loading state for "Assign & Go" button
  const [isUnassigning, setIsUnassigning] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [assignmentError, setAssignmentError] = useState<string | null>(null);
  const [navigateAfterAssign, setNavigateAfterAssign] = useState(false);
  
  // State for repeat/pattern detection
  const [repeatEnabled, setRepeatEnabled] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [detectedEvents, setDetectedEvents] = useState<GoogleCalendarEvent[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [hasDetected, setHasDetected] = useState(false);
  const [extendedEvents, setExtendedEvents] = useState<GoogleCalendarEvent[]>([]); // Events fetched with extended range
  const [isFetchingExtendedEvents, setIsFetchingExtendedEvents] = useState(false);

  // Check if event already has a client
  const existingClientId = clientId || getEventClientId(event);
  const hasClient = !!existingClientId;
  
  // Check if event already has a category
  const existingCategory = getEventCategory(event);
  
  // Get linked workout ID (checks both direct property and description metadata)
  const linkedWorkoutId = getLinkedWorkoutId(event);
  const hasWorkout = !!linkedWorkoutId;
  
  // Get client name for display
  const getClientName = (id: string) => {
    return clients.find(c => c.id === id)?.name || 'Client';
  };

  const eventDate = event.start?.dateTime 
    ? new Date(event.start.dateTime)
    : new Date();

  const dateParam = eventDate.toISOString().split('T')[0];

  // Navigate to workout builder
  const navigateToWorkoutBuilder = (targetClientId: string, workoutId?: string) => {
    const eventIdParam = `&eventId=${event.id}`;
    const categoryParam = selectedCategory ? `&category=${encodeURIComponent(selectedCategory)}` : '';
    
    if (workoutId) {
      const workoutUrl = `/workouts/builder?client=${targetClientId}&date=${dateParam}&workoutId=${workoutId}`;
      router.push(workoutUrl);
    } else {
      const buildWorkoutUrl = `/workouts/builder?client=${targetClientId}&date=${dateParam}${eventIdParam}${categoryParam}`;
      router.push(buildWorkoutUrl);
    }
    onOpenChange(false);
  };

  const handleViewWorkout = () => {
    if (!linkedWorkoutId || !existingClientId) return;
    
    const workoutUrl = `/workouts/view?client=${existingClientId}&date=${dateParam}&workoutId=${linkedWorkoutId}`;
    router.push(workoutUrl);
    onOpenChange(false);
  };

  const handleCreateWorkout = () => {
    if (!existingClientId) return;
    navigateToWorkoutBuilder(existingClientId);
  };

  const handleOpenInCalendar = () => {
    if (event.htmlLink) {
      window.open(event.htmlLink, '_blank');
    }
    onOpenChange(false);
  };

  const handleEditWorkout = () => {
    if (!linkedWorkoutId || !existingClientId) return;
    navigateToWorkoutBuilder(existingClientId, linkedWorkoutId);
  };

  // Handle unassign client from event
  const handleUnassign = async () => {
    console.log('🔴 [handleUnassign] Button clicked!');
    console.log('🔴 [handleUnassign] Event:', event.id, event.summary);
    console.log('🔴 [handleUnassign] existingClientId:', existingClientId);
    console.log('🔴 [handleUnassign] linkedWorkoutId:', getLinkedWorkoutId(event));
    
    const hasWorkout = !!getLinkedWorkoutId(event);
    const message = hasWorkout 
      ? 'Remove client assignment from this event? This will also delete the associated workout.'
      : 'Remove client assignment from this event?';
    
    if (!confirm(message)) {
      console.log('🔴 [handleUnassign] User cancelled');
      return;
    }
    
    console.log('🔴 [handleUnassign] User confirmed, starting unassign...');
    setIsUnassigning(true);
    setAssignmentError(null);
    
    try {
      console.log('🔴 [handleUnassign] Calling unassignClientFromEvent...');
      const result = await unassignClientFromEvent(event);
      console.log('🔴 [handleUnassign] Result:', result);
      
      if (result.success) {
        console.log('✅ [handleUnassign] Successfully unassigned client from event');
        console.log('🔴 [handleUnassign] Calling onClientAssigned to refresh...');
        onClientAssigned?.(); // Refresh the calendar
        onOpenChange(false);
      } else {
        console.error('❌ [handleUnassign] Failed:', result.error);
        setAssignmentError(result.error || 'Failed to unassign client');
      }
    } catch (error) {
      console.error('❌ [handleUnassign] Error:', error);
      setAssignmentError(error instanceof Error ? error.message : 'Failed to unassign client');
    } finally {
      setIsUnassigning(false);
    }
  };

  // Handle delete event from Google Calendar
  const handleDeleteEvent = async () => {
    const hasWorkoutLinked = !!getLinkedWorkoutId(event);
    const message = hasWorkoutLinked
      ? 'Delete this event from your calendar? This will also remove the associated workout assignment.'
      : 'Delete this event from your calendar?';
    
    if (!confirm(message)) {
      return;
    }
    
    setIsDeleting(true);
    setAssignmentError(null);
    
    try {
      // If there's a linked workout, unassign first
      if (hasWorkoutLinked) {
        await unassignClientFromEvent(event);
      }
      
      // Delete from Google Calendar
      await deleteCalendarEvent(
        event.id,
        event.start.dateTime || event.start.date,
        'primary'
      );
      
      console.log('✅ Successfully deleted event from calendar');
      onClientAssigned?.(); // Refresh the calendar
      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting event:', error);
      setAssignmentError(error instanceof Error ? error.message : 'Failed to delete event');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle "Assign & Go to Calendar" button click
  const handleAssignAndGo = async () => {
    if (!selectedClientId) return;
    
    setAssignmentError(null);
    setNavigateAfterAssign(true);
    setIsAssigningAndGo(true); // Set specific loading state for this button
    
    try {
      // Find all patterns and matching events
      const results = findAllPatternsWithEvents(
        event,
        allEvents,
        selectedClientId,
        clientPrograms
      );
      
      // Count total events across all patterns
      const totalEvents = results.reduce((sum, pr) => sum + pr.events.length, 0);
      
      // If only one event (the clicked event), skip bulk confirm and assign directly
      if (totalEvents <= 1) {
        // Create a single-event pattern result for the clicked event
        const eventDate = new Date(event.start.dateTime);
        const singleEventPattern: PatternMatchResult[] = [{
          pattern: {
            dayOfWeek: eventDate.getDay(),
            time: eventDate.toTimeString().slice(0, 5),
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][eventDate.getDay()]
          },
          events: [event]
        }];
        
        // Directly call bulk confirm handler with navigate=true flag
        // Don't reset loading state here - handleBulkConfirm will handle it
        await handleBulkConfirm(singleEventPattern, true);
        return;
      }
      
      setPatternResults(results);
      setShowBulkConfirm(true);
      // Don't reset loading state here - it will be reset when bulk confirm completes or dialog closes
    } catch (error) {
      // Only reset on error
      setIsAssigningAndGo(false);
      throw error;
    }
  };

  // Handle "Assign" button click (assigns but stays on calendar)
  const handleAssign = async () => {
    if (!selectedClientId) return;
    
    setAssignmentError(null);
    setNavigateAfterAssign(false);
    setIsAssigning(true); // Set specific loading state for this button
    
    try {
      // Find all patterns and matching events
      const results = findAllPatternsWithEvents(
        event,
        allEvents,
        selectedClientId,
        clientPrograms
      );
      
      // Count total events across all patterns
      const totalEvents = results.reduce((sum, pr) => sum + pr.events.length, 0);
      
      // If only one event (the clicked event), skip bulk confirm and assign directly
      if (totalEvents <= 1) {
        // Create a single-event pattern result for the clicked event
        const eventDate = new Date(event.start.dateTime);
        const singleEventPattern: PatternMatchResult[] = [{
          pattern: {
            dayOfWeek: eventDate.getDay(),
            time: eventDate.toTimeString().slice(0, 5),
            dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][eventDate.getDay()]
          },
          events: [event]
        }];
        
        // Directly call bulk confirm handler with navigate=false flag
        // Don't reset loading state here - handleBulkConfirm will handle it
        await handleBulkConfirm(singleEventPattern, false);
        return;
      }
      
      setPatternResults(results);
      setShowBulkConfirm(true);
      // Don't reset loading state here - it will be reset when bulk confirm completes or dialog closes
    } catch (error) {
      // Only reset on error
      setIsAssigning(false);
      throw error;
    }
  };

  // Handle bulk assignment confirmation
  // shouldNavigate parameter allows direct calls to override the state-based flag
  const handleBulkConfirm = async (selectedPatterns: PatternMatchResult[], shouldNavigate?: boolean) => {
    if (!selectedClientId) return;
    
    // Use parameter if provided, otherwise use state
    const doNavigate = shouldNavigate !== undefined ? shouldNavigate : navigateAfterAssign;
    
    // Only set loading state if not already set (prevents race condition when called from handleAssign/handleAssignAndGo)
    // The calling function should have already set the appropriate loading state
    if (doNavigate && !isAssigningAndGo) {
      setIsAssigningAndGo(true);
    } else if (!doNavigate && !isAssigning) {
      setIsAssigning(true);
    }
    setAssignmentError(null);
    
    try {
      // Collect all events from selected patterns
      const allSelectedEvents = selectedPatterns.flatMap(pr => pr.events);
      
      // Deduplicate by event ID
      const uniqueEvents = Array.from(
        new Map(allSelectedEvents.map(e => [e.id, e])).values()
      );
      
      const clientName = getClientName(selectedClientId);
      
      console.log('[handleBulkConfirm] Assigning', uniqueEvents.length, 'events to', clientName, 'with category:', selectedCategory);
      
      // Perform bulk assignment
      const result: BulkAssignmentResult = await assignClientToEvents(
        uniqueEvents,
        selectedClientId,
        clientPrograms,
        clientName,
        selectedCategory || undefined
      );
      
      console.log('[handleBulkConfirm] Assignment result:', result);
      
      // Close bulk confirm dialog
      setShowBulkConfirm(false);
      
      // Notify parent to refresh
      onClientAssigned?.();
      
      // Show result message
      if (result.failed > 0) {
        console.warn(`Bulk assignment partial success: ${result.successful}/${result.total} events assigned`);
      } else {
        console.log(`Successfully assigned ${result.successful} events to ${clientName}`);
      }
      
      // Navigate to workout builder if requested
      if (doNavigate) {
        // Find the workout ID for the clicked event from the results
        const clickedEventResult = result.results.find(r => r.eventId === event.id);
        
        if (clickedEventResult?.workoutId) {
          // Found the workout for the clicked event - navigate directly to it
          console.log('✅ Found workout for clicked event:', clickedEventResult.workoutId);
          navigateToWorkoutBuilder(selectedClientId, clickedEventResult.workoutId);
        } else {
          // Fallback: Find any successful result (the clicked event should always be first)
          const firstSuccessful = result.results.find(r => r.success && r.workoutId);
          if (firstSuccessful?.workoutId) {
            console.log('⚠️ Using fallback workout:', firstSuccessful.workoutId);
            navigateToWorkoutBuilder(selectedClientId, firstSuccessful.workoutId);
          } else {
            // No workouts created - navigate without workoutId (will create new)
            console.error('❌ No workouts created during assignment');
            navigateToWorkoutBuilder(selectedClientId);
          }
        }
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Bulk assignment failed:', error);
      setAssignmentError(error instanceof Error ? error.message : 'Assignment failed');
    } finally {
      // Reset both loading states (only one should be active, but reset both to be safe)
      setIsAssigning(false);
      setIsAssigningAndGo(false);
      setNavigateAfterAssign(false);
    }
  };

  // Reset state when dialog closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSelectedClientId('');
      setSelectedCategory('');
      setShowBulkConfirm(false);
      setPatternResults([]);
      setAssignmentError(null);
      setNavigateAfterAssign(false);
      setIsAssigning(false);
      setIsAssigningAndGo(false);
      // Reset repeat/pattern state
      setRepeatEnabled(false);
      setSelectedDays(new Set());
      setDetectedEvents([]);
      setSelectedEventIds(new Set());
      setHasDetected(false);
    }
    onOpenChange(newOpen);
  };

  // Toggle day selection
  const toggleDay = (day: number) => {
    setSelectedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(day)) {
        newSet.delete(day);
      } else {
        newSet.add(day);
      }
      return newSet;
    });
    // Reset detection when days change
    setHasDetected(false);
    setDetectedEvents([]);
    setSelectedEventIds(new Set());
  };

  // Detect matching events based on selected days and time
  const handleDetectEvents = async () => {
    if (!event.start?.dateTime || selectedDays.size === 0) return;
    
    const eventTime = new Date(event.start.dateTime);
    const eventHours = eventTime.getHours();
    const eventMinutes = eventTime.getMinutes();
    const timeString = `${String(eventHours).padStart(2, '0')}:${String(eventMinutes).padStart(2, '0')}`;
    
    // Calculate date range: from event date to 2 months in the future
    const startDate = new Date(eventTime);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(eventTime);
    endDate.setMonth(endDate.getMonth() + 2);
    endDate.setHours(23, 59, 59, 999);
    
    // Fetch events for extended range if fetchEvents is available
    let eventsToSearch = eventsForDetection;
    if (effectiveFetchEvents) {
      setIsFetchingExtendedEvents(true);
      try {
        await effectiveFetchEvents({ start: startDate, end: endDate });
        // Get the latest events from the store after fetching
        const latestStoreEvents = useCalendarStore.getState().events;
        eventsToSearch = latestStoreEvents.length > 0 ? latestStoreEvents : eventsForDetection;
      } catch (error) {
        console.error('Error fetching extended events:', error);
        // Fall back to eventsForDetection if fetch fails
        eventsToSearch = eventsForDetection;
      } finally {
        setIsFetchingExtendedEvents(false);
      }
    }
    
    // Filter events matching the selected days and same time, within 2 months
    const matching = eventsToSearch.filter(e => {
      // Skip if already has a client assigned
      if (getEventClientId(e)) return false;
      
      if (!e.start?.dateTime) return false;
      
      const eDate = new Date(e.start.dateTime);
      
      // Only include events from event date up to 2 months in the future
      if (eDate < startDate || eDate > endDate) return false;
      
      const eDayOfWeek = eDate.getDay();
      const eHours = eDate.getHours();
      const eMinutes = eDate.getMinutes();
      const eTimeString = `${String(eHours).padStart(2, '0')}:${String(eMinutes).padStart(2, '0')}`;
      
      // Check if day matches and time matches
      return selectedDays.has(eDayOfWeek) && eTimeString === timeString;
    });
    
    // Sort by date
    matching.sort((a, b) => {
      const dateA = new Date(a.start.dateTime);
      const dateB = new Date(b.start.dateTime);
      return dateA.getTime() - dateB.getTime();
    });
    
    setDetectedEvents(matching);
    // Select all by default
    setSelectedEventIds(new Set(matching.map(e => e.id)));
    setHasDetected(true);
  };

  // Toggle individual event selection
  const toggleEventSelection = (eventId: string) => {
    setSelectedEventIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(eventId)) {
        newSet.delete(eventId);
      } else {
        newSet.add(eventId);
      }
      return newSet;
    });
  };

  // Select/deselect all detected events
  const toggleAllEvents = () => {
    if (selectedEventIds.size === detectedEvents.length) {
      setSelectedEventIds(new Set());
    } else {
      setSelectedEventIds(new Set(detectedEvents.map(e => e.id)));
    }
  };

  // Handle bulk assign from detected events (without navigation)
  const handleBulkAssignDetectedNoNavigate = async () => {
    if (!selectedClientId || selectedEventIds.size === 0) return;
    
    setIsAssigning(true);
    setAssignmentError(null);
    
    try {
      // Get only the selected events
      const eventsToAssign = detectedEvents.filter(e => selectedEventIds.has(e.id));
      
      const clientName = getClientName(selectedClientId);
      
      console.log('[handleBulkAssignDetectedNoNavigate] Assigning', eventsToAssign.length, 'events to', clientName);
      
      // Perform bulk assignment
      await assignClientToEvents(
        eventsToAssign,
        selectedClientId,
        clientPrograms,
        clientName,
        selectedCategory || undefined
      );
      
      // Notify parent to refresh
      onClientAssigned?.();
      
      // Close dialog and stay on calendar
      onOpenChange(false);
    } catch (error) {
      console.error('Bulk assignment failed:', error);
      setAssignmentError(error instanceof Error ? error.message : 'Assignment failed');
    } finally {
      setIsAssigning(false);
    }
  };

  // Handle bulk assign from detected events (with navigation to workout builder)
  const handleBulkAssignDetected = async () => {
    if (!selectedClientId || selectedEventIds.size === 0) return;
    
    setIsAssigningAndGo(true); // Use specific loading state for "Assign & Go" button
    setAssignmentError(null);
    
    try {
      // Get only the selected events
      const eventsToAssign = detectedEvents.filter(e => selectedEventIds.has(e.id));
      
      const clientName = getClientName(selectedClientId);
      
      console.log('[handleBulkAssignDetected] Assigning', eventsToAssign.length, 'events to', clientName);
      
      // Perform bulk assignment
      const result = await assignClientToEvents(
        eventsToAssign,
        selectedClientId,
        clientPrograms,
        clientName,
        selectedCategory || undefined
      );
      
      console.log('[handleBulkAssignDetected] Assignment result:', result);
      
      // Notify parent to refresh
      onClientAssigned?.();
      
      // Navigate to workout builder for the original clicked event
      const clickedEventResult = result.results.find(r => r.eventId === event.id);
      if (clickedEventResult?.workoutId) {
        navigateToWorkoutBuilder(selectedClientId, clickedEventResult.workoutId);
      } else {
        onOpenChange(false);
      }
    } catch (error) {
      console.error('Bulk assignment failed:', error);
      setAssignmentError(error instanceof Error ? error.message : 'Assignment failed');
    } finally {
      setIsAssigningAndGo(false);
    }
  };

  return (
    <>
      <Dialog open={open && !showBulkConfirm} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{event.summary || 'Event'}</DialogTitle>
            <DialogDescription>
              {event.start?.dateTime && (
                <span>
                  {/* Use app timezone for date display */}
                  {new Date(event.start.dateTime).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    timeZone: getAppTimezone()
                  })}
                  {event.start.dateTime && event.end?.dateTime && (
                    <span className="text-muted-foreground">
                      {' • '}
                      {new Date(event.start.dateTime).toLocaleTimeString('en-US', { 
                        hour: 'numeric', minute: '2-digit', hour12: true,
                        timeZone: getAppTimezone()
                      })} - {new Date(event.end.dateTime).toLocaleTimeString('en-US', { 
                        hour: 'numeric', minute: '2-digit', hour12: true,
                        timeZone: getAppTimezone()
                      })}
                    </span>
                  )}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 mt-4">
            {/* Unassigned Event - Show assignment flow */}
            {!hasClient && clients.length > 0 && (
              <>
                <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <UserPlus className="h-4 w-4" />
                    Assign Session
                  </div>
                  
                  {/* Client Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="client-select" className="text-sm text-muted-foreground">
                      Client
                    </Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger id="client-select">
                        <SelectValue placeholder="Select client..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(client => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Repeat Toggle - right after client selection */}
                  {selectedClientId && (
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="repeat-toggle" className="text-sm flex items-center gap-2 cursor-pointer">
                          <Repeat className="h-4 w-4" />
                          Does this repeat?
                        </Label>
                        <Switch
                          id="repeat-toggle"
                          checked={repeatEnabled}
                          onCheckedChange={(checked) => {
                            setRepeatEnabled(checked);
                            if (!checked) {
                              setSelectedDays(new Set());
                              setDetectedEvents([]);
                              setSelectedEventIds(new Set());
                              setHasDetected(false);
                            } else {
                              // Auto-select the day of the clicked event
                              const eventDay = new Date(event.start.dateTime).getDay();
                              setSelectedDays(new Set([eventDay]));
                            }
                          }}
                        />
                      </div>
                      
                      {/* Day Selector */}
                      {repeatEnabled && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => toggleDay(index)}
                                className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                                  selectedDays.has(index)
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-background hover:bg-muted border-input'
                                }`}
                              >
                                {day}
                              </button>
                            ))}
                          </div>
                          
                          {/* Detect Button */}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleDetectEvents}
                            disabled={selectedDays.size === 0 || isFetchingExtendedEvents}
                            className="w-full"
                          >
                            <Search className="mr-2 h-4 w-4" />
                            {isFetchingExtendedEvents ? 'Searching...' : 'Detect Matching Sessions'}
                          </Button>
                          
                          {/* Detected Events List */}
                          {hasDetected && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">
                                  Found {detectedEvents.length} sessions
                                </span>
                                {detectedEvents.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={toggleAllEvents}
                                    className="text-xs text-primary hover:underline"
                                  >
                                    {selectedEventIds.size === detectedEvents.length ? 'Deselect All' : 'Select All'}
                                  </button>
                                )}
                              </div>
                              
                              {detectedEvents.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-2">
                                  No matching unassigned sessions found
                                </p>
                              ) : (
                                <div className="max-h-48 overflow-y-auto space-y-1 border rounded-md p-2">
                                  {detectedEvents.map(e => {
                                    const eDate = new Date(e.start.dateTime);
                                    const appTz = getAppTimezone();
                                    const dateStr = eDate.toLocaleDateString('en-US', {
                                      weekday: 'short',
                                      month: 'short',
                                      day: 'numeric',
                                      timeZone: appTz
                                    });
                                    const timeStr = eDate.toLocaleTimeString('en-US', {
                                      hour: 'numeric',
                                      minute: '2-digit',
                                      hour12: true,
                                      timeZone: appTz
                                    });
                                    return (
                                      <label
                                        key={e.id}
                                        className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${
                                          selectedEventIds.has(e.id) ? 'bg-primary/10' : 'hover:bg-muted'
                                        }`}
                                      >
                                        <Checkbox
                                          checked={selectedEventIds.has(e.id)}
                                          onCheckedChange={() => toggleEventSelection(e.id)}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-sm font-medium truncate">
                                            {dateStr} @ {timeStr}
                                          </p>
                                          <p className="text-xs text-muted-foreground truncate">
                                            {e.summary}
                                          </p>
                                        </div>
                                        {selectedEventIds.has(e.id) && (
                                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                                        )}
                                      </label>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="category-select" className="text-sm text-muted-foreground">
                      Workout Category
                    </Label>
                    <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                      <SelectTrigger id="category-select">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workoutCategories.map(category => (
                          <SelectItem key={category.id} value={category.name}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: category.color }}
                              />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Assign Button(s) */}
                  {repeatEnabled && hasDetected && selectedEventIds.size > 0 ? (
                    <div className="space-y-2">
                      <Button 
                        onClick={handleBulkAssignDetectedNoNavigate}
                        disabled={!selectedClientId || isAssigning || selectedEventIds.size === 0}
                        className="w-full"
                        variant="default"
                        size="lg"
                      >
                        {isAssigning ? (
                          'Assigning...'
                        ) : (
                          <>
                            <Users className="mr-2 h-4 w-4 icon-clients" />
                            Assign {selectedEventIds.size} Session{selectedEventIds.size !== 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={handleBulkAssignDetected}
                        disabled={!selectedClientId || isAssigning || isAssigningAndGo || selectedEventIds.size === 0}
                        className="w-full"
                        variant="outline"
                        size="lg"
                      >
                        {isAssigningAndGo ? (
                          'Assigning...'
                        ) : (
                          <>
                            <Users className="mr-2 h-4 w-4 icon-clients" />
                            Assign {selectedEventIds.size} Session{selectedEventIds.size !== 1 ? 's' : ''} & Go to Workout
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Button 
                        onClick={handleAssign}
                        disabled={!selectedClientId || isAssigning || isAssigningAndGo}
                        className="w-full"
                        variant="default"
                        size="lg"
                      >
                        {isAssigning ? (
                          'Assigning...'
                        ) : (
                          <>
                            <Users className="mr-2 h-4 w-4 icon-clients" />
                            Assign & Go to Calendar
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                      <Button 
                        onClick={handleAssignAndGo}
                        disabled={!selectedClientId || isAssigning || isAssigningAndGo}
                        className="w-full"
                        variant="outline"
                        size="lg"
                      >
                        {isAssigningAndGo ? (
                          'Assigning...'
                        ) : (
                          <>
                            <Users className="mr-2 h-4 w-4 icon-clients" />
                            Assign & Go to Workout
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {assignmentError && (
                    <p className="text-sm text-destructive">{assignmentError}</p>
                  )}
                </div>
                <Separator />
              </>
            )}

            {/* Client assigned but no workout - Show category selection and create */}
            {hasClient && !event.linkedWorkoutId && (
              <>
                <div className="space-y-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 text-sm font-medium text-blue-800">
                    <Tag className="h-4 w-4" />
                    Create Workout for {getClientName(existingClientId!)}
                  </div>
                  
                  {/* Category Selection */}
                  <div className="space-y-2">
                    <Label htmlFor="category-select-existing" className="text-sm text-muted-foreground">
                      Workout Category
                    </Label>
                    <Select value={selectedCategory || existingCategory || ''} onValueChange={setSelectedCategory}>
                      <SelectTrigger id="category-select-existing">
                        <SelectValue placeholder="Select category..." />
                      </SelectTrigger>
                      <SelectContent>
                        {workoutCategories.map(category => (
                          <SelectItem key={category.id} value={category.name}>
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: category.color }}
                              />
                              {category.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button 
                    onClick={handleCreateWorkout}
                    className="w-full"
                    variant="outline"
                    size="lg"
                  >
                    <Plus className="mr-1.5 h-4 w-4 icon-add" />
                    Create Workout
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
                <Separator />
              </>
            )}

            {/* Workout already linked - Show view/edit options */}
            {event.linkedWorkoutId && (
              <>
                <Button
                  onClick={handleViewWorkout}
                  className="w-full justify-start"
                  variant="default"
                  size="lg"
                >
                  <Dumbbell className="mr-2 h-4 w-4" />
                  View Workout
                </Button>
                {existingClientId && (
                  <Button
                    onClick={handleEditWorkout}
                    className="w-full justify-start"
                    variant="outline"
                  >
                    <Dumbbell className="mr-2 h-4 w-4" />
                    Edit Workout
                  </Button>
                )}
              </>
            )}

            {/* Unassign Client - Show when client is assigned */}
            {hasClient && (
              <>
                <Separator />
                <Button
                  onClick={handleUnassign}
                  disabled={isUnassigning}
                  className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                  variant="ghost"
                  size="sm"
                >
                  <UserMinus className="mr-2 h-4 w-4" />
                  {isUnassigning ? 'Removing...' : 'Remove Client Assignment'}
                </Button>
              </>
            )}

            {/* Google Calendar Link */}
            {event.htmlLink && (
              <Button
                onClick={handleOpenInCalendar}
                className="w-full justify-start"
                variant="ghost"
                size="sm"
              >
                <Calendar className="mr-2 h-4 w-4 icon-schedule" />
                Open in Google Calendar
                <ExternalLink className="ml-2 h-4 w-4" />
              </Button>
            )}
            
            {/* Delete Event */}
            <Separator />
            <Button
              onClick={handleDeleteEvent}
              disabled={isDeleting}
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              variant="ghost"
              size="sm"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? 'Deleting...' : 'Delete Event'}
            </Button>
            
            {/* Error Display */}
            {assignmentError && (
              <p className="text-sm text-destructive text-center">{assignmentError}</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assignment Confirmation Dialog */}
      <BulkAssignmentConfirmDialog
        open={showBulkConfirm}
        onOpenChange={(newOpen) => {
          if (!newOpen) {
            setShowBulkConfirm(false);
          }
        }}
        clientName={getClientName(selectedClientId)}
        patternResults={patternResults}
        onConfirm={handleBulkConfirm}
        isLoading={isAssigning}
      />
    </>
  );
}


















