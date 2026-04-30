"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoreVertical } from 'lucide-react';
import { RepWheelPicker } from './RepWheelPicker';
import { RPEWheelPicker } from './RPEWheelPicker';
import { CategoryWheelPicker } from './CategoryWheelPicker';
import { MovementWheelPicker } from './MovementWheelPicker';
import { DistanceUnitPicker } from './DistanceUnitPicker';
import {
  ClientWorkoutMovementUsage,
  ClientWorkoutTargetWorkload,
  Movement,
  MovementCategory,
  WorkoutSetEntry
} from '@/lib/types';
import { getRecentExercisePerformance } from '@/lib/firebase/services/clients';
import { calculateWeightFromOneRepMax, calculateOneRepMax } from '@/lib/utils/rpe-calculator';

interface InlineMovementEditorProps {
  usage: ClientWorkoutMovementUsage;
  usageIndex: number;
  movements: Movement[];
  categories: MovementCategory[];
  clientId?: string; // Client ID for fetching recent performance data
  onUpdate: (usage: ClientWorkoutMovementUsage) => void;
  onRemove: () => void;
  canDelete: boolean;
  onDragStart?: (usageIndex: number) => void;
  onDragOver?: (usageIndex: number) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  roundSets?: number;
  gridTemplateColumns?: string; // Unified grid template for table-style alignment
  unifiedEnabledFields?: { // Which fields exist in the unified grid (for table alignment)
    reps?: boolean;
    weight?: boolean;
    tempo?: boolean;
    time?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  sectionColor?: string;
  isFirstMovement?: boolean; // Hide separator on first movement to avoid doubling with round separator
}

export function InlineMovementEditor({
  usage,
  usageIndex,
  movements,
  categories,
  clientId,
  onUpdate,
  onRemove,
  canDelete,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDropTarget,
  roundSets = 1,
  gridTemplateColumns,
  unifiedEnabledFields,
  sectionColor,
  isFirstMovement
}: InlineMovementEditorProps) {

  // State for context menu and notes
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showNotes, setShowNotes] = useState(!!usage.note);
  const contextMenuRef = useRef<HTMLButtonElement>(null);
  const setExpansionEnabled = process.env.NEXT_PUBLIC_ENABLE_WORKOUT_SET_EXPANSION === 'true';

  const hasExpandedSetEntries = (usage.setEntries?.length || 0) > 1;
  const baseSetEntry = (): WorkoutSetEntry => ({
    reps: usage.targetWorkload.reps,
    weight: usage.targetWorkload.weight,
    rpe: usage.targetWorkload.rpe
  });

  // Get movement and category info
  const selectedMovement = movements.find(m => m.id === usage.movementId);

  const categoryMovements = movements.filter(m => m.categoryId === usage.categoryId);
  const filteredMovements = selectedMovement && !categoryMovements.some(m => m.id === selectedMovement.id)
    ? [selectedMovement, ...categoryMovements]
    : categoryMovements;

  useEffect(() => {
    if (!selectedMovement?.categoryId) return;
    if (selectedMovement.categoryId === usage.categoryId) return;

    // Keep a filled movement visible/editable even if its category changed in the library.
    onUpdate({
      ...usage,
      categoryId: selectedMovement.categoryId,
    });
  }, [selectedMovement?.categoryId, usage.categoryId, usage, onUpdate]);

  // Auto-populate weight/reps from recent performance when movement is selected
  const previousMovementIdRef = useRef<string | undefined>(usage.movementId);
  const previousRepsRef = useRef<string | number | undefined>(usage.targetWorkload.reps);

  // Calculate weight from 1RM when reps are entered or changed
  useEffect(() => {
    // Track if reps actually changed
    const repsChanged = previousRepsRef.current !== usage.targetWorkload.reps;
    previousRepsRef.current = usage.targetWorkload.reps;

    // Proceed even if movement metadata isn't loaded yet; fall back to defaults
    if (!clientId || !usage.movementId) return;
    const supportsWeight = selectedMovement?.configuration?.useWeight ?? true;
    if (!supportsWeight) return;

    // In expanded set mode, coaches control per-set values directly
    if (hasExpandedSetEntries) return;

    // Only process if reps are set
    const repsValue = usage.targetWorkload.reps;

    // Parse reps - handle ranges like "8-12" by using the average
    let repCount: number | null = null;
    if (typeof repsValue === 'string') {
      if (repsValue.includes('-')) {
        const [min, max] = repsValue.split('-').map(r => parseInt(r.trim()));
        if (!isNaN(min) && !isNaN(max)) {
          repCount = Math.round((min + max) / 2);
        }
      } else {
        repCount = parseInt(repsValue);
      }
    } else if (typeof repsValue === 'number') {
      repCount = repsValue;
    }

    if (!repCount || repCount < 1 || isNaN(repCount)) return;

    console.log('[InlineMovementEditor] Reps effect triggered', {
      repsChanged,
      repCount,
      movementId: usage.movementId
    });

    // Fetch recent performance and calculate weight from 1RM
    getRecentExercisePerformance(clientId, usage.movementId)
      .then(performance => {
        if (!performance) {
          console.log('[InlineMovementEditor] No recent performance found for movement', usage.movementId);
          return;
        }

        let oneRepMax = performance.estimatedOneRepMax;

        // Derive 1RM if missing but prior weight/repRange exist
        if (!oneRepMax && performance.weight && performance.repRange) {
          const historyWeight = parseFloat(performance.weight);
          let historyReps: number | null = null;

          if (typeof performance.repRange === 'string') {
            if (performance.repRange.includes('-')) {
              const [min, max] = performance.repRange.split('-').map(r => parseInt(r.trim()));
              if (!isNaN(min) && !isNaN(max)) {
                historyReps = Math.round((min + max) / 2);
              }
            } else {
              const parsed = parseInt(performance.repRange);
              if (!isNaN(parsed)) historyReps = parsed;
            }
          }

          if (historyWeight > 0 && historyReps && historyReps > 0) {
            const results = calculateOneRepMax(historyWeight, historyReps);
            const avgResult = results.find(r => r.formula === 'average');
            oneRepMax = avgResult?.estimatedOneRepMax || results[0]?.estimatedOneRepMax;
            console.log('[InlineMovementEditor] Derived 1RM from history', {
              historyWeight,
              historyReps,
              derived1RM: oneRepMax
            });
          }
        }

        if (!oneRepMax) {
          console.log('[InlineMovementEditor] No 1RM available to calculate suggested weight', {
            movementId: usage.movementId
          });
          return;
        }

        console.log('[InlineMovementEditor] Calculating suggested weight from 1RM', {
          movementId: usage.movementId,
          repCount,
          oneRepMax,
          performance
        });
        const calculatedWeight = calculateWeightFromOneRepMax(
          oneRepMax,
          repCount
        );

        console.log('[InlineMovementEditor] Updating weight to:', calculatedWeight, 'for', repCount, 'reps from 1RM:', oneRepMax);
        // Batch both updates into a single call to avoid race condition
        onUpdate({
          ...usage,
          targetWorkload: {
            ...usage.targetWorkload,
            weight: calculatedWeight.toString(),
            useWeight: true
          }
        });
      })
      .catch(error => {
        console.error('Error calculating weight from 1RM:', error);
        // Silent fail - don't interrupt user experience
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage.targetWorkload.reps, clientId, usage.movementId, hasExpandedSetEntries]); // Trigger when reps change

  useEffect(() => {
    // Only auto-populate when movementId changes (newly selected)
    const movementChanged = previousMovementIdRef.current !== usage.movementId;

    // Always update the ref to track current movement
    previousMovementIdRef.current = usage.movementId;

    // Don't run on initial mount or if movement didn't change
    if (!movementChanged) {
      return;
    }

    if (clientId && usage.movementId && selectedMovement) {
      console.log('[InlineMovementEditor] Movement changed, checking recent performance', {
        movementId: usage.movementId,
        clientId
      });
      // Only auto-populate if weight/reps are not already set
      const hasWeight = usage.targetWorkload.weight && usage.targetWorkload.weight.toString().trim() !== '';
      const hasReps = usage.targetWorkload.reps && usage.targetWorkload.reps.toString().trim() !== '';

      // Only fetch if BOTH are empty (completely new movement selection)
      if (!hasWeight && !hasReps) {
        getRecentExercisePerformance(clientId, usage.movementId)
          .then(performance => {
            if (performance) {
              const updates: Partial<ClientWorkoutMovementUsage> = {
                ...usage,
                targetWorkload: {
                  ...usage.targetWorkload,
                }
              };

              let needsUpdate = false;

              // Only update if not already set
              if (!hasWeight && performance.weight && selectedMovement.configuration.useWeight) {
                updates.targetWorkload!.weight = performance.weight;
                updates.targetWorkload!.useWeight = true;
                needsUpdate = true;
              }

              if (!hasReps && performance.repRange && selectedMovement.configuration.useReps) {
                updates.targetWorkload!.reps = performance.repRange;
                updates.targetWorkload!.useReps = true;
                needsUpdate = true;
              }

              // Only update if we actually changed something
              if (needsUpdate) {
                console.log('[InlineMovementEditor] Applied recent performance defaults', {
                  movementId: usage.movementId,
                  weight: updates.targetWorkload!.weight,
                  reps: updates.targetWorkload!.reps
                });
                onUpdate(updates as ClientWorkoutMovementUsage);
              }
            }
          })
          .catch(error => {
            console.error('Error fetching recent exercise performance:', error);
            // Don't show error to user, just log it
          });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usage.movementId, clientId]); // Only run when movement or client changes

  // Debug logging
  if (usage.categoryId && filteredMovements.length === 0) {
    // (noise removed) Previously logged when a category had no movements loaded
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showContextMenu]);

  const updateField = (field: string, value: unknown) => {
    if (field.startsWith('targetWorkload.')) {
      const workloadField = field.replace('targetWorkload.', '');
      const updated: ClientWorkoutMovementUsage = {
        ...usage,
        targetWorkload: {
          ...usage.targetWorkload,
          [workloadField]: value
        }
      };

      if (updated.setEntries && updated.setEntries.length > 0) {
        const nextEntries = [...updated.setEntries];
        const normalizedValue = value === null || value === undefined || value === '' ? undefined : String(value);
        nextEntries[0] = {
          ...nextEntries[0],
          ...(workloadField === 'reps' ? { reps: normalizedValue } : {}),
          ...(workloadField === 'weight' ? { weight: normalizedValue } : {}),
          ...(workloadField === 'rpe' ? { rpe: normalizedValue } : {})
        };
        updated.setEntries = nextEntries;
      }

      console.log('[InlineMovementEditor] updateField calling onUpdate:', { field, value, workloadField, updatedWeight: updated.targetWorkload.weight });
      onUpdate(updated);
    } else {
      onUpdate({
        ...usage,
        [field]: value
      });
    }
  };

  const handleExpandSets = () => {
    const targetSets = Math.max(1, roundSets);
    if (targetSets <= 1) return;

    // If entries already exist with the correct count, preserve them
    if (usage.setEntries && usage.setEntries.length === targetSets) {
      setShowContextMenu(false);
      return;
    }

    const source = baseSetEntry();
    // Filter out undefined values from the source entry
    const cleanSource: WorkoutSetEntry = {};
    if (source.reps !== undefined) cleanSource.reps = source.reps;
    if (source.weight !== undefined) cleanSource.weight = source.weight;
    if (source.rpe !== undefined) cleanSource.rpe = source.rpe;

    const nextEntries: WorkoutSetEntry[] = Array.from({ length: targetSets }, () => ({
      ...cleanSource
    }));

    onUpdate({
      ...usage,
      setEntries: nextEntries
    });
    setShowContextMenu(false);
  };

  const handleCollapseSets = () => {
    onUpdate({
      ...usage,
      setEntries: undefined
    });
    setShowContextMenu(false);
  };

  const updateSetEntryField = (setIndex: number, field: keyof WorkoutSetEntry, value: string | undefined) => {
    const existing = usage.setEntries && usage.setEntries.length > 0 ? usage.setEntries : [baseSetEntry()];
    const nextEntries = [...existing];
    
    // Handle type conversion for numeric fields
    let typedValue: string | number | undefined = value || undefined;
    if (field === 'distance' || field === 'percentage') {
      typedValue = value ? parseFloat(value) : undefined;
    }
    
    // Only update the field if it has a value; otherwise delete it
    const updatedEntry: Partial<WorkoutSetEntry> = {};
    const currentEntry = nextEntries[setIndex];
    
    // Copy all fields from current entry
    if (currentEntry.reps !== undefined) updatedEntry.reps = currentEntry.reps;
    if (currentEntry.tempo !== undefined) updatedEntry.tempo = currentEntry.tempo;
    if (currentEntry.time !== undefined) updatedEntry.time = currentEntry.time;
    if (currentEntry.weight !== undefined) updatedEntry.weight = currentEntry.weight;
    if (currentEntry.distance !== undefined) updatedEntry.distance = currentEntry.distance;
    if (currentEntry.pace !== undefined) updatedEntry.pace = currentEntry.pace;
    if (currentEntry.percentage !== undefined) updatedEntry.percentage = currentEntry.percentage;
    if (currentEntry.rpe !== undefined) updatedEntry.rpe = currentEntry.rpe;
    
    // Update or delete the specific field
    if (typedValue !== undefined) {
      (updatedEntry as Record<string, string | number>)[field] = typedValue;
    } else {
      delete (updatedEntry as Record<string, string | number | undefined>)[field];
    }
    nextEntries[setIndex] = updatedEntry as WorkoutSetEntry;

    const updated: ClientWorkoutMovementUsage = {
      ...usage,
      setEntries: nextEntries
    };

    if (setIndex === 0) {
      // Sync the first set entry with targetWorkload
      if (field === 'reps' || field === 'weight' || field === 'rpe' || field === 'tempo' || field === 'time' || field === 'distance' || field === 'percentage') {
        const targetWorkloadUpdate: Partial<ClientWorkoutTargetWorkload> = {
          [field]: typedValue
        };
        
        updated.targetWorkload = {
          ...updated.targetWorkload,
          ...targetWorkloadUpdate
        };
      }
    }

    onUpdate(updated);
  };

  // Ensure default values are set for dropdowns
  const weightMeasure = usage.targetWorkload.weightMeasure || selectedMovement?.configuration?.weightMeasure || 'lbs';
  const timeMeasure = usage.targetWorkload.timeMeasure || selectedMovement?.configuration?.timeMeasure || 's';
  const distanceMeasure = usage.targetWorkload.distanceMeasure || selectedMovement?.configuration?.distanceMeasure || 'mi';

  // Use the unified grid template passed from parent (for table-style alignment)
  // If not provided, fall back to calculating based on this movement's config
  // Column order: Tempo (leftmost) → Reps, Weight, Time → Distance, Percentage → RPE (rightmost)
  // Widths optimized for actual data
  const gridColumns = gridTemplateColumns || (() => {
    const fallbackGrid = [
      'minmax(180px, 1fr)', // Exercise name (category dot + movement)
      selectedMovement?.configuration?.useTempo ? '70px' : '', // 4 digits
      selectedMovement?.configuration?.useReps ? '50px' : '', // 2 digits
      selectedMovement?.configuration?.useWeight ? '60px' : '', // Input(40) + Unit(18) = 58
      selectedMovement?.configuration?.useTime ? '50px' : '', // 4 chars (2:30)
      selectedMovement?.configuration?.useDistance ? '60px' : '', // Input(28) + Unit(20) = 48
      selectedMovement?.configuration?.usePercentage ? '50px' : '', // 2 digits + %
      selectedMovement?.configuration?.useRPE ? '50px' : '', // RPE dropdown
      '40px', // Three dots menu
    ].filter(col => col !== '').join(' ');
    return fallbackGrid;
  })();

  // Determine which columns exist in the unified grid (for table alignment)
  // If unifiedEnabledFields is provided, use it; otherwise fall back to this movement's config
  const gridHasReps = unifiedEnabledFields?.reps ?? ((selectedMovement?.configuration?.useReps ?? usage.targetWorkload.useReps) || Boolean(usage.targetWorkload.reps));
  const gridHasWeight = unifiedEnabledFields?.weight ?? ((selectedMovement?.configuration?.useWeight ?? usage.targetWorkload.useWeight) || Boolean(usage.targetWorkload.weight));
  const gridHasTempo = unifiedEnabledFields?.tempo ?? ((selectedMovement?.configuration?.useTempo ?? usage.targetWorkload.useTempo) || Boolean(usage.targetWorkload.tempo));
  const gridHasTime = unifiedEnabledFields?.time ?? ((selectedMovement?.configuration?.useTime ?? usage.targetWorkload.useTime) || Boolean(usage.targetWorkload.time));
  const gridHasDistance = unifiedEnabledFields?.distance ?? ((selectedMovement?.configuration?.useDistance ?? usage.targetWorkload.useDistance) || typeof usage.targetWorkload.distance === 'number');
  const gridHasRPE = unifiedEnabledFields?.rpe ?? ((selectedMovement?.configuration?.useRPE ?? usage.targetWorkload.useRPE) || Boolean(usage.targetWorkload.rpe));
  const gridHasPercentage = unifiedEnabledFields?.percentage ?? ((selectedMovement?.configuration?.usePercentage ?? usage.targetWorkload.usePercentage) || typeof usage.targetWorkload.percentage === 'number');

  // Check if this specific movement supports each field
  const movementSupportsReps = (selectedMovement?.configuration?.useReps ?? usage.targetWorkload.useReps) || Boolean(usage.targetWorkload.reps);
  const movementSupportsWeight = (selectedMovement?.configuration?.useWeight ?? usage.targetWorkload.useWeight) || Boolean(usage.targetWorkload.weight);
  const movementSupportsTempo = (selectedMovement?.configuration?.useTempo ?? usage.targetWorkload.useTempo) || Boolean(usage.targetWorkload.tempo);
  const movementSupportsTime = (selectedMovement?.configuration?.useTime ?? usage.targetWorkload.useTime) || Boolean(usage.targetWorkload.time);
  const movementSupportsDistance = (selectedMovement?.configuration?.useDistance ?? usage.targetWorkload.useDistance) || typeof usage.targetWorkload.distance === 'number';
  const movementSupportsRPE = (selectedMovement?.configuration?.useRPE ?? usage.targetWorkload.useRPE) || Boolean(usage.targetWorkload.rpe);
  const movementSupportsPercentage = (selectedMovement?.configuration?.usePercentage ?? usage.targetWorkload.usePercentage) || typeof usage.targetWorkload.percentage === 'number';

  const rowBackgroundColor = sectionColor ? `${sectionColor}15` : 'transparent'; // 15 = ~8% opacity

  return (
    <>
      <div
        className={`grid items-center text-sm border-l-4 relative cursor-move overflow-visible ${isDragging ? 'bg-blue-100 opacity-50' :
          isDropTarget ? 'bg-blue-100' :
            'hover:bg-gray-50'
          }`}
        style={{
          gridTemplateColumns: gridColumns,
          backgroundColor: isDragging || isDropTarget ? undefined : rowBackgroundColor,
          borderLeftColor: sectionColor || 'transparent',
          // borderBottomColor removed
        }}
        draggable={true}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          onDragStart?.(usageIndex);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          onDragOver?.(usageIndex);
        }}
        onDragEnd={onDragEnd}
      >
        {/* Exercise Name (Category + Movement) */}
        <div className="flex items-center gap-2 min-w-0 px-1 py-0.5">
          <CategoryWheelPicker
            value={usage.categoryId || ''}
            onChange={(categoryId) => {
              // When category changes, we MUST reset the movementId
              const resetWorkload: ClientWorkoutMovementUsage['targetWorkload'] = {
                useWeight: false,
                weightMeasure: 'lbs',
                useReps: false,
                useTempo: false,
                useTime: false,
                timeMeasure: 's',
                useDistance: false,
                distanceMeasure: 'mi',
                usePace: false,
                paceMeasure: 'mi',
                usePercentage: false,
                useRPE: false,
                unilateral: false,
              };

              onUpdate({
                ...usage,
                categoryId,
                movementId: '', // Reset movement selection
                targetWorkload: resetWorkload, // Reset workload data
                setEntries: undefined
              });
            }}
            categories={categories}
            tabIndex={-1}
          />
          <MovementWheelPicker
            value={usage.movementId || ''}
            onChange={(value) => updateField('movementId', value)}
            movements={filteredMovements}
            tabIndex={-1}
          />
        </div>

        {/* Tempo Column */}
        {gridHasTempo && (
          <div className="px-1 py-0.5">
            {movementSupportsTempo ? (
              <Input
                placeholder="Tempo"
                value={usage.targetWorkload.tempo || ''}
                onChange={(e) => updateField('targetWorkload.tempo', e.target.value)}
                className="h-6 min-h-[24px] max-h-[24px] w-full text-base bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300 text-gray-900"
              />
            ) : null}
          </div>
        )}

        {/* Reps Column */}
        {gridHasReps && (
          <div className="px-1 py-0.5">
            {movementSupportsReps ? (
              <RepWheelPicker
                value={usage.targetWorkload.reps ? parseInt(usage.targetWorkload.reps) || null : null}
                onChange={(value) => updateField('targetWorkload.reps', value.toString())}
                placeholder={selectedMovement?.configuration.unilateral || usage.targetWorkload.unilateral ? "ea" : "Reps"}
              />
            ) : null}
          </div>
        )}

        {/* Weight Column */}
        {gridHasWeight && (
          <div className="px-0 py-0.5">
            {movementSupportsWeight ? (
              <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                <Input
                  type="number"
                  placeholder="Wt"
                  value={usage.targetWorkload.weight?.toString() || ''}
                  onChange={(e) => updateField('targetWorkload.weight', e.target.value || null)}
                  className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 w-auto text-base text-right border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const newMeasure = weightMeasure === 'lbs' ? 'kg' : weightMeasure === 'kg' ? 'bw' : 'lbs';
                    updateField('targetWorkload.weightMeasure', newMeasure);
                  }}
                  className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-xs font-medium border-0 rounded-none bg-white px-0 py-0 cursor-pointer hover:bg-gray-50 text-center tracking-tighter"
                >
                  {weightMeasure}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Time Column */}
        {gridHasTime && (
          <div className="px-1 py-0.5">
            {movementSupportsTime ? (
              <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                <Input
                  type="text"
                  placeholder="Time"
                  value={usage.targetWorkload.time?.toString() || ''}
                  onChange={(e) => updateField('targetWorkload.time', e.target.value || null)}
                  className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 text-base bg-white px-1 py-0 border-0 rounded-none shadow-none placeholder:text-gray-300 text-gray-900"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    const newMeasure = timeMeasure === 's' ? 'm' : 's';
                    updateField('targetWorkload.timeMeasure', newMeasure);
                  }}
                  className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-xs font-medium border-0 rounded-none bg-white px-0 py-0 cursor-pointer hover:bg-gray-50 text-center tracking-tighter"
                >
                  {timeMeasure}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Distance Column */}
        {gridHasDistance && (
          <div className="px-0 py-0.5">
            {movementSupportsDistance ? (
              <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                <Input
                  type="number"
                  placeholder="Dist"
                  value={usage.targetWorkload.distance?.toString() || ''}
                  onChange={(e) => updateField('targetWorkload.distance', parseFloat(e.target.value) || null)}
                  className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 w-auto text-base text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <DistanceUnitPicker
                  value={distanceMeasure}
                  onChange={(value) => updateField('targetWorkload.distanceMeasure', value)}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* Percentage Column */}
        {gridHasPercentage && (
          <div className="px-1 py-0.5">
            {movementSupportsPercentage ? (
              <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                <Input
                  type="number"
                  placeholder="%"
                  value={usage.targetWorkload.percentage?.toString() || ''}
                  onChange={(e) => updateField('targetWorkload.percentage', parseInt(e.target.value) || null)}
                  className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 w-auto text-base text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-sm flex items-center justify-center bg-white">%</span>
              </div>
            ) : null}
          </div>
        )}

        {/* RPE Column */}
        {gridHasRPE && (
          <div className="px-0 py-0.5">
            {movementSupportsRPE ? (
              <RPEWheelPicker
                value={usage.targetWorkload.rpe ? parseInt(usage.targetWorkload.rpe) || null : null}
                onChange={(value) => updateField('targetWorkload.rpe', value.toString())}
              />
            ) : null}
          </div>
        )}

        {/* Three Dots Menu - All the way to the right */}
        <div className="relative flex-none px-1 py-0.5 flex items-center justify-center overflow-visible">
          <Button
            ref={contextMenuRef}
            variant="ghost"
            size="sm"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowContextMenu(!showContextMenu);
            }}
            className="h-6 w-6 p-0 text-gray-500 hover:text-indigo-500"
            title="Open options"
          >
            <MoreVertical className="w-5 h-5" />
          </Button>

          {showContextMenu && (
            <div className="absolute right-0 top-full z-[9999] mt-1 w-40 origin-top-right rounded-md bg-white py-2 shadow-xl ring-1 ring-gray-900/5 focus:outline-none"
              onMouseDown={(e) => e.stopPropagation()}>
              {setExpansionEnabled && roundSets > 1 && !hasExpandedSetEntries && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleExpandSets();
                  }}
                  className="w-full text-left px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50"
                >
                  Expand sets
                </button>
              )}
              {setExpansionEnabled && roundSets > 1 && hasExpandedSetEntries && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleCollapseSets();
                  }}
                  className="w-full text-left px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50"
                >
                  Collapse sets
                </button>
              )}
              {!showNotes && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Add Note clicked');
                    setShowNotes(true);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50"
                >
                  Add Note
                </button>
              )}
              {showNotes && (
                <button
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    console.log('Hide Note clicked');
                    setShowNotes(false);
                    setShowContextMenu(false);
                  }}
                  className="w-full text-left px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50"
                >
                  Hide Note
                              {showNotes && usage.note && (
                                <button
                                  onMouseDown={(e) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    console.log('Delete Note clicked');
                                    updateField('note', '');
                                    setShowNotes(false);
                                    setShowContextMenu(false);
                                  }}
                                  className="w-full text-left px-3 py-1 text-sm leading-6 text-red-600 hover:bg-red-50"
                                >
                                  Delete Note
                                </button>
                              )}
                </button>
              )}
              {canDelete && (
                <>
                  <div className="border-t border-gray-200 my-1"></div>
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      onRemove();
                      setShowContextMenu(false);
                    }}
                    className="w-full text-left px-3 py-1 text-sm leading-6 text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {setExpansionEnabled && hasExpandedSetEntries && (
        <div>
          {(usage.setEntries || []).slice(1).map((setEntry, setIndex) => {
            const expandedSetIndex = setIndex + 1; // Actual index in setEntries array
            return (
              <div
                key={`set-row-${expandedSetIndex}`}
                className={`grid items-center text-sm border-l-4 relative ${
                  'hover:bg-gray-50'
                }`}
                style={{
                  gridTemplateColumns: gridColumns,
                  backgroundColor: rowBackgroundColor,
                  borderLeftColor: sectionColor || 'transparent',
                }}
              >
                {/* Set Label */}
                <div className="flex items-center gap-2 min-w-0 px-1 py-0.5">
                </div>

                {/* Tempo Column */}
                {gridHasTempo && (
                  <div className="px-1 py-0.5">
                    {movementSupportsTempo ? (
                      <Input
                        placeholder="Tempo"
                        value={setEntry.tempo || ''}
                        onChange={(e) => updateSetEntryField(expandedSetIndex, 'tempo', e.target.value)}
                        className="h-6 min-h-[24px] max-h-[24px] w-full text-base bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300 text-gray-900"
                      />
                    ) : null}
                  </div>
                )}

                {/* Reps Column */}
                {gridHasReps && (
                  <div className="px-1 py-0.5">
                    {movementSupportsReps ? (
                      <Input
                        placeholder="Reps"
                        value={setEntry.reps || ''}
                        onChange={(e) => updateSetEntryField(expandedSetIndex, 'reps', e.target.value)}
                        className="h-6 min-h-[24px] max-h-[24px] w-full text-base text-center bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300 text-gray-900"
                      />
                    ) : null}
                  </div>
                )}

                {/* Weight Column */}
                {gridHasWeight && (
                  <div className="px-0 py-0.5">
                    {movementSupportsWeight ? (
                      <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                        <Input
                          type="number"
                          placeholder="Wt"
                          value={setEntry.weight?.toString() || ''}
                          onChange={(e) => updateSetEntryField(expandedSetIndex, 'weight', e.target.value)}
                          className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 w-auto text-base text-right border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled
                          className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-xs font-medium border-0 rounded-none bg-white px-0 py-0 text-center tracking-tighter text-gray-400"
                        >
                          {weightMeasure}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Time Column */}
                {gridHasTime && (
                  <div className="px-1 py-0.5">
                    {movementSupportsTime ? (
                      <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                        <Input
                          type="text"
                          placeholder="Time"
                          value={setEntry.time?.toString() || ''}
                          onChange={(e) => updateSetEntryField(expandedSetIndex, 'time', e.target.value)}
                          className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 text-base bg-white px-1 py-0 border-0 rounded-none shadow-none placeholder:text-gray-300 text-gray-900"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled
                          className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-xs font-medium border-0 rounded-none bg-white px-0 py-0 text-center tracking-tighter text-gray-400"
                        >
                          {timeMeasure}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Distance Column */}
                {gridHasDistance && (
                  <div className="px-0 py-0.5">
                    {movementSupportsDistance ? (
                      <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                        <Input
                          type="number"
                          placeholder="Dist"
                          value={setEntry.distance?.toString() || ''}
                          onChange={(e) => updateSetEntryField(expandedSetIndex, 'distance', e.target.value)}
                          className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 w-auto text-base text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          disabled
                          className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-xs font-medium border-0 rounded-none bg-white px-0 py-0 text-center tracking-tighter text-gray-400"
                        >
                          {distanceMeasure}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Percentage Column */}
                {gridHasPercentage && (
                  <div className="px-1 py-0.5">
                    {movementSupportsPercentage ? (
                      <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-6 min-h-[24px] max-h-[24px] shadow-sm rounded-md">
                        <Input
                          type="number"
                          placeholder="%"
                          value={setEntry.percentage?.toString() || ''}
                          onChange={(e) => updateSetEntryField(expandedSetIndex, 'percentage', e.target.value)}
                          className="h-6 min-h-[24px] max-h-[24px] flex-1 min-w-0 w-auto text-base text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 text-gray-900 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="h-6 min-h-[24px] max-h-[24px] w-[20px] text-sm flex items-center justify-center bg-white">%</span>
                      </div>
                    ) : null}
                  </div>
                )}

                {/* RPE Column */}
                {gridHasRPE && (
                  <div className="px-0 py-0.5">
                    {movementSupportsRPE ? (
                      <Input
                        placeholder="RPE"
                        value={setEntry.rpe || ''}
                        onChange={(e) => updateSetEntryField(expandedSetIndex, 'rpe', e.target.value)}
                        className="h-6 min-h-[24px] max-h-[24px] w-full text-base bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300 text-gray-900"
                      />
                    ) : null}
                  </div>
                )}

                {/* Set Label - Right aligned where menu would be */}
                <div className="px-0 py-0.5 flex items-center justify-center">
                  <span className="text-xs text-gray-500 font-medium whitespace-nowrap">Set {expandedSetIndex + 1}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Notes Section - Integrated into the row look */}
      {showNotes && (
        <div
          className="border-t border-gray-100 px-1 py-0.5 border-l-4"
          style={{
            backgroundColor: rowBackgroundColor,
            borderLeftColor: sectionColor || 'transparent'
          }}
        >
          <Input
            placeholder="Add note..."
            value={usage.note || ''}
            onChange={(e) => updateField('note', e.target.value)}
            className="h-6 text-xs w-full bg-transparent border-none shadow-none focus-visible:ring-0 px-1 text-gray-900 placeholder:text-gray-400 italic"
          />
        </div>
      )}

      {/* Explicit Separator Line - Skip on first movement to avoid doubling with round separator */}
      {!isFirstMovement && (
        <div
          className="h-px w-full"
          style={{
            backgroundColor: sectionColor ? `${sectionColor}33` : '#f3f4f6'
          }}
        />
      )}
    </>
  );
}
