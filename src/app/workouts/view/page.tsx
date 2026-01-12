"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, Check } from 'lucide-react';
import { ClientWorkout, ClientWorkoutRound, ClientWorkoutMovementUsage } from '@/lib/types';
import { getClientWorkout, updateClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { getWorkoutLogByScheduledWorkout, upsertWorkoutLog } from '@/lib/firebase/services/workoutLogs';
import { updateRecentExercisePerformance } from '@/lib/firebase/services/clients';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { format } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface ActualSet {
  weight?: string;
  reps?: string;
  rpe?: string;
  notes?: string;
}

interface ExerciseActuals {
  movementId: string;
  sets: ActualSet[];
}

export default function WorkoutViewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId');
  const clientId = searchParams.get('client');
  const dateParam = searchParams.get('date');

  const { movements, fetchMovements } = useMovementStore();
  const { categories, fetchCategories } = useMovementCategoryStore();

  const [workout, setWorkout] = useState<ClientWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actuals, setActuals] = useState<Record<string, ExerciseActuals>>({});
  const [athleteNotes, setAthleteNotes] = useState('');
  const [sessionRPE, setSessionRPE] = useState<string>('');

  useEffect(() => {
    fetchMovements();
    fetchCategories();
  }, [fetchMovements, fetchCategories]);

  useEffect(() => {
    if (workoutId) {
      loadWorkout();
    }
  }, [workoutId]);

  const loadWorkout = async () => {
    if (!workoutId) return;
    
    try {
      setLoading(true);
      const loadedWorkout = await getClientWorkout(workoutId);
      if (!loadedWorkout) {
        setLoading(false);
        return;
      }
      
      setWorkout(loadedWorkout);
      
      // Initialize actuals from existing data or create empty structure
      if (loadedWorkout.rounds) {
        const initialActuals: Record<string, ExerciseActuals> = {};
        loadedWorkout.rounds.forEach(round => {
          round.movementUsages?.forEach(usage => {
            const key = `${round.ordinal}-${usage.ordinal}`;
            const sets = round.sets || 1;
            initialActuals[key] = {
              movementId: usage.movementId,
              sets: Array.from({ length: sets }, () => ({}))
            };
          });
        });
        setActuals(initialActuals);
      }
      
      // Load existing WorkoutLog if it exists
      try {
        const existingLog = await getWorkoutLogByScheduledWorkout(workoutId);
        if (existingLog) {
          // Populate form with existing log data
          setAthleteNotes(existingLog.athleteNotes || '');
          setSessionRPE(existingLog.sessionRPE?.toString() || '');
          
          // Map WorkoutLog exercises back to actuals structure
          if (existingLog.exercises && loadedWorkout.rounds) {
            const logActuals: Record<string, ExerciseActuals> = {};
            
            // Create a map of movementId to exercises (handle duplicates by using first match)
            // Note: If same movement appears in multiple rounds, they'll share log data
            const exerciseMap = new Map<string, typeof existingLog.exercises[0]>();
            existingLog.exercises.forEach(ex => {
              if (!exerciseMap.has(ex.movementId)) {
                exerciseMap.set(ex.movementId, ex);
              }
            });
            
            loadedWorkout.rounds.forEach(round => {
              round.movementUsages?.forEach(usage => {
                const key = `${round.ordinal}-${usage.ordinal}`;
                const exercise = exerciseMap.get(usage.movementId);
                
                if (exercise && exercise.actualSets && exercise.actualSets.length > 0) {
                  logActuals[key] = {
                    movementId: usage.movementId,
                    sets: exercise.actualSets.map(actualSet => ({
                      weight: actualSet.weight?.toString() || '',
                      reps: actualSet.reps?.toString() || '',
                      rpe: actualSet.actualRPE?.toString() || '',
                      notes: exercise.notes || ''
                    }))
                  };
                } else {
                  // No log data for this exercise, use empty structure
                  const sets = round.sets || 1;
                  logActuals[key] = {
                    movementId: usage.movementId,
                    sets: Array.from({ length: sets }, () => ({}))
                  };
                }
              });
            });
            
            setActuals(logActuals);
          }
        }
      } catch (logError) {
        console.error('Error loading workout log:', logError);
        // Continue without log data
      }
    } catch (error) {
      console.error('Error loading workout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSetChange = (
    roundIndex: number,
    usageIndex: number,
    setIndex: number,
    field: 'weight' | 'reps' | 'rpe' | 'notes',
    value: string
  ) => {
    const key = `${roundIndex}-${usageIndex}`;
    setActuals(prev => {
      const exercise = prev[key] || { movementId: '', sets: [] };
      const updatedSets = [...exercise.sets];
      if (!updatedSets[setIndex]) {
        updatedSets[setIndex] = {};
      }
      updatedSets[setIndex] = {
        ...updatedSets[setIndex],
        [field]: value
      };
      return {
        ...prev,
        [key]: {
          ...exercise,
          sets: updatedSets
        }
      };
    });
  };

  const handleSave = async () => {
    if (!workout || !clientId) return;

    try {
      setSaving(true);
      
      // Transform actuals data to WorkoutLog format
      const exercises: Array<{
        movementId: string;
        prescribedSets: number;
        prescribedReps: string;
        prescribedRPE?: number;
        prescribedWeight?: number;
        actualSets: Array<{
          weight: number;
          reps: number;
          actualRPE: number;
        }>;
        estimatedOneRepMax: number;
        notes?: string;
      }> = [];
      
      if (workout.rounds) {
        workout.rounds.forEach(round => {
          round.movementUsages?.forEach(usage => {
            const key = `${round.ordinal}-${usage.ordinal}`;
            const exerciseActuals = actuals[key];
            
            if (exerciseActuals && exerciseActuals.sets.length > 0) {
              // Convert actual sets from strings to numbers
              const actualSets = exerciseActuals.sets
                .filter(set => set.weight || set.reps || set.rpe) // Only include sets with data
                .map(set => ({
                  weight: parseFloat(set.weight || '0') || 0,
                  reps: parseInt(set.reps || '0') || 0,
                  actualRPE: parseFloat(set.rpe || '0') || 0,
                }));
              
              // Only add exercise if there's at least one actual set with data
              if (actualSets.length > 0 || exerciseActuals.sets.some(s => s.notes)) {
                // Get prescribed values
                const prescribedWeight = usage.targetWorkload.useWeight 
                  ? parseFloat(usage.targetWorkload.weight || '0') || undefined
                  : undefined;
                const prescribedRPE = usage.targetWorkload.useRPE
                  ? parseFloat(usage.targetWorkload.rpe || '0') || undefined
                  : undefined;
                
                // Combine notes from all sets (if any)
                const combinedNotes = exerciseActuals.sets
                  .map((set, idx) => set.notes ? `Set ${idx + 1}: ${set.notes}` : '')
                  .filter(n => n)
                  .join('; ') || undefined;
                
                exercises.push({
                  movementId: usage.movementId,
                  prescribedSets: round.sets || 1,
                  prescribedReps: usage.targetWorkload.reps || '0',
                  prescribedRPE,
                  prescribedWeight,
                  actualSets,
                  estimatedOneRepMax: 0, // TODO: Calculate 1RM if needed
                  notes: combinedNotes,
                });
              }
            }
          });
        });
      }
      
      // Parse session RPE (handle ranges like "7-8" by taking average or first number)
      const sessionRPENum = sessionRPE 
        ? parseFloat(sessionRPE.split('-')[0].trim()) || 0
        : 0;
      
      // Get workout date
      const workoutDate = workout.date instanceof Timestamp 
        ? workout.date 
        : Timestamp.fromDate(new Date(dateParam || Date.now()));
      
      // Create or update WorkoutLog
      await upsertWorkoutLog(workout.id, {
        clientId,
        completedDate: workoutDate,
        exercises,
        sessionRPE: sessionRPENum,
        athleteNotes: athleteNotes || undefined,
      });
      
      // Update recent exercise performance for each exercise
      for (const exercise of exercises) {
        if (exercise.actualSets.length > 0 && exercise.movementId) {
          // Calculate average weight (handle cases where weight might vary)
          const weights = exercise.actualSets.map(s => s.weight).filter(w => w > 0);
          const reps = exercise.actualSets.map(s => s.reps).filter(r => r > 0);
          
          if (weights.length > 0 && reps.length > 0) {
            // Use the first set's weight as the representative weight (most common pattern)
            // Or calculate average if needed
            const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
            const weightStr = Math.round(avgWeight).toString();
            
            // Create rep range from min to max reps
            const minReps = Math.min(...reps);
            const maxReps = Math.max(...reps);
            const repRange = minReps === maxReps ? minReps.toString() : `${minReps}-${maxReps}`;
            
            // Update client's recent performance
            try {
              await updateRecentExercisePerformance(clientId, exercise.movementId, weightStr, repRange);
            } catch (error) {
              console.error(`Error updating recent performance for movement ${exercise.movementId}:`, error);
              // Don't fail the entire save if this fails
            }
          }
        }
      }
      
      // Show success message
      alert('Workout logged successfully!');
    } catch (error) {
      console.error('Error saving workout log:', error);
      alert('Failed to save workout log');
    } finally {
      setSaving(false);
    }
  };

  const getMovementName = (movementId: string) => {
    return movements.find(m => m.id === movementId)?.name || 'Unknown Movement';
  };

  const getCategoryColor = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.color || '#6b7280';
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Loading workout...</p>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <p>Workout not found</p>
        </div>
      </div>
    );
  }

  const workoutDate = workout.date instanceof Timestamp 
    ? workout.date.toDate() 
    : new Date(dateParam || Date.now());

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="mb-2"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-3xl font-bold">{workout.title || 'Workout'}</h1>
          <p className="text-muted-foreground">
            {format(workoutDate, 'EEEE, MMMM d, yyyy')}
            {workout.time && ` • ${workout.time}`}
          </p>
        </div>
      </div>

      {/* Workout Notes */}
      {workout.notes && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Coach Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{workout.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Warmups */}
      {workout.warmups && workout.warmups.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Warmup</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-1">
              {workout.warmups.map((warmup, index) => (
                <li key={index}>{warmup.text}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Rounds */}
      {workout.rounds && workout.rounds.map((round, roundIndex) => (
        <Card key={roundIndex} className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>
                  {round.sectionName || `Round ${round.ordinal}`}
                </CardTitle>
                {round.sets > 1 && (
                  <CardDescription>{round.sets} sets</CardDescription>
                )}
              </div>
              {round.sectionColor && (
                <Badge style={{ backgroundColor: round.sectionColor }}>
                  {round.workoutTypeId}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {round.movementUsages?.map((usage, usageIndex) => {
                const key = `${round.ordinal}-${usageIndex}`;
                const exerciseActuals = actuals[key] || { movementId: usage.movementId, sets: [] };
                const movement = movements.find(m => m.id === usage.movementId);
                const category = categories.find(c => c.id === usage.categoryId);
                
                return (
                  <div key={usageIndex} className="border rounded-lg p-4">
                    {/* Movement Name */}
                    <div className="flex items-center gap-2 mb-4">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category?.color || '#6b7280' }}
                      />
                      <h3 className="font-semibold text-lg">
                        {movement?.name || 'Unknown Movement'}
                      </h3>
                    </div>

                    {/* Prescribed */}
                    <div className="mb-4 p-3 bg-muted rounded">
                      <p className="text-sm font-medium mb-2">Prescribed:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {usage.targetWorkload.useReps && (
                          <div>
                            <span className="text-muted-foreground">Reps: </span>
                            <span className="font-medium">{usage.targetWorkload.reps || 'N/A'}</span>
                          </div>
                        )}
                        {usage.targetWorkload.useWeight && (
                          <div>
                            <span className="text-muted-foreground">Weight: </span>
                            <span className="font-medium">
                              {usage.targetWorkload.weight || 'N/A'} {usage.targetWorkload.weightMeasure}
                            </span>
                          </div>
                        )}
                        {usage.targetWorkload.useRPE && usage.targetWorkload.rpe && (
                          <div>
                            <span className="text-muted-foreground">RPE: </span>
                            <span className="font-medium">{usage.targetWorkload.rpe}</span>
                          </div>
                        )}
                        {usage.targetWorkload.useTempo && usage.targetWorkload.tempo && (
                          <div>
                            <span className="text-muted-foreground">Tempo: </span>
                            <span className="font-medium">{usage.targetWorkload.tempo}</span>
                          </div>
                        )}
                      </div>
                      {usage.note && (
                        <p className="text-sm text-muted-foreground mt-2">{usage.note}</p>
                      )}
                    </div>

                    {/* Actual Sets */}
                    <div>
                      <p className="text-sm font-medium mb-3">Your Actual Performance:</p>
                      <div className="space-y-3">
                        {Array.from({ length: round.sets || 1 }).map((_, setIndex) => (
                          <div key={setIndex} className="flex gap-2 items-center p-2 border rounded">
                            <span className="text-sm font-medium w-8">Set {setIndex + 1}:</span>
                            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                              {usage.targetWorkload.useWeight && (
                                <div>
                                  <Label className="text-xs">Weight ({usage.targetWorkload.weightMeasure})</Label>
                                  <Input
                                    type="text"
                                    placeholder={usage.targetWorkload.weight || '0'}
                                    value={exerciseActuals.sets[setIndex]?.weight || ''}
                                    onChange={(e) => handleSetChange(round.ordinal, usageIndex, setIndex, 'weight', e.target.value)}
                                    className="h-8"
                                  />
                                </div>
                              )}
                              {usage.targetWorkload.useReps && (
                                <div>
                                  <Label className="text-xs">Reps</Label>
                                  <Input
                                    type="text"
                                    placeholder={usage.targetWorkload.reps || '0'}
                                    value={exerciseActuals.sets[setIndex]?.reps || ''}
                                    onChange={(e) => handleSetChange(round.ordinal, usageIndex, setIndex, 'reps', e.target.value)}
                                    className="h-8"
                                  />
                                </div>
                              )}
                              {usage.targetWorkload.useRPE && (
                                <div>
                                  <Label className="text-xs">RPE</Label>
                                  <Input
                                    type="text"
                                    placeholder={usage.targetWorkload.rpe || '0'}
                                    value={exerciseActuals.sets[setIndex]?.rpe || ''}
                                    onChange={(e) => handleSetChange(round.ordinal, usageIndex, setIndex, 'rpe', e.target.value)}
                                    className="h-8"
                                  />
                                </div>
                              )}
                              <div>
                                <Label className="text-xs">Notes</Label>
                                <Input
                                  type="text"
                                  placeholder="Notes..."
                                  value={exerciseActuals.sets[setIndex]?.notes || ''}
                                  onChange={(e) => handleSetChange(round.ordinal, usageIndex, setIndex, 'notes', e.target.value)}
                                  className="h-8"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Session Notes and RPE */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Session Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="sessionRPE">Session RPE</Label>
            <Input
              id="sessionRPE"
              type="text"
              placeholder="e.g., 7, 8-9"
              value={sessionRPE}
              onChange={(e) => setSessionRPE(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div>
            <Label htmlFor="athleteNotes">Your Notes</Label>
            <Textarea
              id="athleteNotes"
              placeholder="How did the workout feel? Any observations?"
              value={athleteNotes}
              onChange={(e) => setAthleteNotes(e.target.value)}
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            'Saving...'
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save Workout Log
            </>
          )}
        </Button>
      </div>
    </div>
  );
}




























