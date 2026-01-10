"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Clock, CalendarRange } from 'lucide-react';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientProgram, ClientProgramPeriod } from '@/lib/types';
import { format, parse } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface WorkoutCategory {
  id: string;
  name: string;
  color: string;
}

interface ScheduleEventEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: GoogleCalendarEvent | null;
  clientId: string | null;
  clientPrograms: ClientProgram[];
  workoutCategories: WorkoutCategory[];
  onUpdateEvent: (updates: {
    date: Date;
    time: string;
    category: string;
    extendPeriod?: {
      newEndDate: Date;
    };
  }) => Promise<void>;
}

// Helper to safely convert dates
const safeToDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue.toDate === 'function') return dateValue.toDate();
  if (dateValue.seconds !== undefined) return new Date(dateValue.seconds * 1000);
  if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
  return new Date();
};

export function ScheduleEventEditDialog({
  open,
  onOpenChange,
  event,
  clientId,
  clientPrograms,
  workoutCategories,
  onUpdateEvent
}: ScheduleEventEditDialogProps) {
  const [date, setDate] = useState<string>('');
  const [time, setTime] = useState<string>('');
  const [category, setCategory] = useState<string>('');
  const [extendPeriod, setExtendPeriod] = useState<boolean>(false);
  const [newPeriodEndDate, setNewPeriodEndDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Find the period that contains this event
  const findPeriodForEvent = (): ClientProgramPeriod | null => {
    if (!event || !clientId) return null;
    
    const eventDate = new Date(event.start.dateTime);
    const clientProgram = clientPrograms.find(cp => cp.clientId === clientId);
    if (!clientProgram) return null;

    for (const period of clientProgram.periods) {
      const startDate = safeToDate(period.startDate);
      const endDate = safeToDate(period.endDate);
      
      if (eventDate >= startDate && eventDate <= endDate) {
        return period;
      }
    }
    
    return null;
  };

  const period = findPeriodForEvent();

  // Initialize form when event changes
  useEffect(() => {
    if (event && open) {
      const eventDate = new Date(event.start.dateTime);
      setDate(format(eventDate, 'yyyy-MM-dd'));
      
      // Extract time from event (format: HH:mm)
      const timeStr = format(eventDate, 'HH:mm');
      setTime(timeStr);
      
      // Get category from event
      const eventCategory = event.preConfiguredCategory || 
        (event.description?.match(/category=([^,\n}]+)/)?.[1]?.trim()) ||
        'Workout';
      setCategory(eventCategory);
      
      // Set period end date if period exists
      if (period) {
        const periodEnd = safeToDate(period.endDate);
        setNewPeriodEndDate(format(periodEnd, 'yyyy-MM-dd'));
      }
    }
  }, [event, open, period]);

  const handleSave = async () => {
    if (!event || !date || !time || !category) {
      alert('Please fill in all required fields');
      return;
    }

    setIsSaving(true);
    try {
      const newDate = parse(date, 'yyyy-MM-dd', new Date());
      
      await onUpdateEvent({
        date: newDate,
        time,
        category,
        extendPeriod: extendPeriod && newPeriodEndDate ? {
          newEndDate: parse(newPeriodEndDate, 'yyyy-MM-dd', new Date())
        } : undefined
      });
      
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating event:', error);
      alert('Failed to update event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!event) return null;

  const eventDate = new Date(event.start.dateTime);
  const eventCategory = event.preConfiguredCategory || 
    (event.description?.match(/category=([^,\n}]+)/)?.[1]?.trim()) ||
    'Workout';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Edit Schedule Event
          </DialogTitle>
          <DialogDescription>
            Update the date, time, and workout category for this scheduled event.
            {period && ' You can also extend the period range if needed.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Event Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="text-sm font-medium mb-2">Current Event</div>
            <div className="text-sm text-muted-foreground space-y-1">
              <div><span className="font-medium">Date:</span> {format(eventDate, 'EEEE, MMMM d, yyyy')}</div>
              <div><span className="font-medium">Time:</span> {format(eventDate, 'h:mm a')}</div>
              <div><span className="font-medium">Category:</span> {eventCategory}</div>
              {period && (
                <div className="mt-2 pt-2 border-t">
                  <div><span className="font-medium">Period:</span> {period.periodName}</div>
                  <div className="text-xs">
                    {format(safeToDate(period.startDate), 'MMM d')} - {format(safeToDate(period.endDate), 'MMM d, yyyy')}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label htmlFor="eventDate">
              <Calendar className="h-4 w-4 inline mr-2" />
              Event Date
            </Label>
            <Input
              id="eventDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Time Selection */}
          <div className="space-y-2">
            <Label htmlFor="eventTime">
              <Clock className="h-4 w-4 inline mr-2" />
              Event Time
            </Label>
            <Input
              id="eventTime"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            />
          </div>

          {/* Workout Category Selection */}
          <div className="space-y-2">
            <Label htmlFor="category">Workout Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select workout category" />
              </SelectTrigger>
              <SelectContent>
                {workoutCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.name}
                    </div>
                  </SelectItem>
                ))}
                <SelectItem value="Rest Day">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-400" />
                    Rest Day
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Extend Period Option */}
          {period && (
            <div className="space-y-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="extendPeriod"
                  checked={extendPeriod}
                  onChange={(e) => setExtendPeriod(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="extendPeriod" className="cursor-pointer">
                  <CalendarRange className="h-4 w-4 inline mr-2" />
                  Extend Period Range
                </Label>
              </div>
              
              {extendPeriod && (
                <div className="space-y-2 ml-6">
                  <Label htmlFor="newPeriodEndDate">New Period End Date</Label>
                  <Input
                    id="newPeriodEndDate"
                    type="date"
                    value={newPeriodEndDate}
                    onChange={(e) => setNewPeriodEndDate(e.target.value)}
                    min={format(safeToDate(period.endDate), 'yyyy-MM-dd')}
                  />
                  <p className="text-xs text-muted-foreground">
                    Current period ends: {format(safeToDate(period.endDate), 'MMMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button variant="outline" onClick={handleSave} disabled={isSaving || !date || !time || !category}>
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

