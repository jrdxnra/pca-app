"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import {
  ClientWorkoutRound,
  ClientWorkoutMovementUsage,
  Movement,
  MovementCategory
} from '@/lib/types';
import { WorkoutType } from '@/lib/firebase/services/workoutTypes';
import { MovementUsageEditor } from './MovementUsageEditor';
import { InlineMovementEditor } from './InlineMovementEditor';
import { resolveWorkoutType } from '@/lib/workouts/workoutTypeUtils';

interface RoundEditorProps {
  round: ClientWorkoutRound;
  index: number;
  movements: Movement[];
  categories: MovementCategory[];
  workoutTypes?: WorkoutType[];
  clientId?: string; // Client ID for fetching recent performance data
  onUpdate: (round: ClientWorkoutRound) => void;
  onRemove: () => void;
  canDelete: boolean;
  errors: Record<string, string>;
  onDragStart?: (index: number) => void;
  onDragOver?: (index: number) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDropTarget?: boolean;
  visibleColumns?: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  onColumnVisibilityChange?: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
  onMovementFieldChange?: (movementId: string) => void; // Track dirty movements in logging mode
}

export function RoundEditor({
  round,
  index,
  movements,
  categories,
  workoutTypes = [],
  clientId,
  onUpdate,
  onRemove,
  canDelete,
  errors,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDropTarget,
  visibleColumns,
  onColumnVisibilityChange,
  onMovementFieldChange
}: RoundEditorProps) {

  // Movement drag and drop state
  const [draggingMovementIndex, setDraggingMovementIndex] = useState<number | null>(null);
  const [dropMovementIndex, setDropMovementIndex] = useState<number | null>(null);

  // Update sets
  const updateSets = (sets: number) => {
    onUpdate({
      ...round,
      sets: Math.max(1, sets)
    });
  };

  // Update round section/type
  const updateSectionType = (workoutTypeId: string) => {
    const workoutType = resolveWorkoutType(workoutTypes, workoutTypeId);
    if (!workoutType) return;

    onUpdate({
      ...round,
      sectionName: workoutType.name,
      sectionColor: workoutType.color,
      workoutTypeId: workoutType.id
    });
  };

  // Movement usage handlers
  const addMovementUsage = () => {
    const newUsage: ClientWorkoutMovementUsage = {
      ordinal: round.movementUsages.length + 1,
      movementId: '',
      categoryId: '',
      note: '',
      targetWorkload: {
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
      }
    };

    onUpdate({
      ...round,
      movementUsages: [...round.movementUsages, newUsage]
    });
  };

  const updateMovementUsage = (usageIndex: number, updatedUsage: ClientWorkoutMovementUsage) => {
    const updated = [...round.movementUsages];
    updated[usageIndex] = updatedUsage;

    onUpdate({
      ...round,
      movementUsages: updated
    });
  };

  const removeMovementUsage = (usageIndex: number) => {
    console.log('removeMovementUsage called with index:', usageIndex);
    console.log('Current movementUsages length:', round.movementUsages.length);

    const updated = round.movementUsages.filter((_, i) => i !== usageIndex);
    console.log('Updated usages after removal:', updated.length, 'movements');

    // Reorder ordinals
    updated.forEach((usage, i) => {
      usage.ordinal = i + 1;
    });

    console.log('About to call onUpdate...');
    onUpdate({
      ...round,
      movementUsages: updated
    });
    console.log('onUpdate called!');
  };

  // Movement drag and drop handlers
  const handleMovementDragStart = (usageIndex: number) => {
    setDraggingMovementIndex(usageIndex);
  };

  const handleMovementDragOver = (usageIndex: number) => {
    setDropMovementIndex(usageIndex);
  };

  const handleMovementDragEnd = () => {
    if (draggingMovementIndex !== null && dropMovementIndex !== null && draggingMovementIndex !== dropMovementIndex) {
      const updated = [...round.movementUsages];
      const [movedUsage] = updated.splice(draggingMovementIndex, 1);
      updated.splice(dropMovementIndex, 0, movedUsage);

      // Reorder ordinals
      updated.forEach((usage, i) => {
        usage.ordinal = i + 1;
      });

      onUpdate({
        ...round,
        movementUsages: updated
      });
    }

    setDraggingMovementIndex(null);
    setDropMovementIndex(null);
  };

  // Calculate unified grid template based on ALL movements in the round
  // This ensures columns align across all rows like a table
  // Shows columns based on movement configuration AND visibility settings
  const calculateUnifiedGrid = () => {
    // Get all unique enabled fields across all movements in this round
    // This is based on movement configuration, not data - so users can always add data
    const enabledFields = new Set<string>();
    const availableFields = new Set<string>(); // Fields that could be shown (for toggle UI)

    round.movementUsages.forEach(usage => {
      const movement = movements.find(m => m.id === usage.movementId);
      const workload = usage.targetWorkload || {};

      const hasReps = workload.useReps || Boolean(workload.reps);
      const hasWeight = workload.useWeight || Boolean(workload.weight);
      const hasTime = workload.useTime || Boolean(workload.time);
      const hasTempo = workload.useTempo || Boolean(workload.tempo);
      const hasDistance = workload.useDistance || typeof workload.distance === 'number';
      const hasRpe = workload.useRPE || Boolean(workload.rpe);
      const hasPercentage = workload.usePercentage || typeof workload.percentage === 'number';

      if (movement?.configuration) {
        // Common columns (always show if movement supports them)
        if (movement.configuration.useReps || hasReps) enabledFields.add('reps');
        if (movement.configuration.useWeight || hasWeight) enabledFields.add('weight');
        if (movement.configuration.useTime || hasTime) enabledFields.add('time');

        // Less common columns (show only if visibility is enabled)
        if (movement.configuration.useTempo || hasTempo) {
          availableFields.add('tempo');
          if (visibleColumns?.tempo) enabledFields.add('tempo');
        }
        if (movement.configuration.useDistance || hasDistance) {
          availableFields.add('distance');
          if (visibleColumns?.distance) enabledFields.add('distance');
        }
        if (movement.configuration.useRPE || hasRpe) {
          availableFields.add('rpe');
          if (visibleColumns?.rpe) enabledFields.add('rpe');
        }
        if (movement.configuration.usePercentage || hasPercentage) {
          availableFields.add('percentage');
          if (visibleColumns?.percentage) enabledFields.add('percentage');
        }
      } else {
        // If movement metadata is unavailable, still show columns based on existing workload data.
        if (hasReps) enabledFields.add('reps');
        if (hasWeight) enabledFields.add('weight');
        if (hasTime) enabledFields.add('time');
        if (hasTempo) {
          availableFields.add('tempo');
          if (visibleColumns?.tempo) enabledFields.add('tempo');
        }
        if (hasDistance) {
          availableFields.add('distance');
          if (visibleColumns?.distance) enabledFields.add('distance');
        }
        if (hasRpe) {
          availableFields.add('rpe');
          if (visibleColumns?.rpe) enabledFields.add('rpe');
        }
        if (hasPercentage) {
          availableFields.add('percentage');
          if (visibleColumns?.percentage) enabledFields.add('percentage');
        }
      }
    });

    // Build grid template columns with appropriate widths for spreadsheet
    // Column order: Tempo (leftmost variable) → Reps, Weight, Time (common) → Distance, Percentage → RPE (rightmost variable)
    // Widths optimized for actual data: Tempo(4 chars), Reps(2), Weight(3+unit), Time(4), Distance(3+unit), %(2), RPE(dropdown)
    const gridColumns = [
      'minmax(180px, 1fr)', // Exercise name (category dot + movement) - flexible width
      enabledFields.has('tempo') ? '70px' : '', // 4 digits (e.g., "3010")
      enabledFields.has('reps') ? '50px' : '', // 2 digits (e.g., "12")
      enabledFields.has('weight') ? '60px' : '', // 3 digits + unit button (e.g., "185 lbs")
      enabledFields.has('time') ? '50px' : '', // 4 chars (e.g., "2:30")
      enabledFields.has('distance') ? '60px' : '', // 3 digits + unit (e.g., "5.5 mi")
      enabledFields.has('percentage') ? '50px' : '', // 2 digits + % (e.g., "85%")
      enabledFields.has('rpe') ? '50px' : '', // RPE dropdown (e.g., "7.5")
      '40px', // Three dots menu
    ].filter(col => col !== '').join(' ');

    return { gridColumns, enabledFields, availableFields };
  };

  const { gridColumns: unifiedGridTemplate, enabledFields: unifiedEnabledFields, availableFields } = calculateUnifiedGrid();

  const selectedWorkoutType = resolveWorkoutType(workoutTypes, round.workoutTypeId, round.sectionName);
  const headerBackgroundColor = selectedWorkoutType?.color ? `${selectedWorkoutType.color}15` : 'transparent'; // 15 = ~8% opacity

  return (
    <Card
      className={`py-0 rounded-none border-x-0 border-b-0 cursor-move gap-0 ${isDragging ? 'bg-blue-50 opacity-50' :
        isDropTarget ? 'bg-blue-50' : ''
        }`}
      style={{
        // borderTopColor removed
      }}
      draggable={true}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.(index);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        onDragOver?.(index);
      }}
      onDragEnd={onDragEnd}
    >
      <CardHeader
        className="pb-0 pt-1 px-2 border-l-4"
        style={{
          backgroundColor: headerBackgroundColor,
          borderLeftColor: selectedWorkoutType?.color || 'transparent'
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-1">
            {/* Workout Type Selector */}
            <select
              value={round.workoutTypeId || ''}
              onChange={(e) => updateSectionType(e.target.value)}
              className="text-xs border rounded px-1 py-0 h-6 min-w-[100px] bg-white text-gray-900"
            >
              <option value="">Round {round.ordinal}</option>
              {workoutTypes.map(type => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>

            {/* Round Controls */}
            <div className="flex items-center gap-1">
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRemove}
                  className="h-6 w-6 p-0 text-red-400 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          </div>

          {/* Sets Input */}
          <div className="flex items-center gap-1.5">
            <Label htmlFor={`sets-${index}`} className="text-xs text-gray-500">Sets</Label>
            <Input
              id={`sets-${index}`}
              type="number"
              min="1"
              value={round.sets}
              onChange={(e) => updateSets(parseInt(e.target.value) || 1)}
              className={`w-[50px] h-6 text-xs px-1 text-center text-gray-900 ${errors[`round-${index}-sets`] ? 'border-red-500' : ''}`}
            />
          </div>
        </div>
      </CardHeader>

      {/* Bottom Separator Line (Shaded) - 1px, same as movements */}
      <div
        className="h-px w-full"
        style={{
          backgroundColor: selectedWorkoutType?.color || '#e5e7eb',
        }}
      />

      <CardContent className="p-0 space-y-0">
        {/* Movement Usages - Flat List */}
        <div>
          {/* Table Data Rows */}
          <div>
            {round.movementUsages.map((usage, usageIndex) => (
              <InlineMovementEditor
                key={usageIndex}
                usage={usage}
                usageIndex={usageIndex}
                movements={movements}
                categories={categories}
                clientId={clientId}
                sectionColor={selectedWorkoutType?.color}
                isFirstMovement={usageIndex === 0}
                onUpdate={(updatedUsage) => {
                  updateMovementUsage(usageIndex, updatedUsage);
                  // Use the latest movement id so dirty tracking follows the new selection
                  onMovementFieldChange?.(updatedUsage.movementId || usage.movementId);
                }}
                onRemove={() => removeMovementUsage(usageIndex)}
                canDelete={true}
                onDragStart={handleMovementDragStart}
                onDragOver={handleMovementDragOver}
                onDragEnd={handleMovementDragEnd}
                isDragging={draggingMovementIndex === usageIndex}
                isDropTarget={dropMovementIndex === usageIndex && draggingMovementIndex !== usageIndex}
                roundSets={round.sets}
                gridTemplateColumns={unifiedGridTemplate}
                unifiedEnabledFields={{
                  reps: unifiedEnabledFields.has('reps'),
                  weight: unifiedEnabledFields.has('weight'),
                  tempo: unifiedEnabledFields.has('tempo'),
                  time: unifiedEnabledFields.has('time'),
                  distance: unifiedEnabledFields.has('distance'),
                  rpe: unifiedEnabledFields.has('rpe'),
                  percentage: unifiedEnabledFields.has('percentage'),
                }}
              />
            ))}
          </div>
        </div>

        {/* Add Movement Button - Minimal Row Style */}
        <Button
          variant="ghost"
          onClick={addMovementUsage}
          className="w-full h-6 rounded-none border-b border-gray-100 hover:bg-gray-50 text-xs text-gray-400 hover:text-blue-600 justify-start px-4"
          style={{
            backgroundColor: headerBackgroundColor,
            color: selectedWorkoutType?.color ? '#6b7280' : undefined
          }}
        >
          <Plus className="w-3 h-3 mr-2 icon-add" />
          Add Movement
        </Button>
      </CardContent>
    </Card >
  );
}
