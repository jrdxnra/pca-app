"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, User } from 'lucide-react';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { format } from 'date-fns';

interface CreateScheduleEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date;
  selectedTime?: Date;
  onEventCreated?: () => void;
}

export function CreateScheduleEventDialog({
  open,
  onOpenChange,
  selectedDate,
  selectedTime,
  onEventCreated
}: CreateScheduleEventDialogProps) {
  const [clientId, setClientId] = useState<string>('');
  const [workoutCategory, setWorkoutCategory] = useState<string>('');
  const [eventTitle, setEventTitle] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [isAllDay, setIsAllDay] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const { createTestEvent, linkToWorkout } = useCalendarStore();
  const { clients, fetchClients } = useClientStore();
  const { workoutCategories, fetchWorkoutCategories, workoutStructureTemplates, fetchWorkoutStructureTemplates } = useConfigurationStore();
  const { findPeriodForDate } = useClientPrograms(clientId);

  useEffect(() => {
    if (open) {
      fetchClients();
      fetchWorkoutCategories();
      fetchWorkoutStructureTemplates();
      
      // Set default time if selectedTime is provided
      if (selectedTime) {
        const timeStr = format(selectedTime, 'HH:mm');
        setStartTime(timeStr);
        // Default to 1 hour duration
        const endTimeDate = new Date(selectedTime);
        endTimeDate.setHours(endTimeDate.getHours() + 1);
        setEndTime(format(endTimeDate, 'HH:mm'));
      }
    }
  }, [open, selectedTime, fetchClients, fetchWorkoutCategories, fetchWorkoutStructureTemplates]);

  const handleSave = async () => {
    if (!clientId || !workoutCategory || !eventTitle) {
      alert('Please fill in all required fields');
      return;
    }

    if (!isAllDay && (!startTime || !endTime)) {
      alert('Please provide start and end times');
      return;
    }

    setIsSaving(true);

    try {
      // Create date strings
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startDateTime = isAllDay 
        ? `${dateStr}T00:00:00`
        : `${dateStr}T${startTime}:00`;
      const endDateTime = isAllDay
        ? `${dateStr}T23:59:59`
        : `${dateStr}T${endTime}:00`;

      // Find period for this date
      const period = findPeriodForDate(selectedDate, clientId);
      
      // Create calendar event with client metadata - workout will be auto-created
      const event = await createTestEvent({
        summary: eventTitle,
        date: dateStr,
        startTime: startTime || '00:00',
        endTime: endTime || '23:59',
        description: `Workout Category: ${workoutCategory}\n[Metadata: client=${clientId}, category=${workoutCategory}, periodId=${period?.id || 'none'}]`,
      });

      // Workout is automatically created by the calendar store when event is created
      // No need to manually create or link here

      // Update event with pre-configured settings
      // Note: This would require updating the mock service to support this
      // For now, the link is created above

      // Reset form
      setClientId('');
      setWorkoutCategory('');
      setEventTitle('');
      setStartTime('');
      setEndTime('');
      setIsAllDay(false);

      onEventCreated?.();
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating schedule event:', error);
      alert('Failed to create event. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedCategory = workoutCategories.find(cat => cat.name === workoutCategory);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Create Schedule Event
          </DialogTitle>
          <DialogDescription>
            Create a new event and corresponding workout for {format(selectedDate, 'EEEE, MMMM do, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Client Selection */}
          <div className="space-y-2">
            <Label htmlFor="client">Client *</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Event Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Event Title *</Label>
            <Input
              id="title"
              value={eventTitle}
              onChange={(e) => setEventTitle(e.target.value)}
              placeholder="e.g., Personal Training Session"
            />
          </div>

          {/* Workout Category */}
          <div className="space-y-2">
            <Label htmlFor="category">Workout Category *</Label>
            <Select value={workoutCategory} onValueChange={setWorkoutCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Select workout category" />
              </SelectTrigger>
              <SelectContent>
                {workoutCategories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCategory && (
              <p className="text-xs text-muted-foreground">
                {selectedCategory.linkedWorkoutStructureTemplateId 
                  ? 'Will create workout with linked template'
                  : 'No linked template - workout will be empty'}
              </p>
            )}
          </div>

          {/* Time Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={isAllDay}
                onChange={(e) => setIsAllDay(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="allDay">All Day Event</Label>
            </div>

            {!isAllDay && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button variant="outline" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save & Create Workout'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

