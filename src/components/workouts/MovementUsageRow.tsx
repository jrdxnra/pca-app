'use client';

import { useState, useEffect } from 'react';
import { ClientWorkoutMovementUsage } from '@/lib/types';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, GripVertical } from 'lucide-react';

interface MovementUsageRowProps {
  usage: ClientWorkoutMovementUsage;
  roundIndex: number;
  usageIndex: number;
  onUpdate: (roundIndex: number, usageIndex: number, field: string, value: any) => void;
  onRemove: (roundIndex: number, usageIndex: number) => void;
  canDelete: boolean;
  isInline?: boolean;
}

export function MovementUsageRow({
  usage,
  roundIndex,
  usageIndex,
  onUpdate,
  onRemove,
  canDelete,
  isInline = false
}: MovementUsageRowProps) {
  const { movements } = useMovementStore();
  const { categories } = useMovementCategoryStore();
  
  const [filteredMovements, setFilteredMovements] = useState<any[]>([]);
  
  // Filter movements when category changes
  useEffect(() => {
    if (usage.categoryId) {
      const filtered = movements.filter(m => m.categoryId === usage.categoryId);
      setFilteredMovements(filtered);
    } else {
      setFilteredMovements([]);
    }
  }, [usage.categoryId, movements]);
  
  // Clear movement when category changes
  useEffect(() => {
    if (usage.categoryId && usage.movementId) {
      const movementExists = movements.find(
        m => m.id === usage.movementId && m.categoryId === usage.categoryId
      );
      if (!movementExists) {
        onUpdate(roundIndex, usageIndex, 'movementId', '');
      }
    }
  }, [usage.categoryId, usage.movementId, movements, roundIndex, usageIndex, onUpdate]);
  
  // Get selected movement configuration
  const selectedMovement = movements.find(m => m.id === usage.movementId);
  const configuration = selectedMovement?.configuration;
  
  // Get selected category for color
  const selectedCategory = categories.find(c => c.id === usage.categoryId);
  const categoryColor = selectedCategory?.color || '#ffffff';
  
  if (isInline) {
    // Compact inline view for week view - category only
    return (
      <div className="flex items-center gap-1 text-xs">
        <GripVertical className="w-3 h-3 text-gray-400 flex-shrink-0" />
        
        {/* Category Select with colored background */}
        <select
          value={usage.categoryId}
          onChange={(e) => onUpdate(roundIndex, usageIndex, 'categoryId', e.target.value)}
          className="text-xs border rounded p-0.5 flex-1 min-w-0 font-medium"
          style={{
            backgroundColor: usage.categoryId ? categoryColor : '#ffffff',
            color: usage.categoryId ? '#ffffff' : '#000000'
          }}
        >
          <option value="" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            Category
          </option>
          {categories.map(cat => (
            <option 
              key={cat.id} 
              value={cat.id}
              style={{ backgroundColor: cat.color, color: '#ffffff' }}
            >
              {cat.name}
            </option>
          ))}
        </select>
        
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(roundIndex, usageIndex)}
            className="h-4 w-4 p-0 text-gray-400 hover:text-red-500 flex-shrink-0"
          >
            <Trash2 className="w-2 h-2" />
          </Button>
        )}
      </div>
    );
  }
  
  // Full view for day view - category, movement, and workload fields
  return (
    <div className="flex flex-col gap-2 p-2 border border-gray-200 rounded">
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
        
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
          {/* Category Select with colored background */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Category</label>
            <select
              value={usage.categoryId}
              onChange={(e) => onUpdate(roundIndex, usageIndex, 'categoryId', e.target.value)}
              className="text-sm border rounded px-2 py-1 font-medium"
              style={{
                backgroundColor: usage.categoryId ? categoryColor : '#ffffff',
                color: usage.categoryId ? '#ffffff' : '#000000'
              }}
            >
              <option value="" style={{ backgroundColor: '#ffffff', color: '#000000' }}>
                Select Category
              </option>
              {categories.map(cat => (
                <option 
                  key={cat.id} 
                  value={cat.id}
                  style={{ backgroundColor: cat.color, color: '#ffffff' }}
                >
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          
          {/* Movement Select */}
          <div className="flex flex-col">
            <label className="text-xs font-medium text-gray-700 mb-1">Movement</label>
            <select
              value={usage.movementId}
              onChange={(e) => onUpdate(roundIndex, usageIndex, 'movementId', e.target.value)}
              className="text-sm border rounded px-2 py-1"
              disabled={!usage.categoryId}
            >
              <option value="">Select Movement</option>
              {filteredMovements.map(mov => (
                <option key={mov.id} value={mov.id}>
                  {mov.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {canDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onRemove(roundIndex, usageIndex)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 mt-6"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Workload fields - show based on movement configuration */}
      {selectedMovement && configuration && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 ml-6">
          {configuration.use_reps && (
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Reps</label>
              <Input
                type="number"
                value={usage.targetWorkload.reps || ''}
                onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.reps', parseInt(e.target.value) || null)}
                className="h-8 text-sm"
                placeholder="Reps"
              />
            </div>
          )}
          
          {configuration.use_weight && (
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Weight</label>
              <div className="flex gap-1">
                <Input
                  type="number"
                  value={usage.targetWorkload.weight || ''}
                  onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.weight', parseFloat(e.target.value) || 0)}
                  className="h-8 text-sm flex-1"
                  placeholder="0"
                />
                <select
                  value={usage.targetWorkload.weightMeasure || 'lbs'}
                  onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.weightMeasure', e.target.value)}
                  className="h-8 text-xs border rounded px-1"
                >
                  <option value="lbs">lbs</option>
                  <option value="kg">kg</option>
                </select>
              </div>
            </div>
          )}
          
          {configuration.use_tempo && (
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Tempo</label>
              <Input
                type="text"
                value={usage.targetWorkload.tempo || ''}
                onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.tempo', e.target.value)}
                className="h-8 text-sm"
                placeholder="3-1-2-0"
              />
            </div>
          )}
          
          {configuration.use_time && (
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Time</label>
              <Input
                type="text"
                value={usage.targetWorkload.time || ''}
                onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.time', e.target.value)}
                className="h-8 text-sm"
                placeholder="00:30"
              />
            </div>
          )}
          
          {configuration.use_rpe && (
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">RPE</label>
              <select
                value={usage.targetWorkload.rpe || ''}
                onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.rpe', e.target.value)}
                className="h-8 text-sm border rounded px-2"
              >
                <option value="">-</option>
                <option value="<5">&lt;5</option>
                {[5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(rpe => (
                  <option key={rpe} value={rpe.toString()}>{rpe}</option>
                ))}
              </select>
            </div>
          )}
          
          {configuration.use_percentage && (
            <div className="flex flex-col">
              <label className="text-xs font-medium text-gray-700 mb-1">Percentage</label>
              <Input
                type="number"
                value={usage.targetWorkload.percentage || ''}
                onChange={(e) => onUpdate(roundIndex, usageIndex, 'targetWorkload.percentage', parseInt(e.target.value) || 0)}
                className="h-8 text-sm"
                placeholder="%"
                min="0"
                max="100"
              />
            </div>
          )}
        </div>
      )}
      
      {/* Note field */}
      <div className="ml-6">
        <Input
          type="text"
          value={usage.note || ''}
          onChange={(e) => onUpdate(roundIndex, usageIndex, 'note', e.target.value)}
          className="h-7 text-xs"
          placeholder="Note (optional)"
        />
      </div>
    </div>
  );
}

