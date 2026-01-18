'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { format, getDay } from 'date-fns';
import { ClientProgram, ClientProgramPeriod } from '@/lib/types';
import { safeToDate, getDateKey, isDateInRange } from '@/lib/utils/dateHelpers';
import {
    createClientProgram,
    getClientProgramsByClient,
    getAllClientPrograms,
    updateClientProgram,
    addPeriodToClientProgram,
    updatePeriodInClientProgram,
    deletePeriodFromClientProgram,
    deleteAllPeriodsFromClientProgram,
    assignProgramTemplateToClient
} from '@/lib/firebase/services/clientPrograms';
import {
    createClientWorkout,
    deleteClientWorkout,
    fetchWorkoutsByDateRange,
    fetchPeriodWorkouts
} from '@/lib/firebase/services/clientWorkouts';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { createRecurringCalendarEvent, checkGoogleCalendarAuth } from '@/lib/google-calendar/api-client';
import { weekTemplateToRRULE } from '@/lib/google-calendar/rrule-utils';

export interface PeriodAssignment {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{ time?: string; isAllDay: boolean; category?: string; deleted?: boolean }>;
}

export interface ProgramTemplateAssignment {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
}

interface UseClientProgramsResult {
    // State
    clientPrograms: ClientProgram[];
    isLoading: boolean;
    error: string | null;

    // Actions
    fetchClientPrograms: (clientId?: string | null) => Promise<void>;
    assignPeriod: (assignment: PeriodAssignment) => Promise<void>;
    assignProgramTemplate: (assignment: ProgramTemplateAssignment) => Promise<void>;
    updatePeriod: (periodId: string, updates: Partial<ClientProgramPeriod>) => Promise<void>;
    deletePeriod: (periodId: string, clientId: string) => Promise<void>;
    clearAllPeriods: (clientId: string) => Promise<void>;

    // Helpers
    findPeriodForDate: (date: Date, clientId: string) => ClientProgramPeriod | null;
    getClientProgram: (clientId: string) => ClientProgram | undefined;
}

export function useClientPrograms(selectedClientId?: string | null): UseClientProgramsResult {
    const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Get configuration data - use selectors to prevent re-renders
    const configPeriods = useConfigurationStore(state => state.periods);
    const weekTemplates = useConfigurationStore(state => state.weekTemplates);
    const workoutCategories = useConfigurationStore(state => state.workoutCategories);
    const clients = useClientStore(state => state.clients);
    // Only subscribe to calendar store functions we actually use
    const createTestEvent = useCalendarStore(state => state.createTestEvent);
    const fetchEvents = useCalendarStore(state => state.fetchEvents);
    const updateEvent = useCalendarStore(state => state.updateEvent);
    const deleteEvent = useCalendarStore(state => state.deleteEvent);
    // Don't subscribe to calendarEvents in the hook - it causes re-renders when ModernCalendarView fetches events
    // Instead, get events directly from store when needed (in clearAllPeriods)

    // Fetch client programs
    const fetchClientProgramsAsync = useCallback(async (clientId?: string | null) => {
        try {
            setIsLoading(true);
            setError(null);

            let programs: ClientProgram[];
            if (clientId) {
                programs = await getClientProgramsByClient(clientId);
            } else {
                programs = await getAllClientPrograms();
            }

            setClientPrograms(programs);
        } catch (err) {
            console.error('Error fetching client programs:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch client programs');
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Auto-fetch when selected client changes
    // Use ref to track last selectedClientId to prevent unnecessary fetches
    const lastSelectedClientIdRef = useRef<string | null | undefined>(selectedClientId);
    
    useEffect(() => {
        // Only fetch if selectedClientId actually changed
        if (lastSelectedClientIdRef.current !== selectedClientId) {
            lastSelectedClientIdRef.current = selectedClientId;
            fetchClientProgramsAsync(selectedClientId);
        }
    }, [selectedClientId, fetchClientProgramsAsync]); // Include fetchClientProgramsAsync but guard with ref

    // Get a specific client's program
    const getClientProgramForClient = useCallback((clientId: string): ClientProgram | undefined => {
        return clientPrograms.find(cp => cp.clientId === clientId);
    }, [clientPrograms]);

    // Find period for a specific date
    const findPeriodForDate = useCallback((date: Date, clientId: string): ClientProgramPeriod | null => {
        const clientProgram = getClientProgramForClient(clientId);
        if (!clientProgram) return null;

        return clientProgram.periods.find(period => {
            const start = safeToDate(period.startDate);
            const end = safeToDate(period.endDate);
            return isDateInRange(date, start, end);
        }) || null;
    }, [getClientProgramForClient]);

    // Assign a period to a client
    const assignPeriod = useCallback(async (assignment: PeriodAssignment) => {
        setIsLoading(true);
        setError(null);

        try {
            // Find or create client program
            const clientProgram = clientPrograms.find(cp => cp.clientId === assignment.clientId);
            let clientProgramId: string;

            if (!clientProgram) {
                // Create new client program
                const newClientProgram = await createClientProgram({
                    clientId: assignment.clientId,
                    startDate: Timestamp.fromDate(assignment.startDate),
                    endDate: Timestamp.fromDate(assignment.endDate),
                    status: 'active' as const,
                    periods: [],
                    createdBy: 'current-user' // TODO: Get from auth
                });
                clientProgramId = newClientProgram.id;
            } else {
                clientProgramId = clientProgram.id;
            }

            // Find the period configuration
            const periodConfig = configPeriods.find(p => p.id === assignment.periodId);
            const weekTemplate = weekTemplates.find(wt => wt.id === assignment.weekTemplateId);

            if (!periodConfig) {
                throw new Error('Period configuration not found');
            }

            // Create the new period
            const newPeriod: Omit<ClientProgramPeriod, 'id'> = {
                periodConfigId: assignment.periodId,
                periodName: periodConfig.name,
                periodColor: periodConfig.color,
                startDate: Timestamp.fromDate(assignment.startDate),
                endDate: Timestamp.fromDate(assignment.endDate),
                weekTemplateId: assignment.weekTemplateId,
                days: []
            };

            // Generate days if week template is applied OR if dayTimes were provided (inline custom week)
            const hasDayTimes = assignment.dayTimes && assignment.dayTimes.length > 0;
            
            if (weekTemplate || hasDayTimes) {
                const days = [];
                const currentDate = new Date(assignment.startDate);
                const endDate = new Date(assignment.endDate);

                // Build a mapping of day names to their settings from dayTimes
                // The editor uses: Monday(0), Tuesday(1), Wednesday(2), Thursday(3), Friday(4), Saturday(5), Sunday(6)
                const dayNameToIndex: Record<string, number> = {
                    'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
                    'Friday': 4, 'Saturday': 5, 'Sunday': 6
                };

                while (currentDate <= endDate) {
                    const dayOfWeek = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
                    
                    // Get template day if week template exists
                    const templateDay = weekTemplate?.days.find((d: { day: string }) => d.day === dayOfWeek);
                    
                    // Find day settings by matching day name
                    let dayTimeSettings = null;
                    if (weekTemplate && assignment.dayTimes) {
                        // For saved templates, dayTimes array matches the template.days array order
                        const templateDayIndex = weekTemplate.days.findIndex((d: { day: string }) => d.day === dayOfWeek);
                        if (templateDayIndex >= 0 && templateDayIndex < assignment.dayTimes.length) {
                            dayTimeSettings = assignment.dayTimes[templateDayIndex];
                        }
                    } else if (assignment.dayTimes) {
                        // For inline custom weeks without saved template, use the dayNameToIndex mapping
                        const dayIndex = dayNameToIndex[dayOfWeek];
                        if (dayIndex !== undefined && dayIndex < assignment.dayTimes.length) {
                            dayTimeSettings = assignment.dayTimes[dayIndex];
                        }
                    }

                    // Skip deleted days
                    if (dayTimeSettings?.deleted) {
                        currentDate.setDate(currentDate.getDate() + 1);
                        continue;
                    }

                    const dayDate = new Date(currentDate.getTime());

                    // Determine the category - from dayTimeSettings, templateDay, or default to Rest Day
                    const finalCategory = dayTimeSettings?.category || templateDay?.workoutCategory || 'Rest Day';
                    const isRestDayCategory = finalCategory.toLowerCase().includes('rest');
                    const category = workoutCategories.find(wc => wc.name === finalCategory);
                    const dayTime = dayTimeSettings?.time || undefined;

                    // Only add days that have a category assignment
                    if (finalCategory && (dayTimeSettings || templateDay)) {
                        days.push({
                            date: Timestamp.fromDate(dayDate),
                            workoutCategory: finalCategory,
                            workoutCategoryColor: category?.color || '#6b7280',
                            time: isRestDayCategory ? undefined : dayTime,
                            isAllDay: false
                        });
                    }

                    currentDate.setDate(currentDate.getDate() + 1);
                }

                newPeriod.days = days;
            }

            // Save period to Firebase
            await addPeriodToClientProgram(clientProgramId, newPeriod);

            // Refresh to get the period with its ID
            await fetchClientProgramsAsync(assignment.clientId);

            // Get updated program to find the created period
            const updatedPrograms = await getClientProgramsByClient(assignment.clientId);
            const updatedProgram = updatedPrograms[0];

            if (updatedProgram) {
                const assignmentStartStr = format(assignment.startDate, 'yyyy-MM-dd');
                const assignmentEndStr = format(assignment.endDate, 'yyyy-MM-dd');

                const createdPeriod = updatedProgram.periods.find(p => {
                    const pStartStr = format(safeToDate(p.startDate), 'yyyy-MM-dd');
                    const pEndStr = format(safeToDate(p.endDate), 'yyyy-MM-dd');
                    return p.periodConfigId === assignment.periodId &&
                        pStartStr === assignmentStartStr &&
                        pEndStr === assignmentEndStr;
                });

                // Create events and workouts for days with times
                if (newPeriod.days && newPeriod.days.length > 0) {
                    const periodIdToUse = createdPeriod?.id || clientProgramId;
                    const client = clients.find(c => c.id === assignment.clientId);
                    const clientName = client?.name || 'Client';

                    // Check if Google Calendar is connected
                    const isGoogleCalendarConnected = await checkGoogleCalendarAuth();

                    if (isGoogleCalendarConnected && weekTemplate) {
                        // Use Google Calendar API to create recurring events
                        try {
                            // Group days by category and time to create recurring events
                            const categoryGroups = new Map<string, {
                                category: string;
                                time: string;
                                days: typeof newPeriod.days;
                            }>();

                            for (const day of newPeriod.days) {
                                if (day.workoutCategory.toLowerCase().includes('rest') || !day.time) continue;

                                const key = `${day.workoutCategory}-${day.time}`;
                                if (!categoryGroups.has(key)) {
                                    categoryGroups.set(key, {
                                        category: day.workoutCategory,
                                        time: day.time,
                                        days: []
                                    });
                                }
                                categoryGroups.get(key)!.days.push(day);
                            }

                            // Create recurring events for each category group
                            for (const [key, group] of categoryGroups) {
                                try {
                                    // Convert week template to RRULE for this category
                                    const rruleMap = weekTemplateToRRULE(weekTemplate, new Date(assignment.endDate));
                                    const categoryRRULE = rruleMap.get(group.category);

                                    if (!categoryRRULE || categoryRRULE.length === 0) {
                                        console.warn(`No RRULE found for category: ${group.category}`);
                                        continue;
                                    }

                                    // Parse time to HH:mm format
                                    let timeStr = group.time.trim();
                                    if (timeStr.includes('AM') || timeStr.includes('PM')) {
                                        const [timePart, ampm] = timeStr.split(/\s*(AM|PM)/i);
                                        const [h, m] = timePart.split(':').map(Number);
                                        const hours = ampm.toUpperCase() === 'PM' && h !== 12 ? h + 12 : (ampm.toUpperCase() === 'AM' && h === 12 ? 0 : h);
                                        const minutes = m || 0;
                                        timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                                    }

                                    // Create recurring event in Google Calendar
                                    const recurringEvent = await createRecurringCalendarEvent({
                                        summary: `${group.category} Session with ${clientName}`,
                                        startDate: assignment.startDate.toISOString().split('T')[0],
                                        endDate: assignment.endDate.toISOString().split('T')[0],
                                        startTime: timeStr,
                                        duration: 60, // Default 1 hour, can be made configurable
                                        clientId: assignment.clientId,
                                        periodId: periodIdToUse,
                                        categoryName: group.category,
                                        weekTemplateId: assignment.weekTemplateId,
                                        weekTemplate: weekTemplate, // Pass the full template object
                                        description: `Workout Category: ${group.category}\nPeriod: ${createdPeriod?.periodName || 'Training Period'}`,
                                    });

                                    // Still create individual workouts in Firebase for each day
                                    // (Workouts contain the actual exercise details)
                                    for (const day of group.days) {
                                        try {
                                            const dayDate = safeToDate(day.date);
                                            const normalizedDayDate = new Date(dayDate);
                                            normalizedDayDate.setHours(0, 0, 0, 0);

                                            await createClientWorkout({
                                                clientId: assignment.clientId,
                                                periodId: periodIdToUse,
                                                date: Timestamp.fromDate(normalizedDayDate),
                                                dayOfWeek: getDay(normalizedDayDate),
                                                categoryName: day.workoutCategory,
                                                time: timeStr,
                                                isModified: false,
                                                createdBy: 'system'
                                            });
                                        } catch (workoutErr) {
                                            console.error('Error creating workout for day:', workoutErr);
                                        }
                                    }
                                } catch (eventErr) {
                                    console.error(`Error creating recurring event for ${group.category}:`, eventErr);
                                    // Fall through to individual event creation
                                }
                            }
                        } catch (err) {
                            console.error('Error creating recurring events, falling back to individual events:', err);
                            // Fall through to individual event creation
                        }
                    } else {
                        // Fallback: Create individual events (original behavior)
                        for (const day of newPeriod.days) {
                            // Skip rest days or days without time set
                            if (day.workoutCategory.toLowerCase().includes('rest') || !day.time) continue;

                            try {
                                const dayDate = safeToDate(day.date);
                                const normalizedDayDate = new Date(dayDate);
                                normalizedDayDate.setHours(0, 0, 0, 0);
                                const dateStr = format(normalizedDayDate, 'yyyy-MM-dd');

                                // Parse time
                                let timeStr = day.time.trim();
                                let hours: number, minutes: number;

                                if (timeStr.includes('AM') || timeStr.includes('PM')) {
                                    const [timePart, ampm] = timeStr.split(/\s*(AM|PM)/i);
                                    const [h, m] = timePart.split(':').map(Number);
                                    hours = ampm.toUpperCase() === 'PM' && h !== 12 ? h + 12 : (ampm.toUpperCase() === 'AM' && h === 12 ? 0 : h);
                                    minutes = m || 0;
                                    timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                                } else {
                                    [hours, minutes] = timeStr.split(':').map(Number);
                                }

                                const eventEnd = new Date(normalizedDayDate);
                                eventEnd.setHours(hours + 1, minutes, 0, 0);

                                // Create workout
                                const workout = await createClientWorkout({
                                    clientId: assignment.clientId,
                                    periodId: periodIdToUse,
                                    date: Timestamp.fromDate(normalizedDayDate),
                                    dayOfWeek: getDay(normalizedDayDate),
                                    categoryName: day.workoutCategory,
                                    time: timeStr,
                                    isModified: false,
                                    createdBy: 'system'
                                });

                                // Create calendar event (Firebase fallback)
                                await createTestEvent({
                                    summary: `${day.workoutCategory} Session with ${clientName}`,
                                    description: `Workout Category: ${day.workoutCategory}\n[Metadata: client=${assignment.clientId}, category=${day.workoutCategory}, workoutId=${workout.id}]`,
                                    date: dateStr,
                                    startTime: timeStr,
                                    endTime: format(eventEnd, 'HH:mm')
                                });

                            } catch (err) {
                                console.error('Error creating event/workout for day:', err);
                                // Continue with other days
                            }
                        }
                    }
                }
            }

            // Refresh calendar events
            const weekStart = new Date(assignment.startDate);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay());
            const weekEnd = new Date(assignment.endDate);
            weekEnd.setDate(weekEnd.getDate() + (6 - weekEnd.getDay()));

            await new Promise(resolve => setTimeout(resolve, 500));
            await fetchEvents({ start: weekStart, end: weekEnd });

        } catch (err) {
            console.error('Error assigning period:', err);
            setError(err instanceof Error ? err.message : 'Failed to assign period');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [clientPrograms, configPeriods, weekTemplates, workoutCategories, clients, createTestEvent, fetchEvents, fetchClientProgramsAsync]);

    // Assign a program template
    const assignProgramTemplate = useCallback(async (assignment: ProgramTemplateAssignment) => {
        setIsLoading(true);
        setError(null);

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === assignment.clientId);

            if (clientProgram) {
                // Update existing program
                const updatedPeriods = clientProgram.periods.filter(p => {
                    if (p.periodName === 'Ongoing') return false;

                    const periodStart = safeToDate(p.startDate);
                    const periodEnd = safeToDate(p.endDate);
                    const overlaps = !(periodEnd < assignment.startDate || periodStart > assignment.endDate);
                    return !overlaps;
                });

                await updateClientProgram(clientProgram.id, {
                    programTemplateId: assignment.programId,
                    periods: updatedPeriods
                });
            } else {
                await assignProgramTemplateToClient(assignment);
            }

            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error assigning program template:', err);
            setError(err instanceof Error ? err.message : 'Failed to assign program template');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [clientPrograms, selectedClientId, fetchClientProgramsAsync]);

    // Update a period
    const updatePeriodAsync = useCallback(async (periodId: string, updates: Partial<ClientProgramPeriod>) => {
        if (!selectedClientId) return;

        setIsLoading(true);
        setError(null);

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClientId);
            if (!clientProgram) throw new Error('Client program not found');

            await updatePeriodInClientProgram(clientProgram.id, periodId, updates);
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error updating period:', err);
            setError(err instanceof Error ? err.message : 'Failed to update period');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [selectedClientId, clientPrograms, fetchClientProgramsAsync]);

    // Delete a period and its associated events/workouts
    const deletePeriodAsync = useCallback(async (periodId: string, clientId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const freshPrograms = await getClientProgramsByClient(clientId);
            const clientProgram = freshPrograms.find(cp => cp.clientId === clientId);

            if (!clientProgram) throw new Error('Client program not found');

            const periodToDelete = clientProgram.periods.find(p => p.id === periodId);
            if (!periodToDelete) throw new Error('Period not found');

            const periodStart = safeToDate(periodToDelete.startDate);
            const periodEnd = safeToDate(periodToDelete.endDate);
            periodStart.setHours(0, 0, 0, 0);
            periodEnd.setHours(23, 59, 59, 999);

            // Fetch and delete events for this period
            await fetchEvents({ start: periodStart, end: periodEnd });
            await new Promise(resolve => setTimeout(resolve, 300));

            // Get events directly from store when needed (don't subscribe to prevent re-renders)
            const currentEvents = useCalendarStore.getState().events;
            const eventsToDelete = currentEvents.filter(event => {
                const hasMatchingClient = event.description?.includes(`client=${clientId}`) ||
                    event.preConfiguredClient === clientId;

                if (!hasMatchingClient) return false;

                try {
                    const eventDate = new Date(event.start.dateTime);
                    eventDate.setHours(0, 0, 0, 0);
                    return eventDate >= periodStart && eventDate <= periodEnd;
                } catch {
                    return false;
                }
            });

            for (const event of eventsToDelete) {
                try {
                    await deleteEvent(event.id);
                } catch (err) {
                    console.error(`Error deleting event ${event.id}:`, err);
                }
            }

            // Delete workouts
            const startTimestamp = Timestamp.fromDate(periodStart);
            const endTimestamp = Timestamp.fromDate(periodEnd);
            const workoutsToDelete = await fetchWorkoutsByDateRange(clientId, startTimestamp, endTimestamp);

            for (const workout of workoutsToDelete) {
                await deleteClientWorkout(workout.id);
            }

            // Delete the period
            await deletePeriodFromClientProgram(clientProgram.id, periodId);
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error deleting period:', err);
            setError(err instanceof Error ? err.message : 'Failed to delete period');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [selectedClientId, fetchEvents, deleteEvent, fetchClientProgramsAsync]);

    // Clear all periods for a client
    const clearAllPeriods = useCallback(async (clientId: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
            if (!clientProgram) throw new Error('Client program not found');

            await deleteAllPeriodsFromClientProgram(clientProgram.id);
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error clearing all periods:', err);
            setError(err instanceof Error ? err.message : 'Failed to clear periods');
            throw err;
        } finally {
            setIsLoading(false);
        }
    }, [clientPrograms, selectedClientId, fetchClientProgramsAsync]);

    return {
        clientPrograms,
        isLoading,
        error,
        fetchClientPrograms: fetchClientProgramsAsync,
        assignPeriod,
        assignProgramTemplate,
        updatePeriod: updatePeriodAsync,
        deletePeriod: deletePeriodAsync,
        clearAllPeriods,
        findPeriodForDate,
        getClientProgram: getClientProgramForClient
    };
}
