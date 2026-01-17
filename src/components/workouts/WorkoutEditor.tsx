"use client";

import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, GripVertical, X, Save } from 'lucide-react';
import {
  ClientWorkout,
  ClientWorkoutWarmup,
  ClientWorkoutRound,
  ClientWorkoutMovementUsage,
  ClientWorkoutTargetWorkload,
  WorkoutStructureTemplate
} from '@/lib/types';

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
  onSave: (workoutData: Partial<ClientWorkout>) => Promise<void>;
  isCreating?: boolean;
  isInline?: boolean;
  expandedInline?: boolean; // Full editor inline (for day view)
  initialRounds?: ClientWorkoutRound[];
  appliedTemplateId?: string;
  eventId?: string; // Calendar event ID for time sync
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
  hideTopActionBar = false,
  externalVisibleColumns,
  onExternalColumnVisibilityChange,
  onDelete,
  draftKey
}, ref) {
  // Use React Query for movements (with caching and deduplication)
  const { data: movements = [], isLoading: movementsLoading } = useMovements(true); // includeCategory = true
  const { categories, fetchCategories } = useMovementCategoryStore();
  const { workoutStructureTemplates, workoutTypes, fetchWorkoutTypes } = useConfigurationStore();
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

  // Column visibility state (use external if provided, otherwise internal)
  const [internalVisibleColumns, setInternalVisibleColumns] = useState<{
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  }>({});

  const visibleColumns = externalVisibleColumns ?? internalVisibleColumns;

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
  const availableColumns = {
    tempo: false,
    distance: false,
    rpe: false,
    percentage: false
  };

  rounds.forEach(round => {
    round.movementUsages?.forEach(usage => {
      const movement = movements.find(m => m.id === usage.movementId);
      if (movement?.configuration) {
        if (movement.configuration.use_tempo) availableColumns.tempo = true;
        if (movement.configuration.use_distance) availableColumns.distance = true;
        if (movement.configuration.use_rpe) availableColumns.rpe = true;
        if (movement.configuration.use_percentage) availableColumns.percentage = true;
      }
    });
  });

  // Load data on mount - React Query handles movements fetching automatically
  // Only fetch categories and workout types if not already loaded
  useEffect(() => {
    console.log('[WorkoutEditor] Mounting, movements will load via React Query...');
    if (categories.length === 0) fetchCategories();
    if (workoutTypes.length === 0) fetchWorkoutTypes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps intentional - only fetch on mount
  
  // Debug: Log when movements change
  useEffect(() => {
    console.log('[WorkoutEditor] Movements updated:', movements.length, 'categories in movements:', [...new Set(movements.map(m => m.categoryId))], 'loading:', movementsLoading);
  }, [movements, movementsLoading]);

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
      }
    }
  }, [draftKey]);

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

  // Template change handler
  const handleChangeTemplate = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTemplateId = e.target.value === 'none' ? undefined : e.target.value;

    if (!newTemplateId) {
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

    const template = workoutStructureTemplates.find(t => t.id === newTemplateId);
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
    setCurrentTemplateId(newTemplateId);
  };

  // Save handler
  const handleSave = async () => {
    console.log('handleSave called');
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
      
      // Clear draft on successful save
      if (draftKey) {
        clearDraft(draftKey);
        console.log('[WorkoutEditor] Draft cleared for', draftKey);
      }
      
      onClose();
    } catch (error) {
      console.error('Error saving workout:', error);
      setErrors({ general: 'Failed to save workout. Please try again.' });
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

  // Expanded inline mode - full editor without modal
  if (expandedInline) {
    return (
      <>
        {/* Top Action Bar - Hidden when hideTopActionBar is true (buttons rendered in parent) */}
        {!hideTopActionBar && (
          <div className="flex items-center justify-between px-2 py-1.5 bg-gray-100 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onClose}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isLoading}
                className="h-7 text-xs"
              >
                {isLoading ? 'Saving...' : 'Save'}
              </Button>
            </div>
            {/* Column Toggle (only show if not using external control) */}
            {!externalVisibleColumns && (
              <ColumnVisibilityToggle
                visibleColumns={visibleColumns}
                availableColumns={availableColumns}
                onToggle={handleColumnVisibilityChange}
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="space-y-0">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Upper Body Push Day"
                    className={errors.title ? 'border-red-500' : ''}
                  />
                  {errors.title && (
                    <p className="text-red-500 text-sm mt-1">{errors.title}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(e.target.value)}
                  />
                </div>
              </div>

              {/* Template Selector */}
              <div>
                <Label htmlFor="template">Workout Structure Template</Label>
                <Select
                  value={currentTemplateId || 'none'}
                  onValueChange={(value) => handleChangeTemplate({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Custom)</SelectItem>
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
            </CardContent>
          </Card>

          {/* Rounds */}
          <div className="space-y-0">
            {rounds.map((round, roundIndex) => (
              <RoundEditor
                key={roundIndex}
                round={round}
                index={roundIndex}
                movements={movements}
                categories={categories}
                workoutTypes={workoutTypes}
                clientId={workout?.clientId}
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
              />
            ))}

            <Button
              type="button"
              variant="outline"
              onClick={addRound}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-1.5 icon-add" />
              Add Round
            </Button>
          </div>

          {/* Notes */}
          <Card className="py-0 rounded-none gap-1">
            <CardContent className="pt-1 pb-1 px-2">
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes..."
                className="min-h-[32px]"
              />
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Saving...' : 'Save Workout'}
            </Button>
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
      <div className="bg-white w-full">
        {/* Ultra Compact Content - No Header */}
        <div className="px-1 space-y-1 max-h-80 overflow-y-auto">
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
              value={currentTemplateId || 'none'}
              onValueChange={(value) => handleChangeTemplate({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
            >
              <SelectTrigger className="text-xs flex-1 h-7">
                <SelectValue placeholder="Select structure" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (Custom)</SelectItem>
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
              placeholder="Title"
              className="h-6 text-xs flex-1"
            />
            <Input
              type="time"
              value={time}
              onChange={(e) => handleTimeChange(e.target.value)}
              placeholder="HH:MM"
              className="h-6 text-xs w-16"
            />
          </div>


          {/* Rounds - Ultra Compact with Drag and Drop */}
          <div className="space-y-0.5">
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
                    className="text-white px-1 py-0.5 flex items-center gap-1 cursor-pointer hover:opacity-90 text-xs"
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
                    <button onClick={toggleExpanded} className="flex-1 text-left">
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
                        className="h-3 w-6 text-xs bg-gray-700 border-none text-white text-center p-0"
                        min="1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      {rounds.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRound(roundIndex);
                          }}
                          className="h-3 w-3 p-0 text-white hover:bg-gray-500"
                        >
                          <Trash2 className="w-2 h-2" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="mt-0.5 bg-white px-1 pb-1">
                      {/* Workout Type selector */}
                      <select
                        value={round.workoutTypeId || ''}
                        onChange={(e) => updateRoundSection(roundIndex, e.target.value)}
                        className="text-xs border rounded p-1 w-full mb-0.5 bg-white"
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
                          className="text-xs text-gray-500 hover:text-gray-700 py-0.5 w-full text-left"
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
              className="h-5 text-xs w-full text-gray-500 hover:text-gray-700"
            >
              <Plus className="w-2 h-2 mr-1 icon-add" />
              Add Round
            </Button>
          </div>

          {/* Notes - Compact (moved after rounds) */}
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="h-12 text-xs resize-none"
          />

          {/* Action Buttons - Ultra Compact */}
          <div className="flex gap-1 pt-0.5">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="h-5 text-xs flex-1"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={isLoading}
              className="h-5 text-xs flex-1"
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Modal mode - original layout
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">
            {isCreating ? 'Create Workout' : 'Edit Workout'}
          </h2>
          <div className="flex items-center gap-2">
            {!externalVisibleColumns && (
              <ColumnVisibilityToggle
                visibleColumns={visibleColumns}
                availableColumns={availableColumns}
                onToggle={handleColumnVisibilityChange}
              />
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* General Error */}
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {errors.general}
            </div>
          )}

          {/* Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle>Workout Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Upper Body Push Day"
                    className={errors.title ? 'border-red-500' : ''}
                  />
                  {errors.title && (
                    <p className="text-red-500 text-sm mt-1">{errors.title}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={time}
                    onChange={(e) => handleTimeChange(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Workout Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="General notes about this workout..."
                  rows={3}
                  className={errors.notes ? 'border-red-500' : ''}
                />
                {errors.notes && (
                  <p className="text-red-500 text-sm mt-1">{errors.notes}</p>
                )}
              </div>
              <div>
                <Label htmlFor="structure">Workout Structure</Label>
                <Select
                  value={currentTemplateId || 'none'}
                  onValueChange={(value) => handleChangeTemplate({ target: { value } } as React.ChangeEvent<HTMLSelectElement>)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select structure" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Custom)</SelectItem>
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
            </CardContent>
          </Card>


          {/* Rounds */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Rounds</CardTitle>
              <Button onClick={addRound} size="sm">
                <Plus className="w-4 h-4 mr-1.5 icon-add" />
                Add Round
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {rounds.map((round, index) => (
                  <RoundEditor
                    key={index}
                    round={round}
                    index={index}
                    movements={movements}
                    clientId={workout?.clientId}
                    categories={categories}
                    workoutTypes={workoutTypes}
                    onUpdate={(updatedRound) => updateRound(index, updatedRound)}
                    onRemove={() => removeRound(index)}
                    canDelete={rounds.length > 1}
                    errors={errors}
                    visibleColumns={visibleColumns}
                    onColumnVisibilityChange={handleColumnVisibilityChange}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isLoading}>
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Workout
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
});
