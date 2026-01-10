"use client";

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Calendar as CalendarIcon, Settings, ChevronDown } from 'lucide-react';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useClientWorkoutStore } from '@/lib/stores/useClientWorkoutStore';
import { ClientProgram, ClientProgramPeriod, ClientWorkout } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';
import { WorkoutEditor } from '@/components/workouts/WorkoutEditor';
import { getAllClientPrograms } from '@/lib/firebase/services/clientPrograms';

// Helper function to safely convert various date formats to Date object
const safeToDate = (dateValue: any): Date => {
  if (dateValue instanceof Date) {
    return dateValue;
  }
  if (dateValue && typeof dateValue === 'object') {
    // Handle Firestore Timestamp with toDate method
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    // Handle Firestore Timestamp in {seconds, nanoseconds} format
    if (typeof dateValue.seconds === 'number') {
      return new Date(dateValue.seconds * 1000);
    }
  }
  // Handle string or number dates
  if (typeof dateValue === 'string' || typeof dateValue === 'number') {
    return new Date(dateValue);
  }
  // Fallback to current date if all else fails
  console.warn('Unknown date format:', dateValue);
  return new Date();
};

export default function WorkoutPlanView() {
  const params = useParams();
  const clientId = params.clientId as string;
  const periodId = params.periodId as string;
  const router = useRouter();
  const { clients, fetchClients } = useClientStore();
  const { 
    workouts, 
    fetchWorkoutsByPeriod, 
    createWorkout, 
    updateWorkout, 
    isLoading 
  } = useClientWorkoutStore();
  
  const [clientPrograms, setClientPrograms] = useState<ClientProgram[]>([]);
  const [period, setPeriod] = useState<ClientProgramPeriod | null>(null);
  const [weeks, setWeeks] = useState<Date[][]>([]);
  const [editingWorkout, setEditingWorkout] = useState<ClientWorkout | null>(null);
  const [isCreatingWorkout, setIsCreatingWorkout] = useState(false);
  const [createWorkoutData, setCreateWorkoutData] = useState<{
    date: Date;
    categoryName: string;
    categoryColor: string;
  } | null>(null);
  const [editingWorkoutDate, setEditingWorkoutDate] = useState<Date | null>(null);
  
  // Week settings state
  const [weekSettings, setWeekSettings] = useState({
    addWeek: true,
    weekOrder: 'descending' as 'ascending' | 'descending',
    showWeekends: false,
    dayView: false
  });
  
  // Additional weeks beyond the period
  const [additionalWeeks, setAdditionalWeeks] = useState(0);

  // Get client
  const client = clients.find(c => c.id === clientId);

  useEffect(() => {
    if (!clients || clients.length === 0) {
      fetchClients();
    }
  }, [clients?.length, fetchClients]);

  useEffect(() => {
    const loadClientPrograms = async () => {
      try {
        const programs = await getAllClientPrograms();
        setClientPrograms(programs);
      } catch (error) {
        console.error('Error fetching client programs:', error);
      }
    };

    loadClientPrograms();
  }, []);

  useEffect(() => {
    // Find the period from client programs
    if (!clientPrograms || clientPrograms.length === 0) return;
    
    const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
    if (clientProgram) {
      const foundPeriod = clientProgram.periods?.find(p => p.id === periodId);
      if (foundPeriod) {
        setPeriod(foundPeriod);
        
        // Calculate weeks - handle different date formats
        let start: Date, end: Date;
        
        if (foundPeriod.startDate instanceof Date) {
          start = foundPeriod.startDate;
        } else if (foundPeriod.startDate && typeof foundPeriod.startDate.toDate === 'function') {
          start = safeToDate(foundPeriod.startDate);
        } else if (foundPeriod.startDate && foundPeriod.startDate.seconds) {
          start = new Date(foundPeriod.startDate.seconds * 1000);
        } else {
          console.error('Invalid startDate format:', foundPeriod.startDate);
          return;
        }
        
        if (foundPeriod.endDate instanceof Date) {
          end = foundPeriod.endDate;
        } else if (foundPeriod.endDate && typeof foundPeriod.endDate.toDate === 'function') {
          end = safeToDate(foundPeriod.endDate);
        } else if (foundPeriod.endDate && foundPeriod.endDate.seconds) {
          end = new Date(foundPeriod.endDate.seconds * 1000);
        } else {
          console.error('Invalid endDate format:', foundPeriod.endDate);
          return;
        }
        
        const calculatedWeeks = calculateWeeks(start, end);
        setWeeks(calculatedWeeks);
        
        // Fetch workouts for this period
        fetchWorkoutsByPeriod(periodId);
      }
    }
  }, [clientPrograms, clientId, periodId, fetchWorkoutsByPeriod]);

  // Recalculate weeks when additional weeks change
  useEffect(() => {
    if (period) {
      const start = safeToDate(period.startDate);
      const end = safeToDate(period.endDate);
      const calculatedWeeks = calculateWeeks(start, end);
      setWeeks(calculatedWeeks);
    }
  }, [additionalWeeks, period]);

  // Calculate weeks from start to end date
  function calculateWeeks(startDate: Date, endDate: Date): Date[][] {
    const weeks: Date[][] = [];
    const current = new Date(startDate);
    current.setHours(12, 0, 0, 0);
    
    // Go to the start of the week (Monday)
    const dayOfWeek = current.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Sunday = 0, so go back 6 days, else go to Monday
    current.setDate(current.getDate() + diff);
    
    // Calculate the extended end date including additional weeks
    const extendedEndDate = new Date(endDate);
    extendedEndDate.setDate(extendedEndDate.getDate() + (additionalWeeks * 7));
    
    while (current <= extendedEndDate) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }
    
    return weeks;
  }

  // Get workout for a specific date
  function getWorkoutForDate(date: Date): ClientWorkout | null {
    return workouts.find(w => {
      const workoutDate = safeToDate(w.date);
      return (
        workoutDate.getFullYear() === date.getFullYear() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getDate() === date.getDate()
      );
    }) || null;
  }

  // Check if date is in period range
  function isDateInPeriod(date: Date): boolean {
    if (!period) return false;
    const start = safeToDate(period.startDate);
    const end = safeToDate(period.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return date >= start && date <= end;
  }

  // Get category for date from period.days
  function getCategoryForDate(date: Date): { category: string; color: string } | null {
    if (!period) return null;
    
    const day = period.days.find(d => {
      const dayDate = safeToDate(d.date);
      return (
        dayDate.getFullYear() === date.getFullYear() &&
        dayDate.getMonth() === date.getMonth() &&
        dayDate.getDate() === date.getDate()
      );
    });
    
    return day ? { category: day.workoutCategory, color: day.workoutCategoryColor } : null;
  }

  // Workout handlers
  const handleCreateWorkout = (date: Date, categoryName: string, categoryColor: string) => {
    setCreateWorkoutData({ date, categoryName, categoryColor });
    setEditingWorkoutDate(date);
    setIsCreatingWorkout(true);
  };

  const handleEditWorkout = (workout: ClientWorkout) => {
    setEditingWorkout(workout);
    setEditingWorkoutDate(safeToDate(workout.date));
  };

  const handleSaveWorkout = async (workoutData: Partial<ClientWorkout>) => {
    try {
      if (isCreatingWorkout && createWorkoutData) {
        // Create new workout
        const dayOfWeek = createWorkoutData.date.getDay();
        const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday=0 to Sunday=6, Monday=1 to Monday=0, etc.
        
        await createWorkout({
          clientId: clientId,
          periodId: periodId,
          date: Timestamp.fromDate(createWorkoutData.date),
          dayOfWeek: adjustedDayOfWeek,
          categoryName: createWorkoutData.categoryName,
          isModified: true,
          createdBy: 'current-coach-id', // TODO: Get from auth context
          ...workoutData,
        });
        
        setIsCreatingWorkout(false);
        setCreateWorkoutData(null);
      } else if (editingWorkout) {
        // Update existing workout
        await updateWorkout(editingWorkout.id, workoutData);
        setEditingWorkout(null);
      }
    } catch (error) {
      console.error('Error saving workout:', error);
      // TODO: Show error toast
    }
  };

  const handleCloseEditor = () => {
    setEditingWorkout(null);
    setEditingWorkoutDate(null);
    setIsCreatingWorkout(false);
    setCreateWorkoutData(null);
  };

  if (!period || !client) {
    return (
      <div className="p-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>
        <div className="text-center text-gray-500">
          {isLoading ? 'Loading...' : 'Period not found'}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <p className="text-gray-500 text-sm">
                {period.periodName} • {safeToDate(period.startDate).toLocaleDateString()} - {safeToDate(period.endDate).toLocaleDateString()}
              </p>
            </div>
          </div>
          <Badge style={{ backgroundColor: period.periodColor }} className="text-white">
            {period.periodName}
          </Badge>
        </div>
      </div>

      {/* Settings Panel */}
      <div className="container mx-auto px-4 mb-4">
        <Card>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Settings className="w-5 h-5" />
              Week Schedule Settings
            </CardTitle>
            <div className="flex items-center gap-4">
              {/* Week Order */}
              <div className="flex items-center space-x-2">
                <label htmlFor="weekOrder" className="text-sm font-medium">Week order:</label>
                <select
                  id="weekOrder"
                  value={weekSettings.weekOrder}
                  onChange={(e) => setWeekSettings(prev => ({ ...prev, weekOrder: e.target.value as 'ascending' | 'descending' }))}
                  className="text-sm border rounded px-2 py-1"
                >
                  <option value="ascending">Ascending</option>
                  <option value="descending">Descending</option>
                </select>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setAdditionalWeeks(prev => prev + 1)}
                  className="h-8 text-sm"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1.5 icon-add" />
                  Add Week
                </Button>
                {additionalWeeks > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    +{additionalWeeks} week{additionalWeeks > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex justify-end px-6 pb-2">
            <div className="space-y-1">
              {/* Toggle Settings */}
              <div className="flex items-center space-x-3">
                <ToggleSwitch
                  id="showWeekends"
                  checked={weekSettings.showWeekends}
                  onChange={(checked) => setWeekSettings(prev => ({ ...prev, showWeekends: checked }))}
                  size="sm"
                />
                <label htmlFor="showWeekends" className="text-sm font-medium">Show weekends</label>
              </div>
              
              <div className="flex items-center space-x-3">
                <ToggleSwitch
                  id="dayView"
                  checked={weekSettings.dayView}
                  onChange={(checked) => setWeekSettings(prev => ({ ...prev, dayView: checked }))}
                  size="sm"
                />
                <label htmlFor="dayView" className="text-sm font-medium">Day View</label>
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      </div>

      {/* Week Grid or Day View */}
      {weekSettings.dayView ? (
        // Day View - Edge-to-Edge Layout
        <div className="overflow-hidden">
          {(weekSettings.showWeekends 
            ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
          ).map((dayName, dayIndex) => {
            const dayOrdinal = weekSettings.showWeekends ? dayIndex : (dayIndex < 5 ? dayIndex : dayIndex + 2);
            const isLastDay = dayIndex === (weekSettings.showWeekends ? 6 : 4);
            
            return (
              <div key={dayName} className={`${!isLastDay ? 'border-b border-gray-200' : ''}`}>
                <div className="overflow-x-auto">
                  <div className="flex min-w-max">
                    {/* Day Name - Sticky Left Column */}
                    <div className="sticky left-0 bg-gray-50 z-10 border-r border-gray-200 w-12 sm:w-16 flex items-center justify-center">
                      <div className="text-xs font-medium text-gray-700 py-1 sm:py-2">
                        {dayName.slice(0, 2)} {/* Show only 2 chars on mobile */}
                      </div>
                    </div>
                    
                    {/* Week Columns */}
                    {(weekSettings.weekOrder === 'descending' ? [...weeks].reverse() : weeks).map((week, weekIndex) => {
                      const displayWeekNumber = weekSettings.weekOrder === 'descending' 
                        ? weeks.length - weekIndex 
                        : weekIndex + 1;
                      const isLastWeek = weekIndex === weeks.length - 1;
                      
                      // Get the date for this day of this week
                      const dateForDay = week.find((date, dateIndex) => {
                        const dayOfWeek = date.getDay();
                        const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                        return adjustedDayOfWeek === dayOrdinal;
                      });
                      
                      if (!dateForDay) return null;
                      
                      const workout = getWorkoutForDate(dateForDay);
                      const inPeriod = isDateInPeriod(dateForDay);
                      const categoryInfo = getCategoryForDate(dateForDay);
                      const isEditingThisDate = editingWorkoutDate && 
                        editingWorkoutDate.getTime() === dateForDay.getTime();
                      
                      return (
                        <div key={weekIndex} className={`w-72 sm:w-80 lg:w-96 ${!isLastWeek ? 'border-r border-gray-200' : ''}`}>
                          {/* Week Header - Inline */}
                          <div className="h-6 flex items-center justify-center text-xs font-medium text-gray-600 bg-gray-50 border-b border-gray-100">
                            Week {displayWeekNumber} • {dateForDay.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })}
                          </div>
                          
                          {/* Day Cell Content */}
                          <div className={`min-h-[120px] ${
                            inPeriod ? 'bg-white' : 'bg-gray-50 opacity-50'
                          } ${isEditingThisDate ? 'bg-blue-50 border-l-2 border-blue-500 relative z-50' : 'relative'}`}>
                            
                            {inPeriod && categoryInfo ? (
                              <div>
                                {workout ? (
                                  // Show workout
                                  <div>
                                    <button
                                      className="w-full text-left p-0.5 hover:bg-gray-50 transition-colors"
                                      onClick={() => handleEditWorkout(workout)}
                                    >
                                      <div
                                        className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                                        style={{ backgroundColor: categoryInfo.color }}
                                      >
                                        {categoryInfo.category}
                                      </div>
                                      <div className="text-xs text-gray-700 font-medium px-1">
                                        {workout.title || 'Untitled'}
                                      </div>
                                    </button>
                                    
                                    {/* Inline Workout Editor */}
                                    {isEditingThisDate && (
                                      <div className="mt-1">
                                        <WorkoutEditor
                                          workout={editingWorkout}
                                          isOpen={true}
                                          onClose={handleCloseEditor}
                                          onSave={handleSaveWorkout}
                                          isCreating={isCreatingWorkout}
                                          isInline={true}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  // Show "Add Workout" button
                                  <div>
                                    <button
                                      className="w-full text-left p-0.5 hover:bg-gray-100 transition-colors border border-dashed border-gray-300"
                                      onClick={() => handleCreateWorkout(dateForDay, categoryInfo.category, categoryInfo.color)}
                                    >
                                      <div
                                        className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                                        style={{ backgroundColor: categoryInfo.color }}
                                      >
                                        {categoryInfo.category}
                                      </div>
                                      <div className="flex items-center justify-center text-gray-400 mt-0.5">
                                        <Plus className="w-3 h-3" />
                                      </div>
                                    </button>
                                    
                                    {/* Inline Workout Editor for New Workout */}
                                    {isEditingThisDate && isCreatingWorkout && (
                                      <div className="mt-1">
                                        <WorkoutEditor
                                          workout={null}
                                          isOpen={true}
                                          onClose={handleCloseEditor}
                                          onSave={handleSaveWorkout}
                                          isCreating={true}
                                          isInline={true}
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-center text-gray-500 py-6 text-xs">
                                No workout
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Week Grid View - Flat Edge-to-Edge Layout
        <div>
          {(weekSettings.weekOrder === 'descending' ? [...weeks].reverse() : weeks).map((week, weekIndex) => {
            const displayWeekNumber = weekSettings.weekOrder === 'descending' 
              ? weeks.length - weekIndex 
              : weekIndex + 1;
            const isLastWeek = weekIndex === weeks.length - 1;
            
            return (
              <div key={weekIndex} className={!isLastWeek ? 'border-b border-gray-200' : ''}>
                {/* Week Header - Minimal Line */}
                <div className="bg-gray-50 border-b border-gray-100 px-1 py-0.5">
                  <h3 className="text-xs font-medium text-gray-600">Week {displayWeekNumber}</h3>
                </div>
                
                {/* Days Grid - No Container Padding */}
                <div className={`grid gap-0 ${weekSettings.showWeekends ? 'grid-cols-7' : 'grid-cols-5'}`}>
                  {/* Day Headers */}
                  {(weekSettings.showWeekends 
                    ? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                    : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
                  ).map((day, index) => (
                    <div key={index} className="text-center text-xs font-medium text-gray-500 py-1 border-b border-gray-100">
                      {day}
                    </div>
                  ))}
                  
                  {/* Day Cells */}
                  {week
                    .filter((date, dayIndex) => {
                      if (weekSettings.showWeekends) return true;
                      const dayOfWeek = date.getDay();
                      return dayOfWeek !== 0 && dayOfWeek !== 6; // Filter out Sunday (0) and Saturday (6)
                    })
                    .map((date, dayIndex) => {
                    const workout = getWorkoutForDate(date);
                    const inPeriod = isDateInPeriod(date);
                    const categoryInfo = getCategoryForDate(date);
                    const isEditingThisDate = editingWorkoutDate && 
                      editingWorkoutDate.getTime() === date.getTime();
                    
                    return (
                      <div
                        key={dayIndex}
                        className={`min-h-[100px] border-r border-gray-200 ${
                          inPeriod ? 'bg-white' : 'bg-gray-50 opacity-50'
                        } ${isEditingThisDate ? 'bg-blue-50 border-l-2 border-blue-500' : ''}`}
                      >
                        <div className="text-xs text-gray-500 px-1 py-1">
                          {date.getDate()}
                        </div>
                        
                        {inPeriod && categoryInfo && (
                          <div>
                            {workout ? (
                              // Show workout
                              <div>
                                <button
                                  className="w-full text-left p-0.5 hover:bg-gray-50 transition-colors"
                                  onClick={() => handleEditWorkout(workout)}
                                >
                                  <div
                                    className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                                    style={{ backgroundColor: categoryInfo.color }}
                                  >
                                    {categoryInfo.category}
                                  </div>
                                  <div className="text-xs text-gray-700 font-medium px-1">
                                    {workout.title || 'Untitled'}
                                  </div>
                                </button>
                                
                                {/* Inline Workout Editor */}
                                {isEditingThisDate && (
                                  <div>
                                    <WorkoutEditor
                                      workout={editingWorkout}
                                      isOpen={true}
                                      onClose={handleCloseEditor}
                                      onSave={handleSaveWorkout}
                                      isCreating={isCreatingWorkout}
                                      isInline={true}
                                    />
                                  </div>
                                )}
                              </div>
                            ) : (
                              // Show "Add Workout" button
                              <div>
                                <button
                                  className="w-full text-left p-0.5 hover:bg-gray-100 transition-colors border border-dashed border-gray-300 m-0.5"
                                  onClick={() => handleCreateWorkout(date, categoryInfo.category, categoryInfo.color)}
                                >
                                  <div
                                    className="text-xs px-1 py-0.5 rounded text-white font-medium mb-0.5"
                                    style={{ backgroundColor: categoryInfo.color }}
                                  >
                                    {categoryInfo.category}
                                  </div>
                                  <div className="flex items-center justify-center text-gray-400 mt-0.5">
                                    <Plus className="w-3 h-3" />
                                  </div>
                                </button>
                                
                                {/* Inline Workout Editor for New Workout */}
                                {isEditingThisDate && isCreatingWorkout && (
                                  <div>
                                    <WorkoutEditor
                                      workout={null}
                                      isOpen={true}
                                      onClose={handleCloseEditor}
                                      onSave={handleSaveWorkout}
                                      isCreating={true}
                                      isInline={true}
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

