"use client";

import { useState, useMemo } from 'react';
import { Timestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Archive, Trash2, Sparkles } from 'lucide-react';
import { addDays, format, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { ClientProgramPeriod } from '@/lib/types';
import { getDateKey, safeToDate } from '@/lib/utils/dateHelpers';
import { Separator } from '@/components/ui/separator';
import { fetchWorkoutsByDateRange } from '@/lib/firebase/services/clientWorkouts';
import { PROGRAM_PLANNING_DIALOG_CONTENT_CLASS } from '@/components/programs/dialogSizing';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';

interface WeekTemplate {
    id: string;
    name: string;
    color: string;
    days?: Array<{
        day: string;
        workoutCategory: string;
        variations?: string[];
    }>;
}

interface WorkoutCategoryOption {
    name: string;
    linkedWorkoutStructureTemplateId?: string;
}

interface WorkoutStructureTemplateOption {
    id: string;
    name: string;
}

interface WorkoutTypeSplitOption {
    id: string;
    name: string;
    daySplits?: Array<{
        id: string;
        label: string;
        active: boolean;
    }>;
}

interface WeekSessionPreview {
    date: Date;
    dateKey: string;
    weekdayLabel: string;
    workoutCategory: string;
    defaultWorkoutCategory: string;
    workoutCategoryColor: string;
    enabled: boolean;
    occurrenceIndex: number;
}

type FillFailure = {
    dateKey: string;
    reason: string;
};

interface ManageWeekDialogProps {
    clientId: string;
    clientName?: string;
    weekTemplates: WeekTemplate[];
    workoutCategories: WorkoutCategoryOption[];
    workoutStructureTemplates: WorkoutStructureTemplateOption[];
    existingAssignments: ClientProgramPeriod[];
    selectedDate?: Date;
    onAssignWeek: (assignment: {
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
    }) => Promise<void>;
    onDeleteDays: (
        periodId: string,
        daysToDelete: string[],
        periodWindow?: { startDate: Date; endDate: Date }
    ) => Promise<void>;
    onArchivePeriod: (periodId: string) => Promise<void>;
    onDataChanged?: () => void | Promise<void>;
    loading?: boolean;
}

const WEEKDAY_PICKER = [
    { dayIndex: 0, short: 'S', full: 'Sunday' },
    { dayIndex: 1, short: 'M', full: 'Monday' },
    { dayIndex: 2, short: 'T', full: 'Tuesday' },
    { dayIndex: 3, short: 'W', full: 'Wednesday' },
    { dayIndex: 4, short: 'T', full: 'Thursday' },
    { dayIndex: 5, short: 'F', full: 'Friday' },
    { dayIndex: 6, short: 'S', full: 'Saturday' },
];

type EndMode = 'on' | 'after';

const DEFAULT_WEEKDAY_SELECTION = new Set<number>([1, 2, 3, 4, 5]);
const MAX_PREVIEW_OCCURRENCES = 180;
const DELETE_ALL_DAYS_TOKEN = '__ALL__';
const DEFAULT_WEEK_ASSIGNMENT_TIME = '09:00';

function toDateInputValue(date: Date): string {
    return format(date, 'yyyy-MM-dd');
}

function parseDateInput(value: string): Date | null {
    if (!value) return null;
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
}

function getNextWeekdayAfter(afterDate: Date): Date {
    // Find the next weekday (Mon-Fri) after the given date
    const next = new Date(afterDate);
    next.setDate(next.getDate() + 1);
    
    const dayOfWeek = getDay(next); // 0=Sun, 1=Mon, ..., 6=Sat
    
    // If Saturday (6), jump to Monday
    if (dayOfWeek === 6) {
        next.setDate(next.getDate() + 2);
    }
    // If Sunday (0), jump to Monday
    else if (dayOfWeek === 0) {
        next.setDate(next.getDate() + 1);
    }
    
    return next;
}

function calculateSmartDefaults(existingAssignments: ClientProgramPeriod[], selectedDate?: Date) {
    // If no existing assignments, use selectedDate or today
    if (!existingAssignments || existingAssignments.length === 0) {
        const startDate = selectedDate || new Date();
        console.log('[Schedule Selector] No existing assignments, using today/selectedDate as start:', format(startDate, 'yyyy-MM-dd'));
        return {
            startDate,
            endDate: addDays(startDate, 13), // 2 weeks = 14 days, so +13 to include start day
        };
    }
    
    // Find the assignment with the latest end date
    let latestEndDate: Date | null = null;
    let latestAssignment = null;
    
    for (const assignment of existingAssignments) {
        const endDate = safeToDate(assignment.endDate);
        if (!latestEndDate || endDate > latestEndDate) {
            latestEndDate = endDate;
            latestAssignment = assignment;
        }
    }
    
    if (latestAssignment && latestEndDate) {
        const nextWeekdayStart = getNextWeekdayAfter(latestEndDate);
        const endDate = addDays(nextWeekdayStart, 13); // 2 weeks
        console.log('[Schedule Selector] Found latest assignment ending:', format(latestEndDate, 'yyyy-MM-dd'));
        console.log('[Schedule Selector] Next weekday:', format(nextWeekdayStart, 'yyyy-MM-dd (EEEE)'));
        console.log('[Schedule Selector] Default date range:', format(nextWeekdayStart, 'yyyy-MM-dd'), 'to', format(endDate, 'yyyy-MM-dd'));
        return {
            startDate: nextWeekdayStart,
            endDate,
        };
    }
    
    // Fallback
    const startDate = selectedDate || new Date();
    console.log('[Schedule Selector] Fallback: using today/selectedDate as start:', format(startDate, 'yyyy-MM-dd'));
    return {
        startDate,
        endDate: addDays(startDate, 13),
    };
}

function getTemplateCategoryOptions(template?: WeekTemplate): string[] {
    if (!template?.days || template.days.length === 0) {
        return ['Workout'];
    }

    const options: string[] = [];
    template.days.forEach(day => {
        const category = normalizeWeekTemplateCategory(day.workoutCategory);
        if (!category) return;
        if (category.toLowerCase().includes('rest')) return;
        if (!options.includes(category)) {
            options.push(category);
        }
    });

    return options.length > 0 ? options : ['Workout'];
}

function normalizeWeekTemplateCategory(value?: string): string {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) return '';
    if (normalized === 'workout') return 'Workout';
    if (normalized === 'cardio' || normalized === 'cardio day') return 'Cardio Day';
    if (normalized === 'conditioning') return 'Conditioning';
    if (normalized === 'strength') return 'Strength';
    if (normalized === 'rest' || normalized === 'rest day') return 'Rest Day';
    return value?.trim() || '';
}

function toCategoryKey(value?: string): string {
    const cleaned = (value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleaned) return '';

    if (cleaned.endsWith(' day')) {
        return cleaned.replace(/ day$/, '');
    }

    return cleaned;
}

function getTemplateTrainingSequence(template?: WeekTemplate): string[] {
    if (!template?.days || template.days.length === 0) {
        return ['Workout'];
    }

    const sequence = template.days
        .map(day => normalizeWeekTemplateCategory(day.workoutCategory))
        .filter((category): category is string => Boolean(category) && category !== 'Rest Day');

    return sequence.length > 0 ? sequence : ['Workout'];
}

function getTemplateDayRows(template?: WeekTemplate): Array<{ dayLabel: string; category: string }> {
    if (!template?.days || template.days.length === 0) {
        return [];
    }

    return template.days
        .map((day, index) => ({
            dayLabel: day.day?.trim() || `Day ${index + 1}`,
            category: normalizeWeekTemplateCategory(day.workoutCategory),
        }))
        .filter((entry) => Boolean(entry.category) && entry.category !== 'Rest Day');
}

function extractTemplateIdFromSelection(value?: string): string | undefined {
    if (!value || value === 'none') return undefined;
    if (value.startsWith('split-fill:')) return undefined;
    if (value.startsWith('structure-fill:')) return value.replace('structure-fill:', '');
    if (value.startsWith('structure:')) return value.replace('structure:', '');
    return value;
}

function toStructureSelectionValue(templateId?: string): string {
    return templateId ? `structure:${templateId}` : 'none';
}

function isFillSelection(value?: string): boolean {
    return Boolean(value && (value.startsWith('structure-fill:') || value.startsWith('split-fill:')));
}

function toFillSelectionValue(value: string): string {
    if (value === 'none') return value;
    if (value.startsWith('split-fill:')) return value;
    if (value.startsWith('structure-fill:')) return value;
    if (value.startsWith('structure:')) return value.replace('structure:', 'structure-fill:');
    return `structure-fill:${value}`;
}

function toBaseSelectionValue(value: string): string {
    if (value === 'none') return value;
    if (value.startsWith('split-fill:')) return 'none';
    if (value.startsWith('structure:')) return value;
    if (value.startsWith('structure-fill:')) return value.replace('structure-fill:', 'structure:');
    return `structure:${value}`;
}

function extractFillFailures(error: unknown): FillFailure[] {
    if (!error || typeof error !== 'object' || !('fillFailures' in error)) {
        return [];
    }

    const raw = (error as { fillFailures?: unknown }).fillFailures;
    if (!Array.isArray(raw)) return [];

    return raw
        .filter((item): item is FillFailure => Boolean(
            item
            && typeof item === 'object'
            && 'dateKey' in item
            && typeof (item as { dateKey?: unknown }).dateKey === 'string'
            && 'reason' in item
            && typeof (item as { reason?: unknown }).reason === 'string'
        ));
}

export function ManageWeekDialog({
    clientId,
    clientName,
    weekTemplates,
    workoutCategories,
    workoutStructureTemplates,
    existingAssignments,
    selectedDate,
    onAssignWeek,
    onDeleteDays,
    onArchivePeriod,
    onDataChanged,
    loading = false,
}: ManageWeekDialogProps) {
    const [open, setOpen] = useState(false);
    const workoutTypes = useConfigurationStore(state => state.workoutTypes) as WorkoutTypeSplitOption[];
    
    // Calculate smart defaults based on existing assignments
    const smartDefaults = useMemo(() => {
        return calculateSmartDefaults(existingAssignments, selectedDate);
    }, [existingAssignments, selectedDate]);
    
    // Assignment state
    const defaultStartDate = smartDefaults.startDate;
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [wizardStep, setWizardStep] = useState<'setup' | 'confirm'>('setup');
    const [startDateInput, setStartDateInput] = useState<string>(toDateInputValue(defaultStartDate));
    const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set(DEFAULT_WEEKDAY_SELECTION));
    const [endMode, setEndMode] = useState<EndMode>('on');
    const [endOnDateInput, setEndOnDateInput] = useState<string>(toDateInputValue(smartDefaults.endDate));
    const [endAfterOccurrences, setEndAfterOccurrences] = useState<number>(8);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [excludedSessionDates, setExcludedSessionDates] = useState<Set<string>>(new Set());
    const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
    const [templateOverrides, setTemplateOverrides] = useState<Record<string, string>>({});
    const [duplicateDateKeys, setDuplicateDateKeys] = useState<Set<string>>(new Set());
    const [overwriteConfirmationArmed, setOverwriteConfirmationArmed] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
    const [fillIssueDateKeys, setFillIssueDateKeys] = useState<Set<string>>(new Set());
    const [fillIssueByDateKey, setFillIssueByDateKey] = useState<Record<string, string>>({});
    const [fillIssueWarning, setFillIssueWarning] = useState<string | null>(null);
    const [selectedDays, setSelectedDays] = useState<Record<string, Set<string>>>({});
    const [archivedPeriods, setArchivedPeriods] = useState<Set<string>>(new Set());

    const clearDuplicateGuardState = () => {
        setDuplicateDateKeys(new Set());
        setOverwriteConfirmationArmed(false);
        setDuplicateWarning(null);
    };

    const relevantAssignments = useMemo(() => {
        if (!selectedDate) return existingAssignments;

        return existingAssignments.filter(period => {
            const periodStart = safeToDate(period.startDate);
            const periodEnd = safeToDate(period.endDate);
            return selectedDate >= periodStart && selectedDate <= periodEnd;
        });
    }, [existingAssignments, selectedDate]);

    const activeAssignments = useMemo(() => {
        return relevantAssignments.filter(period => {
            if (archivedPeriods.has(period.id)) return false;
            return (period.days || []).length > 0;
        });
    }, [relevantAssignments, archivedPeriods]);
    
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setSelectedTemplateId('');
            setWizardStep('setup');
            setStartDateInput(toDateInputValue(smartDefaults.startDate));
            setSelectedWeekdays(new Set(DEFAULT_WEEKDAY_SELECTION));
            setEndMode('on');
            setEndOnDateInput(toDateInputValue(smartDefaults.endDate));
            setEndAfterOccurrences(8);
            setExcludedSessionDates(new Set());
            setCategoryOverrides({});
            setTemplateOverrides({});
            clearDuplicateGuardState();
            setFillIssueDateKeys(new Set());
            setFillIssueByDateKey({});
            setFillIssueWarning(null);
            setSelectedDays({});
            setArchivedPeriods(new Set());
        }
    };

    const parsedStartDate = useMemo(() => parseDateInput(startDateInput), [startDateInput]);
    const parsedEndOnDate = useMemo(() => parseDateInput(endOnDateInput), [endOnDateInput]);

    const selectedTemplate = useMemo(
        () => weekTemplates.find(t => t.id === selectedTemplateId),
        [weekTemplates, selectedTemplateId]
    );

    const templateCategoryOptions = useMemo(() => getTemplateCategoryOptions(selectedTemplate), [selectedTemplate]);
    const templateTrainingSequence = useMemo(() => getTemplateTrainingSequence(selectedTemplate), [selectedTemplate]);
    const templateDayRows = useMemo(() => getTemplateDayRows(selectedTemplate), [selectedTemplate]);

    const { plannedSessions, sessionPreviewTruncated } = useMemo(() => {
        if (!parsedStartDate || selectedWeekdays.size === 0 || !selectedTemplate) {
            return {
                plannedSessions: [] as WeekSessionPreview[],
                sessionPreviewTruncated: false,
            };
        }

        const rows: WeekSessionPreview[] = [];
        const targetOccurrences = endMode === 'after' ? Math.max(1, endAfterOccurrences) : Number.POSITIVE_INFINITY;
        const rangeEnd = endMode === 'on' ? parsedEndOnDate : null;
        let cursor = new Date(parsedStartDate);
        let scheduledSlotIndex = 0;
        let includedOccurrences = 0;
        let safety = 1400;
        let truncated = false;

        while (safety > 0) {
            if (endMode === 'on' && rangeEnd && cursor > rangeEnd) {
                break;
            }

            if (selectedWeekdays.has(getDay(cursor))) {
                const dateKey = getDateKey(cursor);
                const enabled = !excludedSessionDates.has(dateKey);
                const defaultWorkoutCategory = templateTrainingSequence[scheduledSlotIndex % templateTrainingSequence.length] || 'Workout';
                const workoutCategory = categoryOverrides[dateKey] || defaultWorkoutCategory;

                rows.push({
                    date: new Date(cursor),
                    dateKey,
                    weekdayLabel: format(cursor, 'EEEE'),
                    workoutCategory,
                    defaultWorkoutCategory,
                    workoutCategoryColor: selectedTemplate.color || '#6b7280',
                    enabled,
                    occurrenceIndex: scheduledSlotIndex,
                });

                if (enabled) {
                    includedOccurrences += 1;
                    scheduledSlotIndex += 1;
                }

                if (endMode === 'after' && includedOccurrences >= targetOccurrences) {
                    break;
                }

                if (endMode === 'on' && rows.length >= MAX_PREVIEW_OCCURRENCES) {
                    truncated = true;
                    break;
                }
            }

            cursor = addDays(cursor, 1);
            safety -= 1;
        }

        return {
            plannedSessions: rows,
            sessionPreviewTruncated: truncated,
        };
    }, [parsedStartDate, selectedWeekdays, selectedTemplate, endMode, parsedEndOnDate, endAfterOccurrences, excludedSessionDates, categoryOverrides, templateTrainingSequence]);

    const computedEndDate = useMemo(() => {
        if (plannedSessions.length === 0) return null;
        return plannedSessions[plannedSessions.length - 1]?.date || null;
    }, [plannedSessions]);

    const totalTrainingOccurrences = useMemo(() => {
        return plannedSessions.filter(session => session.enabled).length;
    }, [plannedSessions]);

    const selectedWeekdayLabels = useMemo(
        () => WEEKDAY_PICKER.filter(day => selectedWeekdays.has(day.dayIndex)).map(day => day.full),
        [selectedWeekdays]
    );

    const canContinueToConfirm = Boolean(
        selectedTemplateId &&
        parsedStartDate &&
        computedEndDate &&
        selectedWeekdays.size > 0 &&
        totalTrainingOccurrences > 0 &&
        !sessionPreviewTruncated
    );

    const linkedTemplateByCategoryKey = useMemo(() => {
        const lookup = new Map<string, string | undefined>();
        workoutCategories.forEach((item) => {
            lookup.set(toCategoryKey(item.name), item.linkedWorkoutStructureTemplateId);
        });
        return lookup;
    }, [workoutCategories]);

    const splitFillOptions = useMemo(() => {
        const options: Array<{ value: string; label: string }> = [];
        for (const workoutType of workoutTypes || []) {
            const activeSplits = (workoutType.daySplits || []).filter((split) => split.active !== false);
            for (const split of activeSplits) {
                options.push({
                    value: `split-fill:${workoutType.id}:${split.id}`,
                    label: `${workoutType.name} - ${split.label}`,
                });
            }
        }
        return options;
    }, [workoutTypes]);

    const getDefaultTemplateIdForCategory = (category: string): string | undefined => {
        const key = toCategoryKey(category);
        if (!key || key === 'rest') return undefined;

        const direct = linkedTemplateByCategoryKey.get(key);
        if (direct !== undefined) return direct;

        // Fallback for near-matches like "Cardio Day" vs "Cardio" or other renamed labels.
        for (const [candidateKey, templateId] of linkedTemplateByCategoryKey.entries()) {
            if (candidateKey === key) return templateId;
            if (candidateKey.includes(key) || key.includes(candidateKey)) {
                return templateId;
            }
        }

        return undefined;
    };

    const getAppliedTemplateIdForSession = (session: WeekSessionPreview): string | undefined => {
        const override = templateOverrides[session.dateKey];
        const overrideTemplateId = extractTemplateIdFromSelection(override);
        if (override === 'none') return undefined;
        if (overrideTemplateId) return overrideTemplateId;
        return getDefaultTemplateIdForCategory(session.workoutCategory);
    };

    const getTemplateSelectionValueForSession = (session: WeekSessionPreview): string => {
        const override = templateOverrides[session.dateKey];
        if (override) {
            if (override === 'none') return 'none';
            if (override.startsWith('structure:') || override.startsWith('structure-fill:') || override.startsWith('split-fill:')) return override;
            return toStructureSelectionValue(override);
        }
        return toStructureSelectionValue(getDefaultTemplateIdForCategory(session.workoutCategory));
    };

    const enabledSessions = plannedSessions.filter(session => session.enabled);
    const hasEnabledSessionsUsingFill = enabledSessions.some(
        session => isFillSelection(getTemplateSelectionValueForSession(session))
    );
    const groupedFillIssues = useMemo(() => {
        const grouped = new Map<string, { reason: string; dates: string[] }>();

        plannedSessions.forEach((session) => {
            const reason = fillIssueByDateKey[session.dateKey];
            if (!reason) return;

            const existing = grouped.get(reason);
            const dateLabel = format(session.date, 'EEE, MMM d');
            if (existing) {
                existing.dates.push(dateLabel);
                return;
            }

            grouped.set(reason, {
                reason,
                dates: [dateLabel],
            });
        });

        return Array.from(grouped.values()).sort((a, b) => b.dates.length - a.dates.length);
    }, [plannedSessions, fillIssueByDateKey]);
    const showPerRowFillIssueReason = groupedFillIssues.length > 1;

    const checkForDuplicateWorkouts = async (sessions: WeekSessionPreview[]) => {
        if (!clientId || sessions.length === 0) {
            return { duplicateKeys: new Set<string>(), workoutIds: [] as string[] };
        }

        const sorted = [...sessions].sort((a, b) => a.date.getTime() - b.date.getTime());
        const start = new Date(sorted[0].date);
        const end = new Date(sorted[sorted.length - 1].date);
        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        const existingWorkouts = await fetchWorkoutsByDateRange(
            clientId,
            Timestamp.fromDate(start),
            Timestamp.fromDate(end)
        );

        const targetDateKeys = new Set(sorted.map(session => session.dateKey));
        const duplicateKeys = new Set<string>();
        const workoutIds: string[] = [];

        existingWorkouts.forEach(workout => {
            const workoutDateKey = getDateKey(safeToDate(workout.date));
            if (!targetDateKeys.has(workoutDateKey)) return;
            duplicateKeys.add(workoutDateKey);
            workoutIds.push(workout.id);
        });

        return { duplicateKeys, workoutIds };
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        const enabledSessions = plannedSessions.filter(session => session.enabled);
        if (!selectedTemplateId || !parsedStartDate || enabledSessions.length === 0) return;

        const { duplicateKeys, workoutIds } = await checkForDuplicateWorkouts(enabledSessions);
        setDuplicateDateKeys(duplicateKeys);

        if (duplicateKeys.size > 0 && !overwriteConfirmationArmed) {
            setOverwriteConfirmationArmed(true);
            setDuplicateWarning(`Duplicate detected on ${duplicateKeys.size} date${duplicateKeys.size === 1 ? '' : 's'}. Uncheck conflicts or click Confirm Overwrite.`);
            return;
        }

        setIsSubmitting(true);
        try {
            setFillIssueDateKeys(new Set());
            setFillIssueByDateKey({});
            setFillIssueWarning(null);

            await onAssignWeek({
                clientId,
                weekTemplateId: selectedTemplateId,
                startDate: parsedStartDate,
                endDate: computedEndDate || parsedStartDate,
                selectedWeekdays: Array.from(selectedWeekdays).sort((a, b) => a - b),
                scheduledDays: enabledSessions.map(session => ({
                    date: session.date,
                    workoutCategory: session.workoutCategory,
                    workoutCategoryColor: session.workoutCategoryColor,
                    isAllDay: false,
                    time: DEFAULT_WEEK_ASSIGNMENT_TIME,
                    appliedTemplateId: getAppliedTemplateIdForSession(session),
                    appliedTemplateSelection: getTemplateSelectionValueForSession(session),
                })),
                overwriteExistingWorkouts: duplicateKeys.size > 0,
                duplicateWorkoutIds: duplicateKeys.size > 0 ? workoutIds : undefined,
                excludedSessionDateKeys: Array.from(excludedSessionDates),
            });
            setOpen(false);
            await Promise.resolve(onDataChanged?.());
        } catch (error) {
            const fillFailures = extractFillFailures(error);
            if (fillFailures.length > 0) {
                const failureMap = fillFailures.reduce<Record<string, string>>((acc, item) => {
                    if (!acc[item.dateKey]) {
                        acc[item.dateKey] = item.reason;
                    }
                    return acc;
                }, {});
                const hasMissingAdminCredentials = fillFailures.some((item) =>
                    item.reason.toLowerCase().includes('local +fill unavailable')
                    || item.reason.toLowerCase().includes('firebase admin credentials')
                );
                const hasWorkoutCreationFailures = fillFailures.some((item) => {
                    const reason = item.reason.toLowerCase();
                    return reason.includes('workout creation failed') || reason.includes('workout missing after verification');
                });
                setFillIssueDateKeys(new Set(fillFailures.map(item => item.dateKey)));
                setFillIssueByDateKey(failureMap);
                setFillIssueWarning(
                    hasMissingAdminCredentials
                        ? 'Local +Fill is unavailable until Firebase Admin credentials are configured. No workouts were created for this submission.'
                        : hasWorkoutCreationFailures
                            ? `Workout writes failed on ${fillFailures.length} day${fillFailures.length === 1 ? '' : 's'}. Week assignment did not finish; events will not be created until workout writes succeed.`
                        : `+Fill had issues on ${fillFailures.length} day${fillFailures.length === 1 ? '' : 's'}. Review highlighted rows and retry confirm.`
                );
                return;
            }
            console.error('Failed to assign week template:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleWeekday = (dayIndex: number) => {
        clearDuplicateGuardState();
        setSelectedWeekdays(prev => {
            const next = new Set(prev);
            if (next.has(dayIndex)) {
                next.delete(dayIndex);
            } else {
                next.add(dayIndex);
            }
            return next;
        });
    };

    const toggleSessionEnabled = (dateKey: string) => {
        clearDuplicateGuardState();
        setExcludedSessionDates(prev => {
            const next = new Set(prev);
            if (next.has(dateKey)) {
                next.delete(dateKey);
            } else {
                next.add(dateKey);
            }
            return next;
        });
    };

    const updateSessionCategory = (dateKey: string, value: string) => {
        clearDuplicateGuardState();
        setCategoryOverrides(prev => ({
            ...prev,
            [dateKey]: value,
        }));
    };

    const updateSessionTemplate = (dateKey: string, value: string) => {
        setTemplateOverrides(prev => ({
            ...prev,
            [dateKey]: value,
        }));
    };

    const toggleFillForEnabledSessions = () => {
        const enableFill = !hasEnabledSessionsUsingFill;
        const nextOverrides: Record<string, string> = { ...templateOverrides };

        plannedSessions.forEach((session) => {
            if (!session.enabled) return;
            const currentValue = getTemplateSelectionValueForSession(session);
            nextOverrides[session.dateKey] = enableFill
                ? toFillSelectionValue(currentValue)
                : toBaseSelectionValue(currentValue);
        });

        setTemplateOverrides(nextOverrides);
    };

    const handleEndModeChange = (mode: EndMode) => {
        if (mode === endMode) return;
        setEndMode(mode);
        // Reset confirmation-level session edits so one mode cannot leak into the other.
        setExcludedSessionDates(new Set());
        setCategoryOverrides({});
        setTemplateOverrides({});
        clearDuplicateGuardState();
    };

    const toggleDaySelection = (periodId: string, day: string, defaultDays: string[]) => {
        setSelectedDays(prev => {
            const current = prev[periodId] || new Set(defaultDays);
            const next = new Set(current);
            if (next.has(day)) {
                next.delete(day);
            } else {
                next.add(day);
            }
            return {
                ...prev,
                [periodId]: next,
            };
        });
    };

    const selectAllDaysForPeriod = (periodId: string, days: string[]) => {
        setSelectedDays(prev => ({
            ...prev,
            [periodId]: new Set(days),
        }));
    };

    const handleDeleteSelectedDays = async (
        period: ClientProgramPeriod,
        allDaysForPeriod: string[]
    ) => {
        const periodId = period.id;
        const selectedForPeriod = selectedDays[periodId];
        const daysToDelete = selectedForPeriod
            ? Array.from(selectedForPeriod)
            : allDaysForPeriod;
        if (daysToDelete.length === 0) {
            alert('Please select at least one day to delete');
            return;
        }

        if (confirm(`Delete ${daysToDelete.length} selected day(s)?`)) {
            try {
                await onDeleteDays(periodId, daysToDelete, {
                    startDate: safeToDate(period.startDate),
                    endDate: safeToDate(period.endDate),
                });
                setSelectedDays(prev => {
                    const next = { ...prev };
                    delete next[periodId];
                    return next;
                });
                await Promise.resolve(onDataChanged?.());
            } catch (error) {
                console.error('Failed to delete days:', error);
                alert('Failed to delete days. Please try again.');
            }
        }
    };

    const handleDeleteAllDays = async (period: ClientProgramPeriod) => {
        const rangeStartDate = safeToDate(period.startDate);
        const rangeEndDate = safeToDate(period.endDate);
        const periodStart = format(rangeStartDate, 'MMM d, yyyy');
        const periodEnd = format(rangeEndDate, 'MMM d, yyyy');

        if (confirm(`Delete all scheduled days for "${period.periodName}" (${periodStart} - ${periodEnd})? This affects only this assignment.`)) {
            try {
                await onDeleteDays(period.id, [DELETE_ALL_DAYS_TOKEN], {
                    startDate: rangeStartDate,
                    endDate: rangeEndDate,
                });
                setSelectedDays(prev => {
                    const next = { ...prev };
                    delete next[period.id];
                    return next;
                });
                await Promise.resolve(onDataChanged?.());
            } catch (error) {
                console.error('Failed to delete all days:', error);
                alert('Failed to delete all days. Please try again.');
            }
        }
    };

    const handleArchiveAssignment = async (periodId: string) => {
        if (!confirm('Archive this assignment? It will be hidden from this list.')) return;
        try {
            await onArchivePeriod(periodId);
            setArchivedPeriods(prev => new Set([...prev, periodId]));
        } catch (error) {
            console.error('Failed to archive assignment:', error);
            alert('Failed to archive assignment.');
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" type="button" disabled={!clientId || loading}>
                    <CalendarDays className="h-4 w-4 mr-2 icon-template" />
                    Week Split + Fill
                </Button>
            </DialogTrigger>
            <DialogContent className={PROGRAM_PLANNING_DIALOG_CONTENT_CLASS}>
                <DialogHeader>
                    <DialogTitle>
                        Starter Weeks + Fill{clientName ? ` - ${clientName}` : ''}
                    </DialogTitle>
                    <DialogDescription>
                        Pick a split and assign 1 to 4 starter weeks to launch training with manageable beginner-friendly structure.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Debug Info - Schedule Loading Indicator */}
                    <div className="bg-blue-50 border border-blue-200 rounded p-3 space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                            <span className="font-medium text-blue-900">Schedule Selector Loaded</span>
                        </div>
                        {existingAssignments.length > 0 ? (
                            (() => {
                                const latestAssignment = existingAssignments.reduce((latest, a) => {
                                    const aEnd = safeToDate(a.endDate);
                                    const latestEnd = latest ? safeToDate(latest.endDate) : null;
                                    return (!latestEnd || aEnd > latestEnd) ? a : latest;
                                }, null as ClientProgramPeriod | null);

                                if (!latestAssignment) return null;

                                const latestEndDate = safeToDate(latestAssignment.endDate);
                                const nextWeekday = getNextWeekdayAfter(latestEndDate);

                                return (
                                    <div className="text-blue-700">
                                        <div>Last assignment ends: <span className="font-semibold">{format(latestEndDate, 'MMM d, yyyy')}</span></div>
                                        <div>Next weekday: <span className="font-semibold">{format(nextWeekday, 'EEEE, MMM d, yyyy')}</span></div>
                                    </div>
                                );
                            })()
                        ) : (
                            <div className="text-blue-700">No existing assignments - using today as default start</div>
                        )}
                        <div className="text-blue-700">
                            Default duration: 2 weeks
                        </div>
                    </div>

                    {/* Assignment Section */}
                    <div className="border rounded-lg p-4 bg-muted/30">
                        {wizardStep === 'setup' ? (
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="week-start-date">Start Date</Label>
                                    <Input
                                        id="week-start-date"
                                        type="date"
                                        value={startDateInput}
                                        onChange={(e) => {
                                            clearDuplicateGuardState();
                                            setStartDateInput(e.target.value);
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Defaults to the next weekday after your last assignment. Adjust as needed.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Training Days</Label>
                                    <div className="grid grid-cols-7 gap-2">
                                        {WEEKDAY_PICKER.map((weekday) => {
                                            const isSelected = selectedWeekdays.has(weekday.dayIndex);
                                            return (
                                                <Button
                                                    key={weekday.full}
                                                    type="button"
                                                    variant={isSelected ? 'default' : 'outline'}
                                                    className="h-10 px-0"
                                                    onClick={() => toggleWeekday(weekday.dayIndex)}
                                                    title={weekday.full}
                                                >
                                                    {weekday.short}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Selected: {selectedWeekdayLabels.length > 0 ? selectedWeekdayLabels.join(', ') : 'None'}
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="week-template">Split</Label>
                                    <Select
                                        value={selectedTemplateId}
                                        onValueChange={(value) => {
                                            clearDuplicateGuardState();
                                            setSelectedTemplateId(value);
                                            setCategoryOverrides({});
                                        }}
                                    >
                                        <SelectTrigger id="week-template">
                                            <SelectValue placeholder="Select a split template..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {weekTemplates.map((template) => (
                                                <SelectItem key={template.id} value={template.id}>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: template.color }}
                                                        />
                                                        {template.name}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {selectedTemplate && (
                                    <div className="text-sm bg-background p-3 rounded border space-y-2">
                                        <div className="font-medium">Split Days</div>
                                        <div className="flex flex-wrap gap-2">
                                            {templateDayRows.map((row, index) => (
                                                <div
                                                    key={`${row.dayLabel}-${row.category}-${index}`}
                                                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs"
                                                >
                                                    <span className="font-medium">{index + 1}</span>
                                                    <span className="text-muted-foreground">{row.category}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <Label>End Mode</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            variant={endMode === 'on' ? 'default' : 'outline'}
                                            onClick={() => handleEndModeChange('on')}
                                        >
                                            End On Date
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={endMode === 'after' ? 'default' : 'outline'}
                                            onClick={() => handleEndModeChange('after')}
                                        >
                                            End After Occurrences
                                        </Button>
                                    </div>

                                    {endMode === 'on' ? (
                                        <div className="space-y-2">
                                            <Label htmlFor="week-end-on">End Date</Label>
                                            <Input
                                                id="week-end-on"
                                                type="date"
                                                value={endOnDateInput}
                                                onChange={(e) => {
                                                    clearDuplicateGuardState();
                                                    setEndOnDateInput(e.target.value);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label htmlFor="week-end-after">Occurrences</Label>
                                            <Input
                                                id="week-end-after"
                                                type="number"
                                                min={1}
                                                value={String(endAfterOccurrences)}
                                                onChange={(e) => {
                                                    clearDuplicateGuardState();
                                                    setEndAfterOccurrences(Math.max(1, Number(e.target.value) || 1));
                                                }}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Number of selected training-day occurrences to schedule.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                    <div className="rounded-md border bg-background p-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Computed End Date</span>
                                        <span className="font-medium">
                                            {computedEndDate ? format(computedEndDate, 'MMM d, yyyy') : 'Set required fields'}
                                        </span>
                                    </div>
                                    <div className="mt-1 flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Training Occurrences</span>
                                        <span className="font-medium">{totalTrainingOccurrences}</span>
                                    </div>
                                    {sessionPreviewTruncated && (
                                        <p className="mt-2 text-xs text-red-600">
                                            Date range too large for preview. Shorten the range or use End After Occurrences.
                                        </p>
                                    )}
                                </div>

                                <Button
                                    type="button"
                                    onClick={() => setWizardStep('confirm')}
                                    disabled={!canContinueToConfirm || isSubmitting || loading}
                                    className="w-full"
                                >
                                    Next: Confirm
                                </Button>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                <div className="space-y-2">
                                    <div className="grid grid-cols-[auto_1fr_88px] items-center gap-2">
                                        <Label className="text-sm font-medium">Scheduled Sessions</Label>
                                        <span className="text-center text-xs text-muted-foreground -translate-x-2">Uncheck holidays or out days</span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="w-[88px] justify-center"
                                            onClick={toggleFillForEnabledSessions}
                                        >
                                            {hasEnabledSessionsUsingFill ? 'Un+Fill' : '+Fill'}
                                        </Button>
                                    </div>
                                    {duplicateWarning && (
                                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                            {duplicateWarning}
                                        </div>
                                    )}
                                    {fillIssueWarning && (
                                        <div className="rounded-md border border-yellow-300 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                                            {fillIssueWarning}
                                            {groupedFillIssues.length > 0 && (
                                                <details className="mt-2 rounded border border-yellow-200 bg-yellow-100/50 px-2 py-1.5">
                                                    <summary className="cursor-pointer font-medium text-yellow-900">
                                                        Grouped issue summary
                                                    </summary>
                                                    <div className="mt-2 space-y-2">
                                                        {groupedFillIssues.map((group, index) => (
                                                            <div key={`${group.reason}-${index}`} className="rounded border border-yellow-200 bg-yellow-50 px-2 py-1.5">
                                                                <p className="font-medium text-yellow-900">
                                                                    Same issue on {group.dates.length} day{group.dates.length === 1 ? '' : 's'}
                                                                </p>
                                                                <p className="mt-1 text-yellow-800">{group.reason}</p>
                                                                <p className="mt-1 text-[11px] text-yellow-700">{group.dates.join(', ')}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </details>
                                            )}
                                        </div>
                                    )}
                                    {totalTrainingOccurrences === 0 && (
                                        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                                            Select at least one session to continue.
                                        </div>
                                    )}
                                    <div className="space-y-1">
                                        {plannedSessions.map((session) => (
                                            <div
                                                key={session.dateKey}
                                                title={fillIssueByDateKey[session.dateKey] || undefined}
                                                className={cn(
                                                    'grid grid-cols-[auto_minmax(0,1fr)_140px_minmax(0,1fr)_180px] items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-sm',
                                                    !session.enabled && 'opacity-60 bg-muted/40',
                                                    session.enabled && fillIssueDateKeys.has(session.dateKey) && 'border-yellow-300 bg-yellow-50',
                                                    session.enabled && duplicateDateKeys.has(session.dateKey) && 'border-red-300 bg-red-50'
                                                )}
                                            >
                                                <Checkbox
                                                    checked={session.enabled}
                                                    onCheckedChange={() => toggleSessionEnabled(session.dateKey)}
                                                />
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 font-medium leading-none">
                                                        <span>{format(session.date, 'EEE, MMM d')}</span>
                                                    </div>
                                                    {showPerRowFillIssueReason && session.enabled && fillIssueByDateKey[session.dateKey] && (
                                                        <p className="mt-1 text-[11px] leading-tight text-yellow-800">
                                                            {fillIssueByDateKey[session.dateKey]}
                                                        </p>
                                                    )}
                                                </div>
                                                <div className="col-start-4 justify-self-center w-[140px] -translate-x-14">
                                                        <Select value={session.workoutCategory} onValueChange={(value) => updateSessionCategory(session.dateKey, value)}>
                                                            <SelectTrigger className="h-9 w-full">
                                                                <SelectValue placeholder="Workout" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {templateCategoryOptions.map((category) => (
                                                                    <SelectItem key={category} value={category}>
                                                                        {category}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                </div>
                                                    <div className="col-start-5 justify-self-end w-[180px] translate-x-2">
                                                        <Select
                                                            value={getTemplateSelectionValueForSession(session)}
                                                            onValueChange={(value) => updateSessionTemplate(session.dateKey, value)}
                                                        >
                                                            <SelectTrigger className="h-9 w-full">
                                                                <SelectValue placeholder="Structure Templates" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none">No template</SelectItem>
                                                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500">Structure Templates + Fill</div>
                                                                {workoutStructureTemplates.map((template) => (
                                                                    <SelectItem key={`session-fill-${template.id}`} value={`structure-fill:${template.id}`}>
                                                                        <div className="flex items-center gap-2 w-full">
                                                                            <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                                                            <span className="truncate">{template.name} + Fill</span>
                                                                        </div>
                                                                    </SelectItem>
                                                                ))}
                                                                    {splitFillOptions.length > 0 && (
                                                                        <>
                                                                            <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-1 pt-1 border-t">Workout Type Splits + Fill</div>
                                                                            {splitFillOptions.map((option) => (
                                                                                <SelectItem key={option.value} value={option.value}>
                                                                                    <div className="flex items-center gap-2 w-full">
                                                                                        <Sparkles className="h-3.5 w-3.5 text-orange-600 shrink-0" />
                                                                                        <span className="truncate">{option.label}</span>
                                                                                    </div>
                                                                                </SelectItem>
                                                                            ))}
                                                                        </>
                                                                    )}
                                                                <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-1 pt-1 border-t">Structure Templates</div>
                                                                {workoutStructureTemplates.map((template) => (
                                                                    <SelectItem key={`session-structure-${template.id}`} value={`structure:${template.id}`}>
                                                                        {template.name}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="rounded-md border bg-background p-4 space-y-3 text-sm">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Start Date</span>
                                        <span className="font-medium">{parsedStartDate ? format(parsedStartDate, 'MMM d, yyyy') : '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Training Days</span>
                                        <span className="font-medium text-right">{selectedWeekdayLabels.join(', ') || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Split</span>
                                        <span className="font-medium">{selectedTemplate?.name || '-'}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">End Rule</span>
                                        <span className="font-medium">
                                            {endMode === 'on'
                                                ? `On ${parsedEndOnDate ? format(parsedEndOnDate, 'MMM d, yyyy') : '-'}`
                                                : `After ${endAfterOccurrences} occurrences`}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Total Sessions</span>
                                        <span className="font-medium">{totalTrainingOccurrences}</span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-muted-foreground">Final Scheduled Date</span>
                                        <span className="font-medium">{computedEndDate ? format(computedEndDate, 'MMM d, yyyy') : '-'}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            clearDuplicateGuardState();
                                            setWizardStep('setup');
                                        }}
                                        disabled={isSubmitting}
                                    >
                                        Back
                                    </Button>
                                    <Button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={!canContinueToConfirm || isSubmitting || loading}
                                    >
                                        {isSubmitting
                                            ? 'Assigning...'
                                            : (overwriteConfirmationArmed && duplicateDateKeys.size > 0)
                                                ? `Confirm Overwrite (${duplicateDateKeys.size})`
                                                : 'Create Weeks'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    {wizardStep === 'setup' && (
                        <>
                            <Separator />
                            <div>
                                <h3 className="font-medium mb-3">Existing Assignments</h3>
                                {activeAssignments.length === 0 ? (
                                    <div className="text-center py-6 text-muted-foreground">
                                        <p>No active week assignments found.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {activeAssignments.map((period) => {
                                            const periodDays = period.days || [];
                                            const daysInPeriod = Array.from(new Set(periodDays.map(dayEntry => {
                                                const dayDate = safeToDate(dayEntry.date);
                                                return dayDate.toLocaleDateString('en-US', { weekday: 'long' });
                                            })));
                                            const selectedForPeriod = selectedDays[period.id] || new Set<string>(daysInPeriod);
                                            const allSelected = daysInPeriod.length > 0 && daysInPeriod.every(day => selectedForPeriod.has(day));

                                            return (
                                                <div key={period.id} className="rounded-md border bg-background p-3 space-y-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <div className="font-medium">{period.periodName}</div>
                                                            <div className="text-xs text-muted-foreground">
                                                                {format(safeToDate(period.startDate), 'MMM d, yyyy')} - {format(safeToDate(period.endDate), 'MMM d, yyyy')}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <Button type="button" size="sm" variant="outline" onClick={() => handleArchiveAssignment(period.id)}>
                                                                <Archive className="h-4 w-4" />
                                                            </Button>
                                                            <Button type="button" size="sm" variant="destructive" onClick={() => handleDeleteAllDays(period)}>
                                                                Delete All
                                                            </Button>
                                                        </div>
                                                    </div>

                                                    <div className="space-y-2">
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-sm text-muted-foreground">Days</span>
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 text-xs"
                                                                onClick={() => {
                                                                    if (allSelected) {
                                                                        setSelectedDays(prev => {
                                                                            const next = { ...prev };
                                                                            next[period.id] = new Set<string>();
                                                                            return next;
                                                                        });
                                                                    } else {
                                                                        selectAllDaysForPeriod(period.id, daysInPeriod);
                                                                    }
                                                                }}
                                                            >
                                                                {allSelected ? 'Deselect All' : 'Select All'}
                                                            </Button>
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            {daysInPeriod.map(day => {
                                                                const checked = selectedForPeriod.has(day);
                                                                return (
                                                                    <button
                                                                        key={`${period.id}-${day}`}
                                                                        type="button"
                                                                        className={cn(
                                                                            'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                                                                            checked ? 'bg-primary/10 border-primary' : 'bg-white'
                                                                        )}
                                                                        onClick={() => toggleDaySelection(period.id, day, daysInPeriod)}
                                                                    >
                                                                        <span
                                                                            className={cn(
                                                                                'flex h-4 w-4 items-center justify-center rounded-[4px] border',
                                                                                checked
                                                                                    ? 'border-primary bg-primary text-primary-foreground'
                                                                                    : 'border-input bg-background'
                                                                            )}
                                                                        >
                                                                            {checked && (
                                                                                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                                                                            )}
                                                                        </span>
                                                                        <span>{day}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                        {selectedForPeriod.size > 0 && (
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="outline"
                                                                onClick={() => handleDeleteSelectedDays(period, daysInPeriod)}
                                                            >
                                                                <Trash2 className="h-4 w-4 mr-2" />
                                                                Delete Selected Days
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                        </>
                    )}

                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
