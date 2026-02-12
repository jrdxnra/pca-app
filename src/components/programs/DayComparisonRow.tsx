"use client";

import { ProgramWeek, ProgramWorkout } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DayComparisonRowProps {
    dayName: string;
    dayIndex: number;
    weeks: ProgramWeek[];
    programId: string;
    onAddWorkout: (weekId: string, dayIndex: number) => void;
    onEditWorkout: (weekId: string, workoutId: string) => void;
    onDeleteWorkout: (weekId: string, workoutId: string) => void;
    onUpdateWorkout: (weekId: string, workoutId: string, updates: Partial<ProgramWorkout>) => void;
    getMovementName: (movementId: string) => string;
    getCategoryColor: (categoryId: string) => string;
}

export function DayComparisonRow({
    dayName,
    dayIndex,
    weeks,
    programId,
    onAddWorkout,
    onEditWorkout,
    onDeleteWorkout,
    onUpdateWorkout,
    getMovementName,
    getCategoryColor
}: DayComparisonRowProps) {
    // Map this specific day across all weeks
    const workoutsAcrossWeeks = weeks.map(week => {
        return week.workouts.find(w => w.ordinal === dayIndex) || null;
    });

    return (
        <div className="flex h-full flex-col mt-4 border-2 border-gray-200 rounded-xl shadow-sm">
            {/* Day Header */}
            <header className="flex flex-none items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-900 rounded-t-xl px-6 py-3 border-b-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{dayName}</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                    {workoutsAcrossWeeks.filter(w => w).length} / {weeks.length} weeks
                </span>
            </header>

            {/* Horizontal Scrolling Grid */}
            <div className="flex flex-auto flex-col bg-white dark:bg-slate-900 rounded-b-xl overflow-x-auto">
                <div className="grid auto-cols-[minmax(325px,1fr)] grid-flow-col text-sm">
                    {weeks.map((week, weekIndex) => {
                        const workout = workoutsAcrossWeeks[weekIndex];

                        return (
                            <div
                                key={week.id}
                                className="flex flex-col border-r border-gray-100 dark:border-slate-700 last:border-r-0"
                            >
                                {/* Week Label */}
                                <div className="text-center py-2 font-bold border-b bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    Week {week.ordinal}
                                </div>

                                {/* Workout Content */}
                                <div className="p-3 min-h-[200px]">
                                    {workout ? (
                                        <div className="group h-full rounded-xl p-3 transition-all duration-200 bg-secondary/30 border-2 border-transparent hover:shadow-md hover:bg-secondary/50">
                                            <div className="flex flex-col h-full">
                                                <div className="flex-1 space-y-3">
                                                    {/* Workout Title */}
                                                    <div className="flex items-center gap-2">
                                                        <Input
                                                            value={workout.title || ''}
                                                            onChange={(e) => onUpdateWorkout(week.id, workout.id, { title: e.target.value })}
                                                            placeholder="Untitled"
                                                            className="h-7 text-sm font-bold bg-transparent border-none focus-visible:ring-1 focus-visible:ring-ring p-0 px-1 shadow-none"
                                                        />
                                                    </div>

                                                    {/* Rounds */}
                                                    <div className="space-y-3">
                                                        {workout.rounds?.map((round) => (
                                                            <div key={round.id} className="space-y-1.5">
                                                                <div className="flex items-center justify-between px-1">
                                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/70">
                                                                        R{round.ordinal} • {round.sets} sets
                                                                    </span>
                                                                </div>

                                                                {/* Movement Pills */}
                                                                <div className="flex flex-wrap gap-1">
                                                                    {round.movementUsages?.map((usage) => (
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

                                                {/* Action Buttons - Fade in on hover */}
                                                <div className="flex items-center justify-end gap-1 mt-4 pt-2 border-t border-muted-foreground/10 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onEditWorkout(week.id, workout.id)}
                                                        className="h-7 w-7 p-0 hover:bg-background"
                                                    >
                                                        <Edit2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => onDeleteWorkout(week.id, workout.id)}
                                                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Empty State - Dashed placeholder
                                        <button
                                            onClick={() => onAddWorkout(week.id, dayIndex)}
                                            className="h-full w-full border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-lg flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 hover:border-gray-300 dark:hover:border-slate-600 hover:bg-muted/5 transition-all group"
                                        >
                                            <div className="p-2 rounded-full bg-muted/50 group-hover:bg-muted group-hover:scale-110 transition-all mb-2">
                                                <Plus className="h-4 w-4" />
                                            </div>
                                            <span className="text-xs font-medium">Add Workout</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
