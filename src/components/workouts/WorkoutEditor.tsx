"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, X, Save, ClipboardList, TrendingUp, Copy, Sparkles, FastForward } from 'lucide-react';
import {
  ClientWorkout,
  ClientWorkoutWarmup,
  ClientWorkoutRound,
  ClientWorkoutMovementUsage,
  ClientWorkoutTargetWorkload,
  WorkoutStructureTemplate
} from '@/lib/types';
import { toastSuccess, toastError } from '@/components/ui/toaster';

// Helper function to abbreviate workout type names
function abbreviateWorkoutType(name: string): string {
  // Normalize the name: lowercase, trim, and replace multiple spaces with single space
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');

  // Check for exact matches first
  const exactMatches: Record<string, string> = {
    'power prep': 'PREP',
    'performance prep': 'PREP',
    'pp': 'PREP',
    'movement prep': 'PREP',
    'movement preparation': 'PREP',
    'mp': 'PREP',
    'ballistics': 'PREP',
    'ballistic': 'PREP',
    'warm-up': 'W/U',
    'warmup': 'W/U',
    'warm up': 'W/U',
    'warm ups': 'W/U',
    'w/u': 'W/U',
    'round1': 'R1',
    'round 1': 'R1',
    'r1': 'R1',
    'round2': 'R2',
    'round 2': 'R2',
    'r2': 'R2',
    'amrap': 'AMRAP',
    'emom': 'EMOM',
    'cool-down': 'C/D',
    'cooldown': 'C/D',
    'cool down': 'C/D',
    'c/d': 'C/D',
    'pre-hab': 'PRE/HAB',
    'prehab': 'PRE/HAB',
    'pre - hab': 'PRE/HAB',
    'pre hab': 'PRE/HAB',
    'strength 1': 'S1',
    'strength1': 'S1',
    'strength 2': 'S2',
    'strength2': 'S2',
    'energy system development': 'ESD',
    'esd': 'ESD',
    'conditioning': 'COND',
    'mobility': 'MOB',
    'activation': 'ACT',
  };

  if (exactMatches[normalized]) {
    return exactMatches[normalized];
  }

  // Check for partial matches (contains the key phrase)
  if (normalized.includes('power prep') || normalized.includes('performance prep') || normalized.includes('movement prep') || normalized.includes('ballistic')) {
    return 'PREP';
  }
  if (normalized.includes('warm up') || normalized.includes('warm-up')) {
    return 'W/U';
  }
  if (normalized.includes('round 1') || normalized === 'round1') {
    return 'R1';
  }
  if (normalized.includes('round 2') || normalized === 'round2') {
    return 'R2';
  }
  if (normalized.includes('cool down') || normalized.includes('cool-down')) {
    return 'C/D';
  }
  if (normalized.includes('pre-hab') || normalized.includes('pre hab')) {
    return 'PRE/HAB';
  }

  return name.substring(0, 3).toUpperCase();
}

// Helper function to get abbreviation list for a template with colors
function getTemplateAbbreviationList(template: WorkoutStructureTemplate, workoutTypes: any[]): Array<{ abbrev: string; color: string }> {
  if (!template.sections || template.sections.length === 0) {
    return [];
  }

  return template.sections
    .sort((a, b) => a.order - b.order)
    .map(section => {
      const workoutType = workoutTypes.find(wt => wt.id === section.workoutTypeId);
      return {
        abbrev: abbreviateWorkoutType(section.workoutTypeName),
        color: workoutType?.color || '#6b7280'
      };
    });
}
import { useMovements } from '@/hooks/queries/useMovements';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { WarmupEditor } from './WarmupEditor';
import { RoundEditor } from './RoundEditor';
import { MovementUsageRow } from './MovementUsageRow';
import { ColumnVisibilityToggle } from './ColumnVisibilityToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { calculateOneRepMax, calculateTuchscherer, calculateWeightFromOneRepMax } from '@/lib/utils/rpe-calculator';
import { updateRecentExercisePerformance, getRecentExercisePerformance } from '@/lib/firebase/services/clients';

// Helper to convert between weight units
const convertWeight = (weight: number, fromUnit: 'lbs' | 'kg', toUnit: 'lbs' | 'kg'): number => {
  if (fromUnit === toUnit) return weight;
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return Math.round(weight / 2.205 * 10) / 10; // Convert lbs to kg, round to 1 decimal
  }
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return Math.round(weight * 2.205 * 10) / 10; // Convert kg to lbs, round to 1 decimal
  }
  return weight;
};

const DEFAULT_TARGET_WORKLOAD: ClientWorkoutTargetWorkload = {
  useWeight: false,
  weightMeasure: 'lbs',
  useReps: false,
  useTempo: false,
  useTime: false,
  useDistance: false,
  distanceMeasure: 'mi',
  usePace: false,
  paceMeasure: 'mi',
  usePercentage: false,
  useRPE: false,
  unilateral: false,
};

interface WorkoutEditorProps {
  workout?: ClientWorkout | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (workoutData: Partial<ClientWorkout>, options?: { skipClose?: boolean }) => Promise<void>;
  isCreating?: boolean;
  isInline?: boolean;
  expandedInline?: boolean; // Full editor inline (for day view)
  initialRounds?: ClientWorkoutRound[];
  appliedTemplateId?: string;
  eventId?: string; // Calendar event ID for time sync
  clientId?: string; // Client ID for performance logging
  // External column visibility control (optional - for page-level control)
  externalVisibleColumns?: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  onExternalColumnVisibilityChange?: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
  onDelete?: () => Promise<void>;
  hideTopActionBar?: boolean; // Hide top action bar (buttons rendered elsewhere)
  // NEW: Smart Create Handler
  onCreateNext?: (type: 'progression' | 'generation') => void;
  draftKey?: string; // Unique key for draft storage (e.g., "workout-2025-12-15-clientId")
}

// Draft storage helpers
const DRAFT_PREFIX = 'pca-workout-draft-';

interface WorkoutDraft {
  title: string;
  notes: string;
  time: string;
  rounds: ClientWorkoutRound[];
  currentTemplateId?: string;
  savedAt: number;
}

function saveDraft(key: string, draft: WorkoutDraft) {
  try {
    localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(draft));
  } catch (e) {
    console.warn('Failed to save draft:', e);
  }
}

function loadDraft(key: string): WorkoutDraft | null {
  try {
    const data = localStorage.getItem(DRAFT_PREFIX + key);
    if (data) {
      const draft = JSON.parse(data) as WorkoutDraft;
      // Only use drafts less than 24 hours old
      if (Date.now() - draft.savedAt < 24 * 60 * 60 * 1000) {
        return draft;
      }
    }
  } catch (e) {
    console.warn('Failed to load draft:', e);
  }
  return null;
}

function clearDraft(key: string) {
  try {
    localStorage.removeItem(DRAFT_PREFIX + key);
  } catch (e) {
    console.warn('Failed to clear draft:', e);
  }
}

// Expose save method via ref
export interface WorkoutEditorHandle {
  save: () => Promise<void>;
  isLoading: boolean;
}

export const WorkoutEditor = forwardRef<WorkoutEditorHandle, WorkoutEditorProps>(function WorkoutEditor({
  workout,
  isOpen,
  onClose,
  onSave,
  isCreating = false,
  isInline = false,
  expandedInline = false,
  initialRounds,
  appliedTemplateId,
  eventId,
  clientId,
  hideTopActionBar = false,
  externalVisibleColumns,
  onExternalColumnVisibilityChange,
  onDelete,
  draftKey,
  onCreateNext
}, ref) {
  const { categories, fetchCategories } = useMovementCategoryStore();
  const {
    workoutStructureTemplates,
    workoutTemplates, // Add this
    fetchFullWorkoutTemplates, // Add this
    workoutTypes,
    fetchWorkoutTypes
  } = useConfigurationStore();
  const { events, updateEvent } = useCalendarStore();

  // Form state
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [time, setTime] = useState('');
  const [warmups, setWarmups] = useState<ClientWorkoutWarmup[]>([]);
  const [rounds, setRounds] = useState<ClientWorkoutRound[]>([{
    ordinal: 1,
    sets: 1,
    movementUsages: [{
      ordinal: 1,
      movementId: '',
      categoryId: '',
      note: '',
      targetWorkload: { ...DEFAULT_TARGET_WORKLOAD }
    }]
  }]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedRounds, setExpandedRounds] = useState<Record<number, boolean>>({});
  const [currentTemplateId, setCurrentTemplateId] = useState<string | undefined>(appliedTemplateId);
  const [hasSyncedTime, setHasSyncedTime] = useState(false);

  // Performance logging state
  const [isLoggingMode, setIsLoggingMode] = useState(false);
  const [prescribedRounds, setPrescribedRounds] = useState<ClientWorkoutRound[]>([]);
  const [dirtyMovementIds, setDirtyMovementIds] = useState<Set<string>>(new Set());
  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  const [performanceData, setPerformanceData] = useState<Record<string, Array<{
    weight?: string;
    reps?: string;
    rpe?: string;
  }>>>({});
  const [suggestedWeights, setSuggestedWeights] = useState<Record<string, { value: string; unit: string }>>({});

  // Column visibility state (use external if provided, otherwise internal)
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<{
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  }>({});

  const visibleColumns = externalVisibleColumns ?? internalVisibleColumns;

  // Lazy load movements - only fetch when needed:
  // 1. If there are existing movementUsages with movementId (need to display them)
  // 2. MovementUsageRow components will trigger their own loading when category is selected
  // Simple calculation - no useMemo needed (avoids React error #310)
  const hasExistingMovements = rounds.some(round =>
    round.movementUsages?.some(usage => usage.movementId && usage.movementId !== '')
  );

  // Use React Query for movements (with lazy loading and enhanced caching)
  // Always fetch movements since they're filtered by category in InlineMovementEditor
  // Movements are cached for 10 minutes so this isn't expensive
  const { data: movements = [], isLoading: movementsLoading } = useMovements(
    true, // includeCategory = true
    true, // Always fetch movements - they're needed when selecting categories
    {
      // Movements are cached for 10 minutes (configured in hook)
      // This prevents refetching when navigating between workouts
    }
  );

  // Drag and drop state
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Track the current workout ID to prevent unnecessary resets
  const currentWorkoutIdRef = React.useRef<string | null>(null);
  // Track the template ID we initialized with to prevent resets when only column visibility changes
  const initializedTemplateIdRef = React.useRef<string | undefined>(undefined);

  // Column visibility handler (use external handler if provided, otherwise internal)
  const handleColumnVisibilityChange = (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => {
    if (onExternalColumnVisibilityChange) {
      onExternalColumnVisibilityChange(column, visible);
    } else {
      setInternalVisibleColumns(prev => ({
        ...prev,
        [column]: visible
      }));
    }
  };

  // Calculate available columns across all rounds for the toggle
  // Simple calculation - no useMemo needed (avoids React error #310)
  const availableColumns = (() => {
    const columns = {
      tempo: false,
      distance: false,
      rpe: false,
      percentage: false
    };

    rounds.forEach(round => {
      round.movementUsages?.forEach(usage => {
        const movement = movements.find(m => m.id === usage.movementId);
        if (movement?.configuration) {
          if (movement.configuration.useTempo) columns.tempo = true;
          if (movement.configuration.useDistance) columns.distance = true;
          if (movement.configuration.useRPE) columns.rpe = true;
          if (movement.configuration.usePercentage) columns.percentage = true;
        }
      });
    });

    return columns;
  })();

  // Load data on mount - Only fetch categories and workout types if not already loaded
  // Movements are lazy loaded via React Query when needed
  useEffect(() => {
    if (categories.length === 0) fetchCategories();
    if (workoutTypes.length === 0) fetchWorkoutTypes();
    if (workoutTemplates.length === 0) fetchFullWorkoutTemplates(); // Fetch if empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps intentional - only fetch on mount

  // Initialize form when workout changes (only when workout ID actually changes)
  useEffect(() => {
    const workoutId = workout?.id || null;

    // For creation mode, we need to handle initialRounds separately since workoutId is always null
    if (isCreating) {
      // Only initialize if the template ID changed (or first load)
      if (appliedTemplateId !== initializedTemplateIdRef.current) {
        initializedTemplateIdRef.current = appliedTemplateId;

        if (initialRounds) {
          setTitle('');
          setNotes('');
          setTime('');
          setWarmups([]);
          setRounds(initialRounds);
          setCurrentTemplateId(appliedTemplateId);
        } else {
          // Fallback to default single round
          setTitle('');
          setNotes('');
          setTime('');
          setWarmups([]);
          setRounds([
            {
              ordinal: 1,
              sets: 1,
              movementUsages: [
                {
                  ordinal: 1,
                  movementId: '',
                  categoryId: '',
                  note: '',
                  targetWorkload: { ...DEFAULT_TARGET_WORKLOAD }
                }
              ]
            }
          ]);
        }
      }
      return;
    }

    // Reset template ref when switching out of creation mode
    initializedTemplateIdRef.current = undefined;

    // For editing mode, only reset form if we're switching to a different workout
    if (workoutId !== currentWorkoutIdRef.current) {
      currentWorkoutIdRef.current = workoutId;

      if (workout) {
        setTitle(workout.title || '');
        setNotes(workout.notes || '');
        setTime(workout.time || '');
        setWarmups(workout.warmups || []);
        setRounds(workout.rounds || []);
        setCurrentTemplateId(workout.appliedTemplateId);
        // Only set internal columns if not using external control
        if (!externalVisibleColumns) {
          setInternalVisibleColumns(workout.visibleColumns || {});
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout?.id, isCreating, appliedTemplateId]);

  // Draft loading - check for existing draft on mount
  const draftLoadedRef = useRef(false);
  useEffect(() => {
    if (draftKey && !draftLoadedRef.current) {
      draftLoadedRef.current = true;
      const draft = loadDraft(draftKey);
      if (draft) {
        console.log('[WorkoutEditor] Loading draft for', draftKey);
        setTitle(draft.title);
        setNotes(draft.notes);
        setTime(draft.time);
        setRounds(draft.rounds);
        if (draft.currentTemplateId) {
          setCurrentTemplateId(draft.currentTemplateId);
        }
      } else {
        // No draft - try to pre-fill first movement from last workout
        if (clientId && isCreating) {
          const savedFirstMovementId = localStorage.getItem(`pca-first-movement-${clientId}`);
          if (savedFirstMovementId && rounds.length > 0 && !rounds[0].movementUsages?.[0]?.movementId) {
            // Get the category for this movement from the movements list
            const movements = useMovementStore.getState().movements;
            const movement = movements.find(m => m.id === savedFirstMovementId);
            if (movement) {
              // Pre-populate the first movement in the first round
              const updatedRounds = [...rounds];
              if (updatedRounds[0] && updatedRounds[0].movementUsages?.[0]) {
                updatedRounds[0].movementUsages[0] = {
                  ...updatedRounds[0].movementUsages[0],
                  movementId: savedFirstMovementId,
                  categoryId: movement.categoryId,
                };
                setRounds(updatedRounds);
                console.log('[WorkoutEditor] Pre-filled first movement:', savedFirstMovementId);
              }
            }
          }
        }
      }
    }
  }, [draftKey, clientId, isCreating, rounds.length]);

  // Draft saving - save draft when form changes (debounced)
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!draftKey) return;

    // Clear any pending save
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    // Debounce draft saves to avoid excessive writes
    draftTimeoutRef.current = setTimeout(() => {
      // Only save if there's actual content
      if (title || notes || rounds.some(r => r.movementUsages?.some(u => u.movementId))) {
        saveDraft(draftKey, {
          title,
          notes,
          time,
          rounds,
          currentTemplateId,
          savedAt: Date.now()
        });
        console.log('[WorkoutEditor] Draft saved for', draftKey);
      }
    }, 1000); // Save after 1 second of no changes

    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, [draftKey, title, notes, time, rounds, currentTemplateId]);

  // Sync time with calendar event when eventId is present (only on initial load)
  useEffect(() => {
    if (eventId && events.length > 0 && !hasSyncedTime) {
      const calendarEvent = events.find(e => e.id === eventId);
      if (calendarEvent) {
        // Extract time from event start dateTime (format: "HH:MM")
        const eventDate = new Date(calendarEvent.start.dateTime);
        const hours = String(eventDate.getHours()).padStart(2, '0');
        const minutes = String(eventDate.getMinutes()).padStart(2, '0');
        const eventTime = `${hours}:${minutes}`;

        // Only update if time is empty (initial load)
        if (!time) {
          setTime(eventTime);
          setHasSyncedTime(true);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, events]);

  // Reset sync flag when eventId changes
  useEffect(() => {
    setHasSyncedTime(false);
  }, [eventId]);

  // Load suggested weights when movements change (always available for reference)
  useEffect(() => {
    const loadSuggestedWeights = async () => {
      if (!clientId || !rounds.length) {
        setSuggestedWeights({});
        return;
      }

      try {
        const weights: Record<string, { value: string; unit: string }> = {};

        // Get unique movements from the workout
        const uniqueMovements = new Map<string, ClientWorkoutMovementUsage>();
        rounds.forEach(round => {
          round.movementUsages?.forEach(usage => {
            if (!uniqueMovements.has(usage.movementId)) {
              uniqueMovements.set(usage.movementId, usage);
            }
          });
        });

        // Calculate suggested weight for each movement
        for (const [movementId, usage] of uniqueMovements.entries()) {
          try {
            const performance = await getRecentExercisePerformance(clientId, movementId);

            if (performance?.estimatedOneRepMax) {
              let suggestedWeight = 0;

              // Priority order for calculating suggested weight:

              // 1. TEMPO: If tempo is set, use 67.5% of 1RM (midpoint of 65-70%)
              if (usage.targetWorkload.useTempo && usage.targetWorkload.tempo) {
                suggestedWeight = performance.estimatedOneRepMax * 0.675;
              }
              // 2. PERCENTAGE: If percentage is set, use that percentage of 1RM
              else if (usage.targetWorkload.usePercentage && usage.targetWorkload.percentage) {
                suggestedWeight = performance.estimatedOneRepMax * (usage.targetWorkload.percentage / 100);
              }
              // 3. RPE + REPS: If both RPE and reps are prescribed, use Tuchscherer
              else if (usage.targetWorkload.useRPE && usage.targetWorkload.rpe && usage.targetWorkload.useReps && usage.targetWorkload.reps) {
                const rpeValue = parseFloat(usage.targetWorkload.rpe);
                const repParts = usage.targetWorkload.reps.split('-').map(r => parseInt(r.trim()));
                const targetReps = repParts.length > 1
                  ? Math.round((repParts[0] + repParts[1]) / 2)
                  : repParts[0];

                if (!isNaN(rpeValue) && targetReps > 0) {
                  suggestedWeight = calculateTuchscherer(
                    performance.estimatedOneRepMax,
                    targetReps,
                    rpeValue
                  );
                }
              }
              // 4. REPS ONLY: If only reps are prescribed, use rep-based formula
              else if (usage.targetWorkload.useReps && usage.targetWorkload.reps) {
                const repsValue = typeof (usage.targetWorkload.reps as any) === 'number'
                  ? (usage.targetWorkload.reps as any).toString()
                  : usage.targetWorkload.reps;
                const repParts = repsValue.split('-').map((r: string) => parseInt(r.trim()));
                const targetReps = repParts.length > 1
                  ? Math.round((repParts[0] + repParts[1]) / 2)
                  : repParts[0];

                if (targetReps > 0) {
                  suggestedWeight = calculateWeightFromOneRepMax(
                    performance.estimatedOneRepMax,
                    targetReps
                  );
                }
              }

              if (suggestedWeight > 0) {
                weights[movementId] = {
                  value: (Math.round(suggestedWeight * 10) / 10).toString(), // Round to 1 decimal
                  unit: usage.targetWorkload.weightMeasure || 'lbs'
                };
              }
            }
          } catch (error) {
            console.error(`Error loading performance for movement ${movementId}:`, error);
          }
        }

        setSuggestedWeights(weights);
      } catch (error) {
        console.error('Error loading suggested weights:', error);
      }
    };

    loadSuggestedWeights();
  }, [clientId, rounds]);

  // Update calendar event when time changes (if eventId is present)
  const handleTimeChange = async (newTime: string) => {
    setTime(newTime);

    if (eventId && newTime) {
      try {
        // Parse the time (HH:MM format)
        const [hours, minutes] = newTime.split(':').map(Number);
        if (!isNaN(hours) && !isNaN(minutes)) {
          // Find the current event to preserve date
          const calendarEvent = events.find(e => e.id === eventId);
          if (calendarEvent) {
            const eventDate = new Date(calendarEvent.start.dateTime);
            eventDate.setHours(hours, minutes, 0, 0);

            // Calculate end time (preserve duration)
            const endDate = new Date(calendarEvent.end.dateTime);
            const duration = endDate.getTime() - new Date(calendarEvent.start.dateTime).getTime();
            const newEndDate = new Date(eventDate.getTime() + duration);

            // Update the event
            await updateEvent(eventId, {
              start: {
                dateTime: eventDate.toISOString(),
                timeZone: calendarEvent.start.timeZone,
              },
              end: {
                dateTime: newEndDate.toISOString(),
                timeZone: calendarEvent.end.timeZone,
              },
            });
          }
        }
      } catch (error) {
        console.error('Failed to update calendar event time:', error);
      }
    }
  };





  const updateRound = (index: number, updatedRound: ClientWorkoutRound) => {
    const updated = [...rounds];
    updated[index] = updatedRound;
    setRounds(updated);
  };


  const moveRound = (fromIndex: number, toIndex: number) => {
    const updated = [...rounds];
    const [movedRound] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedRound);

    // Reorder ordinals
    updated.forEach((round, i) => {
      round.ordinal = i + 1;
    });
    setRounds(updated);
  };

  // Warmup handlers
  const addWarmup = () => {
    setWarmups([...warmups, { ordinal: warmups.length + 1, text: '' }]);
  };

  const removeWarmup = (index: number) => {
    if (warmups.length > 1) {
      const updated = warmups
        .filter((_, i) => i !== index)
        .map((w, i) => ({ ...w, ordinal: i + 1 }));
      setWarmups(updated);
    }
  };

  const updateWarmup = (index: number, text: string) => {
    setWarmups(warmups.map((warmup, i) =>
      i === index ? { ...warmup, text } : warmup
    ));
  };

  // Round handlers
  const addRound = () => {
    setRounds([...rounds, {
      ordinal: rounds.length + 1,
      sets: 1,
      movementUsages: [{
        ordinal: 1,
        movementId: '',
        categoryId: '',
        note: '',
        targetWorkload: { ...DEFAULT_TARGET_WORKLOAD }
      }]
    }]);
  };

  const removeRound = (index: number) => {
    if (rounds.length > 1) {
      const newRounds = rounds.filter((_, i) => i !== index);
      // Update ordinals
      setRounds(newRounds.map((round, i) => ({ ...round, ordinal: i + 1 })));
    }
  };

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggingIndex(index);
  };

  const handleDragOver = (index: number) => {
    setDropIndex(index);
  };

  const handleDragEnd = () => {
    if (draggingIndex !== null && dropIndex !== null && draggingIndex !== dropIndex) {
      const updated = [...rounds];
      const [movedRound] = updated.splice(draggingIndex, 1);
      updated.splice(dropIndex, 0, movedRound);

      // Reorder ordinals
      updated.forEach((round, i) => {
        round.ordinal = i + 1;
      });

      setRounds(updated);
    }

    setDraggingIndex(null);
    setDropIndex(null);
  };

  const updateRoundSets = (roundIndex: number, sets: number) => {
    setRounds(rounds.map((round, i) =>
      i === roundIndex ? { ...round, sets } : round
    ));
  };

  // Movement usage handlers
  const addMovementUsage = (roundIndex: number) => {
    setRounds(rounds.map((round, i) => {
      if (i === roundIndex) {
        return {
          ...round,
          movementUsages: [...round.movementUsages, {
            ordinal: round.movementUsages.length + 1,
            movementId: '',
            categoryId: '',
            note: '',
            targetWorkload: { ...DEFAULT_TARGET_WORKLOAD }
          }]
        };
      }
      return round;
    }));
  };

  const removeMovementUsage = (roundIndex: number, usageIndex: number) => {
    setRounds(rounds.map((round, i) => {
      if (i === roundIndex && round.movementUsages.length > 1) {
        const newUsages = round.movementUsages.filter((_, j) => j !== usageIndex);
        // Update ordinals
        return {
          ...round,
          movementUsages: newUsages.map((usage, j) => ({ ...usage, ordinal: j + 1 }))
        };
      }
      return round;
    }));
  };

  const updateMovementUsage = (roundIndex: number, usageIndex: number, field: string, value: any) => {
    setRounds(rounds.map((round, i) => {
      if (i === roundIndex) {
        return {
          ...round,
          movementUsages: round.movementUsages.map((usage, j) => {
            if (j === usageIndex) {
              // Handle nested fields like 'targetWorkload.reps'
              if (field.includes('.')) {
                const [parent, child] = field.split('.');
                return {
                  ...usage,
                  [parent]: {
                    ...(usage[parent as keyof ClientWorkoutMovementUsage] as any),
                    [child]: value
                  }
                };
              }
              return { ...usage, [field]: value };
            }
            return usage;
          })
        };
      }
      return round;
    }));
  };

  // Validation
  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Determine if we're in a flexible editing mode (inline or expandedInline)
    // In these modes, movement/category selection is optional
    const isFlexibleMode = isInline || expandedInline;

    // Title is optional in inline/expandedInline mode, required in modal mode
    if (!isFlexibleMode && !title.trim()) {
      newErrors.title = 'Workout title is required';
    }

    if (title.length > 64) {
      newErrors.title = 'Title must be less than 64 characters';
    }

    if (notes.length > 255) {
      newErrors.notes = 'Notes must be less than 255 characters';
    }

    // Validate warmups - only check non-empty warmups
    warmups.forEach((warmup, index) => {
      // Skip validation for empty warmups in flexible mode
      if (isFlexibleMode && !warmup.text.trim()) {
        return;
      }
      if (warmup.text.length > 255) {
        newErrors[`warmup-${index}`] = 'Warmup text must be less than 255 characters';
      }
    });

    // Validate rounds
    rounds.forEach((round, roundIndex) => {
      if (round.sets < 1) {
        newErrors[`round-${roundIndex}-sets`] = 'Sets must be at least 1';
      }

      round.movementUsages.forEach((usage, usageIndex) => {
        // In flexible mode, movement and category are optional
        // In strict modal mode, both are required
        if (!isFlexibleMode) {
          if (!usage.movementId) {
            newErrors[`round-${roundIndex}-movement-${usageIndex}`] = 'Movement is required';
          }
          if (!usage.categoryId) {
            newErrors[`round-${roundIndex}-category-${usageIndex}`] = 'Category is required';
          }
        }
        if (usage.note && usage.note.length > 255) {
          newErrors[`round-${roundIndex}-note-${usageIndex}`] = 'Note must be less than 255 characters';
        }
      });
    });

    // Log validation details for debugging
    if (Object.keys(newErrors).length > 0) {
      console.log('Validation errors:', newErrors);
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Template change handler - handles both Structure and Full Workout templates
  const handleChangeTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    // Check for "none" or empty
    if (!value || value === 'none') {
      // Remove structure, keep single default round
      setRounds([{
        ordinal: 1,
        sets: 1,
        movementUsages: [{
          ordinal: 1,
          movementId: '',
          categoryId: '',
          note: '',
          targetWorkload: { ...DEFAULT_TARGET_WORKLOAD }
        }]
      }]);
      setCurrentTemplateId(undefined);
      return;
    }

    // Determine type based on prefix (or fallback check if no prefix for legacy compatibility)
    let type = 'structure';
    let id = value;

    if (value.startsWith('structure:')) {
      type = 'structure';
      id = value.replace('structure:', '');
    } else if (value.startsWith('workout:')) {
      type = 'workout';
      id = value.replace('workout:', '');
    } else {
      // Legacy fallback: check strictly in structure templates first (though unlikely to overlap)
      if (!workoutStructureTemplates.find(t => t.id === value)) {
        // If not found in structure, assume it might be a workout ID (though unlikely with current UI)
      }
    }

    if (type === 'workout') {
      const template = workoutTemplates.find(t => t.id === id);
      if (!template) return;

      // Map Full Workout Template to ClientWorkoutRounds
      const newRounds = template.rounds.map((round, roundIndex) => ({
        ordinal: roundIndex + 1,
        sets: 1, // Default, implies 1 set of exercises as structured in template? Or does template define sets?
        // Wait, template rounds usually contain exercises. 
        // We need to map 'exercises' -> 'movementUsages'
        sectionName: round.name,
        // Helper to find workoutTypeId? Usually templates don't strictly enforce types unless named so.
        // We leave it empty or try to match name.
        sectionColor: '#6b7280', // Default grey
        workoutTypeId: undefined,

        movementUsages: round.exercises.map((exercise, exerciseIndex) => ({
          ordinal: exerciseIndex + 1,
          movementId: exercise.movementId,
          categoryId: '', // Ideally fetch this but not critical for display
          note: exercise.notes || '',
          targetWorkload: {
            useWeight: !!exercise.weight,
            weight: exercise.weight,
            weightMeasure: 'lbs' as const,
            useReps: !!exercise.reps,
            reps: exercise.reps,
            useTempo: !!exercise.tempo,
            tempo: exercise.tempo,
            useTime: false,
            useDistance: false,
            distanceMeasure: 'mi' as const,
            usePace: false,
            paceMeasure: 'mi' as const,
            usePercentage: !!exercise.percentageIncrease,
            percentage: exercise.percentageIncrease ? parseFloat(exercise.percentageIncrease) : undefined,
            useRPE: !!exercise.targetRPE,
            rpe: exercise.targetRPE?.toString(),
            unilateral: false,
          }
        }))
      }));

      setRounds(newRounds);
      setCurrentTemplateId(undefined); // Clear structure ID as we loaded a full workout

    } else {
      // Is Structure Template
      const template = workoutStructureTemplates.find(t => t.id === id);
      if (!template) return;

      // Apply new template structure
      const newRounds = template.sections
        .sort((a, b) => a.order - b.order)
        .map((section, index) => ({
          ordinal: index + 1,
          sets: 1,
          sectionName: section.workoutTypeName,
          sectionColor: workoutTypes.find(wt => wt.id === section.workoutTypeId)?.color,
          workoutTypeId: section.workoutTypeId,
          movementUsages: [{
            ordinal: 1,
            movementId: '',
            categoryId: '',
            note: '',
            targetWorkload: { ...DEFAULT_TARGET_WORKLOAD }
          }]
        }));

      setRounds(newRounds);
      setCurrentTemplateId(id);
    }
  };

  // Helper: Check if a specific movement's logged values differ from prescribed baseline
  const hasMovementChanged = (
    movementId: string,
    currentRounds: ClientWorkoutRound[],
    baselineRounds: ClientWorkoutRound[]
  ): boolean => {
    if (!baselineRounds || baselineRounds.length === 0) {
      return true; // No baseline, any data is a change
    }

    // Find all instances of this movement in baseline
    const baselineValues: Array<{ weight?: string; reps?: string; rpe?: string }> = [];
    for (const round of baselineRounds) {
      for (const usage of round.movementUsages) {
        if (usage.movementId === movementId) {
          baselineValues.push({
            weight: usage.targetWorkload.weight,
            reps: usage.targetWorkload.reps,
            rpe: usage.targetWorkload.rpe
          });
        }
      }
    }

    // Find all instances of this movement in current
    const currentValues: Array<{ weight?: string; reps?: string; rpe?: string }> = [];
    for (const round of currentRounds) {
      for (const usage of round.movementUsages) {
        if (usage.movementId === movementId) {
          currentValues.push({
            weight: usage.targetWorkload.weight,
            reps: usage.targetWorkload.reps,
            rpe: usage.targetWorkload.rpe
          });
        }
      }
    }

    // Compare - if different counts or any values differ, it's changed
    if (currentValues.length !== baselineValues.length) {
      console.log(`[WorkoutEditor] Movement ${movementId} count changed: ${baselineValues.length} -> ${currentValues.length}`);
      return true;
    }

    for (let i = 0; i < currentValues.length; i++) {
      const current = currentValues[i];
      const baseline = baselineValues[i];
      if (current.weight !== baseline.weight ||
        current.reps !== baseline.reps ||
        current.rpe !== baseline.rpe) {
        console.log(`[WorkoutEditor] Movement ${movementId} set ${i} changed`, { baseline, current });
        return true;
      }
    }

    return false;
  };

  // Debounced auto-save for logging mode edits
  const triggerAutoSave = () => {
    if (!isLoggingMode) return; // Only auto-save in logging mode

    // Cancel any pending auto-save
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    // Schedule auto-save after 2.5 seconds of no edits
    const timeout = setTimeout(async () => {
      if (!validateForm()) {
        console.log('[WorkoutEditor] Form validation failed before auto-save');
        return;
      }

      try {
        console.log('[WorkoutEditor] Auto-saving logging edits...');
        const workoutTitle = title.trim() || (isInline ? 'Workout' : '');
        const workoutData: Partial<ClientWorkout> = {
          title: workoutTitle,
          rounds,
          isModified: true,
        };

        if (notes.trim()) workoutData.notes = notes.trim();
        if (time.trim()) workoutData.time = time.trim();
        if (warmups.length > 0) workoutData.warmups = warmups;
        if (currentTemplateId) workoutData.appliedTemplateId = currentTemplateId;
        workoutData.visibleColumns = visibleColumns;

        console.log('[WorkoutEditor] Auto-save data:', workoutData);
        await onSave(workoutData);
        console.log('[WorkoutEditor] Auto-save completed successfully');
        setAutoSaveTimeout(null);
      } catch (error) {
        console.error('[WorkoutEditor] Error during auto-save:', error);
        // Don't throw - auto-save failures shouldn't break the UI
      }
    }, 2500); // 2.5 second debounce

    setAutoSaveTimeout(timeout);
  };

  // Save handler
  const handleSave = async () => {
    console.log('handleSave called');

    // Cancel any pending auto-save since we're doing a manual save
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
      setAutoSaveTimeout(null);
    }
    console.log('Validation result:', validateForm());

    if (!validateForm()) {
      console.log('Validation failed, errors:', errors);
      return;
    }

    console.log('Starting save...');
    setIsLoading(true);
    try {
      // Provide default title if empty in inline mode
      const workoutTitle = title.trim() || (isInline ? 'Workout' : '');

      // Build workout data, omitting undefined fields for Firestore
      const workoutData: Partial<ClientWorkout> = {
        title: workoutTitle,
        rounds,
        isModified: true, // Mark as modified since we're editing
      };

      // Only add optional fields if they have values
      if (notes.trim()) {
        workoutData.notes = notes.trim();
      }
      if (time.trim()) {
        workoutData.time = time.trim();
      }
      if (warmups.length > 0) {
        workoutData.warmups = warmups;
      }
      if (currentTemplateId) {
        workoutData.appliedTemplateId = currentTemplateId;
      }
      // Always include visibleColumns (even if empty) to persist user preferences
      workoutData.visibleColumns = visibleColumns;

      console.log('Workout data to save:', workoutData);
      await onSave(workoutData);
      console.log('Save completed, closing editor');

      // Save the first movement for next workout (for quick reference)
      if (clientId && rounds.length > 0 && rounds[0].movementUsages?.length > 0) {
        const firstMovementId = rounds[0].movementUsages[0].movementId;
        if (firstMovementId) {
          try {
            localStorage.setItem(`pca-first-movement-${clientId}`, firstMovementId);
            console.log('[WorkoutEditor] Saved first movement for next workout:', firstMovementId);
          } catch (e) {
            console.warn('Failed to save first movement:', e);
          }
        }
      }

      // Calculate and save 1RM in logging mode for all movements with weight+reps
      if (isLoggingMode && clientId && prescribedRounds.length > 0) {
        console.log('[WorkoutEditor] Logging mode - calculating 1RM for movements');

        const movementsSeen = new Set<string>();

        for (const round of rounds) {
          for (const usage of round.movementUsages) {
            const movementId = usage.movementId;
            if (!movementId || movementsSeen.has(movementId)) continue;
            movementsSeen.add(movementId);

            try {
              const weights: number[] = [];
              const reps: number[] = [];
              const rpeValues: number[] = [];

              for (const r of rounds) {
                for (const u of r.movementUsages) {
                  if (u.movementId !== movementId) continue;

                  const weight = u.targetWorkload.weight ? parseFloat(u.targetWorkload.weight) : 0;
                  const rep = u.targetWorkload.reps ? parseInt(u.targetWorkload.reps) : 0;
                  const rpe = u.targetWorkload.rpe ? parseFloat(u.targetWorkload.rpe) : undefined;

                  if (weight > 0 && rep > 0) {
                    weights.push(weight);
                    reps.push(rep);
                    if (rpe !== undefined && rpe > 0) rpeValues.push(rpe);
                  }
                }
              }

              if (weights.length === 0 || reps.length === 0) {
                console.log(`[WorkoutEditor] Movement ${movementId} has no weight+reps to calculate 1RM`);
                continue;
              }

              const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
              const weightStr = Math.round(avgWeight).toString();
              const minReps = Math.min(...reps);
              const maxReps = Math.max(...reps);
              const repRange = minReps === maxReps ? minReps.toString() : `${minReps}-${maxReps}`;
              const repForCalculation = Math.round((minReps + maxReps) / 2);
              const representativeRPE = rpeValues.length > 0 ? rpeValues[0] : undefined;

              const oneRepMaxResults = calculateOneRepMax(
                Math.round(avgWeight),
                repForCalculation,
                representativeRPE
              );

              const averageResult = oneRepMaxResults.find(r => r.formula === 'average');
              const estimatedOneRepMax = averageResult?.estimatedOneRepMax ||
                oneRepMaxResults[0]?.estimatedOneRepMax ||
                Math.round(avgWeight);

              const usedRPE = representativeRPE !== undefined && oneRepMaxResults.some(r => r.formula === 'tuchscherer');

              console.log(`[WorkoutEditor] Saving 1RM: movement=${movementId}, weight=${weightStr}, reps=${repRange}, 1RM=${estimatedOneRepMax}`);

              await updateRecentExercisePerformance(
                clientId,
                movementId,
                weightStr,
                repRange,
                estimatedOneRepMax,
                representativeRPE,
                usedRPE
              );
            } catch (error) {
              console.error(`[WorkoutEditor] Error saving 1RM for movement ${movementId}:`, error);
            }
          }
        }
      }

      // Clear draft on successful save
      if (draftKey) {
        clearDraft(draftKey);
        console.log('[WorkoutEditor] Draft cleared for', draftKey);
      }

      // onClose();
    } catch (error) {
      console.error('Error saving workout:', error);
      setErrors({ general: 'Failed to save workout. Please try again.' });
      // Don't close on error - let user see the error message
    } finally {
      setIsLoading(false);
    }
  };

  // Expose save method via ref for external control
  // Note: We use a wrapper function to always call the latest handleSave
  useImperativeHandle(ref, () => ({
    save: async () => {
      await handleSave();
    },
    isLoading
  }));

  if (!isOpen) return null;

  // Handle Copy to Clipboard (Coachella Style)
  const handleCopyWorkout = async () => {
    let plain = "";
    let rich = "";

    // 1. Date only (no title, no parentheses)
    if (workout?.date) {
      const date = new Date(workout.date.seconds ? workout.date.seconds * 1000 : workout.date);
      const dateStr = date.toLocaleDateString('en-US');
      plain += dateStr + "\n";
      rich += "<b>" + dateStr + "</b><br>";
    }
    if (notes) {
      plain += "Workout Notes\n" + notes + "\n";
      rich += "<b>Workout Notes</b><br>" + notes + "<br>";
    }

    // 2. Warmups
    if (warmups.length > 0) {
      plain += "Warmups\n";
      rich += "<b>Warmups</b><br>";
      warmups.forEach(w => {
        plain += w.text + "\n";
        rich += w.text + "<br>";
      });
    }

    // Helper for description
    const createDescription = (usage: any) => {
      const m = movements.find(mov => mov.id === usage.movementId);
      const name = m?.name || 'Unknown Exercise';
      const workload = usage.targetWorkload || {};
      let st = "";

      const isUnilateral = m?.configuration?.unilateral;
      if (workload.reps) st += " x" + workload.reps + (isUnilateral ? "ea" : ""); // e.g. "x10", "x8-12", or "x8ea"
      if (workload.weight || workload.weightMeasure === 'bw') {
        if (workload.weightMeasure === 'bw') {
          st += " BW";
          if (workload.weight && workload.weight !== '0') st += ` (+${workload.weight})`;
        } else {
          st += " " + workload.weight + (workload.weightMeasure || '');
        }
      }
      if (workload.tempo) st += " " + workload.tempo;
      if (workload.time) st += " " + workload.time + (workload.timeMeasure || 's');
      if (workload.percentage) st += " " + workload.percentage + "%";
      if (workload.rpe) st += " RPE: " + workload.rpe;

      return { name, details: st.trim() };
    };

    // 3. Rounds (skip empty ones)
    rounds.forEach((round, i) => {
      // Skip rounds with no movements
      if (!round.movementUsages || round.movementUsages.length === 0) {
        return;
      }

      const setText = round.sets > 1 ? "sets" : "set";
      const headerPlain = `Round ${i + 1} (${round.sets} ${setText})`;
      const headerRich = `<b>Round ${i + 1}</b> (${round.sets} ${setText})`;

      plain += headerPlain + "\n";
      rich += headerRich + "<br>";

      round.movementUsages.forEach((mu: any) => {
        const { name, details } = createDescription(mu);
        plain += `${name} ${details}\n`;
        rich += `${name} ${details}<br>`;
        if (mu.note) {
          plain += `  - ${mu.note}\n`;
          rich += `  - ${mu.note}<br>`;
        }
      });
      plain += "\n";
    });

    // 4. Clipboard Execution
    try {
      if (typeof ClipboardItem !== "undefined") {
        const textBlob = new Blob([plain], { type: "text/plain" });
        const htmlBlob = new Blob([rich], { type: "text/html" });
        const data = new ClipboardItem({ "text/html": htmlBlob, "text/plain": textBlob });
        await navigator.clipboard.write([data]);
        toastSuccess("Workout copied to clipboard!");
      } else {
        // Fallback
        const cb = (e: any) => {
          e.clipboardData.setData("text/plain", plain);
          e.clipboardData.setData("text/html", rich);
          e.preventDefault();
        };
        document.addEventListener("copy", cb);
        document.execCommand("copy");
        document.removeEventListener("copy", cb);
        toastSuccess("Workout copied to clipboard!");
      }
    } catch (err) {
      console.error("Failed to copy", err);
      toastError("Failed to copy to clipboard");
    }
  };

  // Expanded inline mode - full editor without modal
  if (expandedInline) {
    return (
      <>


        {/* Content - with integrated edge toggle on right side */}
        <div className="space-y-0 relative flex flex-col h-full overflow-hidden">
          {/* Mode Glow Indicator - Subtle elegant fade */}
          {clientId && (
            <div className="absolute right-0 top-0 bottom-0 w-12 z-10 pointer-events-none">
              <div className={`absolute right-0 top-0 bottom-0 w-full transition-all duration-500 ${isLoggingMode
                ? 'bg-gradient-to-l from-green-500/15 to-transparent'
                : 'bg-gradient-to-l from-blue-500/15 to-transparent'
                }`} />
            </div>
          )}

          {/* Integrated Mode Toggle - Right edge, half-circle tab facing outward */}
          {clientId && (
            <div className="absolute right-0 top-1/3 z-20 transform -translate-y-1/2 translate-x-full">
              <button
                onClick={async () => {
                  const switchingToLogging = !isLoggingMode;

                  // When switching TO Logging: save the current workout first, then set baseline
                  if (switchingToLogging) {
                    console.log('[WorkoutEditor] Toggling to Logging - auto-saving workout first');

                    // Cancel any pending timeout from previous auto-saves
                    if (autoSaveTimeout) {
                      clearTimeout(autoSaveTimeout);
                      setAutoSaveTimeout(null);
                    }

                    // Save the current workout immediately to Firestore
                    // This ensures if coach closes laptop, workout is persisted
                    try {
                      if (!validateForm()) {
                        console.log('[WorkoutEditor] Form validation failed on toggle');
                        setErrors({ general: 'Please fix validation errors before switching modes.' });
                        return;
                      }

                      setIsLoading(true);

                      const workoutTitle = title.trim() || (isInline ? 'Workout' : '');
                      const workoutData: Partial<ClientWorkout> = {
                        title: workoutTitle,
                        rounds,
                        isModified: true,
                      };

                      if (notes.trim()) workoutData.notes = notes.trim();
                      if (time.trim()) workoutData.time = time.trim();
                      if (warmups.length > 0) workoutData.warmups = warmups;
                      if (currentTemplateId) workoutData.appliedTemplateId = currentTemplateId;
                      workoutData.visibleColumns = visibleColumns;

                      console.log('[WorkoutEditor] Auto-saving before logging toggle:', workoutData);
                      await onSave(workoutData, { skipClose: true });

                      // Now set the baseline after successful save
                      setPrescribedRounds(JSON.parse(JSON.stringify(rounds)));
                      console.log('[WorkoutEditor] Prescribed baseline set');
                      setIsLoading(false);
                    } catch (error) {
                      console.error('[WorkoutEditor] Error auto-saving on toggle:', error);
                      setIsLoading(false);
                      setErrors({ general: 'Failed to save workout before switching modes. Please try again.' });
                      return;
                    }
                  }

                  setIsLoggingMode(!isLoggingMode);
                  setDirtyMovementIds(new Set()); // Reset dirty tracking on mode change
                }}
                className={`flex items-center justify-center px-2 py-6 rounded-r-full transition-all duration-500 border-r-2 border-t-2 border-b-2 shadow-md hover:shadow-lg ${isLoggingMode
                  ? 'bg-gradient-to-l from-green-50/50 to-white border-green-300 hover:border-green-400'
                  : 'bg-gradient-to-l from-blue-50/50 to-white border-blue-300 hover:border-blue-400'
                  }`}
                title={isLoggingMode ? "Switch to Prescribed view" : "Switch to Logging view"}
              >
                {isLoggingMode ? (
                  <TrendingUp className="w-5 h-5 text-green-600" />
                ) : (
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                )}
              </button>
            </div>
          )}

          {/* Loading skeleton while movements load */}
          {movementsLoading && movements.length === 0 && (
            <div className="p-4 space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          )}

          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-2 py-0.5 rounded">
              {errors.general}
            </div>
          )}

          {/* Basic Info */}
          <Card className="py-0 rounded-none gap-1">
            <CardContent className="space-y-1 pt-1 pb-1 px-2">
              <div className="flex items-center gap-1 w-full">
                {/* Title - 37% */}
                <div className="w-[37%] min-w-0">
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Workout Title (e.g. Upper Body Push)"
                    className={`h-9 text-sm text-gray-900 ${errors.title ? 'border-red-500' : ''}`}
                  />
                </div>

                {/* Time - 25% */}
                <div className="w-[25%] min-w-0">
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="h-9 text-sm px-1 text-gray-900"
                    title="Workout Time"
                  />
                </div>

                {/* Structure - 38% */}
                <div className="w-[38%] min-w-0">
                  <Select
                    value={currentTemplateId ? `structure:${currentTemplateId}` : ""}
                    onValueChange={(value) => handleChangeTemplate({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
                  >
                    <SelectTrigger className={`h-9 text-xs w-full px-2 text-gray-900 flex items-center ${isCreating && !currentTemplateId ? '!border-green-500 !bg-green-50' : ''}`}>
                      <SelectValue placeholder="Load Template..." />
                    </SelectTrigger>
                    <SelectContent>



                      {/* Structure Templates Group */}
                      {workoutStructureTemplates.length > 0 && (
                        <>
                          <div className="px-2 py-1.5 text-xs font-semibold text-gray-500 mt-1 pt-1 border-t">Structure Templates</div>
                          {workoutStructureTemplates.map((template) => {
                            const abbrevList = getTemplateAbbreviationList(template, workoutTypes);
                            return (
                              <SelectItem key={template.id} value={`structure:${template.id}`}>
                                <div className="flex items-center gap-2 w-full">
                                  <span className="truncate">{template.name}</span>
                                  {abbrevList.length > 0 && (
                                    <div className="flex items-center gap-1 ml-auto shrink-0">
                                      {abbrevList.map((item, idx) => (
                                        <span
                                          key={idx}
                                          className="inline-flex items-center justify-center rounded-md px-1 py-0.5 text-[10px] h-4 font-medium text-white border-0"
                                          style={{ backgroundColor: item.color }}
                                        >
                                          {item.abbrev}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </SelectItem>
                            );
                          })}
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Rounds - Same UI for both Prescribed and Logging modes */}
          <div className="space-y-0 flex-1 overflow-y-auto min-h-0 pb-2">
            {rounds.map((round, roundIndex) => (
              <RoundEditor
                key={roundIndex}
                round={round}
                index={roundIndex}
                movements={movements}
                categories={categories}
                workoutTypes={workoutTypes}
                clientId={clientId || workout?.clientId}
                onUpdate={(updatedRound) => updateRound(roundIndex, updatedRound)}
                onRemove={() => removeRound(roundIndex)}
                canDelete={rounds.length > 1}
                errors={errors}
                visibleColumns={visibleColumns}
                onColumnVisibilityChange={handleColumnVisibilityChange}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                isDragging={draggingIndex === roundIndex}
                isDropTarget={dropIndex === roundIndex && draggingIndex !== roundIndex}
                onMovementFieldChange={(movementId) => {
                  if (isLoggingMode) {
                    // Mark this movement as dirty in logging mode
                    setDirtyMovementIds(prev => new Set([...prev, movementId]));
                    // Trigger debounced auto-save
                    triggerAutoSave();
                  }
                }}
              />
            ))}

            <Button
              type="button"
              variant="ghost"
              onClick={addRound}
              className="w-full h-8 rounded-none border-t border-b border-gray-200 hover:bg-gray-50 text-xs text-gray-500 hover:text-blue-600 justify-center"
            >
              <Plus className="w-3 h-3 mr-2 icon-add" />
              Add Round
            </Button>
          </div>

          {/* Notes - Compact & Integrated */}
          <div className="px-1 pt-1 mt-auto bg-white border-t border-gray-100 z-10 shrink-0">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="min-h-[32px] text-xs resize-y bg-gray-50/50 focus:bg-white transition-colors"
            />
          </div>
          {/* Bottom Toolbar - Exact Coachella styling - Evenly Spaced */}
          <div className="mt-4 flex justify-between items-center w-full px-2 py-2 border-t border-gray-100 group-hover:border-gray-200 transition-colors">
            {/* Column Toggle (Left) */}
            {!externalVisibleColumns && (
              <ColumnVisibilityToggle
                visibleColumns={visibleColumns}
                availableColumns={availableColumns}
                onToggle={handleColumnVisibilityChange}
              />
            )}

            {/* Mode Toggle (Left-Center) */}
            {clientId && (
              <button
                type="button"
                onClick={() => setIsLoggingMode(!isLoggingMode)}
                className={`p-1 transition-all hover:scale-110 bg-transparent border-0 ${isLoggingMode ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
                title={isLoggingMode ? "Current: Logging Mode (Click to switch)" : "Current: Prescribed Mode (Click to switch)"}
              >
                {isLoggingMode ? <TrendingUp className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
              </button>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="p-1 text-red-500 hover:text-red-600 transition-all hover:scale-110 bg-transparent border-0"
                title="Delete workout"
              >
                <Trash2 className="h-6 w-6" />
              </button>
            )}

            {/* Cancel Button */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-orange-500 hover:text-orange-600 transition-all hover:scale-110 bg-transparent border-0"
              title="Cancel"
            >
              <X className="h-6 w-6" />
            </button>

            {/* Print Button -> Copy Button */}
            <button
              type="button"
              onClick={handleCopyWorkout}
              className="p-1 text-green-500 hover:text-green-600 transition-all hover:scale-110 bg-transparent border-0"
              title="Copy to Clipboard"
            >
              <Copy className="h-6 w-6" />
            </button>

            {/* Smart Create Dropdown - Only show if onCreateNext provided */}
            {onCreateNext && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="p-1 transition-all hover:scale-110 bg-transparent border-0 group"
                    title="Create Next Workout"
                  >
                    <Sparkles className="h-6 w-6 text-purple-600 group-hover:text-purple-700 fill-purple-100" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => onCreateNext('progression')}
                    className="group text-sm cursor-pointer"
                  >
                    <TrendingUp className="mr-2 h-4 w-4 text-gray-400 group-hover:text-indigo-600" />
                    <span>Progress to Next Week</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onCreateNext('generation')}
                    className="group text-sm cursor-pointer"
                  >
                    <FastForward className="mr-2 h-4 w-4 text-gray-400 group-hover:text-indigo-600" />
                    <span>Generate Next Workout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Save Button */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="p-1 text-blue-600 hover:text-blue-700 transition-all hover:scale-110 bg-transparent border-0"
              title="Save workout"
            >
              <Save className="h-6 w-6" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // Compact inline mode - render without modal overlay (for week view)
  if (isInline) {
    // Helper to update round section name/type
    const updateRoundSection = (roundIndex: number, workoutTypeId: string) => {
      const workoutType = workoutTypes.find(wt => wt.id === workoutTypeId);
      if (!workoutType) return;

      const updated = [...rounds];
      updated[roundIndex] = {
        ...updated[roundIndex],
        sectionName: workoutType.name,
        sectionColor: workoutType.color,
        workoutTypeId: workoutType.id
      };
      setRounds(updated);
    };

    return (
      <div className="flex flex-col justify-between min-h-[180px] h-full bg-white w-full rounded-xl group hover:bg-gray-50 transition-colors relative">
        {/* Ultra Compact Content - Flex-1 to push toolbar down */}
        <div className="px-1 space-y-1 flex-1 overflow-y-auto pb-1">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-1 py-0.5 rounded text-xs">
              {errors.general}
            </div>
          )}

          {/* Template Selector - First */}
          <div className="flex items-center gap-1">
            <label className="text-xs font-medium">Structure:</label>
            <Select
              value={currentTemplateId || ''}
              onValueChange={(value) => handleChangeTemplate({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
            >
              <SelectTrigger className={`text-xs flex-1 h-7 border-0 bg-transparent shadow-none p-0 hover:bg-gray-100 rounded px-1 ${isCreating && !currentTemplateId ? '!border !border-green-500 !bg-green-50' : ''}`}>
                <SelectValue placeholder="Select structure" />
              </SelectTrigger>
              <SelectContent>
                {workoutStructureTemplates.map(template => {
                  const abbrevList = getTemplateAbbreviationList(template, workoutTypes);
                  return (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2 w-full">
                        <span>{template.name}</span>
                        {abbrevList.length > 0 && (
                          <div className="flex items-center gap-1 ml-auto">
                            {abbrevList.map((item, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium text-white border-0"
                                style={{ backgroundColor: item.color }}
                              >
                                {item.abbrev}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Title and Time - Second */}
          <div className="flex gap-1">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Workout Title"
              className="h-7 text-sm font-semibold border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 placeholder:text-gray-400 flex-1"
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              placeholder="HH:MM"
              className="h-7 text-xs w-16 border-0 bg-transparent shadow-none p-0 focus-visible:ring-0 text-right"
            />
          </div>


          {/* Rounds - Ultra Compact with Drag and Drop */}
          <div className="space-y-1">
            {rounds.map((round, roundIndex) => {
              const isExpanded = expandedRounds[roundIndex] ?? false; // Default collapsed
              const toggleExpanded = () => {
                setExpandedRounds(prev => ({
                  ...prev,
                  [roundIndex]: !isExpanded
                }));
              };

              return (
                <div
                  key={roundIndex}
                  draggable
                  onDragStart={() => handleDragStart(roundIndex)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    handleDragOver(roundIndex);
                  }}
                  onDragEnd={handleDragEnd}
                  className={draggingIndex === roundIndex ? 'opacity-50' : ''}
                  style={{
                    borderTop: dropIndex === roundIndex && draggingIndex !== roundIndex ? '2px solid #3b82f6' : 'none'
                  }}
                >
                  {/* Ultra Compact Header with color coding */}
                  <div
                    className="text-white px-1 py-0.5 flex items-center gap-1 cursor-pointer hover:opacity-90 text-xs rounded-sm"
                    style={{
                      backgroundColor: round.sectionColor || '#6b7280'
                    }}
                  >
                    {/* Drag handle */}
                    <GripVertical className="w-3 h-3 cursor-move"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    />

                    {/* Expand/collapse button */}
                    <button onClick={toggleExpanded} className="flex-1 text-left font-medium">
                      {isExpanded ? '−' : '+'}
                      {round.sectionName || `R${roundIndex + 1}`} ({round.sets})
                    </button>

                    <div className="flex items-center gap-1">
                      <Input
                        type="number"
                        value={round.sets}
                        onChange={(e) => {
                          e.stopPropagation();
                          updateRoundSets(roundIndex, parseInt(e.target.value) || 1);
                        }}
                        className="h-4 w-8 text-xs bg-black/20 border-none text-white text-center p-0 rounded-sm"
                        min="1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {rounds.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRound(roundIndex);
                          }}
                          className="text-white/70 hover:text-white transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="mt-0.5 bg-gray-50/50 px-1 pb-1 rounded-b-sm">
                      {/* Workout Type selector */}
                      <select
                        value={round.workoutTypeId || ''}
                        onChange={(e) => updateRoundSection(roundIndex, e.target.value)}
                        className="text-xs border rounded p-1 w-full mb-0.5 bg-white h-6 mt-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <option value="">Custom</option>
                        {workoutTypes.map(type => (
                          <option key={type.id} value={type.id}>
                            {type.name}
                          </option>
                        ))}
                      </select>

                      <div className="space-y-0.5">
                        {round.movementUsages.map((usage, usageIndex) => (
                          <MovementUsageRow
                            key={usageIndex}
                            usage={usage}
                            roundIndex={roundIndex}
                            usageIndex={usageIndex}
                            onUpdate={updateMovementUsage}
                            onRemove={removeMovementUsage}
                            canDelete={round.movementUsages.length > 1}
                            isInline={true}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => addMovementUsage(roundIndex)}
                          className="text-xs text-gray-500 hover:text-gray-700 py-1 w-full text-left pl-1"
                        >
                          + Add Exercise
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Add Round - Ultra Compact */}
            <Button
              type="button"
              onClick={addRound}
              variant="ghost"
              className="h-6 text-xs w-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 justify-start pl-1"
            >
              <Plus className="w-3 h-3 mr-1 icon-add" />
              Add Round
            </Button>
          </div>

          {/* Notes - Compact (flex-1 push) */}
          <div className="pt-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes..."
              className="min-h-[40px] text-xs resize-none bg-transparent border-0 ring-0 focus-visible:ring-0 px-0 placeholder:text-gray-300"
            />
          </div>
        </div>

        {/* Bottom Toolbar - Exact Coachella styling with w-6 h-6 icons - Evenly Spaced */}
        {/* Column Toggle (Left) */}
        {!externalVisibleColumns && (
          <ColumnVisibilityToggle
            visibleColumns={visibleColumns}
            availableColumns={availableColumns}
            onToggle={handleColumnVisibilityChange}
          />
        )}

        {/* Mode Toggle (Left-Center) */}
        {clientId && (
          <button
            type="button"
            onClick={() => setIsLoggingMode(!isLoggingMode)}
            className={`p-1 transition-all hover:scale-110 bg-transparent border-0 ${isLoggingMode ? 'text-indigo-600' : 'text-gray-400 hover:text-indigo-600'}`}
            title={isLoggingMode ? "Current: Logging Mode (Click to switch)" : "Current: Prescribed Mode (Click to switch)"}
          >
            {isLoggingMode ? <TrendingUp className="h-6 w-6" /> : <ClipboardList className="h-6 w-6" />}
          </button>
        )}

        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-red-500 hover:text-red-600 transition-all hover:scale-110 bg-transparent border-0"
            title="Delete"
          >
            <Trash2 className="h-6 w-6" />
          </button>
        )}

        {/* Smart Create Dropdown - Only show if onCreateNext provided */}
        {onCreateNext && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="p-1 transition-all hover:scale-110 bg-transparent border-0 group"
                title="Create Next Workout"
              >
                <Sparkles className="h-6 w-6 text-purple-600 group-hover:text-purple-700 fill-purple-100" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() => onCreateNext('progression')}
                className="group text-sm cursor-pointer"
              >
                <TrendingUp className="mr-2 h-4 w-4 text-gray-400 group-hover:text-indigo-600" />
                <span>Progress to Next Week</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onCreateNext('generation')}
                className="group text-sm cursor-pointer"
              >
                <FastForward className="mr-2 h-4 w-4 text-gray-400 group-hover:text-indigo-600" />
                <span>Generate Next Workout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Copy Button */}
        <button
          type="button"
          onClick={handleCopyWorkout}
          className="p-1 text-green-500 hover:text-green-600 transition-all hover:scale-110 bg-transparent border-0"
          title="Copy to Clipboard"
        >
          <Copy className="h-6 w-6" />
        </button>

        {/* Cancel Button */}
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-orange-500 hover:text-orange-600 transition-all hover:scale-110 bg-transparent border-0"
          title="Cancel"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isLoading}
          className="p-1 text-blue-600 hover:text-blue-700 transition-all hover:scale-110 bg-transparent border-0"
          title="Save"
        >
          <Save className="h-6 w-6" />
        </button>
      </div>
    );
  }

  // Modal mode disabled - use inline/expanded inline mode instead
  return null;
});
