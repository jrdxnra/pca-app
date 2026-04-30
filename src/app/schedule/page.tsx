"use client";

import { useState, useEffect, useRef } from 'react';
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
import { useSetupHubProgress } from '@/hooks/useSetupHubProgress';
import { useCalendarEvents } from '@/hooks/queries/useCalendarEvents';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientWorkout } from '@/lib/types';
import { TwoColumnWeekView } from '@/components/programs/TwoColumnWeekView';
import { fetchWorkoutsByDateRange, fetchAllWorkoutsByDateRange } from '@/lib/firebase/services/clientWorkouts';
import { Timestamp } from 'firebase/firestore';
import { safeToDate } from '@/lib/utils/dateHelpers';
import { format } from 'date-fns';
import { getEventCategory, getEventClientId, getLinkedWorkoutId } from '@/lib/utils/event-patterns';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';

import { QuickWorkoutBuilderDialog } from '@/components/programs/QuickWorkoutBuilderDialog';

// Mutations
import { useUpdateCalendarEvent, useDeleteCalendarEvent } from '@/hooks/mutations/useCalendarMutations';
import { SetupHubDialog } from '@/components/onboarding/SetupHubDialog';

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
    const { isGoogleCalendarConnected, selectedCalendarId } = useCalendarStore(state => ({
        isGoogleCalendarConnected: state.isGoogleCalendarConnected,
        selectedCalendarId: state.config.selectedCalendarId,
    }));

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

    // Batch 1: Event Click Handler - Navigate directly to builder with resolved client/workout.
    const handleEventClick = async (event: GoogleCalendarEvent) => {
        type CandidateWorkout = { id: string; time?: string; categoryName?: string };

        const eventDate = new Date(event.start.dateTime);
        const dateParam = format(eventDate, 'yyyy-MM-dd');
        const eventCategory = getEventCategory(event)?.toLowerCase() || '';
        const eventSummary = (event.summary || '').toLowerCase();
        const eventMinutes = eventDate.getHours() * 60 + eventDate.getMinutes();

        const toMinutes = (time?: string): number | null => {
            if (!time) return null;
            const parts = time.split(':');
            if (parts.length < 2) return null;
            const h = Number(parts[0]);
            const m = Number(parts[1]);
            if (Number.isNaN(h) || Number.isNaN(m)) return null;
            return h * 60 + m;
        };

        const scoreWorkout = (workout: CandidateWorkout): number => {
            let score = 0;
            const wm = toMinutes(workout.time);
            if (wm !== null) {
                const diff = Math.abs(wm - eventMinutes);
                score += Math.max(0, 240 - diff);
            }

            const wc = (workout.categoryName || '').toLowerCase();
            if (eventCategory && wc) {
                if (wc.includes(eventCategory) || eventCategory.includes(wc)) {
                    score += 200;
                }
            }

            return score;
        };

        const pickBestWorkout = (workouts: CandidateWorkout[]): CandidateWorkout | null => {
            if (!workouts.length) return null;
            return workouts.reduce((best, current) => {
                if (!best) return current;
                return scoreWorkout(current) > scoreWorkout(best) ? current : best;
            }, null as CandidateWorkout | null);
        };

        let clientIdFromEvent = getEventClientId(event) || selectedClient || null;
        let linkedWorkoutId = getLinkedWorkoutId(event);

        if (!linkedWorkoutId) {
            try {
                const { getEventWorkoutLinkByEventId } = await import('@/lib/firebase/services/eventWorkoutLinks');
                const trackerLink = await getEventWorkoutLinkByEventId(event.id);
                if (trackerLink?.workoutId) {
                    linkedWorkoutId = trackerLink.workoutId;
                    if (!clientIdFromEvent && trackerLink.clientId) {
                        clientIdFromEvent = trackerLink.clientId;
                    }
                }
            } catch (error) {
                console.error('Failed to read tracker link for event:', event.id, error);
            }
        }

        if (!clientIdFromEvent && event.summary) {
            const matchedClient = clients.find(c => eventSummary.includes(c.name.toLowerCase()));
            if (matchedClient) {
                clientIdFromEvent = matchedClient.id;
            }
        }

        if (!linkedWorkoutId && clientIdFromEvent) {
            try {
                const dayStart = new Date(eventDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(eventDate);
                dayEnd.setHours(23, 59, 59, 999);

                const dayWorkouts = await fetchWorkoutsByDateRange(
                    clientIdFromEvent,
                    Timestamp.fromDate(dayStart),
                    Timestamp.fromDate(dayEnd)
                );

                const bestWorkout = pickBestWorkout(dayWorkouts);
                if (bestWorkout?.id) {
                    linkedWorkoutId = bestWorkout.id;
                }
            } catch (error) {
                console.error('Failed to lookup workout:', error);
            }
        }

        if (!linkedWorkoutId && !clientIdFromEvent && clients.length > 0) {
            try {
                const dayStart = new Date(eventDate);
                dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(eventDate);
                dayEnd.setHours(23, 59, 59, 999);

                const checks = await Promise.all(
                    clients.map(async (client) => {
                        const dayWorkouts = await fetchWorkoutsByDateRange(
                            client.id,
                            Timestamp.fromDate(dayStart),
                            Timestamp.fromDate(dayEnd)
                        );
                        return { clientId: client.id, workouts: dayWorkouts };
                    })
                );

                const candidates = checks.flatMap(c => {
                    const client = clients.find(x => x.id === c.clientId);
                    const clientName = (client?.name || '').toLowerCase();
                    const clientNameBonus = clientName && eventSummary.includes(clientName) ? 300 : 0;
                    return c.workouts.map(w => ({
                        clientId: c.clientId,
                        workoutId: w.id,
                        score: scoreWorkout(w) + clientNameBonus,
                    }));
                });

                if (candidates.length > 0) {
                    const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
                    clientIdFromEvent = best.clientId;
                    linkedWorkoutId = best.workoutId;
                }
            } catch (error) {
                console.error('Failed to infer workout/client from day workouts:', error);
            }
        }

        const params = new URLSearchParams();
        params.set('date', dateParam);
        params.set('eventId', event.id);

        if (clientIdFromEvent) {
            params.set('client', clientIdFromEvent);
        }

        if (linkedWorkoutId) {
            params.set('workoutId', linkedWorkoutId);
        }

        router.push(`/workouts/builder?${params.toString()}`);
    };

    // Batch 1: Workout Click Handler - Navigate to workout builder
    const handleWorkoutClick = (workout: ClientWorkout) => {
        console.log('Workout clicked:', workout);
        if (selectedClient && workout.periodId) {
            router.push(`/programs/${selectedClient}/period/${workout.periodId}/workout/${workout.id}`);
        }
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

    const calendarReady = Boolean(isGoogleCalendarConnected && selectedCalendarId);
    const hasClients = clients.length > 0;
    const { status: onboardingStatus, isLoading: onboardingLoading, needsSetup } = useSetupHubProgress(calendarReady, hasClients);

    const [showSetupHub, setShowSetupHub] = useState(false);
    const [hubDismissed, setHubDismissed] = useState(false);
    const lastStatusRef = useRef<string>('init');

    useEffect(() => {
        const statusKey = `${calendarReady ? 1 : 0}-${hasClients ? 1 : 0}-${onboardingStatus?.calendarComplete ? 1 : 0}-${onboardingStatus?.clientsComplete ? 1 : 0}`;
        if (statusKey !== lastStatusRef.current) {
            lastStatusRef.current = statusKey;
            setHubDismissed(false);
        }
    }, [calendarReady, hasClients, onboardingStatus]);

    useEffect(() => {
        if (needsSetup === undefined || onboardingLoading || clientsLoading) {
            return;
        }

        if (needsSetup) {
            if (!hubDismissed) {
                setShowSetupHub(true);
            }
        } else {
            setShowSetupHub(false);
            setHubDismissed(false);
        }
    }, [needsSetup, onboardingLoading, clientsLoading, hubDismissed]);

    const handleSetupOpenChange = (open: boolean) => {
        if (!open) {
            setShowSetupHub(false);
            setHubDismissed(true);
        } else {
            setHubDismissed(false);
            setShowSetupHub(true);
        }
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

            <SetupHubDialog
                open={showSetupHub}
                onOpenChange={handleSetupOpenChange}
                calendarReady={calendarReady}
                hasClients={hasClients}
                onConnectCalendar={() => router.push('/configure?tab=app')}
                onAddClients={() => router.push('/clients')}
                selectedCalendarLabel={selectedCalendarId || undefined}
            />

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
