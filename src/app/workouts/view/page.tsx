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
import { calculateOneRepMax, calculateWeightFromOneRepMax, calculateTuchscherer } from '@/lib/utils/rpe-calculator';
import { getRecentExercisePerformance } from '@/lib/firebase/services/clients';
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

// Utility function for unit conversion
const convertWeight = (weight: number, fromUnit: 'lbs' | 'kg', toUnit: 'lbs' | 'kg'): number => {
  if (fromUnit === toUnit) return weight;
  if (fromUnit === 'lbs' && toUnit === 'kg') {
    return Math.round(weight / 2.205 * 10) / 10; // Convert lbs to kg, round to 1 decimal
  }
  if (fromUnit === 'kg' && toUnit === 'lbs') {
    return Math.round(weight * 2.205 * 10) / 10; // Convert kg to lbs, round to 1 decimal
  }
  return weight;
};

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
  const [suggestedWeights, setSuggestedWeights] = useState<Record<string, { value: string; unit: string }>>({}); // key: movementId, value: { suggested weight, unit }

  useEffect(() => {
    fetchMovements();
    fetchCategories();
  }, [fetchMovements, fetchCategories]);

  useEffect(() => {
    if (workoutId) {
      loadWorkout();
    }
  }, [workoutId]);

  // Load suggested weights based on client's 1RM history
  useEffect(() => {
    const loadSuggestedWeights = async () => {
      if (!clientId || !workout?.rounds) return;

      try {
        const weights: Record<string, { value: string; unit: string }> = {};

        // Get unique movements from the workout
        const uniqueMovements = new Map<string, ClientWorkoutMovementUsage>();
        workout.rounds.forEach(round => {
          round.movementUsages?.forEach(usage => {
            if (!uniqueMovements.has(usage.movementId)) {
              uniqueMovements.set(usage.movementId, usage);
            }
          });
        });

        console.log('[Suggestions] Loading for movements:', Array.from(uniqueMovements.keys()));

        // Calculate suggested weight for each movement
        for (const [movementId, usage] of uniqueMovements.entries()) {
          try {
            const performance = await getRecentExercisePerformance(clientId, movementId);
            console.log(`[Suggestions] Movement ${movementId}:`, performance);

            if (performance?.estimatedOneRepMax) {
              let suggestedWeight = 0;

              // Priority order for calculating suggested weight:

              // 1. TEMPO: If tempo is set, use 67.5% of 1RM (midpoint of 65-70%)
              if (usage.targetWorkload.useTempo && usage.targetWorkload.tempo) {
                suggestedWeight = performance.estimatedOneRepMax * 0.675;
              }
              // 2. PERCENTAGE: If percentage is set, use that percentage of 1RM
              else if (usage.targetWorkload.usePercentage && usage.targetWorkload.percentage) {
                suggestedWeight = performance.estimatedOneRepMax * (usage.targetWorkload.percentage / 100);
              }
              // 3. RPE + REPS: If both RPE and reps are prescribed, use Tuchscherer (most accurate)
              else if (usage.targetWorkload.useRPE && usage.targetWorkload.rpe && usage.targetWorkload.useReps && usage.targetWorkload.reps) {
                const rpeStr = usage.targetWorkload.rpe;
                const rpeValue = parseFloat(rpeStr);
                const repStr = usage.targetWorkload.reps;
                const repParts = repStr.split('-').map(r => parseInt(r.trim()));
                const targetReps = repParts.length > 1
                  ? Math.round((repParts[0] + repParts[1]) / 2)
                  : repParts[0];

                if (!isNaN(rpeValue) && targetReps > 0) {
                  // Tuchscherer formula takes RPE into account
                  suggestedWeight = calculateTuchscherer(
                    performance.estimatedOneRepMax,
                    targetReps,
                    rpeValue
                  );
                }
              }
              // 4. REPS ONLY: If only reps are prescribed, use rep-based formula
              else if (usage.targetWorkload.useReps && usage.targetWorkload.reps) {
                const repStr = usage.targetWorkload.reps;
                const repParts = repStr.split('-').map(r => parseInt(r.trim()));
                const targetReps = repParts.length > 1
                  ? Math.round((repParts[0] + repParts[1]) / 2)
                  : repParts[0];

                if (targetReps > 0) {
                  suggestedWeight = calculateWeightFromOneRepMax(
                    performance.estimatedOneRepMax,
                    targetReps
                  );
                }
              }
              // 5. RPE ONLY: Can't calculate weight from RPE alone without reps, so skip

              if (suggestedWeight > 0) {
                // Determine the unit of the stored 1RM (assume it's the same as the current usage)
                // If units don't match, convert
                const storedUnit = (usage.targetWorkload.weightMeasure || 'lbs') as 'lbs' | 'kg';
                if (storedUnit !== usage.targetWorkload.weightMeasure) {
                  suggestedWeight = convertWeight(
                    suggestedWeight,
                    storedUnit,
                    usage.targetWorkload.weightMeasure as 'lbs' | 'kg'
                  );
                }

                weights[movementId] = {
                  value: (Math.round(suggestedWeight * 10) / 10).toString(), // Round to 1 decimal and convert to string
                  unit: usage.targetWorkload.weightMeasure || 'lbs'
                };
              }
            }
          } catch (error) {
            console.error(`Error loading performance for movement ${movementId}:`, error);
          }
        }

        setSuggestedWeights(weights);
      } catch (error) {
        console.error('Error loading suggested weights:', error);
      }
    };

    loadSuggestedWeights();
  }, [clientId, workout]);

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
      console.log('[Save] Updating recent performance for exercises:', exercises);
      for (const exercise of exercises) {
        if (exercise.actualSets.length > 0 && exercise.movementId) {
          // Calculate average weight (handle cases where weight might vary)
          const weights = exercise.actualSets.map(s => s.weight).filter(w => w > 0);
          const reps = exercise.actualSets.map(s => s.reps).filter(r => r > 0);
          const rpeValues = exercise.actualSets.map(s => s.actualRPE).filter(r => r > 0);

          console.log(`[Save] Exercise ${exercise.movementId}: weights=${weights}, reps=${reps}`);

          if (weights.length > 0 && reps.length > 0) {
            // Use the first set's weight as the representative weight (most common pattern)
            const avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
            const weightStr = Math.round(avgWeight).toString();

            // Create rep range from min to max reps
            const minReps = Math.min(...reps);
            const maxReps = Math.max(...reps);
            const repRange = minReps === maxReps ? minReps.toString() : `${minReps}-${maxReps}`;

            // Calculate 1RM using multiple formulas and average them
            // Use the average weight and a representative rep count
            const repForCalculation = Math.round((minReps + maxReps) / 2);

            // Use RPE if available for more accurate 1RM calculation
            const representativeRPE = rpeValues.length > 0 ? rpeValues[0] : undefined;

            const oneRepMaxResults = calculateOneRepMax(
              Math.round(avgWeight),
              repForCalculation,
              representativeRPE
            );

            // Get the average 1RM (last result in the array is always the average)
            const averageResult = oneRepMaxResults.find(r => r.formula === 'average');
            const estimatedOneRepMax = averageResult?.estimatedOneRepMax ||
              oneRepMaxResults[0]?.estimatedOneRepMax ||
              Math.round(avgWeight);

            // Determine if Tuchscherer RPE formula was used in the calculation
            const usedRPE = representativeRPE !== undefined && oneRepMaxResults.some(r => r.formula === 'tuchscherer');

            console.log(`[Save] Updating perf: movement=${exercise.movementId}, weight=${weightStr}, reps=${repRange}, 1RM=${estimatedOneRepMax}`);

            // Update client's recent performance with calculated 1RM and RPE
            try {
              await updateRecentExercisePerformance(
                clientId,
                exercise.movementId,
                weightStr,
                repRange,
                estimatedOneRepMax,
                representativeRPE,  // Pass RPE value
                usedRPE  // Pass flag indicating if RPE calculation was used
              );
              console.log(`[Save] Successfully updated performance for ${exercise.movementId}`);
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
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Prescribed:</p>
                        <Badge variant="outline" className="text-xs">
                          💡 Suggestions based on these values
                        </Badge>
                      </div>
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
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium">Your Actual Performance:</p>
                        <span className="text-xs text-muted-foreground">Log what actually happened</span>
                      </div>
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
                                    placeholder={
                                      suggestedWeights[usage.movementId]
                                        ? `Suggested: ${suggestedWeights[usage.movementId].value}`
                                        : usage.targetWorkload.weight || '0'
                                    }
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
                                  <Label className="text-xs">
                                    Actual RPE
                                    {usage.targetWorkload.rpe && (
                                      <span className="text-muted-foreground ml-1">(prescribed: {usage.targetWorkload.rpe})</span>
                                    )}
                                  </Label>
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




























