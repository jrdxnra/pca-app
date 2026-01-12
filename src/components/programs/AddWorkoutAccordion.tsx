'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, X, GripVertical, ChevronUp, ChevronDown, Trash2, FileText } from 'lucide-react';
import { Movement, MovementCategory, ProgramWorkout, ProgramRound, ProgramMovementUsage, ProgramTargetWorkload } from '@/lib/types';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';

interface AddWorkoutAccordionProps {
  isExpanded: boolean;
  onAddWorkout: (workout: ProgramWorkout) => void;
  onCancel: () => void;
}

interface Warmup {
  id: string;
  text: string;
}

export default function AddWorkoutAccordion({ isExpanded, onAddWorkout, onCancel }: AddWorkoutAccordionProps) {
  const { movements, fetchMovements } = useMovementStore();
  const { categories: movementCategories, fetchCategories } = useMovementCategoryStore();
  
  
  const [workoutTitle, setWorkoutTitle] = useState('');
  const [workoutTime, setWorkoutTime] = useState('');
  const [workoutNotes, setWorkoutNotes] = useState('');
  const [titleError, setTitleError] = useState(false);
  const [timeError, setTimeError] = useState(false);
  const [notesError, setNotesError] = useState(false);
  
  const [warmups, setWarmups] = useState<Warmup[]>([
    { id: 'warmup-1', text: '' }
  ]);
  
  const [rounds, setRounds] = useState<ProgramRound[]>([
    {
      id: 'round-1',
      workoutId: '',
      ordinal: 1,
      sets: 1,
      movementUsages: [
        {
          id: 'movement-1',
          roundId: 'round-1',
          movementId: '',
          ordinal: 1,
          note: '',
          targetWorkload: {
            id: 'workload-1',
            movementUsageId: 'movement-1',
            useWeight: false,
            useReps: false,
            useTempo: false,
            useTime: false,
            useDistance: false,
            usePace: false,
            usePercentage: false,
            useRPE: false,
            unilateral: false,
            weightMeasure: 'lbs',
            distanceMeasure: 'mi',
            paceMeasure: 'mi',
            createdAt: new Date() as any,
            updatedAt: new Date() as any
          },
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        }
      ],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    }
  ]);

  useEffect(() => {
    fetchMovements();
    fetchCategories();
  }, [fetchMovements, fetchCategories]);

  const resetForm = () => {
    setWorkoutTitle('');
    setWorkoutTime('');
    setWorkoutNotes('');
    setTitleError(false);
    setTimeError(false);
    setNotesError(false);
    setWarmups([{ id: 'warmup-1', text: '' }]);
    setRounds([{
      id: 'round-1',
      workoutId: '',
      ordinal: 1,
      sets: 1,
      movementUsages: [
        {
          id: 'movement-1',
          roundId: 'round-1',
          movementId: '',
          ordinal: 1,
          note: '',
          targetWorkload: {
            id: 'workload-1',
            movementUsageId: 'movement-1',
            useWeight: false,
            useReps: false,
            useTempo: false,
            useTime: false,
            useDistance: false,
            usePace: false,
            usePercentage: false,
            useRPE: false,
            unilateral: false,
            weightMeasure: 'lbs',
            distanceMeasure: 'mi',
            paceMeasure: 'mi',
            createdAt: new Date() as any,
            updatedAt: new Date() as any
          },
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        }
      ],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    }]);
  };

  const handleCancel = () => {
    resetForm();
    onCancel();
  };

  const handleAddWorkout = () => {
    // Validate
    setTitleError(!workoutTitle.trim());
    setTimeError(!workoutTime.trim());
    setNotesError(false); // Notes are optional
    
    if (!workoutTitle.trim() || !workoutTime.trim()) {
      return;
    }

    // Create workout object
    const newWorkout: ProgramWorkout = {
      id: `workout-${Date.now()}`,
      weekId: '',
      ordinal: 1,
      title: workoutTitle,
      notes: workoutNotes,
      date: new Date() as any,
      time: workoutTime,
      rounds: rounds.map(round => ({
        ...round,
        workoutId: `workout-${Date.now()}`
      })),
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };

    onAddWorkout(newWorkout);
    resetForm();
  };

  const addWarmup = () => {
    const newWarmup: Warmup = {
      id: `warmup-${Date.now()}`,
      text: ''
    };
    setWarmups([...warmups, newWarmup]);
  };

  const removeWarmup = (id: string) => {
    if (warmups.length > 1) {
      setWarmups(warmups.filter(w => w.id !== id));
    }
  };

  const updateWarmupText = (id: string, text: string) => {
    setWarmups(warmups.map(w => w.id === id ? { ...w, text } : w));
  };

  const addRound = () => {
    const newRound: ProgramRound = {
      id: `round-${Date.now()}`,
      workoutId: '',
      ordinal: rounds.length + 1,
      sets: 1,
      movementUsages: [
        {
          id: `movement-${Date.now()}`,
          roundId: `round-${Date.now()}`,
          movementId: '',
          ordinal: 1,
          note: '',
          targetWorkload: {
            id: `workload-${Date.now()}`,
            movementUsageId: `movement-${Date.now()}`,
            useWeight: false,
            useReps: false,
            useTempo: false,
            useTime: false,
            useDistance: false,
            usePace: false,
            usePercentage: false,
            useRPE: false,
            unilateral: false,
            weightMeasure: 'lbs',
            distanceMeasure: 'mi',
            paceMeasure: 'mi',
            createdAt: new Date() as any,
            updatedAt: new Date() as any
          },
          createdAt: new Date() as any,
          updatedAt: new Date() as any
        }
      ],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };
    setRounds([...rounds, newRound]);
  };

  const removeRound = (roundId: string) => {
    if (rounds.length > 1) {
      const updatedRounds = rounds.filter(r => r.id !== roundId);
      // Update ordinals
      updatedRounds.forEach((round, index) => {
        round.ordinal = index + 1;
      });
      setRounds(updatedRounds);
    }
  };

  const addMovementToRound = (roundId: string) => {
    const roundIndex = rounds.findIndex(r => r.id === roundId);
    if (roundIndex === -1) return;

    const newMovement: ProgramMovementUsage = {
      id: `movement-${Date.now()}`,
      roundId: roundId,
      movementId: '',
      ordinal: rounds[roundIndex].movementUsages.length + 1,
      note: '',
      targetWorkload: {
        id: `workload-${Date.now()}`,
        movementUsageId: `movement-${Date.now()}`,
        useWeight: false,
        useReps: false,
        useTempo: false,
        useTime: false,
        useDistance: false,
        usePace: false,
        usePercentage: false,
        useRPE: false,
        unilateral: false,
        weightMeasure: 'lbs',
        distanceMeasure: 'mi',
        paceMeasure: 'mi',
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      },
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };

    const updatedRounds = [...rounds];
    updatedRounds[roundIndex].movementUsages.push(newMovement);
    setRounds(updatedRounds);
  };

  const removeMovementFromRound = (roundId: string, movementId: string) => {
    const roundIndex = rounds.findIndex(r => r.id === roundId);
    if (roundIndex === -1) return;

    const round = rounds[roundIndex];
    if (round.movementUsages.length <= 1) return;

    const updatedRounds = [...rounds];
    updatedRounds[roundIndex].movementUsages = round.movementUsages
      .filter(m => m.id !== movementId)
      .map((m, index) => ({ ...m, ordinal: index + 1 }));
    
    setRounds(updatedRounds);
  };

  const updateMovementSelection = (roundId: string, movementId: string, selectedMovementId: string) => {
    const roundIndex = rounds.findIndex(r => r.id === roundId);
    if (roundIndex === -1) return;

    const movementIndex = rounds[roundIndex].movementUsages.findIndex(m => m.id === movementId);
    if (movementIndex === -1) return;

    const selectedMovement = movements.find(m => m.id === selectedMovementId);
    if (!selectedMovement) return;

    const updatedRounds = [...rounds];
    updatedRounds[roundIndex].movementUsages[movementIndex] = {
      ...updatedRounds[roundIndex].movementUsages[movementIndex],
      movementId: selectedMovementId,
      movement: selectedMovement,
      targetWorkload: {
        ...updatedRounds[roundIndex].movementUsages[movementIndex].targetWorkload,
        useWeight: selectedMovement.configuration?.use_weight || false,
        useReps: selectedMovement.configuration?.use_reps || false,
        useTempo: selectedMovement.configuration?.use_tempo || false,
        useTime: selectedMovement.configuration?.use_time || false,
        useDistance: selectedMovement.configuration?.use_distance || false,
        usePace: selectedMovement.configuration?.use_pace || false,
        usePercentage: selectedMovement.configuration?.use_percentage || false,
        useRPE: selectedMovement.configuration?.use_rpe || false,
        unilateral: selectedMovement.configuration?.unilateral || false,
        weightMeasure: selectedMovement.configuration?.weight_measure || 'lbs',
        distanceMeasure: selectedMovement.configuration?.distance_measure || 'mi',
        paceMeasure: selectedMovement.configuration?.pace_measure || 'mi'
      }
    };

    setRounds(updatedRounds);
  };

  if (!isExpanded) return null;

  // Show loading state if data isn't available yet
  if (!movementCategories || !movements) {
    return (
      <div className="border-l border-r border-b rounded-b-xl border-gray-300 w-full">
        <div className="m-4 p-8 text-center">
          <div className="text-gray-500">Loading workout builder...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="border-l border-r border-b rounded-b-xl border-gray-300 w-full p-8 m-4">
      <div className="m-4 size-max overflow-x-auto">
        {/* Title Bar */}
        <div className="pb-6 border-gray-200">
          <div className="flex items-center justify-between sm:flex-nowrap">
            <div className="w-3/4 flex gap-x-4 items-center">
              <h1 className="text-xl font-semibold leading-6 text-gray-900">Add Workout</h1>
              <div className="flex flex-col w-3/4">
                <label htmlFor="title" className="text-xs font-light">Title</label>
                <Input
                  id="title"
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                  className={`${titleError ? 'border-red-500' : ''}`}
                  placeholder="Enter workout title"
                />
              </div>
              <div className="flex flex-col">
                <label htmlFor="time" className="text-xs font-light">Time</label>
                <Input
                  id="time"
                  value={workoutTime}
                  onChange={(e) => setWorkoutTime(e.target.value)}
                  className={`${timeError ? 'border-red-500' : ''}`}
                  placeholder="e.g., 60 min"
                />
              </div>
            </div>
            <div className="flex gap-x-6">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleAddWorkout}>
                Save
              </Button>
            </div>
          </div>
        </div>

        {/* Workout Notes */}
        <div className="pb-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex items-center justify-between">
              <label htmlFor="workout-notes" className="bg-white pr-3 text-lg font-semibold leading-6 text-gray-900">
                Workout Notes
              </label>
            </div>
          </div>
          <Textarea
            id="workout-notes"
            value={workoutNotes}
            onChange={(e) => setWorkoutNotes(e.target.value)}
            rows={2}
            className="mt-2"
            placeholder="Add workout notes..."
          />
        </div>

        {/* Warmups */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex items-center justify-between">
            <span className="bg-white pr-3 text-lg font-semibold leading-6 text-gray-900">Warmups</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addWarmup}
              className="inline-flex items-center gap-x-1.5 rounded-full"
            >
              <Plus className="h-4 w-4" />
              <span>Add Warmup</span>
            </Button>
          </div>
        </div>
        <div className="pb-2">
          {warmups.map((warmup) => (
            <div key={warmup.id} className="flex items-center gap-2 mt-2">
              <Input
                value={warmup.text}
                onChange={(e) => updateWarmupText(warmup.id, e.target.value)}
                placeholder="Enter warmup description"
                className="flex-1"
              />
              {warmups.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeWarmup(warmup.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Rounds */}
        <div className="mt-4">
          {rounds.map((round, roundIndex) => (
            <Card key={round.id} className="mb-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Round {round.ordinal}</CardTitle>
                  <div className="flex items-center gap-1">
                    <Input
                      type="number"
                      value={round.sets}
                      onChange={(e) => {
                        const updatedRounds = [...rounds];
                        updatedRounds[roundIndex].sets = parseInt(e.target.value) || 1;
                        setRounds(updatedRounds);
                      }}
                      className="w-16 text-center"
                      min="1"
                    />
                    <span className="text-sm text-gray-500">sets</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addMovementToRound(round.id)}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                    {rounds.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeRound(round.id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {round.movementUsages.map((movementUsage, movementIndex) => (
                    <div key={movementUsage.id} className="flex items-center gap-2 p-3 border rounded-lg">
                      <GripVertical className="h-4 w-4 text-gray-400" />
                      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                        <Select
                          value={movementUsage.movementId}
                          onValueChange={(value) => updateMovementSelection(round.id, movementUsage.id, value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select movement" />
                          </SelectTrigger>
                          <SelectContent>
                            {movementCategories && movements ? (
                              movementCategories.map((category) => (
                                <div key={category.id}>
                                  <div className="px-2 py-1.5 text-sm font-medium text-gray-500">
                                    {category.name}
                                  </div>
                                  {movements
                                    .filter(m => m.categoryId === category.id)
                                    .map((movement) => (
                                      <SelectItem key={movement.id} value={movement.id}>
                                        {movement.name}
                                      </SelectItem>
                                    ))}
                                </div>
                              ))
                            ) : (
                              <SelectItem value="loading" disabled>
                                Loading movements...
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        
                        {movementUsage.movement && (
                          <>
                            {movementUsage.targetWorkload.useWeight && (
                              <Input
                                placeholder="Weight"
                                value={movementUsage.targetWorkload.weight || ''}
                                onChange={(e) => {
                                  const updatedRounds = [...rounds];
                                  const roundIdx = updatedRounds.findIndex(r => r.id === round.id);
                                  const movementIdx = updatedRounds[roundIdx].movementUsages.findIndex(m => m.id === movementUsage.id);
                                  updatedRounds[roundIdx].movementUsages[movementIdx].targetWorkload.weight = e.target.value;
                                  setRounds(updatedRounds);
                                }}
                              />
                            )}
                            {movementUsage.targetWorkload.useReps && (
                              <Input
                                placeholder="Reps"
                                value={movementUsage.targetWorkload.reps || ''}
                                onChange={(e) => {
                                  const updatedRounds = [...rounds];
                                  const roundIdx = updatedRounds.findIndex(r => r.id === round.id);
                                  const movementIdx = updatedRounds[roundIdx].movementUsages.findIndex(m => m.id === movementUsage.id);
                                  updatedRounds[roundIdx].movementUsages[movementIdx].targetWorkload.reps = e.target.value;
                                  setRounds(updatedRounds);
                                }}
                              />
                            )}
                            {movementUsage.targetWorkload.useRPE && (
                              <Input
                                placeholder="RPE"
                                value={movementUsage.targetWorkload.rpe || ''}
                                onChange={(e) => {
                                  const updatedRounds = [...rounds];
                                  const roundIdx = updatedRounds.findIndex(r => r.id === round.id);
                                  const movementIdx = updatedRounds[roundIdx].movementUsages.findIndex(m => m.id === movementUsage.id);
                                  updatedRounds[roundIdx].movementUsages[movementIdx].targetWorkload.rpe = e.target.value;
                                  setRounds(updatedRounds);
                                }}
                              />
                            )}
                          </>
                        )}
                      </div>
                      {round.movementUsages.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeMovementFromRound(round.id, movementUsage.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Toolbar */}
        <div className="mt-6 flex items-center justify-between">
          <div className="ml-4 mt-2 flex-shrink-0">
            <Button type="button" onClick={addRound}>
              <Plus className="h-4 w-4 mr-1.5 icon-add" />
              Add Round
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
