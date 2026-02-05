"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dumbbell, Save } from 'lucide-react';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { createClientWorkout, fetchWorkoutsByDateRange, deleteClientWorkout } from '@/lib/firebase/services/clientWorkouts';
import { Timestamp } from 'firebase/firestore';
import { toastSuccess, toastError, toastWarning } from '@/components/ui/toaster';
import { format } from 'date-fns';
import { WorkoutStructureTemplate } from '@/lib/types';

// Helper function to abbreviate workout type names
function abbreviateWorkoutType(name: string): string {
  // Normalize the name: lowercase, trim, and replace multiple spaces with single space
  const normalized = name.toLowerCase().trim().replace(/\s+/g, ' ');

  // Check for exact matches first
  const exactMatches: Record<string, string> = {
    'power prep': 'PREP',
    'performance prep': 'PREP',
    'pp': 'PREP',
    'movement prep': 'PREP',
    'movement preparation': 'PREP',
    'mp': 'PREP',
    'ballistics': 'PREP',
    'ballistic': 'PREP',
    'warm-up': 'W/U',
    'warmup': 'W/U',
    'warm up': 'W/U',
    'warm ups': 'W/U',
    'w/u': 'W/U',
    'round1': 'R1',
    'round 1': 'R1',
    'r1': 'R1',
    'round2': 'R2',
    'round 2': 'R2',
    'r2': 'R2',
    'amrap': 'AMRAP',
    'emom': 'EMOM',
    'cool-down': 'C/D',
    'cooldown': 'C/D',
    'cool down': 'C/D',
    'c/d': 'C/D',
    'pre-hab': 'PRE/HAB',
    'prehab': 'PRE/HAB',
    'pre - hab': 'PRE/HAB',
    'pre hab': 'PRE/HAB',
    'strength 1': 'S1',
    'strength1': 'S1',
    'strength 2': 'S2',
    'strength2': 'S2',
    'energy system development': 'ESD',
    'esd': 'ESD',
    'conditioning': 'COND',
    'mobility': 'MOB',
    'activation': 'ACT',
  };

  if (exactMatches[normalized]) {
    return exactMatches[normalized];
  }

  // Check for partial matches (contains the key phrase)
  if (normalized.includes('power prep') || normalized.includes('performance prep') || normalized.includes('movement prep') || normalized.includes('ballistic')) {
    return 'PREP';
  }
  if (normalized.includes('warm up') || normalized.includes('warm-up')) {
    return 'W/U';
  }
  if (normalized.includes('round 1') || normalized === 'round1') {
    return 'R1';
  }
  if (normalized.includes('round 2') || normalized === 'round2') {
    return 'R2';
  }
  if (normalized.includes('cool down') || normalized.includes('cool-down')) {
    return 'C/D';
  }
  if (normalized.includes('pre-hab') || normalized.includes('pre hab')) {
    return 'PRE/HAB';
  }

  return name.substring(0, 3).toUpperCase();
}

// Helper function to get abbreviation list for a template with colors
function getTemplateAbbreviationList(template: WorkoutStructureTemplate, workoutTypes: any[]): Array<{ abbrev: string; color: string }> {
  if (!template.sections || template.sections.length === 0) {
    return [];
  }

  return template.sections
    .sort((a, b) => a.order - b.order)
    .map(section => {
      const workoutType = workoutTypes.find(wt => wt.id === section.workoutTypeId);
      return {
        abbrev: abbreviateWorkoutType(section.workoutTypeName),
        color: workoutType?.color || '#6b7280'
      };
    });
}

interface QuickWorkoutBuilderDialogProps {
  clientId: string;
  clientName: string;
  onWorkoutCreated?: () => void;
  // Optional props to pre-fill the form (used when coming from calendar event)
  initialOpen?: boolean;
  initialDate?: string;
  initialCategory?: string;
  initialTime?: string;
  eventId?: string;
  onClose?: () => void;
}

export function QuickWorkoutBuilderDialog({
  clientId,
  clientName,
  onWorkoutCreated,
  initialOpen = false,
  initialDate,
  initialCategory,
  initialTime,
  eventId: propEventId,
  onClose
}: QuickWorkoutBuilderDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen);
  const [workoutDate, setWorkoutDate] = useState<string>(initialDate || format(new Date(), 'yyyy-MM-dd'));
  const [workoutTime, setWorkoutTime] = useState<string>(initialTime || '');
  const [workoutTitle, setWorkoutTitle] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || '');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [conflictWorkout, setConflictWorkout] = useState<any>(null);
  const [showConflict, setShowConflict] = useState(false);
  const [moveToDate, setMoveToDate] = useState<string>('');
  const [eventIdToLink, setEventIdToLink] = useState<string | undefined>(propEventId);

  const { clients } = useClientStore();
  const { workoutCategories, workoutStructureTemplates, workoutTypes, fetchAll: fetchConfig } = useConfigurationStore();
  const { createTestEvent, linkToWorkout, deleteEvent, events: calendarEvents, updateEvent } = useCalendarStore();
  const { findPeriodForDate } = useClientPrograms(clientId);

  // Handle initialOpen changes
  useEffect(() => {
    if (initialOpen) {
      setOpen(true);
      if (initialDate) setWorkoutDate(initialDate);
      if (initialCategory) setSelectedCategory(initialCategory);
      if (initialTime) setWorkoutTime(initialTime);
      if (propEventId) setEventIdToLink(propEventId);
    }
  }, [initialOpen, initialDate, initialCategory, initialTime, propEventId]);

  // Fetch config when dialog opens
  useEffect(() => {
    if (open) {
      fetchConfig();
    }
  }, [open, fetchConfig]);

  // Set template when category is pre-selected and workoutCategories loads
  useEffect(() => {
    if (selectedCategory && workoutCategories.length > 0 && !selectedTemplate) {
      const category = workoutCategories.find(cat => cat.name === selectedCategory);
      if (category?.linkedWorkoutStructureTemplateId) {
        setSelectedTemplate(category.linkedWorkoutStructureTemplateId);
      }
    }
  }, [selectedCategory, workoutCategories, selectedTemplate]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      // Only reset if not using initial values
      if (!initialOpen) {
        setWorkoutDate(format(new Date(), 'yyyy-MM-dd'));
        setWorkoutTime('');
        setWorkoutTitle('');
        setSelectedCategory('');
        setSelectedTemplate('');
        setConflictWorkout(null);
        setShowConflict(false);
        setMoveToDate('');
        setEventIdToLink(undefined);
      }
      onClose?.();
    }
  }, [open, initialOpen, onClose]);

  const checkForConflict = async (date: Date): Promise<any | null> => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const workouts = await fetchWorkoutsByDateRange(
      clientId,
      Timestamp.fromDate(startOfDay),
      Timestamp.fromDate(endOfDay)
    );

    return workouts.find(w => {
      const workoutDate = w.date instanceof Timestamp ? w.date.toDate() : new Date(w.date);
      return workoutDate.getDate() === date.getDate() &&
        workoutDate.getMonth() === date.getMonth() &&
        workoutDate.getFullYear() === date.getFullYear();
    }) || null;
  };

  const createQuickWorkout = async (workoutData: any) => {
    // Firestore returns various shapes depending on source/serialization; keep this permissive here.
    const createdWorkout = (await createClientWorkout(workoutData)) as any;

    // If we have an eventId to link to (from calendar event), link it
    if (eventIdToLink && createdWorkout?.id) {
      try {
        await linkToWorkout(eventIdToLink, createdWorkout.id);
        console.log('✅ Linked workout to existing calendar event:', createdWorkout.id, eventIdToLink);
      } catch (error) {
        console.error('❌ Error linking workout to calendar event:', error);
      }
    }
    // Otherwise, create calendar event for the workout if it has a time
    else if (workoutData.time && workoutData.time.trim() !== '') {
      try {
        const client = clients.find(c => c.id === workoutData.clientId);
        const clientNameForEvent = client?.name || 'Unknown Client';
        const date = workoutData.date instanceof Timestamp
          ? workoutData.date.toDate()
          : new Date(workoutData.date);
        const dateStr = format(date, 'yyyy-MM-dd');
        const timeStr = workoutData.time;

        // Calculate end time (default 1 hour)
        const endTime = new Date(date);
        const [hours, minutes] = timeStr.split(':').map(Number);
        endTime.setHours(hours, minutes || 0, 0, 0);
        endTime.setHours(endTime.getHours() + 1);

        const event = await createTestEvent({
          summary: workoutData.title || `${workoutData.categoryName || 'Workout'} with ${clientNameForEvent}`,
          date: dateStr,
          startTime: timeStr,
          endTime: format(endTime, 'HH:mm'),
          description: `Workout Category: ${workoutData.categoryName || 'Workout'}\n[Metadata: client=${workoutData.clientId}, category=${workoutData.categoryName || 'Workout'}, workoutId=${createdWorkout.id}, periodId=${workoutData.periodId || 'none'}]`,
        });

        // Link event to workout
        await linkToWorkout(event.id, createdWorkout.id);

        console.log('✅ Created calendar event for workout:', createdWorkout.id, event.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create calendar event. Please reconnect Google Calendar.';
        console.error('❌ Error creating calendar event for workout:', error);
        toastWarning(`Workout saved, but calendar event was not created: ${message}`);
      }
    }

    return createdWorkout;
  };

  const handleSave = async () => {
    if (!workoutTitle) {
      toastWarning('Please enter a workout title');
      return;
    }

    setIsSaving(true);
    try {
      const [year, month, day] = workoutDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const period = findPeriodForDate(date, clientId);
      const category = workoutCategories.find(cat => cat.name === selectedCategory);

      const linkedTemplateId = category?.linkedWorkoutStructureTemplateId;
      const templateIdToUse = selectedTemplate || linkedTemplateId;
      const template = templateIdToUse && workoutStructureTemplates.find(t => t.id === templateIdToUse);
      const appliedTemplateId = template ? templateIdToUse : undefined;

      // Build rounds from template if available
      let rounds = [];
      if (template && template.sections && template.sections.length > 0) {
        rounds = template.sections
          .sort((a, b) => a.order - b.order)
          .map((section, index) => ({
            ordinal: index + 1,
            sets: 1,
            sectionName: section.workoutTypeName,
            sectionColor: workoutTypes.find(wt => wt.id === section.workoutTypeId)?.color,
            workoutTypeId: section.workoutTypeId,
            movementUsages: [{
              ordinal: 1,
              movementId: '',
              categoryId: '',
              note: '',
              targetWorkload: {
                useWeight: false,
                weightMeasure: 'lbs' as const,
                useReps: false,
                useTempo: false,
                useTime: false,
                useDistance: false,
                distanceMeasure: 'm' as const,
                usePace: false,
                paceMeasure: 'km' as const,
                usePercentage: false,
                useRPE: false
              }
            }]
          }));
      }

      const workoutData = {
        clientId,
        periodId: period?.id || null,
        date: Timestamp.fromDate(date),
        title: workoutTitle,
        notes: '',
        time: workoutTime || '',
        categoryName: selectedCategory || '',
        appliedTemplateId,
        rounds,
        warmups: []
      };

      const existing = await checkForConflict(date);
      if (existing) {
        setConflictWorkout(existing);
        setShowConflict(true);
        setIsSaving(false);
        return;
      }

      await createQuickWorkout(workoutData);
      setOpen(false);
      onWorkoutCreated?.();
    } catch (error) {
      console.error('Error creating workout:', error);
      toastError('Failed to create workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConflictResolution = async (action: 'keep' | 'replace' | 'move' | 'cancel') => {
    if (action === 'cancel') {
      setShowConflict(false);
      setConflictWorkout(null);
      setMoveToDate('');
      return;
    }

    setIsSaving(true);

    try {
      const [year, month, day] = workoutDate.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      const period = findPeriodForDate(date, clientId);
      const category = workoutCategories.find(cat => cat.name === selectedCategory);

      const linkedTemplateId = category?.linkedWorkoutStructureTemplateId;
      const templateIdToUse = selectedTemplate || linkedTemplateId;
      const template = templateIdToUse && workoutStructureTemplates.find(t => t.id === templateIdToUse);
      const appliedTemplateId = template ? templateIdToUse : undefined;

      // Build rounds from template if available
      let rounds = [];
      if (template && template.sections && template.sections.length > 0) {
        rounds = template.sections
          .sort((a, b) => a.order - b.order)
          .map((section, index) => ({
            ordinal: index + 1,
            sets: 1,
            sectionName: section.workoutTypeName,
            sectionColor: workoutTypes.find(wt => wt.id === section.workoutTypeId)?.color,
            workoutTypeId: section.workoutTypeId,
            movementUsages: [{
              ordinal: 1,
              movementId: '',
              categoryId: '',
              note: '',
              targetWorkload: {
                useWeight: false,
                weightMeasure: 'lbs' as const,
                useReps: false,
                useTempo: false,
                useTime: false,
                useDistance: false,
                distanceMeasure: 'm' as const,
                usePace: false,
                paceMeasure: 'km' as const,
                usePercentage: false,
                useRPE: false
              }
            }]
          }));
      }

      const workoutData = {
        clientId,
        periodId: period?.id || null,
        date: Timestamp.fromDate(date),
        title: workoutTitle,
        notes: '',
        time: workoutTime || '',
        categoryName: selectedCategory || '',
        appliedTemplateId,
        rounds,
        warmups: []
      };

      if (action === 'keep') {
        // Navigate to existing workout
        const dateParam = format(date, 'yyyy-MM-dd');
        router.push(`/workouts/builder?client=${clientId}&date=${dateParam}&workoutId=${conflictWorkout.id}`);
        setOpen(false);
      } else if (action === 'replace') {
        // Delete existing and create new
        if (conflictWorkout.id) {
          const existingEvent = calendarEvents.find(e => e.linkedWorkoutId === conflictWorkout.id);
          if (existingEvent) {
            try {
              await deleteEvent(existingEvent.id);
            } catch (error) {
              console.error('Error deleting existing event:', error);
            }
          }
          await deleteClientWorkout(conflictWorkout.id);
        }
        await createQuickWorkout(workoutData);
        setOpen(false);
        onWorkoutCreated?.();
      } else if (action === 'move') {
        if (!moveToDate) {
          toastWarning('Please select a date to move the existing workout to');
          setIsSaving(false);
          return;
        }
        const newDate = new Date(moveToDate);
        const { updateClientWorkout } = await import('@/lib/firebase/services/clientWorkouts');
        const movePeriod = findPeriodForDate(newDate, clientId);
        await updateClientWorkout(conflictWorkout.id, {
          date: Timestamp.fromDate(newDate),
          periodId: movePeriod?.id || conflictWorkout.periodId || 'quick-workouts'
        });
        // Update calendar event if exists
        const existingEvent = calendarEvents.find(e => e.linkedWorkoutId === conflictWorkout.id);
        if (existingEvent && conflictWorkout.time) {
          try {
            const dateStr = format(newDate, 'yyyy-MM-dd');
            const timeStr = conflictWorkout.time;
            const endTime = new Date(newDate);
            const [hours, minutes] = timeStr.split(':').map(Number);
            endTime.setHours(hours, minutes || 0, 0, 0);
            endTime.setHours(endTime.getHours() + 1);

            await updateEvent(existingEvent.id, {
              start: {
                dateTime: `${dateStr}T${timeStr}:00`,
                timeZone: 'America/Los_Angeles',
              },
              end: {
                dateTime: `${dateStr}T${format(endTime, 'HH:mm')}:00`,
                timeZone: 'America/Los_Angeles',
              },
            });
          } catch (error) {
            console.error('Error updating event date:', error);
          }
        }
        await createQuickWorkout(workoutData);
        setOpen(false);
        onWorkoutCreated?.();
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      toastError('Failed to resolve conflict. Please try again.');
    } finally {
      setIsSaving(false);
      setShowConflict(false);
      setConflictWorkout(null);
      setMoveToDate('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Dumbbell className="h-4 w-4" />
          <span className="hidden lg:inline">Quick </span>Workout
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Quick Workout Builder
          </DialogTitle>
          <DialogDescription>
            Create a workout for {clientName}
          </DialogDescription>
        </DialogHeader>

        {!showConflict ? (
          <>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="workout-date">Date *</Label>
                  <Input
                    id="workout-date"
                    type="date"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="workout-time">Time</Label>
                  <Input
                    id="workout-time"
                    type="time"
                    value={workoutTime}
                    onChange={(e) => setWorkoutTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workout-title">Title *</Label>
                <Input
                  id="workout-title"
                  placeholder="e.g., Upper Body"
                  value={workoutTitle}
                  onChange={(e) => setWorkoutTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(value) => {
                    setSelectedCategory(value);
                    const category = workoutCategories.find(cat => cat.name === value);
                    setSelectedTemplate(category?.linkedWorkoutStructureTemplateId || '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {workoutCategories.map((category) => (
                      <SelectItem key={category.id} value={category.name}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedCategory && (
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select template (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {workoutStructureTemplates.map((template) => {
                        const category = workoutCategories.find(cat => cat.name === selectedCategory);
                        const isLinked = category?.linkedWorkoutStructureTemplateId === template.id;
                        const abbrevList = getTemplateAbbreviationList(template, workoutTypes);
                        return (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2 w-full">
                              <span>{template.name}{isLinked ? ' (default)' : ''}</span>
                              {abbrevList.length > 0 && (
                                <div className="flex items-center gap-1 ml-auto">
                                  {abbrevList.map((item, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium text-white border-0"
                                      style={{ backgroundColor: item.color }}
                                    >
                                      {item.abbrev}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={handleSave} disabled={isSaving || !workoutTitle}>
                <Save className="h-4 w-4 mr-2 icon-success" />
                {isSaving ? 'Creating...' : 'Create Workout'}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="py-4 space-y-4">
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                <p className="text-sm text-orange-800 mb-2">
                  <strong>Workout already exists</strong> for this date.
                </p>
                <p className="text-sm text-orange-700">
                  <strong>Existing:</strong> {conflictWorkout?.title || conflictWorkout?.categoryName || 'Untitled Workout'}
                </p>
                <p className="text-sm text-orange-700">
                  <strong>New:</strong> {workoutTitle}
                </p>
              </div>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleConflictResolution('keep')}
                  disabled={isSaving}
                >
                  Keep existing workout
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => handleConflictResolution('replace')}
                  disabled={isSaving}
                >
                  Replace with new workout
                </Button>
                <div className="space-y-2">
                  <Label>Move existing workout to:</Label>
                  <div className="flex gap-2">
                    <Input
                      type="date"
                      value={moveToDate}
                      onChange={(e) => setMoveToDate(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      onClick={() => handleConflictResolution('move')}
                      disabled={isSaving || !moveToDate}
                    >
                      Move
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => handleConflictResolution('cancel')}
                disabled={isSaving}
              >
                Cancel
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}


























