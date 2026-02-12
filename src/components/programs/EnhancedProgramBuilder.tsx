"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
  Calendar,
  Clock,
  Dumbbell,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import { Program, ProgramWeek, ProgramWorkout, ProgramRound, ProgramMovementUsage, Movement } from '@/lib/types';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { DayComparisonRow } from './DayComparisonRow';

interface EnhancedProgramBuilderProps {
  program: Program;
  onProgramUpdate: (program: Program) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function EnhancedProgramBuilder({
  program,
  onProgramUpdate,
  onSave,
  onCancel,
  isSaving = false
}: EnhancedProgramBuilderProps) {
  const { movements, fetchMovements } = useMovementStore();
  const { categories, fetchCategories } = useMovementCategoryStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showWeekends, setShowWeekends] = useState(false);
  const [showDayView, setShowDayView] = useState(false);
  const [editingWeek, setEditingWeek] = useState<string | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<{ weekId: string, workoutId: string } | null>(null);
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(new Set());

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

  const handleAddWeek = () => {
    const newWeek: ProgramWeek = {
      id: `week-${Date.now()}`,
      programId: program.id,
      ordinal: (program.weeks?.length || 0) + 1,
      notes: '',
      workouts: [],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };

    onProgramUpdate({
      ...program,
      weeks: [...(program.weeks || []), newWeek]
    });
  };

  const handleAddWorkout = (weekId: string, dayIndex: number) => {
    const newWorkout: ProgramWorkout = {
      id: `workout-${Date.now()}`,
      weekId: weekId,
      ordinal: dayIndex,
      title: '',
      notes: '',
      rounds: [{
        id: `round-${Date.now()}`,
        workoutId: '',
        ordinal: 1,
        sets: 3,
        movementUsages: [],
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      }],
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };

    const updatedProgram = { ...program };
    const weekIndex = updatedProgram.weeks?.findIndex(w => w.id === weekId) || -1;
    if (weekIndex >= 0 && updatedProgram.weeks) {
      updatedProgram.weeks[weekIndex].workouts.push(newWorkout);
      onProgramUpdate(updatedProgram);
    }
  };

  const handleDeleteWorkout = (weekId: string, workoutId: string) => {
    const updatedProgram = { ...program };
    const weekIndex = updatedProgram.weeks?.findIndex(w => w.id === weekId) || -1;
    if (weekIndex >= 0 && updatedProgram.weeks) {
      updatedProgram.weeks[weekIndex].workouts = updatedProgram.weeks[weekIndex].workouts.filter(w => w.id !== workoutId);
      onProgramUpdate(updatedProgram);
    }
  };

  const handleUpdateWorkout = (weekId: string, workoutId: string, updates: Partial<ProgramWorkout>) => {
    const updatedProgram = { ...program };
    const weekIndex = updatedProgram.weeks?.findIndex(w => w.id === weekId) || -1;
    if (weekIndex >= 0 && updatedProgram.weeks) {
      const workoutIndex = updatedProgram.weeks[weekIndex].workouts.findIndex(w => w.id === workoutId);
      if (workoutIndex >= 0) {
        updatedProgram.weeks[weekIndex].workouts[workoutIndex] = {
          ...updatedProgram.weeks[weekIndex].workouts[workoutIndex],
          ...updates
        };
        onProgramUpdate(updatedProgram);
      }
    }
  };

  const handleMoveWeek = (week: ProgramWeek, direction: 'up' | 'down') => {
    if (!program.weeks) return;

    const updatedProgram = { ...program };
    // `updatedProgram.weeks` isn't narrowed by the guard above because it's a copy,
    // so use the already-narrowed `program.weeks`.
    const weeks = [...program.weeks];
    const weekIndex = weeks.findIndex(w => w.id === week.id);
    if (weekIndex === -1) return;

    const targetIndex = direction === 'up' ? weekIndex - 1 : weekIndex + 1;

    if (targetIndex < 0 || targetIndex >= weeks.length) return;

    [weeks[weekIndex], weeks[targetIndex]] = [weeks[targetIndex], weeks[weekIndex]];
    weeks.forEach((w, index) => {
      w.ordinal = index + 1;
    });

    onProgramUpdate({
      ...updatedProgram,
      weeks
    });
  };

  const handleDeleteWeek = (weekId: string) => {
    onProgramUpdate({
      ...program,
      weeks: (program.weeks || []).filter(w => w.id !== weekId)
    });
  };

  const handleDuplicateWeek = (week: ProgramWeek) => {
    const newWeekId = `week-${Date.now()}`;
    const newWeek: ProgramWeek = {
      id: newWeekId,
      programId: program.id,
      ordinal: (program.weeks?.length || 0) + 1,
      notes: week.notes,
      workouts: week.workouts.map(workout => ({
        ...workout,
        id: `workout-${Date.now()}-${Math.random()}`,
        weekId: newWeekId,
        createdAt: new Date() as any,
        updatedAt: new Date() as any
      })),
      createdAt: new Date() as any,
      updatedAt: new Date() as any
    };

    onProgramUpdate({
      ...program,
      weeks: [...(program.weeks || []), newWeek]
    });
  };

  const toggleWeekExpansion = (weekId: string) => {
    const newExpanded = new Set(expandedWeeks);
    if (newExpanded.has(weekId)) {
      newExpanded.delete(weekId);
    } else {
      newExpanded.add(weekId);
    }
    setExpandedWeeks(newExpanded);
  };

  const getWorkoutsForWeek = (week: ProgramWeek) => {
    const workouts = week.workouts || [];
    const days = showWeekends ? 7 : 5;
    const result = [];

    for (let i = 0; i < days; i++) {
      const workout = workouts.find(w => w.ordinal === i);
      result.push(workout || null);
    }

    return result;
  };

  const getDayName = (index: number) => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days[index];
  };

  const days = showWeekends ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

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
            <label className="text-xs font-light mb-1">Program Title</label>
            <Input
              placeholder="e.g., 12-Week Strength Program"
              value={program.name}
              onChange={(e) => onProgramUpdate({ ...program, name: e.target.value })}
              className="h-10 text-lg font-semibold"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="outline" onClick={onSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Program'}
          </Button>
        </div>
      </div>

      {/* Program Controls */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5 icon-schedule" />
            Program Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Switch
                id="showWeekends"
                checked={showWeekends}
                onCheckedChange={setShowWeekends}
              />
              <label htmlFor="showWeekends" className="text-sm">Show weekends</label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="showDayView"
                checked={showDayView}
                onCheckedChange={setShowDayView}
              />
              <label htmlFor="showDayView" className="text-sm">Day view</label>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Total weeks:</label>
              <Input
                type="number"
                min="1"
                max="52"
                value={program.weeks?.length || 0}
                className="w-20 h-8"
                readOnly
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

      {/* Weeks or Days View */}
      <div className="space-y-4">
        {showDayView ? (
          // Day View - Coachella Style: Each day shows all weeks horizontally
          days.map((dayName, dayIndex) => (
            <DayComparisonRow
              key={dayName}
              dayName={dayName}
              dayIndex={dayIndex}
              weeks={program.weeks || []}
              programId={program.id}
              onAddWorkout={handleAddWorkout}
              onEditWorkout={(weekId, workoutId) => setEditingWorkout({ weekId, workoutId })}
              onDeleteWorkout={handleDeleteWorkout}
              onUpdateWorkout={handleUpdateWorkout}
              getMovementName={getMovementName}
              getCategoryColor={getCategoryColor}
            />
          ))
        ) : (
          // Week View - Traditional: Each week shows all days vertically
          program.weeks?.map((week, weekIndex) => {
            const workouts = getWorkoutsForWeek(week);
            const isExpanded = expandedWeeks.has(week.id);
            const isFirst = weekIndex === 0;
            const isLast = weekIndex === (program.weeks?.length || 0) - 1;

            return (
              <Card key={week.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleWeekExpansion(week.id)}
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
                        <span className="text-lg font-semibold">Week {week.ordinal}</span>
                        <Badge variant="secondary">{workouts.filter(w => w).length} workouts</Badge>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => handleDuplicateWeek(week)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate Week
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        {!isFirst && (
                          <DropdownMenuItem onClick={() => handleMoveWeek(week, 'up')}>
                            <ArrowUp className="h-4 w-4 mr-2" />
                            Move Up
                          </DropdownMenuItem>
                        )}
                        {!isLast && (
                          <DropdownMenuItem onClick={() => handleMoveWeek(week, 'down')}>
                            <ArrowDown className="h-4 w-4 mr-2" />
                            Move Down
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Delete Week ${week.ordinal}?`)) {
                              handleDeleteWeek(week.id);
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2 icon-delete" />
                          Delete Week
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent>
                    {/* Day Headers */}
                    <div className={`grid gap-0 border-b bg-muted/50 mb-4`} style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                      {days.map((day) => (
                        <div key={day} className="p-3 text-center text-sm font-medium text-muted-foreground border-r">
                          {day}
                        </div>
                      ))}
                    </div>

                    {/* Workout Grid */}
                    <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}>
                      {workouts.map((workout, dayIndex) => (
                        <div
                          key={dayIndex}
                          className={`group min-h-[160px] rounded-xl p-3 transition-all duration-200 border-2 ${workout
                            ? 'bg-secondary/30 border-transparent shadow-sm hover:shadow-md hover:bg-secondary/50'
                            : 'border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 hover:bg-muted/5'
                            }`}
                        >
                          {workout ? (
                            <div className="flex flex-col h-full">
                              <div className="flex-1 space-y-3">
                                {/* Workout Header */}
                                <div className="flex items-center gap-2">
                                  <Input
                                    value={workout.title || ''}
                                    onChange={(e) => handleUpdateWorkout(week.id, workout.id, { title: e.target.value })}
                                    placeholder="Untitled"
                                    className="h-7 text-sm font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-ring p-0 px-1 shadow-none"
                                  />
                                </div>

                                <div className="space-y-3">
                                  {workout.rounds?.map((round, roundIndex) => (
                                    <div key={round.id} className="space-y-1.5">
                                      <div className="flex items-center justify-between px-1">
                                        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">
                                          R{round.ordinal} • {round.sets} sets
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap gap-1">
                                        {round.movementUsages?.map((usage, usageIndex) => (
                                          <div
                                            key={usage.id}
                                            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background border border-border/50 shadow-sm max-w-full"
                                            title={getMovementName(usage.movementId)}
                                          >
                                            <div
                                              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                              style={{ backgroundColor: getCategoryColor(usage.movement?.categoryId || '') }}
                                            />
                                            <span className="text-[11px] font-medium truncate leading-tight">
                                              {getMovementName(usage.movementId)}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-1 mt-4 pt-2 border-t border-muted-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingWorkout({ weekId: week.id, workoutId: workout.id })}
                                  className="h-7 w-7 p-0 hover:bg-background"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleDeleteWorkout(week.id, workout.id)}
                                  className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => handleAddWorkout(week.id, dayIndex)}
                              className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground transition-colors"
                            >
                              <div className="p-2 rounded-full bg-muted/50 group-hover:bg-muted group-hover:scale-110 transition-all">
                                <Plus className="h-4 w-4" />
                              </div>
                              <span className="text-xs font-medium">Add Workout</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })
        )}


        {/* Add Week Button */}
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={handleAddWeek}
            className="border-dashed"
          >
            <Plus className="h-4 w-4 mr-1.5 icon-add" />
            Add Week
          </Button>
        </div>
      </div>
    </div>
  );
}
