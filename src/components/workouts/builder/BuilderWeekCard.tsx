"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { WorkoutEditor, WorkoutEditorHandle } from '@/components/workouts/WorkoutEditor';
import { ClientProgramPeriod, ClientWorkout, ClientWorkoutRound } from '@/lib/types';

interface BuilderWeekCardProps {
  week: Date[];
  weekIndex: number;
  displayWeekNumber: number;
  isCurrentWeek: boolean;
  isPastWeek: boolean;
  showViewedIndicator: boolean;
  weekSettings: {
    showWeekends: boolean;
    weekOrder: 'ascending' | 'descending';
  };
  selectedPeriod: ClientProgramPeriod | null;
  workouts: any[];
  editingWorkouts: Record<string, any>;
  creatingWorkouts: Record<string, {
    date: Date;
    category: string;
    color: string;
    appliedTemplateId?: string;
  }>;
  openDates: Set<string>;
  selectedCategories: string[];
  workoutCategories: any[];
  workoutStructureTemplates: any[];
  visibleColumns: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  editorRefs: React.MutableRefObject<Record<string, WorkoutEditorHandle | null>>;
  savingEditors: Set<string>;
  clientId: string | null;
  eventId?: string | null;
  // Helper functions
  getDateKey: (date: Date) => string;
  getWorkoutForDate: (date: Date) => any | null;
  isDateInPeriod: (date: Date) => boolean;
  getCategoryForDate: (date: Date) => { category: string; color: string } | null;
  getEventIdForWorkout: (workout: ClientWorkout | null, dateKey: string) => string | undefined;
  generateInitialRounds: (templateId?: string) => ClientWorkoutRound[];
  // Handlers
  onEditWorkout: (workout: any) => void;
  onCreateWorkout: (date: Date, category: string, color: string, structureId?: string) => void;
  onCloseEditor: (dateKey: string, closedWorkoutId?: string) => void;
  onSaveWorkout: (workoutData: any, dateKey: string) => Promise<void>;
  onSaveButtonClick: (dateKey: string) => Promise<void>;
  onDeleteWorkout: (workoutId: string | undefined, dateKey: string) => void;
  onShowDeleteConfirmation: (workoutId: string | undefined, dateKey: string) => void;
  onColumnVisibilityChange: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
}

export function BuilderWeekCard({
  week,
  weekIndex,
  displayWeekNumber,
  isCurrentWeek,
  isPastWeek,
  showViewedIndicator,
  weekSettings,
  selectedPeriod,
  workouts,
  editingWorkouts,
  creatingWorkouts,
  openDates,
  selectedCategories,
  workoutCategories,
  workoutStructureTemplates,
  visibleColumns,
  editorRefs,
  savingEditors,
  clientId,
  eventId,
  getDateKey,
  getWorkoutForDate,
  isDateInPeriod,
  getCategoryForDate,
  getEventIdForWorkout,
  generateInitialRounds,
  onEditWorkout,
  onCreateWorkout,
  onCloseEditor,
  onSaveWorkout,
  onSaveButtonClick,
  onDeleteWorkout,
  onShowDeleteConfirmation,
  onColumnVisibilityChange
}: BuilderWeekCardProps) {
  // Calculate week label
  const todayWeekStart = new Date();
  const dayOfWeek = todayWeekStart.getDay();
  const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  todayWeekStart.setDate(todayWeekStart.getDate() - daysFromMonday);
  todayWeekStart.setHours(0, 0, 0, 0);
  
  const weekStart = new Date(week[0]);
  weekStart.setHours(0, 0, 0, 0);
  const msPerDay = 24 * 60 * 60 * 1000;
  const daysDiff = Math.round((weekStart.getTime() - todayWeekStart.getTime()) / msPerDay);
  const weekDiff = Math.round(daysDiff / 7);
  
  const getWeekLabel = () => {
    if (isCurrentWeek) return 'Current Week';
    if (weekDiff === -1) return 'Last Week';
    if (weekDiff === 1) return '1 Week Out';
    if (weekDiff === 2) return '2 Weeks Out';
    if (weekDiff < 0) return `${Math.abs(weekDiff)} Weeks Ago`;
    return `${weekDiff} Weeks Out`;
  };

  // Check if this week has any active editors
  const weekEditingWorkouts = Object.entries(editingWorkouts).filter(([dateKey]) => {
    return week.some(weekDate => getDateKey(weekDate) === dateKey);
  });

  const weekCreatingWorkouts = Object.entries(creatingWorkouts).filter(([dateKey]) => {
    return week.some(weekDate => getDateKey(weekDate) === dateKey);
  });

  const weekOpenDates = week.filter(weekDate => {
    const dateKey = getDateKey(weekDate);
    return openDates.has(dateKey);
  });

  const hasActiveEditors = weekEditingWorkouts.length > 0 || weekCreatingWorkouts.length > 0 || weekOpenDates.length > 0;

  return (
    <div
      key={`week-${weekIndex}-${Object.keys(editingWorkouts).length}-${Object.keys(creatingWorkouts).length}-${openDates.size}`}
      className={`bg-white rounded-lg shadow-sm border overflow-hidden ${
        isCurrentWeek 
          ? 'border-blue-400 ring-2 ring-blue-100' 
          : showViewedIndicator
            ? 'border-purple-400 ring-2 ring-purple-100'
            : isPastWeek 
              ? 'border-gray-200 opacity-75' 
              : 'border-gray-200'
      }`}
    >
      {/* Week Header */}
      <div className={`border-b border-gray-200 px-4 py-2 ${
        isCurrentWeek 
          ? 'bg-gradient-to-r from-blue-50 to-blue-100' 
          : showViewedIndicator
            ? 'bg-gradient-to-r from-purple-50 to-purple-100'
            : isPastWeek
              ? 'bg-gradient-to-r from-gray-100 to-gray-150'
              : 'bg-gradient-to-r from-gray-50 to-gray-100'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className={`text-sm ${
              isCurrentWeek 
                ? 'font-bold text-blue-800' 
                : showViewedIndicator 
                  ? 'font-bold text-purple-800'
                  : 'font-semibold text-gray-800'
            }`}>
              {week[0]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {week[week.length - 1]?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isCurrentWeek 
                ? 'bg-blue-500 text-white font-bold' 
                : showViewedIndicator
                  ? 'bg-purple-500 text-white font-bold'
                  : isPastWeek
                    ? 'bg-gray-400 text-white font-medium'
                    : 'bg-gray-200 text-gray-600 font-medium'
            }`}>
              {getWeekLabel()}
              {showViewedIndicator && ' • Viewing'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {hasActiveEditors && (
              <div className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full font-medium">
                {weekEditingWorkouts.length + weekCreatingWorkouts.length} editing
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Days Grid */}
      <div className={`grid ${weekSettings.showWeekends ? 'grid-cols-7' : 'grid-cols-5'} divide-x divide-gray-200`}>
        {/* Day Headers */}
        {(weekSettings.showWeekends
          ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
          : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
        ).map((day, index) => (
          <div key={index} className="bg-gray-50 text-center text-xs font-semibold text-gray-700 py-3 border-b border-gray-200">
            <div className="hidden sm:block">{day}</div>
            <div className="sm:hidden">{day.slice(0, 3)}</div>
          </div>
        ))}

        {/* Day Cells */}
        {week
          .filter((date) => {
            if (weekSettings.showWeekends) return true;
            const dayOfWeek = date.getDay();
            return dayOfWeek !== 0 && dayOfWeek !== 6;
          })
          .map((date, dayIndex) => {
            const workout = getWorkoutForDate(date);
            const inPeriod = isDateInPeriod(date);
            const categoryInfo = getCategoryForDate(date);
            const dateKey = getDateKey(date);
            const isEditingThisDate = openDates.has(dateKey);
            const editingWorkout = editingWorkouts[dateKey];
            const createWorkoutData = creatingWorkouts[dateKey];
            const isToday = date.toDateString() === new Date().toDateString();

            // Filter by selected categories
            const shouldShow = !categoryInfo || selectedCategories.length === 0 || selectedCategories.includes(categoryInfo.category);

            if (!shouldShow) {
              return (
                <div key={dayIndex} className="min-h-[160px] bg-gray-50 opacity-30">
                  <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
                    <div className="text-sm font-semibold text-gray-400">{date.getDate()}</div>
                  </div>
                </div>
              );
            }

            return (
              <div key={dayIndex} className={`min-h-[160px] relative ${
                isEditingThisDate && !isToday 
                  ? 'bg-amber-50 border-2 border-amber-400' 
                  : isToday 
                    ? 'bg-blue-50 border-2 border-blue-300' 
                    : inPeriod 
                      ? 'bg-white' 
                      : 'bg-gray-50'
              } ${!inPeriod && !isToday && !isEditingThisDate ? 'opacity-60' : ''}`}>

                {/* Date Header */}
                <div className={`px-3 py-2 border-b border-gray-100 ${
                  isEditingThisDate && !isToday
                    ? 'bg-amber-100'
                    : isToday 
                      ? 'bg-blue-100' 
                      : 'bg-gray-50'
                }`}>
                  <div className={`text-sm font-semibold ${
                    isEditingThisDate && !isToday
                      ? 'text-amber-800 font-bold'
                      : isToday 
                        ? 'text-blue-700 font-bold' 
                        : 'text-gray-700'
                  }`}>
                    {date.getDate()}
                  </div>
                  {isEditingThisDate && (
                    <div className={`text-xs font-medium ${
                      isToday ? 'text-blue-600' : 'text-amber-700'
                    }`}>
                      ✏️ Editing {editingWorkout?.categoryName || createWorkoutData?.category || ''}
                    </div>
                  )}
                </div>

                {/* Workout Content */}
                {workout ? (
                  <div>
                    <button
                      className="w-full text-left p-0.5 hover:bg-gray-50 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditWorkout(workout);
                      }}
                    >
                      {/* Show applied template indicator */}
                      {workout.appliedTemplateId && (
                        <div className="text-[8px] text-gray-500 px-1">
                          {workoutStructureTemplates.find(t => t.id === workout.appliedTemplateId)?.name}
                        </div>
                      )}
                      {/* Show workout's actual category */}
                      {workout.categoryName ? (
                        <div
                          className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                          style={{ 
                            backgroundColor: workoutCategories.find((wc: any) => wc.name === workout.categoryName)?.color || categoryInfo?.color || '#6b7280'
                          }}
                        >
                          {workout.categoryName}
                        </div>
                      ) : categoryInfo ? (
                        <div
                          className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                          style={{ backgroundColor: categoryInfo.color }}
                        >
                          {categoryInfo.category}
                        </div>
                      ) : null}
                      <div className="text-xs text-gray-700 font-medium px-1">
                        {workout.title || 'Untitled'}
                      </div>
                    </button>
                  </div>
                ) : categoryInfo ? (
                  <div>
                    <button
                      className="w-full text-left p-0.5 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateWorkout(date, categoryInfo.category, categoryInfo.color);
                      }}
                    >
                      <div
                        className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5 flex items-center justify-between"
                        style={{ backgroundColor: categoryInfo.color }}
                      >
                        <span>{categoryInfo.category}</span>
                        {workoutCategories.find((wc: any) => wc.name === categoryInfo.category)?.linkedWorkoutStructureTemplateId && (
                          <span className="text-[8px] opacity-75">★</span>
                        )}
                      </div>
                      <div className="flex items-center justify-center text-gray-400 mt-0.5">
                        <Plus className="w-3 h-3 icon-add" />
                      </div>
                    </button>
                  </div>
                ) : (
                  <div className="p-3 flex flex-col items-center justify-center text-center h-full">
                    <div className="text-gray-400 text-xs">
                      {inPeriod ? (
                        <>
                          <div className="text-lg mb-1">📅</div>
                          <div>No category assigned</div>
                        </>
                      ) : (
                        <>
                          <div className="text-lg mb-1">🚫</div>
                          <div>Outside training period</div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
      </div>

      {/* Expandable Editors Section */}
      {hasActiveEditors && (
        <div className="border-t border-gray-200 bg-gray-50">
          <div className="p-2 overflow-x-auto">
            <div className="flex gap-4 min-w-max border border-gray-200" style={{ maxWidth: 'calc(2 * 560px + 1rem)' }}>
              {[...weekEditingWorkouts, ...weekCreatingWorkouts]
                .sort(([dateKeyA], [dateKeyB]) => new Date(dateKeyA).getTime() - new Date(dateKeyB).getTime())
                .slice(0, 2)
                .map(([dateKey, workoutOrCreateData], index, array) => {
                  const isEditing = weekEditingWorkouts.some(([key]) => key === dateKey);
                  const workout = isEditing ? workoutOrCreateData : null;
                  const createData = !isEditing ? workoutOrCreateData : null;
                  const isLast = index === array.length - 1;

                  return (
                    <div
                      key={isEditing ? `editing-${dateKey}` : `creating-${dateKey}`}
                      className={`flex-shrink-0 w-[560px] bg-white shadow-lg overflow-visible ${!isLast ? 'border-r border-gray-200' : ''}`}
                    >
                      <div className="border-b px-3 py-1.5 flex items-center justify-between bg-gray-50 border-gray-200 sticky top-0 z-20">
                        <h3 className="text-sm font-semibold text-gray-900">
                          {isEditing ? '📝 Edit' : '➕ Create'} - {(() => {
                            const [year, month, day] = dateKey.split('-').map(Number);
                            const date = new Date(year, month - 1, day);
                            return date.toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric'
                            });
                          })()}
                        </h3>
                        <div className="flex items-center gap-1 relative z-30">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              onCloseEditor(dateKey, workout?.id);
                            }}
                            className="h-6 text-xs px-2 relative z-30"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              await onSaveButtonClick(dateKey);
                            }}
                            disabled={savingEditors.has(dateKey)}
                            className="h-6 text-xs px-2 relative z-30"
                          >
                            {savingEditors.has(dateKey) ? 'Saving...' : 'Save'}
                          </Button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (isEditing && workout?.id) {
                                onShowDeleteConfirmation(workout.id, dateKey);
                              } else {
                                onCloseEditor(dateKey, workout?.id);
                              }
                            }}
                            className={`p-1 rounded cursor-pointer relative z-30 ${isEditing ? 'text-red-500 hover:text-red-700 hover:bg-red-50' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
                            title={isEditing ? 'Delete workout' : 'Discard'}
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <div className="p-0 relative z-10">
                        <WorkoutEditor
                          ref={(el) => { editorRefs.current[dateKey] = el; }}
                          workout={workout}
                          isOpen={true}
                          onClose={() => onCloseEditor(dateKey, workout?.id)}
                          onSave={(workoutData) => onSaveWorkout(workoutData, dateKey)}
                          onDelete={() => onDeleteWorkout(workout?.id, dateKey)}
                          isCreating={!isEditing}
                          expandedInline={true}
                          hideTopActionBar={true}
                          initialRounds={createData ? generateInitialRounds(createData?.appliedTemplateId) : undefined}
                          appliedTemplateId={createData?.appliedTemplateId}
                          eventId={getEventIdForWorkout(workout, dateKey)}
                          externalVisibleColumns={visibleColumns}
                          onExternalColumnVisibilityChange={onColumnVisibilityChange}
                          draftKey={clientId ? `${dateKey}-${clientId}${workout?.id ? `-${workout.id}` : '-new'}` : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
