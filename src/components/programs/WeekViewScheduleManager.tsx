"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Settings } from 'lucide-react';
import { ClientProgramPeriod } from '@/lib/types';

interface WeekViewScheduleManagerProps {
  selectedDate: Date;
  selectedTimeSlot: Date | null;
  selectedPeriod: ClientProgramPeriod | null;
  workoutCategories: Array<{
    id: string;
    name: string;
    color: string;
  }>;
  onUpdatePeriod: (periodId: string, updates: Partial<ClientProgramPeriod>) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function WeekViewScheduleManager({
  selectedDate,
  selectedTimeSlot,
  selectedPeriod,
  workoutCategories,
  onUpdatePeriod,
  isOpen,
  onClose
}: WeekViewScheduleManagerProps) {
  
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [isAllDay, setIsAllDay] = useState(false);
  const [editingDay, setEditingDay] = useState<string | null>(null);
  const [editingDayTime, setEditingDayTime] = useState<string>('');
  const [editingDayIsAllDay, setEditingDayIsAllDay] = useState<boolean>(true);

  // Helper function to safely convert dates
  const safeToDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    
    // If it's already a Date object
    if (dateValue instanceof Date) {
      return dateValue;
    }
    
    // If it has a toDate method (Firestore Timestamp)
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    
    // Handle plain Firestore timestamp objects {seconds: ..., nanoseconds: ...}
    if (dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000);
    }
    
    // If it's a string or number, try to create a Date
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    
    // Fallback
    console.warn('Unknown date format in WeekViewScheduleManager:', dateValue);
    return new Date();
  };

  // Initialize time when component opens
  useEffect(() => {
    if (selectedTimeSlot && isOpen) {
      setSelectedTime(selectedTimeSlot.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      }));
    }
  }, [selectedTimeSlot, isOpen]);

  if (!selectedPeriod) {
    return null;
  }


  const handleDayClick = (dayData: any) => {
    setEditingDay(safeToDate(dayData.date).toISOString().split('T')[0]);
    setEditingDayTime(dayData.time || '');
    setEditingDayIsAllDay(dayData.isAllDay ?? true);
  };

  const handleSaveDayEdit = () => {
    if (!editingDay) return;

    const updatedDays = selectedPeriod.days.map(day => {
      const dayDateStr = safeToDate(day.date).toISOString().split('T')[0];
      if (dayDateStr === editingDay) {
        return {
          ...day,
          time: editingDayIsAllDay ? undefined : editingDayTime,
          isAllDay: editingDayIsAllDay
        };
      }
      return day;
    });

    onUpdatePeriod(selectedPeriod.id, { days: updatedDays });
    setEditingDay(null);
    setEditingDayTime('');
    setEditingDayIsAllDay(true);
  };

  const getWorkoutCategoryColor = (categoryName: string) => {
    const category = workoutCategories.find(wc => wc.name === categoryName);
    return category?.color || '#6b7280';
  };

  // Get the week dates for the selected date
  const getWeekDates = (date: Date) => {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay()); // Start from Sunday
    
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + i);
      weekDates.push(day);
    }
    return weekDates;
  };

  const weekDates = getWeekDates(selectedDate);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Management
          </DialogTitle>
          <DialogDescription>
            Manage daily schedules and timing for the selected period.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period Info */}
          <Card style={{ borderLeftColor: selectedPeriod.periodColor, borderLeftWidth: '4px' }}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: selectedPeriod.periodColor }}
                />
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  {selectedPeriod.periodName}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Manage your daily schedule by assigning workout categories and times.
              </p>
            </CardContent>
          </Card>

          {/* Time Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Time Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="allDay"
                    checked={isAllDay}
                    onChange={(e) => setIsAllDay(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="allDay" className="text-sm font-medium">
                    All Day Event
                  </label>
                </div>
                {!isAllDay && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium">Time:</label>
                    <input
                      type="time"
                      value={selectedTime}
                      onChange={(e) => setSelectedTime(e.target.value)}
                      className="p-2 border rounded-md"
                    />
                  </div>
                )}
              </div>
              {selectedTimeSlot && (
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedDate.toLocaleDateString()} {!isAllDay && `at ${selectedTimeSlot.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
                </div>
              )}
            </CardContent>
          </Card>


          {/* Weekly Schedule - Time Management */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Weekly Schedule - Adjust Timing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Click on any day to adjust the timing for that workout category.
                </p>
                
                <div className="grid grid-cols-7 gap-3">
                  {weekDates.map((date) => {
                    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
                    const dayData = selectedPeriod.days.find(d => {
                      const dDayName = safeToDate(d.date).toLocaleDateString('en-US', { weekday: 'long' });
                      return dDayName === dayName;
                    });
                    
                    const isToday = date.toDateString() === new Date().toDateString();
                    
                    return (
                      <div 
                        key={date.toISOString()} 
                        className="text-center"
                      >
                        <div className="text-sm font-medium text-muted-foreground mb-2">
                          {date.toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div className={`text-lg font-bold mb-3 ${isToday ? 'text-primary' : 'text-foreground'}`}>
                          {date.getDate()}
                        </div>
                        
                        {dayData ? (
                          <div 
                            className="p-3 rounded-lg border-2 border-solid transition-all duration-200 min-h-[120px] flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:scale-105"
                            style={{ 
                              backgroundColor: `${dayData.workoutCategoryColor}15`,
                              borderColor: dayData.workoutCategoryColor
                            }}
                            onClick={() => handleDayClick(dayData)}
                            title="Click to edit timing"
                          >
                            <div 
                              className="w-5 h-5 rounded-full mb-2"
                              style={{ backgroundColor: dayData.workoutCategoryColor }}
                            />
                            <div className="text-sm font-medium text-center mb-2">
                              {dayData.workoutCategory}
                            </div>
                            
                            {/* Time Display */}
                            <div className="text-xs space-y-1">
                              {dayData.isAllDay ? (
                                <div className="text-muted-foreground font-medium">
                                  All Day
                                </div>
                              ) : dayData.time ? (
                                <div className="text-muted-foreground font-medium">
                                  {dayData.time}
                                </div>
                              ) : (
                                <div className="text-muted-foreground">
                                  No time set
                                </div>
                              )}
                            </div>
                            
                            <div className="text-xs text-muted-foreground mt-2 opacity-70">
                              Click to edit
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 rounded-lg border-2 border-dashed border-muted-foreground/30 min-h-[120px] flex items-center justify-center">
                            <div className="text-xs text-muted-foreground text-center">
                              No workout<br/>scheduled
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Day Time Editing Dialog */}
      {editingDay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96 max-w-[90vw]">
            <h3 className="text-lg font-semibold mb-4">Edit Day Time Settings</h3>
            
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="editIsAllDay"
                  checked={editingDayIsAllDay}
                  onChange={(e) => setEditingDayIsAllDay(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="editIsAllDay" className="text-sm">
                  All day event
                </Label>
              </div>
              
              {!editingDayIsAllDay && (
                <div className="space-y-2">
                  <Label htmlFor="editDayTime">Time</Label>
                  <Input
                    id="editDayTime"
                    type="time"
                    value={editingDayTime}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditingDayTime(e.target.value)}
                  />
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => setEditingDay(null)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleSaveDayEdit}>
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
