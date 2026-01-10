"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, 
  Edit2, 
  Save,
  X,
  MoreVertical
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { WorkoutRound } from '@/lib/types';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';
import { ExerciseRow } from './ExerciseRow';

interface WorkoutRoundCardProps {
  round: WorkoutRound;
  roundIndex: number;
  isFirst: boolean;
  isLast: boolean;
}

export function WorkoutRoundCard({ round, roundIndex, isFirst, isLast }: WorkoutRoundCardProps) {
  const {
    updateRound,
    removeRound,
    reorderRounds,
    addExercise,
  } = useWorkoutStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(round.name);

  const handleAddMovement = () => {
    // Add an empty movement to the round (like the original Coachella app)
    addExercise(roundIndex, {
      movementId: '', // Empty - will be selected inline
      sets: 3,
      reps: '10',
    });
  };

  const handleSaveName = () => {
    if (editName.trim()) {
      updateRound(roundIndex, { name: editName.trim() });
      setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(round.name);
    setIsEditing(false);
  };

  const handleDeleteRound = () => {
    if (confirm(`Are you sure you want to delete the "${round.name}" round?`)) {
      removeRound(roundIndex);
    }
  };

  const handleMoveUp = () => {
    if (!isFirst) {
      reorderRounds(roundIndex, roundIndex - 1);
    }
  };

  const handleMoveDown = () => {
    if (!isLast) {
      reorderRounds(roundIndex, roundIndex + 1);
    }
  };

  return (
    <div className="pt-4">
      {/* Round Header with Divider Line */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-gray-300"></div>
        </div>
        <div className="relative flex items-center justify-between">
          <div className="flex items-center justify-begin">
            {/* Round Name */}
            {isEditing ? (
              <div className="flex items-center gap-2 bg-white pr-3">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="max-w-xs h-8"
                  autoFocus
                />
                <Button variant="outline" size="sm" onClick={handleSaveName} className="h-8">
                  <Save className="h-4 w-4 icon-success" />
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancelEdit} className="h-8">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <span className="bg-white pr-3 text-lg font-semibold leading-6 text-gray-900">
                {round.name}
              </span>
            )}
            
            {/* Three-Dot Menu */}
            {!isEditing && (
              <div className="flex items-center gap-x-4 bg-white pl-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Name
                    </DropdownMenuItem>
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
                    <DropdownMenuItem onClick={handleDeleteRound} className="text-destructive">
                      Delete Round
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* Round Info */}
          <div className="flex flex-col pl-3 bg-white">
            <label className="text-xs font-light"># of Sets</label>
            <Input
              type="number"
              min="1"
              value={round.exercises[0]?.sets || 3}
              onChange={(e) => {
                // Update sets for all exercises in the round
                round.exercises.forEach((_, idx) => {
                  updateRound(roundIndex, {
                    exercises: round.exercises.map((ex, i) => 
                      i === idx ? { ...ex, sets: parseInt(e.target.value) || 1 } : ex
                    )
                  });
                });
              }}
              className="rounded-md border-0 py-1.5 w-12 text-center text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            />
          </div>
        </div>
      </div>

      {/* Movements */}
      <div className="mt-2">
        {round.exercises.map((exercise, exerciseIndex) => (
          <ExerciseRow
            key={`${exercise.movementId}-${exerciseIndex}`}
            exercise={exercise}
            roundIndex={roundIndex}
            exerciseIndex={exerciseIndex}
            isFirst={exerciseIndex === 0}
            isLast={exerciseIndex === round.exercises.length - 1}
          />
        ))}
      </div>
      
      {/* Add Movement Button */}
      <div className="pt-2 flex justify-center">
        <button 
          type="button" 
          onClick={handleAddMovement}
          className="inline-flex items-center gap-x-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
        >
          <Plus className="h-5 w-5 icon-add" />
          <span>Add Movement to {round.name}</span>
        </button>
      </div>
    </div>
  );
}
