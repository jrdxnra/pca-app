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
  onColumnVisibilityChange
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
    const workoutType = workoutTypes.find(wt => wt.id === workoutTypeId);
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
      if (movement?.configuration) {
        // Common columns (always show if movement supports them)
        if (movement.configuration.use_reps) enabledFields.add('reps');
        if (movement.configuration.use_weight) enabledFields.add('weight');
        if (movement.configuration.use_time) enabledFields.add('time');
        
        // Less common columns (show only if visibility is enabled)
        if (movement.configuration.use_tempo) {
          availableFields.add('tempo');
          if (visibleColumns?.tempo) enabledFields.add('tempo');
        }
        if (movement.configuration.use_distance) {
          availableFields.add('distance');
          if (visibleColumns?.distance) enabledFields.add('distance');
        }
        if (movement.configuration.use_rpe) {
          availableFields.add('rpe');
          if (visibleColumns?.rpe) enabledFields.add('rpe');
        }
        if (movement.configuration.use_percentage) {
          availableFields.add('percentage');
          if (visibleColumns?.percentage) enabledFields.add('percentage');
        }
      }
    });

    // Build grid template columns with appropriate widths for spreadsheet
    // Column order: Tempo (leftmost variable) → Reps, Weight, Time (common) → Distance, Percentage → RPE (rightmost variable)
    // Widths optimized for actual data: Tempo(4 chars), Reps(2), Weight(3+unit), Time(4), Distance(3+unit), %(2), RPE(dropdown)
    const gridColumns = [
      'minmax(200px, 1fr)', // Exercise name (category dot + movement) - flexible width
      enabledFields.has('tempo') ? '70px' : '', // 4 digits (e.g., "3010")
      enabledFields.has('reps') ? '48px' : '', // 2 digits (e.g., "12")
      enabledFields.has('weight') ? '80px' : '', // 3 digits + unit button (e.g., "185 lbs")
      enabledFields.has('time') ? '70px' : '', // 4 chars (e.g., "2:30")
      enabledFields.has('distance') ? '110px' : '', // 3 digits + unit (e.g., "5.5 mi")
      enabledFields.has('percentage') ? '58px' : '', // 2 digits + % (e.g., "85%")
      enabledFields.has('rpe') ? '60px' : '', // RPE dropdown (e.g., "7.5")
      '40px', // Three dots menu
    ].filter(col => col !== '').join(' ');

    return { gridColumns, enabledFields, availableFields };
  };

  const { gridColumns: unifiedGridTemplate, enabledFields: unifiedEnabledFields, availableFields } = calculateUnifiedGrid();

  return (
    <Card 
      className={`py-0 rounded-none border-0 cursor-move gap-1 ${
        isDragging ? 'bg-blue-50 opacity-50' : 
        isDropTarget ? 'bg-blue-50' : ''
      }`}
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
      <CardHeader className="pb-0 pt-1 px-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            {/* Workout Type Selector */}
            <select
              value={round.workoutTypeId || ''}
              onChange={(e) => updateSectionType(e.target.value)}
              className="text-sm border rounded px-2 py-1 min-w-[120px]"
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
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Sets Input */}
          <div className="flex items-center gap-2">
            <Label htmlFor={`sets-${index}`} className="text-sm">Sets:</Label>
            <Input
              id={`sets-${index}`}
              type="number"
              min="1"
              value={round.sets}
              onChange={(e) => updateSets(parseInt(e.target.value) || 1)}
              className={`w-20 ${errors[`round-${index}-sets`] ? 'border-red-500' : ''}`}
            />
            {errors[`round-${index}-sets`] && (
              <p className="text-red-500 text-sm">{errors[`round-${index}-sets`]}</p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-1 pt-0 pb-1 px-2">
        {/* Movement Usages - Google Sheets Style Table */}
        <div className="border border-gray-300 rounded overflow-visible shadow-md">
          {/* Table Data Rows */}
          <div>
            {round.movementUsages.map((usage, usageIndex) => (
              <InlineMovementEditor
                key={usageIndex}
                usage={usage}
                roundIndex={index}
                usageIndex={usageIndex}
                movements={movements}
                categories={categories}
                clientId={clientId}
                onUpdate={(updatedUsage) => updateMovementUsage(usageIndex, updatedUsage)}
                onRemove={() => removeMovementUsage(usageIndex)}
                canDelete={true}
                onDragStart={handleMovementDragStart}
                onDragOver={handleMovementDragOver}
                onDragEnd={handleMovementDragEnd}
                isDragging={draggingMovementIndex === usageIndex}
                isDropTarget={dropMovementIndex === usageIndex && draggingMovementIndex !== usageIndex}
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

        {/* Add Movement Button */}
        <Button 
          variant="outline" 
          onClick={addMovementUsage}
          className="w-full border-dashed"
        >
          <Plus className="w-4 h-4 mr-1.5 icon-add" />
          Add Movement to Round {round.ordinal}
        </Button>
      </CardContent>
    </Card>
  );
}
