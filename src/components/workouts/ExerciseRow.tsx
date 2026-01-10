"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  MoreVertical,
  Plus
} from 'lucide-react';
import { WorkoutExercise, Movement } from '@/lib/types';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';

interface ExerciseRowProps {
  exercise: WorkoutExercise;
  roundIndex: number;
  exerciseIndex: number;
  isFirst: boolean;
  isLast: boolean;
}

export function ExerciseRow({ exercise, roundIndex, exerciseIndex, isFirst, isLast }: ExerciseRowProps) {
  const {
    updateExercise,
    removeExercise,
    reorderExercises,
  } = useWorkoutStore();

  const { movements, fetchMovements, addMovement } = useMovementStore();
  const { categories, fetchCategories } = useMovementCategoryStore();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [showQuickAddMovement, setShowQuickAddMovement] = useState(false);
  const [newMovementName, setNewMovementName] = useState('');
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const [showNotes, setShowNotes] = useState(!!exercise.notes);

  useEffect(() => {
    fetchMovements();
    fetchCategories();
  }, [fetchMovements, fetchCategories]);

  const movement = movements.find(m => m.id === exercise.movementId);
  
  // Set initial category if movement exists
  useEffect(() => {
    if (movement && !selectedCategoryId) {
      setSelectedCategoryId(movement.categoryId);
      setSelectedMovement(movement);
    }
  }, [movement, selectedCategoryId]);

  // Filter movements by selected category
  const filteredMovements = selectedCategoryId
    ? movements.filter(m => m.categoryId === selectedCategoryId)
    : [];

  const handleQuickAddMovement = async () => {
    if (!newMovementName.trim() || !selectedCategoryId) return;
    
    setIsAddingMovement(true);
    try {
      const movementId = await addMovement({
        name: newMovementName.trim(),
        categoryId: selectedCategoryId,
        configuration: {
          use_reps: true,
          use_tempo: false,
          use_time: false,
          use_weight: true,
          weight_measure: 'lbs',
          use_distance: false,
          distance_measure: 'mi',
          use_pace: false,
          pace_measure: 'mi',
          unilateral: false,
          use_percentage: false,
          use_rpe: true,
        },
        links: [],
      });
      
      await fetchMovements();
      const newMovement = movements.find(m => m.id === movementId);
      if (newMovement) {
        setSelectedMovement(newMovement);
        updateExercise(roundIndex, exerciseIndex, { movementId });
      }
      
      setShowQuickAddMovement(false);
      setNewMovementName('');
    } catch (error) {
      console.error('Failed to add movement:', error);
      alert('Failed to add movement. Please try again.');
    } finally {
      setIsAddingMovement(false);
    }
  };

  const handleUpdate = (field: string, value: any) => {
    updateExercise(roundIndex, exerciseIndex, { [field]: value });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to remove this movement?')) {
      removeExercise(roundIndex, exerciseIndex);
    }
  };

  const handleMoveUp = () => {
    if (!isFirst) {
      reorderExercises(roundIndex, exerciseIndex, exerciseIndex - 1);
    }
  };

  const handleMoveDown = () => {
    if (!isLast) {
      reorderExercises(roundIndex, exerciseIndex, exerciseIndex + 1);
    }
  };

  const handleAddNote = () => {
    setShowNotes(true);
  };

  const handleRemoveNote = () => {
    setShowNotes(false);
    updateExercise(roundIndex, exerciseIndex, { notes: '' });
  };

  return (
    <div className="mt-2">
      {/* Main Horizontal Row */}
      <div className="flex items-center gap-2">
        {/* Drag Handle */}
        <div 
          className="flex items-center cursor-grab active:cursor-grabbing"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
          }}
        >
          <svg 
            fill="currentColor" 
            xmlns="http://www.w3.org/2000/svg" 
            viewBox="0 0 52 52" 
            className="h-8 w-4 text-gray-500 hover:text-indigo-500"
          >
            <g>
              <path d="M20,4c2.2,0,4,1.8,4,4s-1.8,4-4,4s-4-1.8-4-4S17.8,4,20,4z M32,4c2.2,0,4,1.8,4,4s-1.8,4-4,4s-4-1.8-4-4S29.8,4,32,4z M20,16c2.2,0,4,1.8,4,4s-1.8,4-4,4s-4-1.8-4-4S17.8,16,20,16z M32,16c2.2,0,4,1.8,4,4s-1.8,4-4,4s-4-1.8-4-4S29.8,16,32,16z M20,28c2.2,0,4,1.8,4,4s-1.8,4-4,4s-4-1.8-4-4S17.8,28,20,28z M32,28c2.2,0,4,1.8,4,4s-1.8,4-4,4s-4-1.8-4-4S29.8,28,32,28z" />
            </g>
          </svg>
        </div>

        {/* Category */}
        <div className="flex flex-col">
          <label className="text-xs font-light">Category</label>
          <Select 
            value={selectedCategoryId} 
            onValueChange={(value) => {
              setSelectedCategoryId(value);
              setSelectedMovement(null);
              updateExercise(roundIndex, exerciseIndex, { movementId: '' });
            }}
          >
            <SelectTrigger className="h-8 w-32">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
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
        </div>

        {/* Movement */}
        {selectedCategoryId && (
          <div className="flex flex-col ml-2">
            <label className="text-xs font-light">Movement</label>
            <Select 
              value={selectedMovement?.id || ''} 
              onValueChange={(value) => {
                if (value === '__add_new__') {
                  setShowQuickAddMovement(true);
                } else {
                  const movement = movements.find(m => m.id === value);
                  setSelectedMovement(movement || null);
                  updateExercise(roundIndex, exerciseIndex, { movementId: value });
                }
              }}
            >
              <SelectTrigger className="h-8 w-48">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {filteredMovements.map((movement) => (
                  <SelectItem key={movement.id} value={movement.id}>
                    {movement.name}
                  </SelectItem>
                ))}
                <SelectItem 
                  value="__add_new__" 
                  className="text-primary font-semibold border-t mt-1 pt-1"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add New Movement...
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Dynamic Fields Based on Movement Configuration */}
        {selectedMovement && selectedMovement.configuration && (
          <>
            {/* Reps */}
            {selectedMovement.configuration.use_reps && (
              <div className="flex flex-col ml-2">
                <label className="text-xs font-light">Reps</label>
                <Input
                  placeholder="10"
                  value={exercise.reps}
                  onChange={(e) => handleUpdate('reps', e.target.value)}
                  className="h-8 w-20"
                />
              </div>
            )}

            {/* Weight */}
            {selectedMovement.configuration.use_weight && (
              <div className="flex flex-col ml-2">
                <label className="text-xs font-light">Weight</label>
                <Input
                  placeholder="lbs"
                  value={exercise.weight || ''}
                  onChange={(e) => handleUpdate('weight', e.target.value)}
                  className="h-8 w-24"
                />
              </div>
            )}

            {/* Tempo */}
            {selectedMovement.configuration.use_tempo && (
              <div className="flex flex-col ml-2">
                <label className="text-xs font-light">Tempo</label>
                <Input
                  placeholder="3010"
                  value={exercise.tempo || ''}
                  onChange={(e) => handleUpdate('tempo', e.target.value)}
                  className="h-8 w-24"
                />
              </div>
            )}

            {/* RPE */}
            {selectedMovement.configuration.use_rpe && (
              <div className="flex flex-col ml-2">
                <label className="text-xs font-light">RPE</label>
                <Input
                  type="number"
                  min="1"
                  max="10"
                  step="0.5"
                  placeholder="7.5"
                  value={exercise.targetRPE || ''}
                  onChange={(e) => handleUpdate('targetRPE', e.target.value ? parseFloat(e.target.value) : undefined)}
                  className="h-8 w-20"
                />
              </div>
            )}
          </>
        )}

        {/* Three-Dot Menu */}
        <div className="ml-2 pb-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-500 hover:text-indigo-500">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {!showNotes ? (
                <DropdownMenuItem onClick={handleAddNote}>
                  Add Note
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={handleRemoveNote}>
                  Remove Note
                </DropdownMenuItem>
              )}
              {!isFirst && (
                <DropdownMenuItem onClick={handleMoveUp}>
                  Move Up
                </DropdownMenuItem>
              )}
              {!isLast && (
                <DropdownMenuItem onClick={handleMoveDown}>
                  Move Down
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleDelete} className="text-destructive">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Notes Field (if visible) */}
      {showNotes && (
        <div className="mt-1 ml-6">
          <Input
            placeholder="Additional notes..."
            value={exercise.notes || ''}
            onChange={(e) => handleUpdate('notes', e.target.value)}
            className="h-8"
          />
        </div>
      )}

      {/* Quick Add Movement Dialog */}
      {showQuickAddMovement && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowQuickAddMovement(false)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-semibold mb-2">Quick Add Movement</h3>
              <p className="text-sm text-muted-foreground">
                Add a new movement with default settings. Edit the full configuration later on the Movements page.
              </p>
            </div>
            <div>
              <label htmlFor="movement-name" className="text-sm font-medium mb-2 block">
                Movement Name *
              </label>
              <Input
                id="movement-name"
                placeholder="e.g., Barbell Squat"
                value={newMovementName}
                onChange={(e) => setNewMovementName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMovementName.trim()) {
                    handleQuickAddMovement();
                  }
                  if (e.key === 'Escape') {
                    setShowQuickAddMovement(false);
                    setNewMovementName('');
                  }
                }}
                autoFocus
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowQuickAddMovement(false);
                  setNewMovementName('');
                }}
                disabled={isAddingMovement}
              >
                Cancel
              </Button>
              <Button
                onClick={handleQuickAddMovement}
                disabled={!newMovementName.trim() || isAddingMovement}
              >
                {isAddingMovement ? 'Adding...' : 'Add Movement'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
