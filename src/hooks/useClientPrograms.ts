'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import React from 'react';
import { Timestamp } from 'firebase/firestore';
import { format, getDay } from 'date-fns';
import { ClientProgram, ClientProgramPeriod, ClientWorkoutRound } from '@/lib/types';
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
    assignProgramTemplateToClient,
    deleteDaysFromPeriod,
    archivePeriod
} from '@/lib/firebase/services/clientPrograms';
// React Query hooks for fetching
import { useClientPrograms as useClientProgramsQuery } from '@/hooks/queries/useClientPrograms';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import {
    createClientWorkout,
    deleteClientWorkout,
    fetchClientWorkouts,
    fetchWorkoutsByDateRange,
    fetchPeriodWorkouts
} from '@/lib/firebase/services/clientWorkouts';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { auth } from '@/lib/firebase/config';
import { createRecurringCalendarEvent, checkGoogleCalendarAuth } from '@/lib/google-calendar/api-client';
import { weekTemplateToRRULE } from '@/lib/google-calendar/rrule-utils';
import {
    buildWorkoutDraftFromHistory,
    type GenerateWorkoutDraftResponse,
    type HistoricalWorkoutForDraft,
} from '@/lib/ai/workoutDraft';

export interface PeriodAssignment {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{ time?: string; isAllDay: boolean; category?: string; deleted?: boolean }>;
    skipCalendarSync?: boolean;
}

export interface ProgramTemplateAssignment {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
}

export interface WeekTemplateAssignment {
    weekTemplateId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    selectedWeekdays?: number[];
    scheduledDays?: Array<{
        date: Date;
        workoutCategory: string;
        workoutCategoryColor?: string;
        isAllDay?: boolean;
        time?: string;
        appliedTemplateId?: string;
        appliedTemplateSelection?: string;
    }>;
    overwriteExistingWorkouts?: boolean;
    duplicateWorkoutIds?: string[];
    excludedSessionDateKeys?: string[];
}

type WeeklyFillFailure = {
    dateKey: string;
    reason: string;
};

type WeeklyFillPartialError = Error & {
    fillFailures: WeeklyFillFailure[];
    partialSuccess: true;
};

function isWeeklyFillPartialError(err: unknown): err is WeeklyFillPartialError {
    return Boolean(
        err
        && typeof err === 'object'
        && 'fillFailures' in err
        && Array.isArray((err as { fillFailures?: unknown }).fillFailures)
    );
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
    assignWeekTemplate: (assignment: WeekTemplateAssignment) => Promise<void>;
    updatePeriod: (periodId: string, updates: Partial<ClientProgramPeriod>) => Promise<void>;
    deletePeriod: (periodId: string, clientId: string) => Promise<void>;
    clearAllPeriods: (clientId: string) => Promise<void>;
    deleteDaysFromPeriod: (
        periodId: string,
        clientId: string,
        daysToDelete: string[],
        periodWindow?: { startDate: Date; endDate: Date }
    ) => Promise<void>;
    archivePeriod: (periodId: string, clientId: string) => Promise<void>;

    // Helpers
    findPeriodForDate: (date: Date, clientId: string) => ClientProgramPeriod | null;
    getClientProgram: (clientId: string) => ClientProgram | undefined;
}

export function useClientPrograms(selectedClientId?: string | null): UseClientProgramsResult {
    // Use React Query for fetching client programs (better caching, automatic refetching)
    const { data: clientPrograms = [], isLoading: queryLoading, error: queryError } = useClientProgramsQuery(selectedClientId);
    const queryClient = useQueryClient();

    // Mutation-specific loading/error states (separate from query loading)
    const [mutationLoading, setMutationLoading] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const weekAssignmentLocksRef = useRef<Set<string>>(new Set());

    // Combined loading state (query or mutation)
    const isLoading = queryLoading || mutationLoading;

    // Get configuration data - use selectors to prevent re-renders
    const configPeriods = useConfigurationStore(state => state.periods);
    const weekTemplates = useConfigurationStore(state => state.weekTemplates);
    const workoutCategories = useConfigurationStore(state => state.workoutCategories);
    const workoutTypes = useConfigurationStore(state => state.workoutTypes);
    const clients = useClientStore(state => state.clients);
    // Only subscribe to calendar store functions we actually use
    const createTestEvent = useCalendarStore(state => state.createTestEvent);
    const fetchEvents = useCalendarStore(state => state.fetchEvents);
    const updateEvent = useCalendarStore(state => state.updateEvent);
    const deleteEvent = useCalendarStore(state => state.deleteEvent);
    // Don't subscribe to calendarEvents in the hook - it causes re-renders when ModernCalendarView fetches events
    // Instead, get events directly from store when needed (in clearAllPeriods)

    // Combined error state (prioritize mutation errors over query errors)
    const error = mutationError || (queryError ? (queryError instanceof Error ? queryError.message : 'Failed to fetch client programs') : null);

    // Fetch client programs - now just invalidates React Query cache to trigger refetch
    const fetchClientProgramsAsync = useCallback(async (clientId?: string | null) => {
        // Invalidate React Query cache to trigger refetch
        if (clientId) {
            await queryClient.invalidateQueries({ queryKey: queryKeys.clientPrograms.byClient(clientId) });
        } else {
            await queryClient.invalidateQueries({ queryKey: queryKeys.clientPrograms.all });
        }
    }, [queryClient]); // Include fetchClientProgramsAsync but guard with ref

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

    const generateWeeklyFillDraftClientFallback = useCallback(async (
        clientId: string,
        categoryName: string,
        structureTemplateId: string,
        fallbackTitle: string,
        targetDateKey?: string,
        weeklySequenceIndex?: number,
        avoidMovementIds?: string[],
    ): Promise<GenerateWorkoutDraftResponse> => {
        const configState = useConfigurationStore.getState();

        if (configState.workoutStructureTemplates.length === 0) {
            await configState.fetchWorkoutStructureTemplates().catch(() => undefined);
        }
        if (configState.workoutCategories.length === 0) {
            await configState.fetchWorkoutCategories().catch(() => undefined);
        }

        const movementState = useMovementStore.getState();
        if (movementState.movements.length === 0) {
            await movementState.fetchMovements().catch(() => undefined);
        }

        const structureTemplate = useConfigurationStore
            .getState()
            .workoutStructureTemplates
            .find((template) => template.id === structureTemplateId);

        if (!structureTemplate) {
            throw new Error('Local fallback could not find the selected structure template.');
        }

        const allWorkouts = await fetchClientWorkouts(clientId);
        const recentWorkouts: HistoricalWorkoutForDraft[] = allWorkouts
            .slice()
            .sort((a, b) => {
                const am = typeof (a.date as { toMillis?: () => number })?.toMillis === 'function'
                    ? (a.date as { toMillis: () => number }).toMillis()
                    : 0;
                const bm = typeof (b.date as { toMillis?: () => number })?.toMillis === 'function'
                    ? (b.date as { toMillis: () => number }).toMillis()
                    : 0;
                return bm - am;
            })
            .slice(0, 12)
            .map((workout) => ({
                id: workout.id,
                categoryName: workout.categoryName,
                title: workout.title,
                notes: workout.notes,
                rounds: workout.rounds,
                dateMillis: typeof (workout.date as { toMillis?: () => number })?.toMillis === 'function'
                    ? (workout.date as { toMillis: () => number }).toMillis()
                    : undefined,
            }));

        const structureSections = (structureTemplate.sections || []).map((section) => ({
            order: section.order,
            workoutTypeId: section.workoutTypeId,
            workoutTypeName: section.workoutTypeName,
            workoutIntentId: section.workoutIntentId,
            workoutIntentKey: section.workoutIntentKey,
            workoutIntentName: section.workoutIntentName,
            configuration: section.configuration
                ? {
                    defaultDuration: section.configuration.defaultDuration,
                    defaultStructure: section.configuration.defaultStructure,
                    focusArea: section.configuration.focusArea,
                    aiGuidance: section.configuration.aiGuidance,
                }
                : undefined,
        }));

        const categoryContextById = Object.fromEntries(
            useConfigurationStore.getState().workoutCategories.map((category) => [
                category.id,
                {
                    name: category.name,
                    description: category.description,
                },
            ])
        );

        const movementContextById = Object.fromEntries(
            useMovementStore.getState().movements.map((movement) => [
                movement.id,
                {
                    categoryId: movement.categoryId,
                    name: movement.name,
                    instructions: movement.instructions,
                    configuration: movement.configuration,
                },
            ])
        );

        return buildWorkoutDraftFromHistory({
            categoryName,
            structureTemplateId,
            structureSections,
            recentWorkouts,
            fallbackTitle,
            targetDateKey,
            weeklySequenceIndex,
            avoidMovementIds,
            categoryContextById,
            movementContextById,
            sessionDurationMinutes: 60,
        });
    }, []);

    // Assign a period to a client
    const assignPeriod = useCallback(async (assignment: PeriodAssignment) => {
        setMutationLoading(true);
        setMutationError(null);

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
            // Use React Query cache if available, otherwise fetch directly
            const queryData = queryClient.getQueryData<ClientProgram[]>(queryKeys.clientPrograms.byClient(assignment.clientId));
            const updatedPrograms = queryData || await getClientProgramsByClient(assignment.clientId);
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

                // Create events and workouts for days with times - skip if skipCalendarSync is true
                if (!assignment.skipCalendarSync && newPeriod.days && newPeriod.days.length > 0) {
                    const periodIdToUse = createdPeriod?.id || clientProgramId;
                    const client = clients.find(c => c.id === assignment.clientId);
                    const clientName = client?.name || 'Client';

                    // Check if Google Calendar is connected
                    const isGoogleCalendarConnected = await checkGoogleCalendarAuth();
                    const timedDays = newPeriod.days.filter((day) => !day.workoutCategory.toLowerCase().includes('rest') && Boolean(day.time));
                    const untimedDays = newPeriod.days.filter((day) => !day.workoutCategory.toLowerCase().includes('rest') && !day.time);

                    if (untimedDays.length > 0) {
                        console.warn('[Weekly +Fill] Untimed days will not create Google Calendar recurring events', {
                            untimedDays: untimedDays.map((day) => ({
                                dateKey: getDateKey(safeToDate(day.date)),
                                category: day.workoutCategory,
                            })),
                        });
                    }

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

                            if (categoryGroups.size === 0) {
                                console.warn('[Weekly +Fill] No category/time groups were available for Google Calendar event creation', {
                                    periodIdToUse,
                                    clientId: assignment.clientId,
                                    weekTemplateId: assignment.weekTemplateId,
                                    timedDays: timedDays.length,
                                    untimedDays: untimedDays.length,
                                });
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

            // Period assignment complete - calendar sync decoupled
            // Calendar events will be managed separately when needed

        } catch (err) {
            console.error('Error assigning period:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to assign period');
            throw err;
        } finally {
            setMutationLoading(false);
            // Invalidate React Query cache after mutation
            await fetchClientProgramsAsync(assignment.clientId);
        }
    }, [clientPrograms, configPeriods, weekTemplates, workoutCategories, clients, createTestEvent, fetchEvents, fetchClientProgramsAsync]);

    // Assign a program template
    const assignProgramTemplate = useCallback(async (assignment: ProgramTemplateAssignment) => {
        setMutationLoading(true);
        setMutationError(null);

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

            // Invalidate React Query cache after mutation
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error assigning program template:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to assign program template');
            throw err;
        } finally {
            setMutationLoading(false);
        }
    }, [clientPrograms, selectedClientId, fetchClientProgramsAsync]);

    // Assign a week template directly with a date range (creates a period internally)
    const assignWeekTemplate = useCallback(async (assignment: WeekTemplateAssignment) => {
        const flowStartMs = Date.now();
        const flowDebugId = `weekly-fill:${assignment.clientId}:${flowStartMs}`;
        const shouldLogWeeklyFillDebug = process.env.NEXT_PUBLIC_DEBUG_WEEKLY_FILL === 'true';
        const debugFlow = (stage: string, data?: Record<string, unknown>) => {
            if (!shouldLogWeeklyFillDebug) return;
            console.info('[Weekly +Fill]', {
                flowDebugId,
                stage,
                elapsedMs: Date.now() - flowStartMs,
                ...(data || {}),
            });
        };

        const assignmentKey = `${assignment.clientId}:${getDateKey(assignment.startDate)}:${getDateKey(assignment.endDate)}:${assignment.weekTemplateId}`;
        if (weekAssignmentLocksRef.current.has(assignmentKey)) {
            return;
        }
        weekAssignmentLocksRef.current.add(assignmentKey);

        setMutationLoading(true);
        setMutationError(null);

        let clientProgramIdForRollback: string | null = null;
        let createdPeriodIdForRollback: string | null = null;
        const createdWorkoutIdsForRollback: string[] = [];

        try {
            debugFlow('start', {
                weekTemplateId: assignment.weekTemplateId,
                startDate: assignment.startDate.toISOString(),
                endDate: assignment.endDate.toISOString(),
                scheduledDaysCount: assignment.scheduledDays?.length || 0,
            });

            const weekTemplate = weekTemplates.find(wt => wt.id === assignment.weekTemplateId);
            if (!weekTemplate) {
                throw new Error('Week template not found');
            }

            if (assignment.overwriteExistingWorkouts && assignment.duplicateWorkoutIds?.length) {
                const uniqueIds = Array.from(new Set(assignment.duplicateWorkoutIds));
                for (const workoutId of uniqueIds) {
                    try {
                        await deleteClientWorkout(workoutId);
                    } catch (deleteErr) {
                        console.error('Failed to delete duplicate workout before overwrite:', deleteErr);
                    }
                }
            }

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
            clientProgramIdForRollback = clientProgramId;

            // Create a special period for the week template assignment
            const newPeriod: Omit<ClientProgramPeriod, 'id'> = {
                periodConfigId: 'week_template_assignment',
                periodName: `Week Template: ${weekTemplate.name}`,
                periodColor: weekTemplate.color || '#9ca3af',
                startDate: Timestamp.fromDate(assignment.startDate),
                endDate: Timestamp.fromDate(assignment.endDate),
                weekTemplateId: assignment.weekTemplateId,
                days: []
            };

            const excludedDateKeys = new Set(assignment.excludedSessionDateKeys || []);
            const scheduledTemplateByDateKey = new Map<string, string>();
            const scheduledSelectionByDateKey = new Map<string, string>();
            (assignment.scheduledDays || []).forEach((day) => {
                if (!day.appliedTemplateId) return;
                const key = getDateKey(safeToDate(day.date));
                scheduledTemplateByDateKey.set(key, day.appliedTemplateId);
            });
            (assignment.scheduledDays || []).forEach((day) => {
                if (!day.appliedTemplateSelection) return;
                const key = getDateKey(safeToDate(day.date));
                scheduledSelectionByDateKey.set(key, day.appliedTemplateSelection);
            });

            // Generate days from the explicit schedule when provided, otherwise fall back to the legacy date-range behavior.
            const days = assignment.scheduledDays && assignment.scheduledDays.length > 0
                ? assignment.scheduledDays
                    .filter(day => !excludedDateKeys.has(getDateKey(safeToDate(day.date))))
                    .map(day => ({
                        date: Timestamp.fromDate(new Date(day.date)),
                        workoutCategory: day.workoutCategory,
                        workoutCategoryColor: day.workoutCategoryColor || weekTemplate.color || '#6b7280',
                        appliedTemplateId: day.appliedTemplateId,
                        appliedTemplateSelection: day.appliedTemplateSelection,
                        time: day.time,
                        isAllDay: Boolean(day.isAllDay),
                    }))
                : (() => {
                    const generatedDays = [];
                    const currentDate = new Date(assignment.startDate);
                    const endDate = new Date(assignment.endDate);
                    const selectedWeekdaySet = new Set(
                        assignment.selectedWeekdays && assignment.selectedWeekdays.length > 0
                            ? assignment.selectedWeekdays
                            : [0, 1, 2, 3, 4, 5, 6]
                    );

                    const nonRestTemplateDays = weekTemplate.days.filter((d: { workoutCategory: string }) => {
                        const categoryName = d?.workoutCategory || '';
                        return categoryName && !categoryName.toLowerCase().includes('rest');
                    });
                    const categorySequence = nonRestTemplateDays.length > 0 ? nonRestTemplateDays : weekTemplate.days;
                    let sequenceIndex = 0;

                    while (currentDate <= endDate) {
                        const dayOfWeekNumber = getDay(currentDate);
                        if (selectedWeekdaySet.has(dayOfWeekNumber) && categorySequence.length > 0) {
                            const templateDay = categorySequence[sequenceIndex % categorySequence.length];
                            const finalCategory = templateDay?.workoutCategory || 'Workout';
                            const category = workoutCategories.find(wc => wc.name === finalCategory);
                            generatedDays.push({
                                date: Timestamp.fromDate(new Date(currentDate)),
                                workoutCategory: finalCategory,
                                workoutCategoryColor: category?.color || '#6b7280',
                                time: undefined, // Default to no time for direct week template assignments
                                isAllDay: false
                            });
                            sequenceIndex += 1;
                        }
                        currentDate.setDate(currentDate.getDate() + 1);
                    }

                    return generatedDays;
                })();
            newPeriod.days = days;

            // Preflight weekly +Fill before creating period/workouts so partial +Fill errors
            // do not create workouts in the background.
            const plannedCategoryByDateKey = new Map<string, string>();
            for (const day of newPeriod.days) {
                if (day.workoutCategory.toLowerCase().includes('rest')) continue;
                plannedCategoryByDateKey.set(getDateKey(safeToDate(day.date)), day.workoutCategory);
            }

            const plannedSequenceIndexByDateKey = new Map<string, number>();
            Array.from(plannedCategoryByDateKey.keys())
                .sort((left, right) => left.localeCompare(right))
                .forEach((dateKey, index) => {
                    plannedSequenceIndexByDateKey.set(dateKey, index);
                });

            const resolveStructureTemplateFromSelection = (
                selection: string,
                dateKey: string,
            ): string | null => {
                if (/^structure-fill:/.test(selection) || /^structure-ai:/.test(selection)) {
                    const directTemplateId = selection.replace(/^structure-(fill|ai):/, '').trim();
                    return directTemplateId || null;
                }

                if (!/^split-fill:/.test(selection)) {
                    return null;
                }

                const payload = selection.replace(/^split-fill:/, '').trim();
                if (!payload) return null;

                const [workoutTypeId, requestedSplitId] = payload.split(':').map((part) => part?.trim()).filter(Boolean);
                if (!workoutTypeId) return null;

                const workoutType = workoutTypes.find((type) => type.id === workoutTypeId);
                if (!workoutType || !Array.isArray(workoutType.daySplits) || workoutType.daySplits.length === 0) {
                    return null;
                }

                const selectedSplit = workoutType.daySplits.find((split) => split.id === requestedSplitId)
                    || workoutType.daySplits.find((split) => split.id === workoutType.defaultDaySplitId)
                    || workoutType.daySplits[0];
                if (!selectedSplit || !Array.isArray(selectedSplit.dayAssignments) || selectedSplit.dayAssignments.length === 0) {
                    return null;
                }

                const sequenceIndex = plannedSequenceIndexByDateKey.get(dateKey) || 0;
                const dayIndex = (sequenceIndex % Math.max(1, selectedSplit.daysPerWeek || selectedSplit.dayAssignments.length || 1)) + 1;
                const assignment = selectedSplit.dayAssignments.find((day) => day.dayIndex === dayIndex)
                    || selectedSplit.dayAssignments[(dayIndex - 1) % selectedSplit.dayAssignments.length];

                if (!assignment || !Array.isArray(assignment.structureTemplateIds) || assignment.structureTemplateIds.length === 0) {
                    return null;
                }

                return assignment.structureTemplateIds[0] || null;
            };

            const fillTargets = Array.from(scheduledSelectionByDateKey.entries())
                .filter(([dateKey, selection]) => (/^structure-fill:/.test(selection) || /^split-fill:/.test(selection)) && plannedCategoryByDateKey.has(dateKey))
                .sort(([leftDateKey], [rightDateKey]) => leftDateKey.localeCompare(rightDateKey));
            const fillDraftByDateKey = new Map<string, {
                title?: string;
                notes?: string;
                rounds: ClientWorkoutRound[];
                appliedTemplateId: string;
            }>();
            const preflightFillFailures: Array<{ dateKey: string; reason: string }> = [];
            const preflightFailureCategoryCounts = new Map<string, number>();
            let preflightApiDraftCount = 0;
            let preflightFallbackDraftCount = 0;
            const preflightStartMs = Date.now();
            debugFlow('preflight_begin', { fillTargets: fillTargets.length });
            const fillAuthToken = await auth.currentUser?.getIdToken();
            const weeklyAvoidMovementIds = new Set<string>();

            const addDraftMovementIdsToAvoidSet = (rounds: ClientWorkoutRound[] | undefined): void => {
                if (!Array.isArray(rounds)) return;
                for (const round of rounds) {
                    const movementUsages = Array.isArray(round?.movementUsages) ? round.movementUsages : [];
                    for (const usage of movementUsages) {
                        if (typeof usage?.movementId === 'string' && usage.movementId.trim()) {
                            weeklyAvoidMovementIds.add(usage.movementId.trim());
                        }
                    }
                }
            };

            const recordPreflightFailure = (reason: string): void => {
                const normalized = reason.toLowerCase();
                const category = normalized.includes('unauthorized')
                    ? 'unauthorized'
                    : normalized.includes('timeout')
                        ? 'timeout'
                        : normalized.includes('missing_admin_credentials')
                            ? 'missing_admin_credentials'
                            : normalized.includes('flow is disabled') || normalized.includes('dds_flow_disabled')
                                ? 'flow_disabled'
                                : normalized.includes('fallback')
                                    ? 'fallback_failure'
                                    : normalized.includes('no rounds')
                                        ? 'empty_draft'
                                        : normalized.includes('failed')
                                            ? 'request_failed'
                                            : 'other';

                preflightFailureCategoryCounts.set(
                    category,
                    (preflightFailureCategoryCounts.get(category) || 0) + 1
                );
            };

            if (!fillAuthToken && fillTargets.length > 0) {
                for (const [targetDateKey] of fillTargets) {
                    preflightFillFailures.push({
                        dateKey: targetDateKey,
                        reason: 'Unauthorized: session token missing. Refresh the app and retry +Fill.',
                    });
                    recordPreflightFailure('unauthorized');
                }
            }

            for (let i = 0; i < fillTargets.length; i += 1) {
                const [dateKey, selection] = fillTargets[i];
                const structureTemplateId = resolveStructureTemplateFromSelection(selection, dateKey);
                if (!structureTemplateId) {
                    const reason = `No structure template resolved for selection: ${selection}`;
                    preflightFillFailures.push({ dateKey, reason });
                    recordPreflightFailure(reason);
                    continue;
                }

                if (preflightFillFailures.length > 0) {
                    break;
                }

                const categoryName = plannedCategoryByDateKey.get(dateKey) || 'Workout';
                const avoidMovementIds = Array.from(weeklyAvoidMovementIds).slice(0, 200);

                try {
                    const draftRequestStartMs = Date.now();
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 12000);
                    const response = await fetch('/api/fill/workouts/draft', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Authorization: `Bearer ${fillAuthToken}`,
                            'X-DDS-Flow': 'weekly',
                        },
                        signal: controller.signal,
                        body: JSON.stringify({
                            clientId: assignment.clientId,
                            categoryName,
                            structureTemplateId,
                            sessionDurationMinutes: 60,
                            targetDateKey: dateKey,
                            weeklySequenceIndex: i,
                            avoidMovementIds,
                            currentTitle: `${categoryName} Draft`,
                            includeDecisionTrace: true,
                        }),
                    });
                    clearTimeout(timeoutId);
                    debugFlow('preflight_api_response', {
                        dateKey,
                        status: response.status,
                        requestMs: Date.now() - draftRequestStartMs,
                    });

                    if (!response.ok) {
                        const errorBody = await response.json().catch(() => ({}));
                        const errorCode = typeof errorBody?.code === 'string' ? errorBody.code : undefined;
                        const debugNote = typeof errorBody?.debugNote === 'string' ? errorBody.debugNote : undefined;

                        if (response.status === 401) {
                            const unauthorizedReason = 'Unauthorized: session expired. Refresh the app and retry +Fill.';
                            for (let targetIndex = i; targetIndex < fillTargets.length; targetIndex += 1) {
                                const [remainingDateKey] = fillTargets[targetIndex];
                                preflightFillFailures.push({ dateKey: remainingDateKey, reason: unauthorizedReason });
                                recordPreflightFailure(unauthorizedReason);
                            }
                            break;
                        }

                        if (errorCode === 'missing_admin_credentials') {
                            for (let targetIndex = i; targetIndex < fillTargets.length; targetIndex += 1) {
                                const [remainingDateKey, remainingSelection] = fillTargets[targetIndex];
                                const remainingTemplateId = remainingSelection.replace(/^structure-(fill|ai):/, '').trim();
                                if (!remainingTemplateId) continue;

                                const remainingCategoryName = plannedCategoryByDateKey.get(remainingDateKey) || 'Workout';

                                try {
                                    const fallbackDraft = await generateWeeklyFillDraftClientFallback(
                                        assignment.clientId,
                                        remainingCategoryName,
                                        remainingTemplateId,
                                        `${remainingCategoryName} Draft`,
                                        remainingDateKey,
                                        targetIndex,
                                        Array.from(weeklyAvoidMovementIds).slice(0, 200),
                                    );

                                    if (!fallbackDraft?.draft?.rounds || !Array.isArray(fallbackDraft.draft.rounds)) {
                                        preflightFillFailures.push({
                                            dateKey: remainingDateKey,
                                            reason: 'Local fallback returned no rounds for +Fill.',
                                        });
                                        recordPreflightFailure('Local fallback returned no rounds for +Fill.');
                                        continue;
                                    }

                                    fillDraftByDateKey.set(remainingDateKey, {
                                        title: fallbackDraft.draft.title,
                                        notes: fallbackDraft.draft.notes,
                                        rounds: fallbackDraft.draft.rounds,
                                        appliedTemplateId: remainingTemplateId,
                                    });
                                    addDraftMovementIdsToAvoidSet(fallbackDraft.draft.rounds);
                                    preflightFallbackDraftCount += 1;
                                } catch (fallbackErr) {
                                    const fallbackReason = fallbackErr instanceof Error
                                        ? fallbackErr.message
                                        : 'Local fallback failed for +Fill.';
                                    preflightFillFailures.push({ dateKey: remainingDateKey, reason: fallbackReason });
                                    recordPreflightFailure(fallbackReason);
                                }
                            }
                            break;
                        }

                        if (response.status >= 500) {
                            try {
                                const fallbackDraft = await generateWeeklyFillDraftClientFallback(
                                    assignment.clientId,
                                    categoryName,
                                    structureTemplateId,
                                    `${categoryName} Draft`,
                                    dateKey,
                                    i,
                                    avoidMovementIds,
                                );

                                if (!fallbackDraft?.draft?.rounds || !Array.isArray(fallbackDraft.draft.rounds)) {
                                    preflightFillFailures.push({
                                        dateKey,
                                        reason: `DDS draft request failed (${response.status}) and local fallback returned no rounds.`,
                                    });
                                    recordPreflightFailure(`DDS draft request failed (${response.status}) and local fallback returned no rounds.`);
                                    continue;
                                }

                                fillDraftByDateKey.set(dateKey, {
                                    title: fallbackDraft.draft.title,
                                    notes: fallbackDraft.draft.notes,
                                    rounds: fallbackDraft.draft.rounds,
                                    appliedTemplateId: structureTemplateId,
                                });
                                addDraftMovementIdsToAvoidSet(fallbackDraft.draft.rounds);
                                preflightFallbackDraftCount += 1;
                                continue;
                            } catch (fallbackErr) {
                                const fallbackReason = fallbackErr instanceof Error
                                    ? fallbackErr.message
                                    : 'Local fallback failed for +Fill.';
                                preflightFillFailures.push({
                                    dateKey,
                                    reason: `DDS draft request failed (${response.status}). ${fallbackReason}`,
                                });
                                recordPreflightFailure(`DDS draft request failed (${response.status}). ${fallbackReason}`);
                                continue;
                            }
                        }

                        const errorMessage = typeof errorBody?.error === 'string'
                            ? `${errorBody.error}${debugNote ? ` ${debugNote}` : ''}`
                            : `DDS draft request failed (${response.status})`;
                        preflightFillFailures.push({ dateKey, reason: errorMessage });
                        recordPreflightFailure(errorMessage);
                        continue;
                    }

                    const payload = await response.json() as {
                        draft?: {
                            title?: string;
                            notes?: string;
                            rounds?: ClientWorkoutRound[];
                        };
                    };

                    if (!payload?.draft?.rounds || !Array.isArray(payload.draft.rounds)) {
                        preflightFillFailures.push({ dateKey, reason: 'DDS returned no rounds' });
                        recordPreflightFailure('DDS returned no rounds');
                        continue;
                    }

                    fillDraftByDateKey.set(dateKey, {
                        title: payload.draft.title,
                        notes: payload.draft.notes,
                        rounds: payload.draft.rounds,
                        appliedTemplateId: structureTemplateId,
                    });
                    addDraftMovementIdsToAvoidSet(payload.draft.rounds);
                    preflightApiDraftCount += 1;
                } catch (fillErr) {
                    const isTimeoutAbort = fillErr instanceof DOMException && fillErr.name === 'AbortError';
                    if (isTimeoutAbort) {
                        debugFlow('preflight_api_timeout', { dateKey, timeoutMs: 12000 });
                        try {
                            const fallbackDraft = await generateWeeklyFillDraftClientFallback(
                                assignment.clientId,
                                categoryName,
                                structureTemplateId,
                                `${categoryName} Draft`,
                                dateKey,
                                i,
                                avoidMovementIds,
                            );

                            if (!fallbackDraft?.draft?.rounds || !Array.isArray(fallbackDraft.draft.rounds)) {
                                preflightFillFailures.push({
                                    dateKey,
                                    reason: 'DDS request timed out and local fallback returned no rounds.',
                                });
                                recordPreflightFailure('DDS request timed out and local fallback returned no rounds.');
                                continue;
                            }

                            fillDraftByDateKey.set(dateKey, {
                                title: fallbackDraft.draft.title,
                                notes: fallbackDraft.draft.notes,
                                rounds: fallbackDraft.draft.rounds,
                                appliedTemplateId: structureTemplateId,
                            });
                            addDraftMovementIdsToAvoidSet(fallbackDraft.draft.rounds);
                            preflightFallbackDraftCount += 1;
                            debugFlow('preflight_timeout_fallback_ok', { dateKey });
                            continue;
                        } catch (fallbackErr) {
                            const fallbackReason = fallbackErr instanceof Error
                                ? fallbackErr.message
                                : 'Local fallback failed for +Fill.';
                            preflightFillFailures.push({
                                dateKey,
                                reason: `DDS request timed out. ${fallbackReason}`,
                            });
                            recordPreflightFailure(`DDS request timed out. ${fallbackReason}`);
                            continue;
                        }
                    }

                    const reason = fillErr instanceof Error ? fillErr.message : 'Unknown +Fill error';
                    preflightFillFailures.push({ dateKey, reason });
                    recordPreflightFailure(reason);
                }
            }

            const preflightSummary = {
                flow: 'weekly' as const,
                fillTargets: fillTargets.length,
                apiDrafts: preflightApiDraftCount,
                fallbackDrafts: preflightFallbackDraftCount,
                failedDrafts: preflightFillFailures.length,
                failureCategories: Object.fromEntries(preflightFailureCategoryCounts.entries()),
                preflightMs: Date.now() - preflightStartMs,
            };

            debugFlow('preflight_end', {
                ...preflightSummary,
                resolvedDrafts: fillDraftByDateKey.size,
                failures: preflightFillFailures.length,
            });

            if (preflightFillFailures.length > 0) {
                const partialError = new Error('Weekly +Fill completed with issues') as WeeklyFillPartialError;
                partialError.fillFailures = preflightFillFailures;
                partialError.partialSuccess = true;
                debugFlow('preflight_failed', { failures: preflightFillFailures.length });
                throw partialError;
            }

            // Save period to Firebase
            const createdPeriodId = await addPeriodToClientProgram(clientProgramId, newPeriod);
            createdPeriodIdForRollback = createdPeriodId;
            debugFlow('period_saved', { dayCount: newPeriod.days.length, createdPeriodId });

            // Fetch updated program
            await fetchClientProgramsAsync(assignment.clientId);

            if (newPeriod.days.length > 0) {
                const periodIdToUse = createdPeriodId || clientProgramId;

                const normalizedTrainingDates = newPeriod.days
                    .filter(day => !day.workoutCategory.toLowerCase().includes('rest'))
                    .map(day => {
                        const date = safeToDate(day.date);
                        date.setHours(0, 0, 0, 0);
                        return date;
                    })
                    .sort((a, b) => a.getTime() - b.getTime());

                let existingWorkoutDateKeys = new Set<string>();
                if (normalizedTrainingDates.length > 0) {
                    const rangeStart = new Date(normalizedTrainingDates[0]);
                    const rangeEnd = new Date(normalizedTrainingDates[normalizedTrainingDates.length - 1]);
                    rangeStart.setHours(0, 0, 0, 0);
                    rangeEnd.setHours(23, 59, 59, 999);

                    const existingWorkouts = await fetchWorkoutsByDateRange(
                        assignment.clientId,
                        Timestamp.fromDate(rangeStart),
                        Timestamp.fromDate(rangeEnd)
                    );

                    existingWorkoutDateKeys = new Set(existingWorkouts.map(workout => getDateKey(safeToDate(workout.date))));
                }

                // Create workouts for each day
                const workoutCreationFailures: Array<{ dateKey: string; reason: string }> = [];
                const firstFailureReasonByDateKey = new Map<string, string>();
                const plannedDayByDateKey = new Map<string, typeof newPeriod.days[number]>();
                for (const day of newPeriod.days) {
                    if (day.workoutCategory.toLowerCase().includes('rest')) continue;
                    const dayDate = safeToDate(day.date);
                    dayDate.setHours(0, 0, 0, 0);
                    plannedDayByDateKey.set(getDateKey(dayDate), day);
                }

                for (const day of newPeriod.days) {
                    if (day.workoutCategory.toLowerCase().includes('rest')) continue;

                    try {
                        const dayDate = safeToDate(day.date);
                        const normalizedDayDate = new Date(dayDate);
                        normalizedDayDate.setHours(0, 0, 0, 0);
                        const dayKey = getDateKey(normalizedDayDate);

                        if (existingWorkoutDateKeys.has(dayKey)) {
                            continue;
                        }

                        const precomputedFillDraft = fillDraftByDateKey.get(dayKey);

                        const createdWorkout = await createClientWorkout({
                            clientId: assignment.clientId,
                            periodId: periodIdToUse,
                            date: Timestamp.fromDate(normalizedDayDate),
                            dayOfWeek: getDay(normalizedDayDate),
                            categoryName: day.workoutCategory,
                            appliedTemplateId: precomputedFillDraft?.appliedTemplateId || scheduledTemplateByDateKey.get(dayKey),
                            title: precomputedFillDraft?.title,
                            notes: precomputedFillDraft?.notes,
                            rounds: precomputedFillDraft?.rounds,
                            isModified: Boolean(precomputedFillDraft),
                            createdBy: 'system'
                        });
                        createdWorkoutIdsForRollback.push(createdWorkout.id);

                        existingWorkoutDateKeys.add(dayKey);
                    } catch (err) {
                        const dayKey = getDateKey(safeToDate(day.date));
                        const reason = err instanceof Error ? err.message : 'Unknown workout creation error';
                        workoutCreationFailures.push({ dateKey: dayKey, reason: `Workout creation failed: ${reason}` });
                        if (!firstFailureReasonByDateKey.has(dayKey)) {
                            firstFailureReasonByDateKey.set(dayKey, `Workout creation failed: ${reason}`);
                        }
                    }
                }

                // Verify writes landed for all planned training dates and self-heal once if any are missing.
                if (normalizedTrainingDates.length > 0) {
                    const verifyStart = new Date(normalizedTrainingDates[0]);
                    const verifyEnd = new Date(normalizedTrainingDates[normalizedTrainingDates.length - 1]);
                    verifyStart.setHours(0, 0, 0, 0);
                    verifyEnd.setHours(23, 59, 59, 999);

                    const verifyWorkouts = await fetchWorkoutsByDateRange(
                        assignment.clientId,
                        Timestamp.fromDate(verifyStart),
                        Timestamp.fromDate(verifyEnd)
                    );
                    const verifiedDateKeys = new Set(
                        verifyWorkouts.map(workout => getDateKey(safeToDate(workout.date)))
                    );

                    const missingDateKeys = Array.from(plannedDayByDateKey.keys()).filter(
                        (dateKey) => !verifiedDateKeys.has(dateKey)
                    );

                    if (missingDateKeys.length > 0) {
                        debugFlow('workouts_missing_after_create', {
                            missingCount: missingDateKeys.length,
                            missingDateKeys,
                        });

                        for (const missingDateKey of missingDateKeys) {
                            const missingDay = plannedDayByDateKey.get(missingDateKey);
                            if (!missingDay) continue;

                            try {
                                const missingDate = safeToDate(missingDay.date);
                                missingDate.setHours(0, 0, 0, 0);
                                const precomputedFillDraft = fillDraftByDateKey.get(missingDateKey);

                                const createdWorkout = await createClientWorkout({
                                    clientId: assignment.clientId,
                                    periodId: periodIdToUse,
                                    date: Timestamp.fromDate(missingDate),
                                    dayOfWeek: getDay(missingDate),
                                    categoryName: missingDay.workoutCategory,
                                    appliedTemplateId: precomputedFillDraft?.appliedTemplateId || scheduledTemplateByDateKey.get(missingDateKey),
                                    title: precomputedFillDraft?.title,
                                    notes: precomputedFillDraft?.notes,
                                    rounds: precomputedFillDraft?.rounds,
                                    isModified: Boolean(precomputedFillDraft),
                                    createdBy: 'system'
                                });
                                createdWorkoutIdsForRollback.push(createdWorkout.id);
                            } catch (retryErr) {
                                const retryReason = retryErr instanceof Error ? retryErr.message : 'Unknown retry creation error';
                                workoutCreationFailures.push({
                                    dateKey: missingDateKey,
                                    reason: `Retry workout creation failed: ${retryReason}`,
                                });
                                if (!firstFailureReasonByDateKey.has(missingDateKey)) {
                                    firstFailureReasonByDateKey.set(missingDateKey, `Retry workout creation failed: ${retryReason}`);
                                }
                            }
                        }

                        const finalVerifyWorkouts = await fetchWorkoutsByDateRange(
                            assignment.clientId,
                            Timestamp.fromDate(verifyStart),
                            Timestamp.fromDate(verifyEnd)
                        );
                        const finalVerifiedDateKeys = new Set(
                            finalVerifyWorkouts.map(workout => getDateKey(safeToDate(workout.date)))
                        );
                        const stillMissingDateKeys = Array.from(plannedDayByDateKey.keys()).filter(
                            (dateKey) => !finalVerifiedDateKeys.has(dateKey)
                        );

                        if (stillMissingDateKeys.length > 0) {
                            for (const stillMissingDateKey of stillMissingDateKeys) {
                                if (firstFailureReasonByDateKey.has(stillMissingDateKey)) {
                                    workoutCreationFailures.push({
                                        dateKey: stillMissingDateKey,
                                        reason: firstFailureReasonByDateKey.get(stillMissingDateKey) as string,
                                    });
                                    continue;
                                }

                                const priorFailureForDate = workoutCreationFailures.find(
                                    (entry) => entry.dateKey === stillMissingDateKey
                                );
                                if (priorFailureForDate?.reason) {
                                    workoutCreationFailures.push({
                                        dateKey: stillMissingDateKey,
                                        reason: priorFailureForDate.reason,
                                    });
                                    continue;
                                }

                                workoutCreationFailures.push({
                                    dateKey: stillMissingDateKey,
                                    reason: 'Workout missing after verification and retry.',
                                });
                            }
                        }
                    }
                }

                if (workoutCreationFailures.length > 0) {
                    debugFlow('workouts_create_failed', {
                        failures: workoutCreationFailures.length,
                        sampleFailures: workoutCreationFailures.slice(0, 5),
                    });
                    const partialError = new Error('Weekly workout creation completed with issues') as WeeklyFillPartialError;
                    partialError.fillFailures = workoutCreationFailures;
                    partialError.partialSuccess = true;
                    throw partialError;
                }
                debugFlow('workouts_created', {
                    createdOrUpdatedDays: newPeriod.days.length,
                    timedDays: newPeriod.days.filter((day) => !day.workoutCategory.toLowerCase().includes('rest') && Boolean(day.time)).length,
                    untimedDays: newPeriod.days.filter((day) => !day.workoutCategory.toLowerCase().includes('rest') && !day.time).length,
                });

                const timedDays = newPeriod.days.filter(
                    (day) => !day.workoutCategory.toLowerCase().includes('rest') && Boolean(day.time)
                );

                if (timedDays.length > 0) {
                    const client = clients.find(c => c.id === assignment.clientId);
                    const clientName = client?.name || 'Client';
                    const isGoogleCalendarConnected = await checkGoogleCalendarAuth();

                    debugFlow('calendar_events_create_start', {
                        isGoogleCalendarConnected,
                        timedDays: timedDays.length,
                        periodId: periodIdToUse,
                    });

                    if (!isGoogleCalendarConnected) {
                        debugFlow('calendar_events_skipped_not_connected', {
                            reason: 'Google Calendar is not connected',
                            timedDays: timedDays.length,
                        });
                    } else {
                        const rangeStart = new Date(timedDays[0].date.toDate());
                        const rangeEnd = new Date(timedDays[timedDays.length - 1].date.toDate());
                        rangeStart.setHours(0, 0, 0, 0);
                        rangeEnd.setHours(23, 59, 59, 999);

                        const workoutsForRange = await fetchWorkoutsByDateRange(
                            assignment.clientId,
                            Timestamp.fromDate(rangeStart),
                            Timestamp.fromDate(rangeEnd)
                        );

                        const workoutIdByDateKey = new Map<string, string>();
                        for (const workout of workoutsForRange) {
                            const workoutDateKey = getDateKey(safeToDate(workout.date));
                            if (!workoutIdByDateKey.has(workoutDateKey)) {
                                workoutIdByDateKey.set(workoutDateKey, workout.id);
                            }
                        }

                        const eventCreationFailures: Array<{ dateKey: string; reason: string }> = [];

                        for (const day of timedDays) {
                            try {
                                const dayDate = safeToDate(day.date);
                                dayDate.setHours(0, 0, 0, 0);
                                const dateKey = getDateKey(dayDate);
                                const workoutId = workoutIdByDateKey.get(dateKey);

                                let timeStr = String(day.time || '').trim();
                                let hours: number;
                                let minutes: number;

                                if (timeStr.includes('AM') || timeStr.includes('PM')) {
                                    const [timePart, ampm] = timeStr.split(/\s*(AM|PM)/i);
                                    const [h, m] = timePart.split(':').map(Number);
                                    hours = ampm.toUpperCase() === 'PM' && h !== 12 ? h + 12 : (ampm.toUpperCase() === 'AM' && h === 12 ? 0 : h);
                                    minutes = m || 0;
                                    timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
                                } else {
                                    [hours, minutes] = timeStr.split(':').map(Number);
                                    if (Number.isNaN(hours) || Number.isNaN(minutes)) {
                                        throw new Error(`Invalid time format: ${timeStr}`);
                                    }
                                }

                                const eventEnd = new Date(dayDate);
                                eventEnd.setHours(hours + 1, minutes, 0, 0);

                                await createTestEvent({
                                    summary: `${day.workoutCategory} Session with ${clientName}`,
                                    description: `Workout Category: ${day.workoutCategory}\n[Metadata: client=${assignment.clientId}, category=${day.workoutCategory}, workoutId=${workoutId || ''}]`,
                                    date: format(dayDate, 'yyyy-MM-dd'),
                                    startTime: timeStr,
                                    endTime: format(eventEnd, 'HH:mm')
                                });

                                debugFlow('calendar_event_create_success', {
                                    dateKey,
                                    workoutId: workoutId || null,
                                    startTime: timeStr,
                                });
                            } catch (eventErr) {
                                const failedDateKey = getDateKey(safeToDate(day.date));
                                const reason = eventErr instanceof Error ? eventErr.message : String(eventErr);
                                eventCreationFailures.push({ dateKey: failedDateKey, reason });
                                debugFlow('calendar_event_create_failed', {
                                    dateKey: failedDateKey,
                                    reason,
                                });
                            }
                        }

                        debugFlow('calendar_events_create_end', {
                            attempted: timedDays.length,
                            failures: eventCreationFailures.length,
                        });
                    }
                } else {
                    debugFlow('calendar_events_skipped_no_timed_days', {
                        totalDays: newPeriod.days.length,
                    });
                }
            }
        } catch (err) {
            if (createdPeriodIdForRollback && clientProgramIdForRollback) {
                debugFlow('rollback_start', {
                    createdPeriodId: createdPeriodIdForRollback,
                    createdWorkoutCount: createdWorkoutIdsForRollback.length,
                    reason: err instanceof Error ? err.message : String(err),
                });

                for (const workoutId of createdWorkoutIdsForRollback) {
                    try {
                        await deleteClientWorkout(workoutId);
                    } catch (cleanupWorkoutErr) {
                        debugFlow('rollback_workout_delete_failed', {
                            workoutId,
                            error: cleanupWorkoutErr instanceof Error ? cleanupWorkoutErr.message : String(cleanupWorkoutErr),
                        });
                    }
                }

                try {
                    await deletePeriodFromClientProgram(clientProgramIdForRollback, createdPeriodIdForRollback);
                    debugFlow('rollback_period_deleted', { createdPeriodId: createdPeriodIdForRollback });
                } catch (cleanupPeriodErr) {
                    debugFlow('rollback_period_delete_failed', {
                        createdPeriodId: createdPeriodIdForRollback,
                        error: cleanupPeriodErr instanceof Error ? cleanupPeriodErr.message : String(cleanupPeriodErr),
                    });
                }
            }

            if (isWeeklyFillPartialError(err)) {
                throw err;
            }
            console.error('Error assigning week template:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to assign week template');
            throw err;
        } finally {
            debugFlow('end');
            setMutationLoading(false);
            await fetchClientProgramsAsync(assignment.clientId);
            weekAssignmentLocksRef.current.delete(assignmentKey);
        }
    }, [clientPrograms, weekTemplates, workoutCategories, fetchClientProgramsAsync, queryClient, generateWeeklyFillDraftClientFallback]);


    // Update a period
    const updatePeriodAsync = useCallback(async (periodId: string, updates: Partial<ClientProgramPeriod>) => {
        if (!selectedClientId) return;

        setMutationLoading(true);
        setMutationError(null);

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === selectedClientId);
            if (!clientProgram) throw new Error('Client program not found');

            await updatePeriodInClientProgram(clientProgram.id, periodId, updates);
            // Invalidate React Query cache after mutation
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error updating period:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to update period');
            throw err;
        } finally {
            setMutationLoading(false);
        }
    }, [selectedClientId, clientPrograms, fetchClientProgramsAsync]);

    // Delete a period and its associated events/workouts
    const deletePeriodAsync = useCallback(async (periodId: string, clientId: string) => {
        setMutationLoading(true);
        setMutationError(null);

        try {
            // Use React Query cache if available, otherwise fetch directly
            const queryData = queryClient.getQueryData<ClientProgram[]>(queryKeys.clientPrograms.byClient(clientId));
            const freshPrograms = queryData || await getClientProgramsByClient(clientId);
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
            // Invalidate React Query cache after mutation
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error deleting period:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to delete period');
            throw err;
        } finally {
            setMutationLoading(false);
        }
    }, [selectedClientId, fetchEvents, deleteEvent, fetchClientProgramsAsync]);

    // Clear all periods for a client
    const clearAllPeriods = useCallback(async (clientId: string) => {
        setMutationLoading(true);
        setMutationError(null);

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
            if (!clientProgram) throw new Error('Client program not found');

            await deleteAllPeriodsFromClientProgram(clientProgram.id);
            // Invalidate React Query cache after mutation
            await fetchClientProgramsAsync(selectedClientId);

        } catch (err) {
            console.error('Error clearing all periods:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to clear periods');
            throw err;
        } finally {
            setMutationLoading(false);
        }
    }, [clientPrograms, selectedClientId, fetchClientProgramsAsync]);

    // Delete specific days from a period
    const deleteDaysFromPeriodAsync = useCallback(async (
        periodId: string,
        clientId: string,
        daysToDelete: string[],
        periodWindow?: { startDate: Date; endDate: Date }
    ) => {
        setMutationLoading(true);
        setMutationError(null);

        const deleteAllDays = daysToDelete.includes('__ALL__');

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
            if (!clientProgram) {
                throw new Error('Client program not found');
            }

            if (deleteAllDays) {
                const rangeStartDate = periodWindow?.startDate;
                const rangeEndDate = periodWindow?.endDate;

                if (!rangeStartDate || !rangeEndDate) {
                    throw new Error('Delete-all requires an assignment date window');
                }

                const normalizedStart = new Date(rangeStartDate);
                const normalizedEnd = new Date(rangeEndDate);
                normalizedStart.setHours(0, 0, 0, 0);
                normalizedEnd.setHours(23, 59, 59, 999);

                const workoutsToDelete = await fetchWorkoutsByDateRange(
                    clientId,
                    Timestamp.fromDate(normalizedStart),
                    Timestamp.fromDate(normalizedEnd)
                );

                for (const workout of workoutsToDelete) {
                    await deleteClientWorkout(workout.id);
                }

                await deleteDaysFromPeriod(clientProgram.id, periodId, daysToDelete);
                await fetchClientProgramsAsync(selectedClientId);
                return;
            }

            await deleteDaysFromPeriod(clientProgram.id, periodId, daysToDelete);
            
            // Also delete corresponding workouts for those days
            let period = clientProgram.periods.find(p => p.id === periodId);
            if (!period) {
                const refreshedPrograms = await getClientProgramsByClient(clientId);
                const refreshedClientProgram = refreshedPrograms.find(cp => cp.clientId === clientId);
                period = refreshedClientProgram?.periods.find(p => p.id === periodId);
            }

            if (period) {
                const validPeriodIds = new Set<string>([periodId, clientProgram.id]);
                const targetDateKeys = new Set(
                    (period.days || [])
                        .filter((dayEntry) => {
                            if (deleteAllDays) return true;
                            const dayName = safeToDate(dayEntry.date).toLocaleDateString('en-US', { weekday: 'long' });
                            return daysToDelete.includes(dayName);
                        })
                        .map((dayEntry) => getDateKey(safeToDate(dayEntry.date)))
                );

                // Find and delete workouts for the specified days
                const workoutsToDelete = await fetchWorkoutsByDateRange(
                    clientId,
                    period.startDate,
                    period.endDate
                );

                for (const workout of workoutsToDelete) {
                    const workoutDateKey = getDateKey(safeToDate(workout.date));
                    if (!validPeriodIds.has(workout.periodId)) continue;

                    if (deleteAllDays || targetDateKeys.has(workoutDateKey)) {
                        await deleteClientWorkout(workout.id);
                    }
                }
            }

            await fetchClientProgramsAsync(selectedClientId);
        } catch (err) {
            console.error('Error deleting days from period:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to delete days');
            throw err;
        } finally {
            setMutationLoading(false);
        }
    }, [clientPrograms, selectedClientId, fetchClientProgramsAsync]);

    // Archive a period (soft delete)
    const archivePeriodAsync = useCallback(async (periodId: string, clientId: string) => {
        setMutationLoading(true);
        setMutationError(null);

        try {
            const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
            if (!clientProgram) {
                throw new Error('Client program not found');
            }

            await archivePeriod(clientProgram.id, periodId);
            await fetchClientProgramsAsync(selectedClientId);
        } catch (err) {
            console.error('Error archiving period:', err);
            setMutationError(err instanceof Error ? err.message : 'Failed to archive period');
            throw err;
        } finally {
            setMutationLoading(false);
        }
    }, [clientPrograms, selectedClientId, fetchClientProgramsAsync]);

    return {
        clientPrograms,
        isLoading,
        error,
        fetchClientPrograms: fetchClientProgramsAsync,
        assignPeriod,
        assignProgramTemplate,
        assignWeekTemplate,
        updatePeriod: updatePeriodAsync,
        deletePeriod: deletePeriodAsync,
        clearAllPeriods,
        deleteDaysFromPeriod: deleteDaysFromPeriodAsync,
        archivePeriod: archivePeriodAsync,
        findPeriodForDate,
        getClientProgram: getClientProgramForClient
    };
}
