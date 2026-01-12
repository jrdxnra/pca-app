"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  ChevronUp, 
  ChevronDown, 
  GripVertical, 
  Settings,
  ChevronRight,
  ChevronDown as ChevronDownIcon
} from 'lucide-react';
import { 
  ClientWorkoutMovementUsage,
  ClientWorkoutTargetWorkload,
  Movement,
  MovementCategory 
} from '@/lib/types';

interface MovementUsageEditorProps {
  usage: ClientWorkoutMovementUsage;
  roundIndex: number;
  usageIndex: number;
  movements: Movement[];
  categories: MovementCategory[];
  onUpdate: (usage: ClientWorkoutMovementUsage) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canDelete: boolean;
  errors: Record<string, string>;
}

export function MovementUsageEditor({
  usage,
  roundIndex,
  usageIndex,
  movements,
  categories,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  canDelete,
  errors
}: MovementUsageEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Get movement and category info
  const selectedMovement = movements.find(m => m.id === usage.movementId);
  const selectedCategory = categories.find(c => c.id === usage.categoryId);
  const categoryMovements = movements.filter(m => m.categoryId === usage.categoryId);

  // Error keys for this usage
  const movementError = errors[`round-${roundIndex}-movement-${usageIndex}`];
  const categoryError = errors[`round-${roundIndex}-category-${usageIndex}`];
  const noteError = errors[`round-${roundIndex}-note-${usageIndex}`];

  // Update handlers
  const updateCategory = (categoryId: string) => {
    onUpdate({
      ...usage,
      categoryId,
      movementId: '', // Reset movement when category changes
    });
  };

  const updateMovement = (movementId: string) => {
    onUpdate({
      ...usage,
      movementId,
    });
  };

  const updateNote = (note: string) => {
    onUpdate({
      ...usage,
      note,
    });
  };

  const updateTargetWorkload = (updates: Partial<ClientWorkoutTargetWorkload>) => {
    onUpdate({
      ...usage,
      targetWorkload: {
        ...usage.targetWorkload,
        ...updates,
      },
    });
  };

  return (
    <Card className="border border-gray-300">
      <CardContent className="p-4">
        {/* Header Row */}
        <div className="flex items-center gap-3 mb-3">
          {/* Drag Handle */}
          <div className="flex-shrink-0">
            <GripVertical className="w-4 h-4 text-gray-400 cursor-move" />
          </div>

          {/* Movement Number */}
          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs font-medium text-blue-700">
            {usage.ordinal}
          </div>

          {/* Category Select */}
          <div className="flex-1 min-w-0">
            <Select value={usage.categoryId} onValueChange={updateCategory}>
              <SelectTrigger className={`${categoryError ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map(category => (
                  <SelectItem key={category.id} value={category.id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {categoryError && (
              <p className="text-red-500 text-xs mt-1">{categoryError}</p>
            )}
          </div>

          {/* Movement Select */}
          <div className="flex-1 min-w-0">
            <Select 
              value={usage.movementId} 
              onValueChange={updateMovement}
              disabled={!usage.categoryId}
            >
              <SelectTrigger className={`${movementError ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select movement..." />
              </SelectTrigger>
              <SelectContent>
                {categoryMovements.map(movement => (
                  <SelectItem key={movement.id} value={movement.id}>
                    {movement.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {movementError && (
              <p className="text-red-500 text-xs mt-1">{movementError}</p>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-gray-500"
            >
              {isExpanded ? (
                <ChevronDownIcon className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </Button>

            {onMoveUp && (
              <Button variant="ghost" size="sm" onClick={onMoveUp}>
                <ChevronUp className="w-4 h-4" />
              </Button>
            )}
            {onMoveDown && (
              <Button variant="ghost" size="sm" onClick={onMoveDown}>
                <ChevronDown className="w-4 h-4" />
              </Button>
            )}
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

        {/* Quick Target Workload Preview */}
        {!isExpanded && (
          <div className="flex items-center gap-2 text-sm text-gray-600 ml-10">
            {usage.targetWorkload.useWeight && usage.targetWorkload.weight && (
              <Badge variant="outline">{usage.targetWorkload.weight} {usage.targetWorkload.weightMeasure}</Badge>
            )}
            {usage.targetWorkload.useReps && usage.targetWorkload.reps && (
              <Badge variant="outline">{usage.targetWorkload.reps} reps</Badge>
            )}
            {usage.targetWorkload.useTempo && usage.targetWorkload.tempo && (
              <Badge variant="outline">{usage.targetWorkload.tempo}</Badge>
            )}
            {usage.targetWorkload.useRPE && usage.targetWorkload.rpe && (
              <Badge variant="outline">RPE {usage.targetWorkload.rpe}</Badge>
            )}
            {usage.note && (
              <span className="text-xs italic">&quot;{usage.note}&quot;</span>
            )}
          </div>
        )}

        {/* Expanded Target Workload Configuration */}
        {isExpanded && (
          <div className="ml-10 mt-4 space-y-4 border-t pt-4">
            {/* Notes */}
            <div>
              <Label htmlFor={`note-${roundIndex}-${usageIndex}`}>Notes</Label>
              <Textarea
                id={`note-${roundIndex}-${usageIndex}`}
                value={usage.note}
                onChange={(e) => updateNote(e.target.value)}
                placeholder="Exercise-specific notes..."
                rows={2}
                className={noteError ? 'border-red-500' : ''}
              />
              {noteError && (
                <p className="text-red-500 text-xs mt-1">{noteError}</p>
              )}
            </div>

            {/* Target Workload Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Weight */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`weight-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.useWeight}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ useWeight: checked as boolean })
                    }
                  />
                  <Label htmlFor={`weight-${roundIndex}-${usageIndex}`}>Weight</Label>
                </div>
                {usage.targetWorkload.useWeight && (
                  <div className="flex gap-2">
                    <Input
                      value={usage.targetWorkload.weight || ''}
                      onChange={(e) => updateTargetWorkload({ weight: e.target.value })}
                      placeholder="135"
                      className="flex-1"
                    />
                    <Select 
                      value={usage.targetWorkload.weightMeasure} 
                      onValueChange={(value: 'lbs' | 'kg') => updateTargetWorkload({ weightMeasure: value })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="lbs">lbs</SelectItem>
                        <SelectItem value="kg">kg</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Reps */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`reps-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.useReps}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ useReps: checked as boolean })
                    }
                  />
                  <Label htmlFor={`reps-${roundIndex}-${usageIndex}`}>Reps</Label>
                </div>
                {usage.targetWorkload.useReps && (
                  <Input
                    value={usage.targetWorkload.reps || ''}
                    onChange={(e) => updateTargetWorkload({ reps: e.target.value })}
                    placeholder="8-12"
                  />
                )}
              </div>

              {/* Tempo */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`tempo-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.useTempo}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ useTempo: checked as boolean })
                    }
                  />
                  <Label htmlFor={`tempo-${roundIndex}-${usageIndex}`}>Tempo</Label>
                </div>
                {usage.targetWorkload.useTempo && (
                  <Input
                    value={usage.targetWorkload.tempo || ''}
                    onChange={(e) => updateTargetWorkload({ tempo: e.target.value })}
                    placeholder="3010"
                  />
                )}
              </div>

              {/* Time */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`time-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.useTime}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ useTime: checked as boolean })
                    }
                  />
                  <Label htmlFor={`time-${roundIndex}-${usageIndex}`}>Time</Label>
                </div>
                {usage.targetWorkload.useTime && (
                  <Input
                    value={usage.targetWorkload.time || ''}
                    onChange={(e) => updateTargetWorkload({ time: e.target.value })}
                    placeholder="30 seconds"
                  />
                )}
              </div>

              {/* Distance */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`distance-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.useDistance}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ useDistance: checked as boolean })
                    }
                  />
                  <Label htmlFor={`distance-${roundIndex}-${usageIndex}`}>Distance</Label>
                </div>
                {usage.targetWorkload.useDistance && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={usage.targetWorkload.distance || ''}
                      onChange={(e) => updateTargetWorkload({ distance: parseFloat(e.target.value) || 0 })}
                      placeholder="1.5"
                      className="flex-1"
                    />
                    <Select 
                      value={usage.targetWorkload.distanceMeasure} 
                      onValueChange={(value: any) => updateTargetWorkload({ distanceMeasure: value })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mi">mi</SelectItem>
                        <SelectItem value="km">km</SelectItem>
                        <SelectItem value="m">m</SelectItem>
                        <SelectItem value="yd">yd</SelectItem>
                        <SelectItem value="ft">ft</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Pace */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`pace-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.usePace}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ usePace: checked as boolean })
                    }
                  />
                  <Label htmlFor={`pace-${roundIndex}-${usageIndex}`}>Pace</Label>
                </div>
                {usage.targetWorkload.usePace && (
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      value={usage.targetWorkload.pace || ''}
                      onChange={(e) => updateTargetWorkload({ pace: parseInt(e.target.value) || 0 })}
                      placeholder="7"
                      className="flex-1"
                    />
                    <Select 
                      value={usage.targetWorkload.paceMeasure} 
                      onValueChange={(value: 'mi' | 'km') => updateTargetWorkload({ paceMeasure: value })}
                    >
                      <SelectTrigger className="w-20">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mi">min/mi</SelectItem>
                        <SelectItem value="km">min/km</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Percentage */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`percentage-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.usePercentage}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ usePercentage: checked as boolean })
                    }
                  />
                  <Label htmlFor={`percentage-${roundIndex}-${usageIndex}`}>% 1RM</Label>
                </div>
                {usage.targetWorkload.usePercentage && (
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={usage.targetWorkload.percentage || ''}
                      onChange={(e) => updateTargetWorkload({ percentage: parseFloat(e.target.value) || 0 })}
                      placeholder="75"
                      className="flex-1"
                    />
                    <span className="text-sm text-gray-500">%</span>
                  </div>
                )}
              </div>

              {/* RPE */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`rpe-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.useRPE}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ useRPE: checked as boolean })
                    }
                  />
                  <Label htmlFor={`rpe-${roundIndex}-${usageIndex}`}>RPE</Label>
                </div>
                {usage.targetWorkload.useRPE && (
                  <Input
                    value={usage.targetWorkload.rpe || ''}
                    onChange={(e) => updateTargetWorkload({ rpe: e.target.value })}
                    placeholder="7-8"
                  />
                )}
              </div>

              {/* Unilateral */}
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id={`unilateral-${roundIndex}-${usageIndex}`}
                    checked={usage.targetWorkload.unilateral}
                    onCheckedChange={(checked) => 
                      updateTargetWorkload({ unilateral: checked as boolean })
                    }
                  />
                  <Label htmlFor={`unilateral-${roundIndex}-${usageIndex}`}>Unilateral</Label>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
