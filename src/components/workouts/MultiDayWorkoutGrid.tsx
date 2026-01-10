"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkoutEditor } from './WorkoutEditor';
import { ClientWorkout, Movement, MovementCategory, ClientWorkoutRound } from '@/lib/types';
import { WorkoutType } from '@/lib/firebase/services/workoutTypes';
import { format } from 'date-fns';

interface DayWorkout {
  date: Date;
  category: string;
  workout?: ClientWorkout;
}

interface MultiDayWorkoutGridProps {
  days: DayWorkout[];
  movements: Movement[];
  categories: MovementCategory[];
  workoutTypes: WorkoutType[];
  visibleColumns: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  onColumnVisibilityChange: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
  onSaveWorkout: (workout: ClientWorkout, workoutData: Partial<ClientWorkout>) => Promise<void>;
  onCreateWorkout: (date: Date, category: string, workoutData: Partial<ClientWorkout>) => Promise<void>;
}

export function MultiDayWorkoutGrid({
  days,
  movements,
  categories,
  workoutTypes,
  visibleColumns,
  onColumnVisibilityChange,
  onSaveWorkout,
  onCreateWorkout
}: MultiDayWorkoutGridProps) {
  if (days.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No days match the selected categories</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-4 min-w-min">
        {days.map((day, index) => (
          <Card key={index} className="flex-shrink-0 w-[600px]">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-gray-700">
                    {format(day.date, 'EEEE')}
                  </div>
                  <div className="text-lg font-bold">
                    {format(day.date, 'MMM d, yyyy')}
                  </div>
                </div>
                <div className="text-sm font-medium text-indigo-600">
                  {day.category}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {day.workout ? (
                <WorkoutEditor
                  workout={day.workout}
                  isOpen={true}
                  onClose={() => {}}
                  onSave={(workoutData) => onSaveWorkout(day.workout!, workoutData)}
                  isCreating={false}
                  isInline={true}
                  expandedInline={true}
                />
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p className="mb-4">No workout for this day</p>
                  <button
                    onClick={() => onCreateWorkout(day.date, day.category, {})}
                    className="text-indigo-600 hover:text-indigo-700 font-medium"
                  >
                    + Create Workout
                  </button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

