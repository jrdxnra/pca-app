"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    SquareArrowOutUpRight,
    Users,
} from 'lucide-react';

// Import hooks and types
import { useClients } from '@/hooks/queries/useClients';
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientWorkout, ClientProgramPeriod } from '@/lib/types';
import { TwoColumnWeekView } from '@/components/programs/TwoColumnWeekView';
import { fetchWorkoutsByDateRange, fetchAllWorkoutsByDateRange } from '@/lib/firebase/services/clientWorkouts';
import { Timestamp } from 'firebase/firestore';
import { safeToDate } from '@/lib/utils/dateHelpers';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';

// Batch 1: Event → Workout Flow Dialogs
import { EventActionDialog } from '@/components/programs/EventActionDialog';
import { QuickWorkoutBuilderDialog } from '@/components/programs/QuickWorkoutBuilderDialog';

// Mutations
import { useUpdateCalendarEvent, useDeleteCalendarEvent } from '@/hooks/mutations/useCalendarMutations';

export default function SchedulePage() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Store state
    const selectedClient = useProgramStore(state => state.selectedClient);
    const setSelectedClient = useProgramStore(state => state.setSelectedClient);
    const calendarDate = useProgramStore(state => state.calendarDate);
    const setCalendarDate = useProgramStore(state => state.setCalendarDate);
    const navigateWeek = useProgramStore(state => state.navigateWeek);

    // Calendar store for mutations
    const linkToWorkout = useCalendarStore(state => state.linkToWorkout);

    // Mutations
    const updateCalendarEventMutation = useUpdateCalendarEvent();
    const deleteCalendarEventMutation = useDeleteCalendarEvent();

    // Wrapper functions for backward compatibility
    const updateEvent = async (eventId: string, updates: Partial<GoogleCalendarEvent>) => {
        await updateCalendarEventMutation.mutateAsync({ id: eventId, updates });
    };

    const deleteEvent = async (eventId: string) => {
        await deleteCalendarEventMutation.mutateAsync(eventId);
    };

    // Local state
    const [includeWeekends, setIncludeWeekends] = useState(false);
    const [workouts, setWorkouts] = useState<ClientWorkout[]>([]);
    const [calendarKey, setCalendarKey] = useState(0);

    // Batch 1: Event → Workout Flow State
    const [eventActionDialogOpen, setEventActionDialogOpen] = useState(false);
    const [selectedEventForAction, setSelectedEventForAction] = useState<GoogleCalendarEvent | null>(null);
    const [quickWorkoutDialogOpen, setQuickWorkoutDialogOpen] = useState(false);
    const [selectedEventForWorkout, setSelectedEventForWorkout] = useState<GoogleCalendarEvent | null>(null);

    // Fetch clients
    const { data: clients = [], isLoading: clientsLoading } = useClients(false);

    // Fetch client programs
    const { clientPrograms } = useClientPrograms(selectedClient);

    // Calculate date range for current week
    const dateRange = (() => {
        if (!calendarDate) return null;
        const startDate = new Date(calendarDate);
        startDate.setDate(calendarDate.getDate() - calendarDate.getDay());
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        return { start: startDate, end: endDate };
    })();

    // Fetch calendar events for the date range
    const { data: calendarEvents = [], isLoading: eventsLoading } = useCalendarEvents(
        dateRange?.start,
        dateRange?.end
    );

    // Fetch workouts for the current week
    useEffect(() => {
        if (!dateRange) return;

        let cancelled = false;

        const fetchData = async () => {
            if (cancelled) return;

            try {
                const expandedStart = new Date(dateRange.start);
                expandedStart.setDate(expandedStart.getDate() - 7);
                const expandedEnd = new Date(dateRange.end);
                expandedEnd.setDate(expandedEnd.getDate() + 7);

                if (selectedClient) {
                    const freshWorkouts = await fetchWorkoutsByDateRange(
                        selectedClient,
                        Timestamp.fromDate(expandedStart),
                        Timestamp.fromDate(expandedEnd)
                    );
                    if (!cancelled) {
                        setWorkouts(freshWorkouts);
                    }
                } else {
                    const freshWorkouts = await fetchAllWorkoutsByDateRange(
                        Timestamp.fromDate(expandedStart),
                        Timestamp.fromDate(expandedEnd)
                    );
                    if (!cancelled) {
                        setWorkouts(freshWorkouts);
                    }
                }
            } catch (error) {
                if (!cancelled) {
                    console.error('Error fetching workouts:', error);
                }
            }
        };

        fetchData();

        return () => {
            cancelled = true;
        };
    }, [dateRange?.start?.getTime(), dateRange?.end?.getTime(), selectedClient]);

    // Navigation handlers
    const handleNavigate = (direction: 'prev' | 'next' | 'today') => {
        if (direction === 'today') {
            setCalendarDate(new Date());
        } else if (direction === 'prev') {
            navigateWeek(-1);
        } else {
            navigateWeek(1);
        }
    };

    const handleClientChange = (clientId: string) => {
        setSelectedClient(clientId === 'all' ? null : clientId);
    };

    // Generate Google Calendar URL for the current week
    const getGoogleCalendarUrl = () => {
        const weekStart = new Date(calendarDate);
        weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
        const year = weekStart.getFullYear();
        const month = weekStart.getMonth() + 1;
        const day = weekStart.getDate();
        return `https://calendar.google.com/calendar/u/0/r/week/${year}/${month}/${day}`;
    };

    // Get navigation label
    const getNavigationLabel = () => {
        const weekStart = new Date(calendarDate);
        weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    };

    // Batch 1: Event Click Handler - Opens EventActionDialog
    const handleEventClick = (event: GoogleCalendarEvent) => {
        console.log('Event clicked:', event);
        setSelectedEventForAction(event);
        setEventActionDialogOpen(true);
    };

    // Batch 1: Workout Click Handler - Navigate to workout builder
    const handleWorkoutClick = (workout: ClientWorkout) => {
        console.log('Workout clicked:', workout);
        if (selectedClient && workout.periodId) {
            router.push(`/programs/${selectedClient}/period/${workout.periodId}/workout/${workout.id}`);
        }
    };

    // Batch 1: Quick Workout Builder Dialog
    const handleCreateWorkoutFromEvent = (event: GoogleCalendarEvent) => {
        setSelectedEventForWorkout(event);
        setQuickWorkoutDialogOpen(true);
        setEventActionDialogOpen(false);
    };

    // New: Handle empty slot click in schedule grid
    const [selectedDateForWorkout, setSelectedDateForWorkout] = useState<Date | null>(null);
    const [selectedTimeForWorkout, setSelectedTimeForWorkout] = useState<Date | null>(null);

    const handleCellClick = (date: Date, timeSlot: Date) => {
        // If a specific client is selected, we can open the builder immediately
        // If "All Clients" is selected, the dialog will prompt for client selection
        setSelectedDateForWorkout(date);
        setSelectedTimeForWorkout(timeSlot);
        setQuickWorkoutDialogOpen(true);
    };

    return (
        <div className="flex flex-col h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 px-4 py-2">
                <div className="flex flex-wrap items-center justify-between gap-1 gap-y-4">
                    {/* Left: Client Selector & Navigation */}
                    <div className="flex items-center gap-1 lg:gap-2">
                        {/* Client Selector */}
                        <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            <Select
                                value={selectedClient || 'all'}
                                onValueChange={handleClientChange}
                            >
                                <SelectTrigger className="w-[130px]">
                                    <SelectValue placeholder="Select client" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Clients</SelectItem>
                                    {clients.map(client => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Separator */}
                        <div className="h-4 w-px bg-slate-200 mx-1 lg:mx-2"></div>

                        {/* Navigation */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleNavigate('today')}
                            className="text-sm px-3 h-8"
                        >
                            Today
                        </Button>
                        <div className="flex items-center rounded-md border border-input shadow-sm">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNavigate('prev')}
                                className="p-1 h-8 w-8 rounded-l-md rounded-r-none border-r hover:bg-slate-50"
                            >
                                <ChevronLeft className="h-4 w-4 icon-schedule" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNavigate('next')}
                                className="p-1 h-8 w-8 rounded-r-md rounded-l-none hover:bg-slate-50"
                            >
                                <ChevronRight className="h-4 w-4 icon-schedule" />
                            </Button>
                        </div>
                        <div className="ml-2 flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">
                                {getNavigationLabel()}
                            </span>
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-4">
                        {/* Weekends Toggle */}
                        <div className="flex items-center gap-2">
                            <label className="text-sm text-gray-600">Include Weekends</label>
                            <input
                                type="checkbox"
                                checked={includeWeekends}
                                onChange={(e) => setIncludeWeekends(e.target.checked)}
                                className="rounded"
                            />
                        </div>

                        {/* Google Calendar Link */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(getGoogleCalendarUrl(), '_blank')}
                        >
                            <SquareArrowOutUpRight className="h-4 w-4 mr-2" />
                            Google Calendar
                        </Button>
                    </div>
                </div>
            </div>

            {/* Two-Column Week View */}
            <div className="flex-1 overflow-auto p-6">
                <TwoColumnWeekView
                    calendarDate={calendarDate}
                    calendarEvents={calendarEvents}
                    workouts={workouts}
                    selectedClient={selectedClient}
                    clients={clients}
                    clientPrograms={clientPrograms}
                    includeWeekends={includeWeekends}
                    onEventClick={handleEventClick}
                    onWorkoutClick={handleWorkoutClick}
                    onScheduleCellClick={handleCellClick}
                    onWorkoutCellClick={handleCellClick}
                />
            </div>

            {/* Loading State */}
            {(clientsLoading || eventsLoading) && (
                <div className="fixed inset-0 bg-black/20 flex items-center justify-center pointer-events-none">
                    <div className="bg-white rounded-lg p-6 shadow-xl">
                        <p className="text-gray-700">Loading...</p>
                    </div>
                </div>
            )}

            {/* Batch 1: Event Action Dialog */}
            {selectedEventForAction && (
                <EventActionDialog
                    open={eventActionDialogOpen}
                    onOpenChange={setEventActionDialogOpen}
                    event={selectedEventForAction}
                    clientId={selectedClient || undefined}
                    allEvents={calendarEvents}
                    clients={clients}
                    clientPrograms={clientPrograms}
                    fetchEvents={async (dateRange: { start: Date; end: Date }) => {
                        queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
                    }}
                    onClientAssigned={async () => {
                        setSelectedEventForAction(null);
                        const weekStart = new Date(calendarDate);
                        weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
                        const weekEnd = new Date(weekStart);
                        weekEnd.setDate(weekStart.getDate() + 6);
                        queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
                        setCalendarKey(prev => prev + 1);
                    }}
                />
            )}

            {/* Batch 1: Quick Workout Builder Dialog */}
            {(selectedClient || selectedEventForWorkout || selectedDateForWorkout) && (
                <QuickWorkoutBuilderDialog
                    clientId={selectedClient || 'all'}
                    clientName={selectedClient ? (clients.find(c => c.id === selectedClient)?.name || 'Unknown Client') : 'Select Client'}
                    initialOpen={quickWorkoutDialogOpen}
                    initialDate={
                        selectedEventForWorkout
                            ? new Date(selectedEventForWorkout.start.dateTime).toISOString().split('T')[0]
                            : selectedDateForWorkout
                                ? selectedDateForWorkout.toISOString().split('T')[0]
                                : undefined
                    }
                    initialTime={
                        selectedEventForWorkout
                            ? new Date(selectedEventForWorkout.start.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                            : selectedTimeForWorkout
                                ? selectedTimeForWorkout.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
                                : undefined
                    }
                    eventId={selectedEventForWorkout?.id}
                    onClose={() => {
                        setQuickWorkoutDialogOpen(false);
                        setSelectedEventForWorkout(null);
                        setSelectedDateForWorkout(null);
                        setSelectedTimeForWorkout(null);
                    }}
                    onWorkoutCreated={() => {
                        setQuickWorkoutDialogOpen(false);
                        setSelectedEventForWorkout(null);
                        setSelectedDateForWorkout(null);
                        setSelectedTimeForWorkout(null);
                        // Refresh workouts
                        setCalendarKey(prev => prev + 1);
                        queryClient.invalidateQueries({ queryKey: queryKeys.calendarEvents.all });
                    }}
                />
            )}
        </div>
    );
}
