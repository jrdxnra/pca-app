"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  Plus, 
  Edit2, 
  Save,
  X,
  MoreVertical,
  GripVertical,
  Search,
  Filter,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Clock,
  Dumbbell,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Eye
} from 'lucide-react';
import { WorkoutRound, WorkoutExercise, Movement, MovementCategory } from '@/lib/types';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { cn } from '@/lib/utils';

interface WorkoutTemplateBuilderProps {
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function WorkoutTemplateBuilder({ 
  onSave, 
  onCancel, 
  isSaving = false 
}: WorkoutTemplateBuilderProps) {
  const {
    builderTemplate,
    addRound,
    updateRound,
    removeRound,
    reorderRounds,
    addExercise,
    updateExercise,
    removeExercise,
    reorderExercises,
    setWorkoutName,
    setWorkoutNotes,
    setWorkoutDuration,
    setWorkoutType,
  } = useWorkoutStore() as any;

  const { movements, fetchMovements } = useMovementStore();
  const { categories, fetchCategories } = useMovementCategoryStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingRound, setEditingRound] = useState<number | null>(null);
  const [editingExercise, setEditingExercise] = useState<{roundIndex: number, exerciseIndex: number} | null>(null);
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set([0])); // First round expanded by default

  useEffect(() => {
    fetchMovements();
    fetchCategories();
  }, [fetchMovements, fetchCategories]);

  // Filter movements based on search and category
  const filteredMovements = movements.filter(movement => {
    const matchesSearch = movement.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || !selectedCategory || movement.categoryId === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getMovementName = (movementId: string) => {
    const movement = movements.find(m => m.id === movementId);
    return movement?.name || 'Unknown Movement';
  };

  const getCategoryName = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Unknown';
  };

  const getCategoryColor = (categoryId: string) => {
    const category = categories.find(c => c.id === categoryId);
    return category?.color || '#6b7280';
  };

  const handleAddRound = () => {
    const newRound: any = {
      id: `round-${Date.now()}`,
      workoutId: '',
      ordinal: (builderTemplate.rounds?.length || 0) + 1,
      sets: 3,
      movementUsages: [],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };
    addRound(newRound);
  };

  const handleAddExercise = (roundIndex: number) => {
    const newExercise: any = {
      id: `exercise-${Date.now()}`,
      roundId: builderTemplate.rounds?.[roundIndex]?.id || '',
      ordinal: (builderTemplate.rounds?.[roundIndex]?.movementUsages?.length || 0) + 1,
      movementId: '',
      targetWorkload: {
        pace: 0,
        reps: 0,
        weight: 0,
        distance: 0,
        time: 0,
        rpe: 0
      },
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };
    addExercise(roundIndex, newExercise);
  };

  const handleUpdateExercise = (roundIndex: number, exerciseIndex: number, updates: any) => {
    updateExercise(roundIndex, exerciseIndex, updates);
  };

  const handleRemoveExercise = (roundIndex: number, exerciseIndex: number) => {
    removeExercise(roundIndex, exerciseIndex);
  };

  const handleRemoveRound = (roundIndex: number) => {
    removeRound(roundIndex);
  };

  const toggleRoundExpansion = (roundIndex: number) => {
    const newExpanded = new Set(expandedRounds);
    if (newExpanded.has(roundIndex)) {
      newExpanded.delete(roundIndex);
    } else {
      newExpanded.add(roundIndex);
    }
    setExpandedRounds(newExpanded);
  };

  const handleMoveRound = (roundIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? roundIndex - 1 : roundIndex + 1;
    if (targetIndex >= 0 && targetIndex < (builderTemplate.rounds?.length || 0)) {
      reorderRounds(roundIndex, targetIndex);
    }
  };

  const getWorkoutTypeColor = (type: string) => {
    const workoutType = type.toLowerCase();
    if (workoutType.includes('strength') || workoutType.includes('power')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (workoutType.includes('conditioning') || workoutType.includes('cardio') || workoutType.includes('esd')) return 'bg-red-100 text-red-800 border-red-200';
    if (workoutType.includes('skill') || workoutType.includes('mobility')) return 'bg-green-100 text-green-800 border-green-200';
    if (workoutType.includes('recovery') || workoutType.includes('rest')) return 'bg-gray-100 text-gray-800 border-gray-200';
    return 'bg-purple-100 text-purple-800 border-purple-200';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-6">
        <div className="flex items-center gap-4 flex-1">
          <Button variant="outline" size="sm" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" />
            Back
          </Button>
          
          <div className="flex flex-col flex-1 max-w-md">
            <label className="text-xs font-light mb-1">Workout Template Name</label>
            <Input
              placeholder="e.g., Upper Body Strength"
              value={builderTemplate.name || ''}
              onChange={(e) => setWorkoutName(e.target.value)}
              className="h-10 text-lg font-semibold"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Template'}
          </Button>
        </div>
      </div>

      {/* Workout Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Workout Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-light mb-1 block">Workout Type</label>
              <Select value={builderTemplate.type || ''} onValueChange={setWorkoutType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="power">Power</SelectItem>
                  <SelectItem value="hypertrophy">Hypertrophy</SelectItem>
                  <SelectItem value="conditioning">Conditioning</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="mobility">Mobility</SelectItem>
                  <SelectItem value="skill">Skill</SelectItem>
                  <SelectItem value="recovery">Recovery</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-xs font-light mb-1 block">Duration (minutes)</label>
              <Input
                type="number"
                placeholder="60"
                value={builderTemplate.duration || ''}
                onChange={(e) => setWorkoutDuration(parseInt(e.target.value) || 0)}
              />
            </div>
            
            <div>
              <label className="text-xs font-light mb-1 block">Notes</label>
              <Textarea
                placeholder="Workout notes..."
                value={builderTemplate.notes || ''}
                onChange={(e) => setWorkoutNotes(e.target.value)}
                className="min-h-[40px]"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Add Panel */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Plus className="h-5 w-5 icon-add" />
            Quick Add Movements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="text-xs font-light mb-1 block">Search Movements</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search movements..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="w-48">
              <label className="text-xs font-light mb-1 block">Filter by Category</label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
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
          </div>

          {/* Movement Grid */}
          {filteredMovements.length > 0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {filteredMovements.slice(0, 20).map((movement) => (
                <div
                  key={movement.id}
                  className="p-2 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  title={`Add ${movement.name} to workout`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div 
                      className="w-2 h-2 rounded-full" 
                      style={{ backgroundColor: getCategoryColor(movement.categoryId) }}
                    />
                    <span className="text-sm font-medium truncate">{movement.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getCategoryName(movement.categoryId)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rounds */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Workout Rounds</h3>
          <Button variant="outline" onClick={handleAddRound} size="sm">
            <Plus className="h-4 w-4 mr-1.5 icon-add" />
            Add Round
          </Button>
        </div>

        {builderTemplate.rounds?.map((round: any, roundIndex: number) => {
          const isExpanded = expandedRounds.has(roundIndex);
          const isFirst = roundIndex === 0;
          const isLast = roundIndex === (builderTemplate.rounds?.length || 0) - 1;
          
          return (
            <Card key={round.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleRoundExpansion(roundIndex)}
                      className="p-1"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-lg font-semibold">Round {round.ordinal}</span>
                      <Badge variant="secondary">{round.sets} sets</Badge>
                      <Badge variant="outline">{round.movementUsages?.length || 0} exercises</Badge>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleAddExercise(roundIndex)}>
                        <Plus className="h-4 w-4 mr-1.5 icon-add" />
                        Add Exercise
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {!isFirst && (
                        <DropdownMenuItem onClick={() => handleMoveRound(roundIndex, 'up')}>
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Move Up
                        </DropdownMenuItem>
                      )}
                      {!isLast && (
                        <DropdownMenuItem onClick={() => handleMoveRound(roundIndex, 'down')}>
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Move Down
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => {
                          if (confirm(`Delete Round ${round.ordinal}?`)) {
                            handleRemoveRound(roundIndex);
                          }
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2 icon-delete" />
                        Delete Round
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent>
                  <div className="space-y-4">
                    {/* Round Settings */}
                    <div className="flex items-center gap-4">
                      <div>
                        <label className="text-xs font-light mb-1 block">Sets</label>
                        <Input
                          type="number"
                          min="1"
                          value={round.sets}
                          onChange={(e) => updateRound(roundIndex, { sets: parseInt(e.target.value) || 1 })}
                          className="w-20"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs font-light mb-1 block">Round Notes</label>
                        <Input
                          placeholder="Round notes..."
                          value={round.notes || ''}
                          onChange={(e) => updateRound(roundIndex, { notes: e.target.value })}
                        />
                      </div>
                    </div>

                    {/* Exercises */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">Exercises</h4>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => handleAddExercise(roundIndex)}
                        >
                          <Plus className="h-4 w-4 mr-1.5 icon-add" />
                          Add Exercise
                        </Button>
                      </div>

                      {round.movementUsages?.map((exercise: any, exerciseIndex: number) => (
                        <div key={exercise.id} className="border rounded-lg p-4 bg-muted/20">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <label className="text-xs font-light mb-1 block">Movement</label>
                              <Select
                                value={exercise.movementId || ''}
                                onValueChange={(value) => handleUpdateExercise(roundIndex, exerciseIndex, { movementId: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select movement" />
                                </SelectTrigger>
                                <SelectContent>
                                  {movements.map((movement) => (
                                    <SelectItem key={movement.id} value={movement.id}>
                                      <div className="flex items-center gap-2">
                                        <div 
                                          className="w-2 h-2 rounded-full" 
                                          style={{ backgroundColor: getCategoryColor(movement.categoryId) }}
                                        />
                                        {movement.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="flex gap-2">
                              <div>
                                <label className="text-xs font-light mb-1 block">Reps</label>
                                <Input
                                  type="number"
                                  placeholder="10"
                                  value={exercise.targetWorkload?.reps || ''}
                                  onChange={(e) => handleUpdateExercise(roundIndex, exerciseIndex, {
                                    targetWorkload: {
                                      ...exercise.targetWorkload,
                                      reps: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="w-20"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-light mb-1 block">Weight</label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={exercise.targetWorkload?.weight || ''}
                                  onChange={(e) => handleUpdateExercise(roundIndex, exerciseIndex, {
                                    targetWorkload: {
                                      ...exercise.targetWorkload,
                                      weight: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="w-20"
                                />
                              </div>
                              <div>
                                <label className="text-xs font-light mb-1 block">RPE</label>
                                <Input
                                  type="number"
                                  min="1"
                                  max="10"
                                  placeholder="7"
                                  value={exercise.targetWorkload?.rpe || ''}
                                  onChange={(e) => handleUpdateExercise(roundIndex, exerciseIndex, {
                                    targetWorkload: {
                                      ...exercise.targetWorkload,
                                      rpe: parseInt(e.target.value) || 0
                                    }
                                  })}
                                  className="w-20"
                                />
                              </div>
                            </div>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleRemoveExercise(roundIndex, exerciseIndex)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4 icon-delete" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {(!builderTemplate.rounds || builderTemplate.rounds.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Rounds Yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add your first round to start building this workout template
                </p>
                <Button variant="outline" onClick={handleAddRound}>
                  <Plus className="h-4 w-4 mr-1.5 icon-add" />
                  Add First Round
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
