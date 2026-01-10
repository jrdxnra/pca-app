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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, User, Dumbbell } from 'lucide-react';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';

interface QuickWorkoutCreationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: GoogleCalendarEvent | null;
  onCreateWorkout: (clientId: string, workoutStructureId: string, eventId: string) => void;
}

export function QuickWorkoutCreationDialog({
  open,
  onOpenChange,
  event,
  onCreateWorkout
}: QuickWorkoutCreationDialogProps) {
  const router = useRouter();
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedStructureId, setSelectedStructureId] = useState<string>('');

  const { clients, fetchClients } = useClientStore();
  const { workoutStructureTemplates, fetchAll: fetchConfig } = useConfigurationStore();

  // Fetch data when dialog opens
  useEffect(() => {
    if (open) {
      fetchClients();
      fetchConfig();
    }
  }, [open, fetchClients, fetchConfig]);

  // Reset selections when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedClientId('');
      setSelectedStructureId('');
    }
  }, [open]);

  if (!event) return null;

  const formatEventTime = (dateTime: string, timeZone?: string) => {
    return new Date(dateTime).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: timeZone || 'America/Los_Angeles'
    });
  };

  const formatEventDate = (dateTime: string) => {
    return new Date(dateTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleCreateWorkout = () => {
    if (!selectedClientId || !selectedStructureId) {
      alert('Please select both a client and workout structure');
      return;
    }

    // Navigate to workout builder with pre-filled data
    const eventDate = new Date(event.start.dateTime).toISOString().split('T')[0];
    const url = `/workouts/builder?client=${selectedClientId}&date=${eventDate}&eventId=${event.id}&structure=${selectedStructureId}`;
    
    router.push(url);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Create Workout
          </DialogTitle>
          <DialogDescription>
            Create a workout for this calendar event. Select a client and workout structure to get started.
          </DialogDescription>
        </DialogHeader>

        {/* Event Details */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-900">{event.summary}</h4>
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Coaching Session
            </Badge>
          </div>
          
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 icon-schedule" />
              <span>{formatEventDate(event.start.dateTime)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>
                {formatEventTime(event.start.dateTime, event.start.timeZone)} - {formatEventTime(event.end.dateTime, event.end.timeZone)}
              </span>
            </div>
            
            {event.location && (
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span className="truncate">{event.location}</span>
              </div>
            )}
          </div>

          {event.description && (
            <div className="text-sm text-gray-600 bg-white rounded p-2 border">
              <p className="line-clamp-3">{event.description}</p>
            </div>
          )}
        </div>

        {/* Client Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <User className="h-4 w-4" />
            Select Client
          </label>
          <Select value={selectedClientId} onValueChange={setSelectedClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a client for this workout" />
            </SelectTrigger>
            <SelectContent>
              {clients
                .filter(client => !client.isDeleted)
                .map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        {/* Workout Structure Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            Select Workout Structure
          </label>
          <Select value={selectedStructureId} onValueChange={setSelectedStructureId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a workout structure template" />
            </SelectTrigger>
            <SelectContent>
              {workoutStructureTemplates.map((template) => (
                <SelectItem key={template.id} value={template.id}>
                  <div className="flex flex-col">
                    <span>{template.name}</span>
                    <span className="text-xs text-gray-500">
                      {template.sections.length} sections
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {workoutStructureTemplates.length === 0 && (
            <p className="text-xs text-gray-500">
              No workout structure templates found. Create some in the Configure page first.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateWorkout}
            disabled={!selectedClientId || !selectedStructureId}
          >
            Build Workout
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


