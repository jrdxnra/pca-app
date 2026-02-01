"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  ToggleLeft, 
  ToggleRight, 
  Eye, 
  PlusCircle,
  MapPin,
  Clock
} from 'lucide-react';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { useCalendarStore } from '@/lib/stores/useCalendarStore';
import { getAppTimezone } from '@/lib/utils/timezone';

interface GoogleCalendarEventCardProps {
  event: GoogleCalendarEvent;
  onToggleCoachingSession: (eventId: string, isCoaching: boolean) => void;
  onToggleClassSession: (eventId: string, isClass: boolean) => void;
  onCreateWorkout: (event: GoogleCalendarEvent) => void;
  onViewWorkout: (workoutId: string) => void;
  onOpenInCalendar: (event: GoogleCalendarEvent) => void;
  compact?: boolean;
}

// Memoize to prevent unnecessary re-renders when parent re-renders
export const GoogleCalendarEventCard = React.memo(function GoogleCalendarEventCard({
  event,
  onToggleCoachingSession,
  onToggleClassSession,
  onCreateWorkout,
  onViewWorkout,
  onOpenInCalendar,
  compact = false
}: GoogleCalendarEventCardProps) {
  const { config } = useCalendarStore();
  const startTime = new Date(event.start.dateTime);
  const endTime = new Date(event.end.dateTime);
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true,
      timeZone: getAppTimezone()
    });
  };

  const getEventTypeColor = () => {
    if (event.linkedWorkoutId) {
      return 'bg-green-100 border-green-300 text-green-800'; // Linked to workout
    } else if (event.isClassSession) {
      if (config.classColor) {
        switch (config.classColor) {
          case 'blue': return 'bg-blue-100 border-blue-300 text-blue-800';
          case 'purple': return 'bg-purple-100 border-purple-300 text-purple-800';
          case 'green': return 'bg-green-100 border-green-300 text-green-800';
          case 'orange': return 'bg-orange-100 border-orange-300 text-orange-800';
          case 'pink': return 'bg-pink-100 border-pink-300 text-pink-800';
        }
      }
      return 'bg-purple-100 border-purple-300 text-purple-800'; // Class session
    } else if (event.isCoachingSession) {
      if (config.coachingColor) {
        switch (config.coachingColor) {
          case 'blue': return 'bg-blue-100 border-blue-300 text-blue-800';
          case 'purple': return 'bg-purple-100 border-purple-300 text-purple-800';
          case 'green': return 'bg-green-100 border-green-300 text-green-800';
          case 'orange': return 'bg-orange-100 border-orange-300 text-orange-800';
          case 'pink': return 'bg-pink-100 border-pink-300 text-pink-800';
        }
      }
      return 'bg-orange-100 border-orange-300 text-orange-800'; // Coaching session without workout
    } else {
      return 'bg-gray-100 border-gray-300 text-gray-600'; // Personal event
    }
  };

  const getEventTypeBadge = () => {
    if (event.linkedWorkoutId) {
      return <Badge variant="secondary" className="bg-green-100 text-green-800">Linked</Badge>;
    } else if (event.isClassSession) {
      let colorClass = 'bg-purple-100 text-purple-800';
      if (config.classColor) {
        switch (config.classColor) {
          case 'blue': colorClass = 'bg-blue-100 text-blue-800'; break;
          case 'purple': colorClass = 'bg-purple-100 text-purple-800'; break;
          case 'green': colorClass = 'bg-green-100 text-green-800'; break;
          case 'orange': colorClass = 'bg-orange-100 text-orange-800'; break;
          case 'pink': colorClass = 'bg-pink-100 text-pink-800'; break;
        }
      }
      return <Badge variant="secondary" className={colorClass}>Class</Badge>;
    } else if (event.isCoachingSession) {
      let colorClass = 'bg-orange-100 text-orange-800';
      if (config.coachingColor) {
        switch (config.coachingColor) {
          case 'blue': colorClass = 'bg-blue-100 text-blue-800'; break;
          case 'purple': colorClass = 'bg-purple-100 text-purple-800'; break;
          case 'green': colorClass = 'bg-green-100 text-green-800'; break;
          case 'orange': colorClass = 'bg-orange-100 text-orange-800'; break;
          case 'pink': colorClass = 'bg-pink-100 text-pink-800'; break;
        }
      }
      return <Badge variant="secondary" className={colorClass}>Coaching</Badge>;
    } else {
      return <Badge variant="secondary" className="bg-gray-100 text-gray-600">Personal</Badge>;
    }
  };

  if (compact) {
    return (
      <div className={`p-2 rounded-md border text-xs ${getEventTypeColor()}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{event.summary}</p>
            <p className="text-xs opacity-75">
              {formatTime(startTime)} - {formatTime(endTime)}
            </p>
          </div>
          {getEventTypeBadge()}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 rounded-lg border ${getEventTypeColor()}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold truncate">{event.summary}</h4>
          <div className="flex items-center gap-2 text-sm mt-1">
            <Clock className="h-3 w-3 opacity-75" />
            <span className="font-bold opacity-90">{formatTime(startTime)} - {formatTime(endTime)}</span>
            {event.location && (() => {
              const displayLocation = useCalendarStore.getState().getLocationDisplay(event.location);
              return displayLocation ? (
                <>
                  <span className="mx-1 opacity-75">@</span>
                  <MapPin className="h-3 w-3 opacity-75" />
                  <span className="font-bold opacity-90">{displayLocation}</span>
                </>
              ) : null;
            })()}
          </div>
        </div>
        {getEventTypeBadge()}
      </div>

      {/* Description */}
      {event.description && (
        <p className="text-sm opacity-75 mb-3 line-clamp-2">
          {event.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 text-xs">
        {/* Coaching Session Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleCoachingSession(event.id, !event.isCoachingSession)}
          className="h-6 px-2 text-xs"
          title={event.isCoachingSession ? "Mark as personal event" : "Mark as coaching session"}
        >
          {event.isCoachingSession ? (
            <ToggleRight className="h-3 w-3 mr-1" />
          ) : (
            <ToggleLeft className="h-3 w-3 mr-1" />
          )}
          Coaching
        </Button>

        {/* Class Session Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleClassSession(event.id, !event.isClassSession)}
          className="h-6 px-2 text-xs"
          title={event.isClassSession ? "Mark as personal event" : "Mark as class session"}
        >
          {event.isClassSession ? (
            <ToggleRight className="h-3 w-3 mr-1" />
          ) : (
            <ToggleLeft className="h-3 w-3 mr-1" />
          )}
          Class
        </Button>

        {/* Workout Actions */}
        {event.isCoachingSession && (
          <>
            {event.linkedWorkoutId ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewWorkout(event.linkedWorkoutId!)}
                className="h-6 px-2 text-xs"
              >
                <Eye className="h-3 w-3 mr-1" />
                View Workout
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onCreateWorkout(event)}
                className="h-6 px-2 text-xs"
              >
                <PlusCircle className="h-3 w-3 mr-1" />
                Create Workout
              </Button>
            )}
          </>
        )}

        {/* Open in Google Calendar */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onOpenInCalendar(event)}
          className="h-6 px-2 text-xs ml-auto"
          title="Open in Google Calendar"
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Only re-render if event or callbacks change
  return (
    prevProps.event.id === nextProps.event.id &&
    prevProps.event.summary === nextProps.event.summary &&
    prevProps.event.start.dateTime === nextProps.event.start.dateTime &&
    prevProps.compact === nextProps.compact
  );
});


