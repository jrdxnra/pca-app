"use client";

import React from 'react';
import { Dumbbell, Calendar, Clock } from 'lucide-react';
import { GoogleCalendarEvent } from '@/lib/google-calendar/types';
import { ClientWorkout } from '@/lib/types';
import { getAppTimezone } from '@/lib/utils/timezone';

interface UnifiedDayCardProps {
    event?: GoogleCalendarEvent | null;
    workout?: ClientWorkout | any | null;
    categoryColor?: string;
    clientName?: string;
    onEventClick?: () => void;
    onWorkoutClick?: () => void;
    compact?: boolean; // For month view (smaller)
}

export function UnifiedDayCard({
    event,
    workout,
    categoryColor = '#3b82f6',
    clientName,
    onEventClick,
    onWorkoutClick,
    compact = false
}: UnifiedDayCardProps) {
    // Determine display values
    const eventTime = event?.start?.dateTime
        ? new Date(event.start.dateTime).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: getAppTimezone()
        })
        : null;

    const eventTitle = event?.summary || null;
    const workoutTitle = workout?.sessionType || workout?.categoryName || workout?.title || null;

    const hasEvent = !!event;
    const hasWorkout = !!workout;

    // Unified status
    const isLinked = hasEvent && hasWorkout;
    const isEventOnly = hasEvent && !hasWorkout;
    const isWorkoutOnly = !hasEvent && hasWorkout;

    // Compact mode (for month view small cells)
    if (compact) {
        return (
            <div
                className={`
          flex items-center gap-1 text-[10px] rounded overflow-hidden
          border shadow-sm cursor-pointer
          ${isLinked ? 'bg-gradient-to-r from-gray-50 to-blue-50 hover:from-gray-100 hover:to-blue-100' : ''}
          ${isEventOnly ? 'bg-gray-50 hover:bg-gray-100' : ''}
          ${isWorkoutOnly ? 'bg-blue-50 hover:bg-blue-100' : ''}
        `}
                style={{ borderLeftColor: categoryColor, borderLeftWidth: 3 }}
            >
                {/* Left: Event Info */}
                <div
                    className={`flex-1 flex items-center gap-1 p-1 min-w-0 ${hasEvent ? 'cursor-pointer' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onEventClick) onEventClick();
                    }}
                >
                    {hasEvent ? (
                        <>
                            <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: categoryColor }}
                            />
                            <span className="truncate font-medium text-gray-700">
                                {clientName || eventTitle || 'Event'}
                            </span>
                            {eventTime && (
                                <span className="text-gray-400 text-[9px] flex-shrink-0">
                                    {eventTime}
                                </span>
                            )}
                        </>
                    ) : (
                        <span className="text-gray-300 italic">No Event</span>
                    )}
                </div>

                {/* Separator */}
                <div className="w-px h-4 bg-gray-200" />

                {/* Right: Workout Info */}
                <div
                    className={`flex-1 flex items-center gap-1 p-1 min-w-0 ${hasWorkout ? 'cursor-pointer' : ''}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onWorkoutClick) onWorkoutClick();
                    }}
                >
                    {hasWorkout ? (
                        <>
                            <Dumbbell className="h-2.5 w-2.5 text-blue-600 flex-shrink-0" />
                            <span className="truncate font-medium text-blue-800">
                                {workoutTitle || 'Workout'}
                            </span>
                        </>
                    ) : (
                        <span className="text-gray-300 italic text-[9px]">No Plan</span>
                    )}
                </div>
            </div>
        );
    }

    // Full mode (for week/day view larger cells)
    return (
        <div
            className={`
        flex rounded-lg overflow-hidden border shadow-sm
        ${isLinked ? 'bg-gradient-to-r from-white to-blue-50/50' : ''}
        ${isEventOnly ? 'bg-white' : ''}
        ${isWorkoutOnly ? 'bg-blue-50/30' : ''}
        transition-shadow hover:shadow-md
      `}
            style={{ borderLeftColor: categoryColor, borderLeftWidth: 4 }}
        >
            {/* Left Section: Event */}
            <div
                className={`
          flex-1 p-2 flex flex-col justify-center min-w-0
          ${hasEvent ? 'cursor-pointer hover:bg-gray-50' : 'bg-gray-50/50'}
          border-r border-gray-100
        `}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onEventClick) onEventClick();
                }}
            >
                {hasEvent ? (
                    <>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <Calendar className="h-3 w-3 text-gray-500 flex-shrink-0" />
                            <span className="text-xs font-semibold text-gray-800 truncate">
                                {eventTitle}
                            </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-gray-500">
                            {eventTime && (
                                <>
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>{eventTime}</span>
                                </>
                            )}
                            {clientName && (
                                <span className="ml-1 truncate">• {clientName}</span>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span className="text-xs italic">No Scheduled Event</span>
                    </div>
                )}
            </div>

            {/* Right Section: Workout */}
            <div
                className={`
          flex-1 p-2 flex flex-col justify-center min-w-0
          ${hasWorkout ? 'cursor-pointer hover:bg-blue-50' : 'bg-blue-50/30'}
        `}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onWorkoutClick) onWorkoutClick();
                }}
            >
                {hasWorkout ? (
                    <>
                        <div className="flex items-center gap-1.5 mb-0.5">
                            <Dumbbell className="h-3 w-3 text-blue-600 flex-shrink-0" />
                            <span className="text-xs font-semibold text-blue-800 truncate">
                                {workoutTitle}
                            </span>
                        </div>
                        <span className="text-[11px] text-blue-600">
                            View Plan →
                        </span>
                    </>
                ) : (
                    <div className="flex items-center gap-1.5 text-gray-400">
                        <Dumbbell className="h-3 w-3" />
                        <span className="text-xs italic">No Workout Plan</span>
                    </div>
                )}
            </div>
        </div>
    );
}
