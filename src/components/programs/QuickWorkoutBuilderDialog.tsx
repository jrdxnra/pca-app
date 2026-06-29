'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Archive, Dumbbell, Sparkles, Trash2 } from 'lucide-react';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { createClientWorkout, deleteClientWorkout, fetchPeriodWorkouts, fetchWorkoutsByDateRange } from '@/lib/firebase/services/clientWorkouts';
import { auth } from '@/lib/firebase/config';
import { Timestamp } from 'firebase/firestore';
import { toastError, toastSuccess, toastWarning } from '@/components/ui/toaster';
import { addDays, addMonths, endOfMonth, format, getDay, startOfMonth, startOfWeek } from 'date-fns';
import { ClientProgramPeriod, WorkoutStructureTemplate } from '@/lib/types';
import { resolveWorkoutTypeColor } from '@/lib/workouts/workoutTypeUtils';
import { cn } from '@/lib/utils';
import { safeToDate } from '@/lib/utils/dateHelpers';
import {
  PROGRAM_PLANNING_DIALOG_CONTENT_CLASS,
  PROGRAM_PLANNING_NAV_BUTTON_CLASS,
  PROGRAM_PLANNING_NAV_GROUP_CLASS,
} from '@/components/programs/dialogSizing';

type WeekTemplate = {
  id: string;
  name: string;
  color?: string;
  days?: Array<{ day: string; workoutCategory: string }>;
};

type MonthSessionPlan = {
  date: Date;
  dateKey: string;
  workoutCategory: string;
};

type SplitDayRow = {
  dayIndex: number;
  dayLabel: string;
  category: string;
};

type MonthSessionPreview = MonthSessionPlan & {
  enabled: boolean;
  defaultWorkoutCategory: string;
};

type PeriodFillStatus = {
  scheduledWorkoutDays: number;
  plannedFillDays: number;
  loadedWorkoutDays: number;
  loadedDayLabels: string[];
};

type PeriodDayWithFill = ClientProgramPeriod['days'][number] & {
  appliedTemplateId?: string;
  appliedTemplateSelection?: string;
};

const MONTH_GOAL_OPTIONS = [
  'Strength',
  'Hypertrophy',
  'Endurance',
  'Power',
  'Conditioning',
  'Fat loss',
  'Sport-specific performance',
  'Mobility/flexibility',
  'Injury prevention',
  'Maintenance',
] as const;

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
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

function dayIndexFromLabel(dayLabel?: string): number | null {
  if (!dayLabel) return null;
  const normalized = dayLabel.trim().toLowerCase();
  const map: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thur: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  return map[normalized] ?? null;
}

function toCategoryKey(value?: string): string {
  return value?.trim().toLowerCase().replace(/\s+/g, ' ') || '';
}

function extractTemplateIdFromSelection(value?: string): string | undefined {
  if (!value || value === 'none') return undefined;
  if (value.startsWith('structure-fill:')) return value.replace('structure-fill:', '') || undefined;
  if (value.startsWith('structure:')) return value.replace('structure:', '') || undefined;
  return value;
}

function isFillSelection(value?: string): boolean {
  return Boolean(value && value.startsWith('structure-fill:'));
}

function toStructureSelectionValue(templateId?: string): string {
  return templateId ? `structure:${templateId}` : 'none';
}

function toFillSelectionValue(value: string): string {
  const templateId = extractTemplateIdFromSelection(value);
  return templateId ? `structure-fill:${templateId}` : 'none';
}

function toBaseSelectionValue(value: string): string {
  const templateId = extractTemplateIdFromSelection(value);
  return templateId ? `structure:${templateId}` : 'none';
}

function isPersistedFillDay(day: PeriodDayWithFill): boolean {
  return typeof day.appliedTemplateSelection === 'string'
    && day.appliedTemplateSelection.startsWith('structure-fill:');
}

interface QuickWorkoutBuilderDialogProps {
  clientId: string;
  clientName: string;
  onWorkoutCreated?: () => void;
  // Optional props to pre-fill the form (used when coming from calendar event)
  initialOpen?: boolean;
  initialDate?: string;
  initialCategory?: string;
  initialTime?: string;
  eventId?: string;
  onClose?: () => void;
}

export function QuickWorkoutBuilderDialog({
  clientId,
  clientName,
  onWorkoutCreated,
  initialOpen = false,
  initialDate,
  initialCategory,
  initialTime,
  eventId: propEventId,
  onClose
}: QuickWorkoutBuilderDialogProps) {
  const [open, setOpen] = useState(initialOpen);
  const [wizardStep, setWizardStep] = useState<'setup' | 'confirm'>('setup');
  const [workoutTitle, setWorkoutTitle] = useState<string>('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedSplitTemplateId, setSelectedSplitTemplateId] = useState<string>('none');
  const [selectedWeekdays, setSelectedWeekdays] = useState<Set<number>>(new Set([1, 2, 3, 4, 5]));
  const [selectedWeekKeys, setSelectedWeekKeys] = useState<Set<string>>(new Set());
  const [excludedSessionDates, setExcludedSessionDates] = useState<Set<string>>(new Set());
  const [categoryOverrides, setCategoryOverrides] = useState<Record<string, string>>({});
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, string>>({});
  const [selectedDays, setSelectedDays] = useState<Record<string, Set<string>>>({});
  const [archivedPeriods, setArchivedPeriods] = useState<Set<string>>(new Set());
  const [duplicateDateKeys, setDuplicateDateKeys] = useState<Set<string>>(new Set());
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [overwriteConfirmationArmed, setOverwriteConfirmationArmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [monthWindowStart, setMonthWindowStart] = useState(() => startOfMonth(new Date()));
  const [periodFillStatusById, setPeriodFillStatusById] = useState<Record<string, PeriodFillStatus>>({});

  const { workoutCategories, workoutStructureTemplates, workoutTypes, weekTemplates, fetchAll: fetchConfig } = useConfigurationStore();
  const {
    findPeriodForDate,
    getClientProgram,
    deleteDaysFromPeriod,
    archivePeriod,
    fetchClientPrograms,
  } = useClientPrograms(clientId);

  const clearMonthConfirmationState = () => {
    setDuplicateDateKeys(new Set());
    setDuplicateWarning(null);
    setOverwriteConfirmationArmed(false);
  };

  const monthWindowEnd = useMemo(() => endOfMonth(addMonths(monthWindowStart, 1)), [monthWindowStart]);

  const splitTemplate = useMemo(() => {
    if (!selectedSplitTemplateId || selectedSplitTemplateId === 'none') return null;
    return (weekTemplates as WeekTemplate[]).find((template) => template.id === selectedSplitTemplateId) || null;
  }, [selectedSplitTemplateId, weekTemplates]);

  const splitDayRows = useMemo((): SplitDayRow[] => {
    if (!splitTemplate?.days || splitTemplate.days.length === 0) return [];

    return splitTemplate.days
      .map((day, index) => {
        const dayIndex = dayIndexFromLabel(day.day);
        const category = normalizeWeekTemplateCategory(day.workoutCategory);
        if (dayIndex === null || !category || category === 'Rest Day') return null;
        return {
          dayIndex,
          dayLabel: day.day?.trim() || `Day ${index + 1}`,
          category,
        };
      })
      .filter((row): row is SplitDayRow => Boolean(row));
  }, [splitTemplate]);

  const splitDayCategoryOptions = useMemo(() => {
    const options = new Set<string>(['Workout']);
    workoutCategories.forEach((category) => {
      if (category?.name?.trim()) options.add(category.name.trim());
    });
    splitDayRows.forEach((row) => {
      if (row.category.trim()) options.add(row.category.trim());
    });
    return Array.from(options);
  }, [splitDayRows, workoutCategories]);

  const splitCategoryByDayIndex = useMemo(() => {
    const map = new Map<number, string>();
    if (splitDayRows.length === 0) return map;

    for (const row of splitDayRows) {
      const normalizedCategory = normalizeWeekTemplateCategory(row.category);
      if (!normalizedCategory || normalizedCategory === 'Rest Day') continue;
      map.set(row.dayIndex, normalizedCategory);
    }
    return map;
  }, [splitDayRows]);

  const plannedMonthSessions = useMemo((): MonthSessionPlan[] => {
    if (selectedWeekKeys.size === 0) return [];

    const byDateKey = new Map<string, MonthSessionPlan>();
    for (const weekKey of selectedWeekKeys) {
      const weekStart = parseDateKey(weekKey);
      for (let offset = 0; offset < 7; offset += 1) {
        const date = addDays(weekStart, offset);
        if (date < monthWindowStart || date > monthWindowEnd) continue;
        if (!selectedWeekdays.has(getDay(date))) continue;

        const splitCategory = splitCategoryByDayIndex.get(getDay(date));
        const resolvedCategory = splitCategory || 'Workout';
        if (resolvedCategory.toLowerCase().includes('rest')) continue;

        const dateKey = toDateKey(date);
        if (!byDateKey.has(dateKey)) {
          byDateKey.set(dateKey, { date, dateKey, workoutCategory: resolvedCategory });
        }
      }
    }

    return Array.from(byDateKey.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [monthWindowEnd, monthWindowStart, selectedWeekKeys, selectedWeekdays, splitCategoryByDayIndex]);

  const plannedSessions = useMemo((): MonthSessionPreview[] => {
    return plannedMonthSessions.map((session) => ({
      ...session,
      defaultWorkoutCategory: session.workoutCategory,
      workoutCategory: categoryOverrides[session.dateKey] || session.workoutCategory,
      enabled: !excludedSessionDates.has(session.dateKey),
    }));
  }, [categoryOverrides, excludedSessionDates, plannedMonthSessions]);

  const enabledSessions = useMemo(
    () => plannedSessions.filter((session) => session.enabled),
    [plannedSessions]
  );

  const templateCategoryOptions = useMemo(() => {
    const values = new Set<string>(['Workout']);
    workoutCategories.forEach((category) => {
      if (category.name?.trim()) values.add(category.name.trim());
    });
    plannedSessions.forEach((session) => {
      if (session.workoutCategory?.trim()) values.add(session.workoutCategory.trim());
      if (session.defaultWorkoutCategory?.trim()) values.add(session.defaultWorkoutCategory.trim());
    });
    return Array.from(values);
  }, [plannedSessions, workoutCategories]);

  const linkedTemplateByCategoryKey = useMemo(() => {
    const map = new Map<string, string | undefined>();
    workoutCategories.forEach((category) => {
      map.set(toCategoryKey(category.name), category.linkedWorkoutStructureTemplateId);
    });
    return map;
  }, [workoutCategories]);

  const getDefaultTemplateIdForCategory = (categoryName: string): string | undefined => {
    const key = toCategoryKey(categoryName);
    if (!key || key === 'rest day' || key === 'rest') return undefined;

    const direct = linkedTemplateByCategoryKey.get(key);
    if (direct !== undefined) return direct;

    for (const [candidateKey, templateId] of linkedTemplateByCategoryKey.entries()) {
      if (candidateKey === key) return templateId;
      if (candidateKey.includes(key) || key.includes(candidateKey)) return templateId;
    }

    return undefined;
  };

  const getTemplateSelectionValueForSession = (session: MonthSessionPreview): string => {
    const override = templateOverrides[session.dateKey];
    if (override) {
      if (override === 'none') return 'none';
      if (override.startsWith('structure:') || override.startsWith('structure-fill:')) return override;
      return toStructureSelectionValue(override);
    }
    return toStructureSelectionValue(getDefaultTemplateIdForCategory(session.workoutCategory));
  };

  const hasEnabledSessionsUsingFill = enabledSessions.some((session) =>
    isFillSelection(getTemplateSelectionValueForSession(session))
  );
  const selectedGoalsSummary = selectedGoals.join(', ');

  const activeAssignments = useMemo(() => {
    const periods = getClientProgram(clientId)?.periods || [];
    return periods.filter((period) => {
      if (period.archived || archivedPeriods.has(period.id)) return false;
      return (period.days || []).length > 0;
    });
  }, [archivedPeriods, clientId, getClientProgram]);

  const canContinueToConfirm = Boolean(
    workoutTitle.trim()
      && selectedWeekKeys.size > 0
      && selectedWeekdays.size > 0
      && plannedMonthSessions.length > 0
  );

  // Handle initialOpen changes
  useEffect(() => {
    if (initialOpen) {
      setOpen(true);
    }
  }, [initialOpen]);

  // Fetch config when dialog opens
  useEffect(() => {
    if (open) {
      fetchConfig();
      fetchClientPrograms(clientId).catch(() => undefined);
    }
  }, [open, fetchConfig, fetchClientPrograms, clientId]);

  useEffect(() => {
    if (!open) return;
    if (selectedWeekKeys.size > 0) return;
    const currentWeekStart = startOfWeek(new Date(), { weekStartsOn: 0 });
    setSelectedWeekKeys(new Set([toDateKey(currentWeekStart)]));
  }, [open, selectedWeekKeys.size]);

  useEffect(() => {
    if (!open || activeAssignments.length === 0) {
      setPeriodFillStatusById({});
      return;
    }

    let cancelled = false;

    const loadPeriodFillStatus = async () => {
      const nextStatusEntries = await Promise.all(activeAssignments.map(async (period) => {
        const periodDays = ((period.days || []) as PeriodDayWithFill[]).filter((day) =>
          !day.workoutCategory.toLowerCase().includes('rest')
        );
        const plannedFillDays = periodDays.filter(isPersistedFillDay).length;
        const workouts = await fetchPeriodWorkouts(period.id);
        const loadedWorkouts = workouts.filter((workout) => Boolean(workout.appliedTemplateId));
        const loadedDayLabels = Array.from(new Set(loadedWorkouts.map((workout) =>
          safeToDate(workout.date).toLocaleDateString('en-US', { weekday: 'long' })
        )));

        return [period.id, {
          scheduledWorkoutDays: periodDays.length,
          plannedFillDays,
          loadedWorkoutDays: loadedWorkouts.length,
          loadedDayLabels,
        } satisfies PeriodFillStatus] as const;
      }));

      if (cancelled) return;
      setPeriodFillStatusById(Object.fromEntries(nextStatusEntries));
    };

    loadPeriodFillStatus().catch((error) => {
      console.error('Failed to load assignment +Fill status:', error);
      if (!cancelled) {
        setPeriodFillStatusById({});
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeAssignments, open]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Only reset if not using initial values
      if (!initialOpen) {
        setWorkoutTitle('');
        setSelectedGoals([]);
        setWizardStep('setup');
        setSelectedSplitTemplateId('none');
        setSelectedWeekdays(new Set([1, 2, 3, 4, 5]));
        setSelectedWeekKeys(new Set());
        setExcludedSessionDates(new Set());
        setCategoryOverrides({});
        setTemplateOverrides({});
        setSelectedDays({});
        setArchivedPeriods(new Set());
        setMonthWindowStart(startOfMonth(new Date()));
        clearMonthConfirmationState();
      }
      onClose?.();
    }
  }, [open, initialOpen, onClose]);

  const createQuickWorkout = async (workoutData: any) => createClientWorkout(workoutData);

  const handleSave = async () => {
    if (!workoutTitle.trim()) {
      toastWarning('Please enter a workout title');
      return;
    }

    if (enabledSessions.length === 0) {
      toastWarning('Select at least one session to create.');
      return;
    }

    setIsSaving(true);
    try {
      const buildRoundsFromTemplate = (templateId?: string): any[] => {
        if (!templateId) return [];
        const template = workoutStructureTemplates.find((item) => item.id === templateId);
        if (!template?.sections?.length) return [];

        return template.sections
          .sort((a, b) => a.order - b.order)
          .map((section, index) => ({
            ordinal: index + 1,
            sets: 1,
            sectionName: section.workoutTypeName,
            sectionColor: resolveWorkoutTypeColor(workoutTypes, section.workoutTypeId, section.workoutTypeName),
            workoutTypeId: section.workoutTypeId,
            movementUsages: [{
              ordinal: 1,
              movementId: '',
              categoryId: '',
              note: '',
              targetWorkload: {
                useWeight: false,
                weightMeasure: 'lbs' as const,
                useReps: false,
                useTempo: false,
                useTime: false,
                useDistance: false,
                distanceMeasure: 'm' as const,
                usePace: false,
                paceMeasure: 'km' as const,
                usePercentage: false,
                useRPE: false,
              },
            }],
          }));
      };

      const generateDraftForDate = async (
        categoryName: string,
        templateSelection: string,
        rounds: any[],
        templateId?: string
      ) => {
        if (!isFillSelection(templateSelection) || !templateId) {
          return {
            title: workoutTitle,
            notes: '',
            rounds,
            isModified: false,
          };
        }

        const token = await auth.currentUser?.getIdToken();
        if (!token) {
          throw new Error('Unauthorized: session token missing. Refresh and retry +Fill.');
        }

        const response = await fetch('/api/fill/workouts/draft', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'X-DDS-Flow': 'monthly',
          },
          body: JSON.stringify({
            clientId,
            categoryName,
            structureTemplateId: templateId,
            sessionDurationMinutes: 60,
            currentTitle: workoutTitle,
            currentNotes: selectedGoalsSummary ? `Monthly goals: ${selectedGoalsSummary}` : undefined,
            goals: selectedGoalsSummary || undefined,
            includeDecisionTrace: true,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const message = typeof errorBody?.error === 'string'
            ? errorBody.error
            : `+Fill draft failed (${response.status})`;
          throw new Error(message);
        }

        const payload = await response.json() as {
          draft?: {
            title?: string;
            notes?: string;
            rounds?: any[];
          };
        };

        return {
          title: payload?.draft?.title || workoutTitle,
          notes: payload?.draft?.notes || '',
          rounds: Array.isArray(payload?.draft?.rounds) ? payload.draft.rounds : rounds,
          isModified: true,
        };
      };

      const buildWorkoutData = async (session: MonthSessionPreview) => {
        const templateSelection = getTemplateSelectionValueForSession(session);
        const templateId = extractTemplateIdFromSelection(templateSelection);
        const rounds = buildRoundsFromTemplate(templateId);
        const targetDate = session.date;
        const categoryName = session.workoutCategory;
        const period = findPeriodForDate(targetDate, clientId);
        const draft = await generateDraftForDate(categoryName, templateSelection, rounds, templateId);
        const goalPrefix = selectedGoalsSummary ? `Goals: ${selectedGoalsSummary}` : '';
        const mergedNotes = [goalPrefix, draft.notes || ''].filter(Boolean).join('\n\n');

        return {
          clientId,
          periodId: period?.id || null,
          date: Timestamp.fromDate(targetDate),
          title: draft.title,
          notes: mergedNotes,
          time: '',
          categoryName,
          appliedTemplateId: templateId,
          appliedTemplateSelection: templateSelection,
          rounds: draft.rounds,
          isModified: draft.isModified,
          warmups: [],
        };
      };

      const sortedEnabledSessions = [...enabledSessions].sort((a, b) => a.date.getTime() - b.date.getTime());
      const rangeStart = new Date(sortedEnabledSessions[0].date);
      const rangeEnd = new Date(sortedEnabledSessions[sortedEnabledSessions.length - 1].date);
      rangeStart.setHours(0, 0, 0, 0);
      rangeEnd.setHours(23, 59, 59, 999);

      const existingInRange = await fetchWorkoutsByDateRange(
        clientId,
        Timestamp.fromDate(rangeStart),
        Timestamp.fromDate(rangeEnd)
      );
      const existingByDateKey = new Map<string, string[]>();
      for (const workout of existingInRange) {
        const key = toDateKey(workout.date instanceof Timestamp ? workout.date.toDate() : new Date(workout.date));
        const ids = existingByDateKey.get(key) || [];
        ids.push(workout.id);
        existingByDateKey.set(key, ids);
      }

      const monthSessionMap = new Map(sortedEnabledSessions.map((session) => [session.dateKey, session]));
      const foundDuplicates = sortedEnabledSessions
        .map((session) => session.dateKey)
        .filter((key) => existingByDateKey.has(key));

      const duplicateSet = new Set(foundDuplicates);
      setDuplicateDateKeys(duplicateSet);

      if (duplicateSet.size > 0 && !overwriteConfirmationArmed) {
        setDuplicateWarning(
          `Duplicate workouts found on ${duplicateSet.size} day${duplicateSet.size === 1 ? '' : 's'}. Click Confirm Overwrite to replace them.`
        );
        setOverwriteConfirmationArmed(true);
        setIsSaving(false);
        return;
      }

      if (duplicateSet.size > 0) {
        const idsToDelete = Array.from(new Set(Array.from(duplicateSet).flatMap((dateKey) => existingByDateKey.get(dateKey) || [])));
        for (const workoutId of idsToDelete) {
          try {
            await deleteClientWorkout(workoutId);
          } catch {
            // Continue with remaining IDs so month overwrite can proceed when possible.
          }
        }
      }

      let createdCount = 0;
      const failures: string[] = [];

      for (const session of sortedEnabledSessions) {
        try {
          const monthSession = monthSessionMap.get(session.dateKey);
          if (!monthSession) continue;
          const workoutData = await buildWorkoutData(monthSession);
          await createQuickWorkout(workoutData);
          createdCount += 1;
        } catch (error) {
          failures.push(`${format(session.date, 'MMM d')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (createdCount === 0) {
        toastError(`No workouts created. ${failures[0] || 'Please retry.'}`);
        return;
      }

      if (failures.length > 0) {
        toastWarning(`Created ${createdCount} workout(s) with ${failures.length} failure(s). First issue: ${failures[0]}`);
      } else {
        toastSuccess(`Created ${createdCount} workouts for month range.`);
      }

      setOpen(false);
      clearMonthConfirmationState();
      setWizardStep('setup');
      onWorkoutCreated?.();
    } catch (error) {
      console.error('Error creating workout:', error);
      toastError('Failed to create workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSessionEnabled = (dateKey: string) => {
    clearMonthConfirmationState();
    setExcludedSessionDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) {
        next.delete(dateKey);
      } else {
        next.add(dateKey);
      }
      return next;
    });
  };

  const toggleGoal = (goalName: string) => {
    clearMonthConfirmationState();
    setSelectedGoals((prev) => {
      if (prev.includes(goalName)) {
        return prev.filter((goal) => goal !== goalName);
      }
      return [...prev, goalName];
    });
  };

  const updateSessionCategory = (dateKey: string, categoryName: string) => {
    clearMonthConfirmationState();
    setCategoryOverrides((prev) => ({
      ...prev,
      [dateKey]: categoryName,
    }));
  };

  const updateSessionTemplate = (dateKey: string, value: string) => {
    setTemplateOverrides((prev) => ({
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

  const toggleDaySelection = (periodId: string, day: string, defaultDays: string[]) => {
    setSelectedDays((prev) => {
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
    setSelectedDays((prev) => ({
      ...prev,
      [periodId]: new Set(days),
    }));
  };

  const handleDeleteSelectedDays = async (
    period: ClientProgramPeriod,
    allDaysForPeriod: string[]
  ) => {
    const selectedForPeriod = selectedDays[period.id];
    const daysToDelete = selectedForPeriod ? Array.from(selectedForPeriod) : allDaysForPeriod;
    if (daysToDelete.length === 0) {
      alert('Please select at least one day to delete');
      return;
    }

    if (!confirm(`Delete ${daysToDelete.length} selected day(s)?`)) return;

    try {
      await deleteDaysFromPeriod(period.id, clientId, daysToDelete, {
        startDate: safeToDate(period.startDate),
        endDate: safeToDate(period.endDate),
      });
      setSelectedDays((prev) => {
        const next = { ...prev };
        delete next[period.id];
        return next;
      });
      await fetchClientPrograms(clientId);
      onWorkoutCreated?.();
    } catch (error) {
      console.error('Failed to delete days:', error);
      alert('Failed to delete days. Please try again.');
    }
  };

  const handleDeleteAllDays = async (period: ClientProgramPeriod) => {
    const rangeStartDate = safeToDate(period.startDate);
    const rangeEndDate = safeToDate(period.endDate);
    const periodStart = format(rangeStartDate, 'MMM d, yyyy');
    const periodEnd = format(rangeEndDate, 'MMM d, yyyy');

    if (!confirm(`Delete all scheduled days for "${period.periodName}" (${periodStart} - ${periodEnd})? This affects only this assignment.`)) return;

    try {
      await deleteDaysFromPeriod(period.id, clientId, ['__ALL_DAYS__'], {
        startDate: rangeStartDate,
        endDate: rangeEndDate,
      });
      setSelectedDays((prev) => {
        const next = { ...prev };
        delete next[period.id];
        return next;
      });
      await fetchClientPrograms(clientId);
      onWorkoutCreated?.();
    } catch (error) {
      console.error('Failed to delete all days:', error);
      alert('Failed to delete all days. Please try again.');
    }
  };

  const handleArchiveAssignment = async (periodId: string) => {
    if (!confirm('Archive this assignment? It will be hidden from this list.')) return;
    try {
      await archivePeriod(periodId, clientId);
      setArchivedPeriods((prev) => new Set([...prev, periodId]));
      await fetchClientPrograms(clientId);
    } catch (error) {
      console.error('Failed to archive assignment:', error);
      alert('Failed to archive assignment.');
    }
  };

  const toggleWeekSelection = (date: Date) => {
    clearMonthConfirmationState();
    const weekStartKey = toDateKey(startOfWeek(date, { weekStartsOn: 0 }));
    setSelectedWeekKeys((prev) => {
      const next = new Set(prev);
      if (next.has(weekStartKey)) {
        next.delete(weekStartKey);
      } else {
        next.add(weekStartKey);
      }
      return next;
    });
  };

  const renderMiniMonth = (monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const monthLabel = format(monthDate, 'MMMM yyyy');
    const dayHeaders = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const plannedKeys = new Set(plannedMonthSessions.map((session) => session.dateKey));

    const weeks = Array.from({ length: 6 }).map((_, weekIndex) =>
      Array.from({ length: 7 }).map((__, dayIndex) => addDays(gridStart, weekIndex * 7 + dayIndex))
    );

    return (
      <div className="rounded-lg border border-slate-200 p-3">
        <div className="mb-2 text-sm font-semibold text-slate-700">{monthLabel}</div>
        <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] text-slate-500">
          {dayHeaders.map((day, index) => (
            <div key={`${monthLabel}-${index}`}>{day}</div>
          ))}
        </div>
        <div className="grid gap-1">
          {weeks.map((week, weekIndex) => {
            const weekStartKey = toDateKey(startOfWeek(week[0], { weekStartsOn: 0 }));
            const isWeekSelected = selectedWeekKeys.has(weekStartKey);
            return (
              <div key={`${monthLabel}-week-${weekIndex}`} className="grid grid-cols-7 gap-1">
                {week.map((date) => {
                  const inCurrentMonth = date.getMonth() === monthDate.getMonth();
                  const dateKey = toDateKey(date);
                  const isPlanned = plannedKeys.has(dateKey);
                  const isDuplicate = duplicateDateKeys.has(dateKey);
                  return (
                    <button
                      key={`${monthLabel}-${dateKey}`}
                      type="button"
                      onClick={() => toggleWeekSelection(date)}
                      className={cn(
                        'h-8 rounded text-xs transition-colors',
                        inCurrentMonth ? 'text-slate-700' : 'text-slate-300',
                        isWeekSelected && 'bg-blue-100 text-blue-900',
                        isPlanned && 'ring-1 ring-emerald-500',
                        isDuplicate && 'ring-1 ring-amber-500'
                      )}
                      title={isDuplicate ? 'Existing workout found for this date' : undefined}
                    >
                      {format(date, 'd')}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Dumbbell className="h-4 w-4" />
          <span className="hidden lg:inline">Month Plan + </span>Fill
        </Button>
      </DialogTrigger>
      <DialogContent className={PROGRAM_PLANNING_DIALOG_CONTENT_CLASS}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Month Plan + Fill
          </DialogTitle>
          <DialogDescription>
            Build month sessions first, then confirm each one with categories and templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="border rounded-lg p-4 bg-muted/30">
            {wizardStep === 'setup' ? (
              <div className="grid gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 pt-0">
                    <div className={PROGRAM_PLANNING_NAV_GROUP_CLASS}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMonthWindowStart((current) => startOfMonth(addMonths(current, -1)))}
                        className={`${PROGRAM_PLANNING_NAV_BUTTON_CLASS} rounded-l-md rounded-r-none border-r`}
                        aria-label="Previous months"
                      >
                        <span aria-hidden="true">‹</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setMonthWindowStart((current) => startOfMonth(addMonths(current, 1)))}
                        className={`${PROGRAM_PLANNING_NAV_BUTTON_CLASS} rounded-r-md rounded-l-none`}
                        aria-label="Next months"
                      >
                        <span aria-hidden="true">›</span>
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 pt-1 md:grid-cols-2">
                    {renderMiniMonth(monthWindowStart)}
                    {renderMiniMonth(addMonths(monthWindowStart, 1))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Click any day to toggle a full week. Green rings show planned sessions. Amber rings indicate duplicates.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Weekdays</Label>
                  <div className="grid grid-cols-7 gap-2">
                    {WEEKDAY_OPTIONS.map((weekday) => {
                      const selected = selectedWeekdays.has(weekday.value);
                      return (
                        <Button
                          key={weekday.value}
                          type="button"
                          variant={selected ? 'default' : 'outline'}
                          className="h-8 px-0"
                          onClick={() => {
                            clearMonthConfirmationState();
                            const next = new Set(selectedWeekdays);
                            if (next.has(weekday.value)) {
                              next.delete(weekday.value);
                            } else {
                              next.add(weekday.value);
                            }
                            setSelectedWeekdays(next);
                          }}
                        >
                          {weekday.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="month-split-template">Split</Label>
                  <Select
                    value={selectedSplitTemplateId}
                    onValueChange={(value) => {
                      clearMonthConfirmationState();
                      setSelectedSplitTemplateId(value);
                    }}
                  >
                    <SelectTrigger id="month-split-template">
                      <SelectValue placeholder="Select a split template..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No split template</SelectItem>
                      {(weekTemplates as WeekTemplate[]).map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          <div className="flex items-center gap-2">
                            {template.color && (
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: template.color }} />
                            )}
                            {template.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {splitTemplate && splitDayRows.length > 0 && (
                  <div className="text-sm bg-background p-3 rounded border space-y-2">
                    <div className="font-medium">Split Days</div>
                    <div className="flex flex-wrap gap-2">
                      {splitDayRows.map((row, index) => (
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
                  <Label>Goals</Label>
                  <div className="flex flex-wrap gap-2">
                    {MONTH_GOAL_OPTIONS.map((goal) => {
                      const isSelected = selectedGoals.includes(goal);
                      return (
                        <button
                          key={goal}
                          type="button"
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors',
                            isSelected
                              ? 'border-primary bg-primary/10 text-foreground'
                              : 'border-border bg-background text-muted-foreground hover:text-foreground'
                          )}
                          onClick={() => toggleGoal(goal)}
                        >
                          <span
                            className={cn(
                              'flex h-4 w-4 items-center justify-center rounded-[4px] border',
                              isSelected
                                ? 'border-primary bg-primary text-primary-foreground'
                                : 'border-input bg-background'
                            )}
                          >
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                          </span>
                          <span>{goal}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workout-title">Title *</Label>
                  <Input
                    id="workout-title"
                    placeholder="e.g., Upper Body"
                    value={workoutTitle}
                    onChange={(e) => {
                      setWorkoutTitle(e.target.value);
                      clearMonthConfirmationState();
                    }}
                  />
                </div>

                <Button
                  type="button"
                  onClick={() => setWizardStep('confirm')}
                  disabled={!canContinueToConfirm || isSaving}
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

                  {enabledSessions.length === 0 && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      Select at least one session to continue.
                    </div>
                  )}

                  <div className="space-y-1">
                    {plannedSessions.map((session) => (
                      <div
                        key={session.dateKey}
                        className={cn(
                          'grid grid-cols-[auto_minmax(0,1fr)_140px_minmax(0,1fr)_180px] items-center gap-2 rounded-md border bg-white px-2.5 py-2 text-sm',
                          !session.enabled && 'opacity-60 bg-muted/40',
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
                        </div>

                        <div className="col-start-4 justify-self-center w-[140px] -translate-x-14">
                          <Select
                            value={session.workoutCategory}
                            onValueChange={(value) => updateSessionCategory(session.dateKey, value)}
                          >
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
                                <SelectItem key={`month-fill-${template.id}`} value={`structure-fill:${template.id}`}>
                                  <div className="flex items-center gap-2 w-full">
                                    <Sparkles className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                                    <span className="truncate">{template.name} + Fill</span>
                                  </div>
                                </SelectItem>
                              ))}
                              <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-1 pt-1 border-t">Structure Templates</div>
                              {workoutStructureTemplates.map((template) => (
                                <SelectItem key={`month-structure-${template.id}`} value={`structure:${template.id}`}>
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

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      clearMonthConfirmationState();
                      setWizardStep('setup');
                    }}
                    disabled={isSaving}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={!canContinueToConfirm || isSaving}
                  >
                    {isSaving
                      ? 'Creating...'
                      : (overwriteConfirmationArmed && duplicateDateKeys.size > 0)
                        ? `Confirm Overwrite (${duplicateDateKeys.size})`
                        : 'Create Month'}
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
                    <p>No active month assignments found.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeAssignments.map((period) => {
                      const periodDays = period.days || [];
                      const daysInPeriod = Array.from(new Set(periodDays.map((dayEntry) => {
                        const dayDate = safeToDate(dayEntry.date);
                        return dayDate.toLocaleDateString('en-US', { weekday: 'long' });
                      })));
                      const fillStatus = periodFillStatusById[period.id];
                      const loadedDayLabels = new Set(fillStatus?.loadedDayLabels || []);

                      const selectedForPeriod = selectedDays[period.id] || new Set<string>(daysInPeriod);
                      const allSelected = daysInPeriod.length > 0 && daysInPeriod.every((day) => selectedForPeriod.has(day));

                      return (
                        <div key={period.id} className="rounded-md border bg-background p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <div className="font-medium">{period.periodName}</div>
                                {fillStatus && fillStatus.loadedWorkoutDays > 0 && (
                                  <Badge variant="secondary" className="gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Loaded {fillStatus.loadedWorkoutDays}/{fillStatus.scheduledWorkoutDays}
                                  </Badge>
                                )}
                                {fillStatus && fillStatus.loadedWorkoutDays === 0 && fillStatus.plannedFillDays > 0 && (
                                  <Badge variant="outline" className="gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    Fill planned {fillStatus.plannedFillDays}/{fillStatus.scheduledWorkoutDays}
                                  </Badge>
                                )}
                              </div>
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
                                    setSelectedDays((prev) => {
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
                              {daysInPeriod.map((day) => {
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
                                      {checked && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
                                    </span>
                                    <span>{day}</span>
                                    {loadedDayLabels.has(day) && (
                                      <span className="inline-flex items-center gap-1 text-primary">
                                        <Sparkles className="h-3 w-3" />
                                        +Fill
                                      </span>
                                    )}
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


























