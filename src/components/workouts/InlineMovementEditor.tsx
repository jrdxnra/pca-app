"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, MoreVertical } from 'lucide-react';
import { 
  ClientWorkoutMovementUsage,
  Movement,
  MovementCategory 
} from '@/lib/types';
import { getRecentExercisePerformance } from '@/lib/firebase/services/clients';

interface InlineMovementEditorProps {
  usage: ClientWorkoutMovementUsage;
  roundIndex: number;
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
}

export function InlineMovementEditor({
  usage,
  roundIndex,
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
  gridTemplateColumns,
  unifiedEnabledFields
}: InlineMovementEditorProps) {
  
  // State for context menu and notes
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showNotes, setShowNotes] = useState(!!usage.note);
  const contextMenuRef = useRef<HTMLButtonElement>(null);
  
  // Get movement and category info
  const selectedMovement = movements.find(m => m.id === usage.movementId);
  const selectedCategory = categories.find(c => c.id === usage.categoryId);
  const filteredMovements = movements.filter(m => m.categoryId === usage.categoryId);

  // Auto-populate weight/reps from recent performance when movement is selected
  const previousMovementIdRef = useRef<string | undefined>(usage.movementId);
  useEffect(() => {
    // Only auto-populate when movementId changes (newly selected)
    const movementChanged = previousMovementIdRef.current !== usage.movementId;
    previousMovementIdRef.current = usage.movementId;
    
    if (clientId && usage.movementId && selectedMovement && movementChanged) {
      // Only auto-populate if weight/reps are not already set
      const hasWeight = usage.targetWorkload.weight && usage.targetWorkload.weight.toString().trim() !== '';
      const hasReps = usage.targetWorkload.reps && usage.targetWorkload.reps.toString().trim() !== '';
      
      if (!hasWeight || !hasReps) {
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
              if (!hasWeight && performance.weight && selectedMovement.configuration.use_weight) {
                updates.targetWorkload!.weight = performance.weight;
                updates.targetWorkload!.useWeight = true;
                needsUpdate = true;
              }
              
              if (!hasReps && performance.repRange && selectedMovement.configuration.use_reps) {
                updates.targetWorkload!.reps = performance.repRange;
                updates.targetWorkload!.useReps = true;
                needsUpdate = true;
              }
              
              // Only update if we actually changed something
              if (needsUpdate) {
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
  }, [usage.movementId, clientId, selectedMovement?.id]); // Only run when movement or client changes
  
  // Debug logging
  if (usage.categoryId && filteredMovements.length === 0) {
    console.log('[InlineMovementEditor] No movements found for category:', {
      categoryId: usage.categoryId,
      categoryName: selectedCategory?.name,
      totalMovements: movements.length,
      movementCategoryIds: [...new Set(movements.map(m => m.categoryId))],
      usage
    });
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

  const updateField = (field: string, value: any) => {
    if (field.startsWith('targetWorkload.')) {
      const workloadField = field.replace('targetWorkload.', '');
      onUpdate({
        ...usage,
        targetWorkload: {
          ...usage.targetWorkload,
          [workloadField]: value
        }
      });
    } else {
      onUpdate({
        ...usage,
        [field]: value
      });
    }
  };

  // Ensure default values are set for dropdowns
  const weightMeasure = usage.targetWorkload.weightMeasure || selectedMovement?.configuration?.weight_measure || 'lbs';
  const distanceMeasure = usage.targetWorkload.distanceMeasure || selectedMovement?.configuration?.distance_measure || 'mi';

  // Use the unified grid template passed from parent (for table-style alignment)
  // If not provided, fall back to calculating based on this movement's config
  // Column order: Tempo (leftmost) → Reps, Weight, Time → Distance, Percentage → RPE (rightmost)
  // Widths optimized for actual data
  const gridColumns = gridTemplateColumns || (() => {
    const fallbackGrid = [
      'minmax(200px, 1fr)', // Exercise name (category dot + movement)
      selectedMovement?.configuration?.use_tempo ? '70px' : '', // 4 digits
      selectedMovement?.configuration?.use_reps ? '48px' : '', // 2 digits
      selectedMovement?.configuration?.use_weight ? '80px' : '', // 3 digits + unit
      selectedMovement?.configuration?.use_time ? '70px' : '', // 4 chars (2:30)
      selectedMovement?.configuration?.use_distance ? '110px' : '', // 3 digits + unit
      selectedMovement?.configuration?.use_percentage ? '58px' : '', // 2 digits + %
      selectedMovement?.configuration?.use_rpe ? '60px' : '', // RPE dropdown
      '40px', // Three dots menu
    ].filter(col => col !== '').join(' ');
    return fallbackGrid;
  })();

  // Determine which columns exist in the unified grid (for table alignment)
  // If unifiedEnabledFields is provided, use it; otherwise fall back to this movement's config
  const gridHasReps = unifiedEnabledFields?.reps ?? (selectedMovement?.configuration?.use_reps ?? false);
  const gridHasWeight = unifiedEnabledFields?.weight ?? (selectedMovement?.configuration?.use_weight ?? false);
  const gridHasTempo = unifiedEnabledFields?.tempo ?? (selectedMovement?.configuration?.use_tempo ?? false);
  const gridHasTime = unifiedEnabledFields?.time ?? (selectedMovement?.configuration?.use_time ?? false);
  const gridHasDistance = unifiedEnabledFields?.distance ?? (selectedMovement?.configuration?.use_distance ?? false);
  const gridHasRPE = unifiedEnabledFields?.rpe ?? (selectedMovement?.configuration?.use_rpe ?? false);
  const gridHasPercentage = unifiedEnabledFields?.percentage ?? (selectedMovement?.configuration?.use_percentage ?? false);
  
  // Check if this specific movement supports each field
  const movementSupportsReps = selectedMovement?.configuration?.use_reps ?? false;
  const movementSupportsWeight = selectedMovement?.configuration?.use_weight ?? false;
  const movementSupportsTempo = selectedMovement?.configuration?.use_tempo ?? false;
  const movementSupportsTime = selectedMovement?.configuration?.use_time ?? false;
  const movementSupportsDistance = selectedMovement?.configuration?.use_distance ?? false;
  const movementSupportsRPE = selectedMovement?.configuration?.use_rpe ?? false;
  const movementSupportsPercentage = selectedMovement?.configuration?.use_percentage ?? false;

  return (
    <>
      <div 
        className={`grid items-center text-sm border-b border-r-0 border-gray-300 relative cursor-move overflow-visible ${
          isDragging ? 'bg-blue-100 opacity-50' : 
          isDropTarget ? 'bg-blue-100' : 
          'bg-white hover:bg-gray-50'
        }`}
        style={{
          gridTemplateColumns: gridColumns
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
      <div className="flex items-center gap-2 min-w-0 px-1 py-1.5">
        <Select value={usage.categoryId || ''} onValueChange={(value) => updateField('categoryId', value)}>
          <SelectTrigger className={`h-8 text-xs bg-white py-0 flex-shrink-0 ${selectedCategory ? 'w-8 px-0 flex items-center justify-center [&_svg]:hidden [&_[data-slot=select-value]]:hidden' : 'w-28'}`}>
            {selectedCategory ? (
              <div 
                className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0" 
                style={{ backgroundColor: selectedCategory.color }}
              />
            ) : null}
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: cat.color }}
                  />
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={usage.movementId || ''} onValueChange={(value) => updateField('movementId', value)}>
          <SelectTrigger className="h-8 w-auto min-w-[120px] text-xs bg-white py-0">
            <SelectValue placeholder="Movement" />
          </SelectTrigger>
          <SelectContent>
            {filteredMovements.map(movement => (
              <SelectItem key={movement.id} value={movement.id}>
                {movement.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tempo Column */}
      {gridHasTempo && (
        <div className="px-1 py-1.5">
          {movementSupportsTempo ? (
            <Input
              placeholder="Tempo"
              value={usage.targetWorkload.tempo || ''}
              onChange={(e) => updateField('targetWorkload.tempo', e.target.value)}
              className="h-8 min-h-[32px] max-h-[32px] w-full text-xs bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300"
            />
          ) : null}
        </div>
      )}

      {/* Reps Column */}
      {gridHasReps && (
        <div className="px-1 py-1.5">
          {movementSupportsReps ? (
            <Input
              type="number"
              placeholder="Reps"
              value={usage.targetWorkload.reps?.toString() || ''}
              onChange={(e) => updateField('targetWorkload.reps', parseInt(e.target.value) || null)}
              className="h-8 min-h-[32px] max-h-[32px] w-full text-xs bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
            />
          ) : null}
        </div>
      )}

      {/* Weight Column */}
      {gridHasWeight && (
        <div className="px-1 py-1.5">
          {movementSupportsWeight ? (
            <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-8 min-h-[32px] max-h-[32px] shadow-sm rounded-md">
              <Input
                type="number"
                placeholder="Wt"
                value={usage.targetWorkload.weight?.toString() || ''}
                onChange={(e) => updateField('targetWorkload.weight', parseFloat(e.target.value) || null)}
                className="h-8 min-h-[32px] max-h-[32px] w-10 text-sm text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0 [&::-webkit-inner-spin-button]:m-0"
              />
              <button
                type="button"
                onClick={() => {
                  const newMeasure = weightMeasure === 'lbs' ? 'kg' : 'lbs';
                  updateField('targetWorkload.weightMeasure', newMeasure);
                }}
                className="h-8 min-h-[32px] max-h-[32px] w-10 text-sm border-0 rounded-none bg-white px-0.5 py-0 cursor-pointer hover:bg-gray-50"
              >
                {weightMeasure}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Time Column */}
      {gridHasTime && (
        <div className="px-1 py-1.5">
          {movementSupportsTime ? (
            <Input
              type="text"
              placeholder="Time"
              value={usage.targetWorkload.time?.toString() || ''}
              onChange={(e) => updateField('targetWorkload.time', e.target.value || null)}
              className="h-8 min-h-[32px] max-h-[32px] w-full text-xs bg-white px-1 py-0 border border-gray-300 rounded-md shadow-sm placeholder:text-gray-300"
            />
          ) : null}
        </div>
      )}

      {/* Distance Column */}
      {gridHasDistance && (
        <div className="px-1 py-1.5">
          {movementSupportsDistance ? (
            <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-8 min-h-[32px] max-h-[32px] shadow-sm rounded-md">
              <Input
                type="number"
                placeholder="Dist"
                value={usage.targetWorkload.distance?.toString() || ''}
                onChange={(e) => updateField('targetWorkload.distance', parseFloat(e.target.value) || null)}
                className="h-8 min-h-[32px] max-h-[32px] w-10 text-sm text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <select
                value={distanceMeasure}
                onChange={(e) => updateField('targetWorkload.distanceMeasure', e.target.value)}
                className="h-8 min-h-[32px] max-h-[32px] w-12 text-sm border-0 rounded-none bg-white px-0.5 py-0 focus:ring-0 focus:outline-none"
              >
                <option value="mi">mi</option>
                <option value="km">km</option>
                <option value="m">m</option>
                <option value="yd">yd</option>
                <option value="ft">ft</option>
              </select>
            </div>
          ) : null}
        </div>
      )}

      {/* Percentage Column */}
      {gridHasPercentage && (
        <div className="px-1 py-1.5">
          {movementSupportsPercentage ? (
            <div className="flex items-center bg-white border border-gray-300 overflow-hidden h-8 min-h-[32px] max-h-[32px] shadow-sm rounded-md">
              <Input
                type="number"
                placeholder="%"
                value={usage.targetWorkload.percentage?.toString() || ''}
                onChange={(e) => updateField('targetWorkload.percentage', parseInt(e.target.value) || null)}
                className="h-8 min-h-[32px] max-h-[32px] w-10 text-sm text-left border-0 rounded-none px-0.5 py-0 focus:ring-0 placeholder:text-gray-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="h-8 min-h-[32px] max-h-[32px] w-6 text-sm flex items-center justify-center bg-white">%</span>
            </div>
          ) : null}
        </div>
      )}

      {/* RPE Column */}
      {gridHasRPE && (
        <div className="px-1 py-1.5">
          {movementSupportsRPE ? (
            <select
              value={usage.targetWorkload.rpe?.toString() || ''}
              onChange={(e) => updateField('targetWorkload.rpe', e.target.value || null)}
              className="h-8 min-h-[32px] max-h-[32px] w-full text-sm border border-gray-300 rounded-md bg-white px-1 py-0 shadow-sm text-gray-700"
            >
              <option value="" className="text-gray-300">RPE</option>
              <option value="<5">&lt;5</option>
              <option value="5">5</option>
              <option value="5.5">5.5</option>
              <option value="6">6</option>
              <option value="6.5">6.5</option>
              <option value="7">7</option>
              <option value="7.5">7.5</option>
              <option value="8">8</option>
              <option value="8.5">8.5</option>
              <option value="9">9</option>
              <option value="9.5">9.5</option>
              <option value="10">10</option>
            </select>
          ) : null}
        </div>
      )}

      {/* Three Dots Menu - All the way to the right */}
      <div className="relative flex-none px-1 py-1.5 flex items-center justify-center overflow-visible">
        <Button
          ref={contextMenuRef}
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowContextMenu(!showContextMenu);
          }}
          className="h-8 w-8 p-0 text-gray-500 hover:text-indigo-500"
          title="Open options"
        >
          <MoreVertical className="w-5 h-5" />
        </Button>
        
        {showContextMenu && (
          <div className="absolute right-0 top-full z-[9999] mt-1 w-32 origin-top-right rounded-md bg-white py-2 shadow-xl ring-1 ring-gray-900/5 focus:outline-none"
               onMouseDown={(e) => e.stopPropagation()}>
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
                  console.log('Remove Note clicked');
                  setShowNotes(false);
                  updateField('note', '');
                  setShowContextMenu(false);
                }}
                className="w-full text-left px-3 py-1 text-sm leading-6 text-gray-900 hover:bg-gray-50"
              >
                Remove Note
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
    
      {/* Notes Section - Appears below when activated */}
      {showNotes && (
        <div className="mt-2 ml-6">
          <Input
            placeholder="Note"
            value={usage.note || ''}
            onChange={(e) => updateField('note', e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      )}
    </>
  );
}
