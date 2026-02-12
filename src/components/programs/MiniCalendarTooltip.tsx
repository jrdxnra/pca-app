"use client";

import React, { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MiniCalendarTooltipProps {
  currentDate: Date;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

export function MiniCalendarTooltip({
  currentDate,
  selectedDate,
  onDateSelect
}: MiniCalendarTooltipProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredWeekIndex, setHoveredWeekIndex] = useState<number | null>(null);
  const [hoveredDayKey, setHoveredDayKey] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Track if mounted to avoid hydration mismatch with date comparisons
  useEffect(() => {
    setMounted(true);
  }, []);

  // Track displayed month separately from currentDate so user can navigate
  // Initialize from currentDate prop to avoid hydration mismatch
  const [displayedMonth, setDisplayedMonth] = useState(() =>
    new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
  );

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();

  // Navigate to previous month
  const goToPreviousMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayedMonth(new Date(year, month - 1, 1));
  };

  // Navigate to next month
  const goToNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDisplayedMonth(new Date(year, month + 1, 1));
  };

  // Reset to current date's month when tooltip opens
  React.useEffect(() => {
    if (isHovered) {
      setDisplayedMonth(new Date(currentDate.getFullYear(), currentDate.getMonth(), 1));
    }
  }, [isHovered, currentDate]);

  // Calculate the selected week range (Sunday to Saturday)
  const selectedWeekStart = new Date(selectedDate);
  selectedWeekStart.setDate(selectedDate.getDate() - selectedDate.getDay());
  selectedWeekStart.setHours(0, 0, 0, 0);
  const selectedWeekEnd = new Date(selectedWeekStart);
  selectedWeekEnd.setDate(selectedWeekStart.getDate() + 6);
  selectedWeekEnd.setHours(23, 59, 59, 999);

  // Get first day of month and calculate calendar grid
  const firstDay = new Date(year, month, 1);
  const startDate = new Date(firstDay);
  startDate.setDate(startDate.getDate() - firstDay.getDay());

  // Generate weeks (6 rows of 7 days each)
  const weeks: React.ReactElement[] = [];
  const currentDateObj = new Date(startDate);

  for (let weekIndex = 0; weekIndex < 6; weekIndex++) {
    const weekDays: React.ReactElement[] = [];

    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const dayDate = new Date(currentDateObj);
      const dayKey = dayDate.toISOString();
      const isCurrentMonth = dayDate.getMonth() === month;
      // Only check isToday after mount to avoid hydration mismatch
      const isToday = mounted && dayDate.toDateString() === new Date().toDateString();

      // Check if this day is in the selected week (only after mount to avoid hydration mismatch)
      const dayNormalized = new Date(dayDate);
      dayNormalized.setHours(12, 0, 0, 0);
      const isInSelectedWeek = mounted && dayNormalized >= selectedWeekStart && dayNormalized <= selectedWeekEnd;

      // Check if this day is in the hovered week
      const isInHoveredWeek = hoveredWeekIndex === weekIndex && !isInSelectedWeek;

      // Check if this specific day is hovered
      const isDayHovered = hoveredDayKey === dayKey;

      // Determine position in week for rounded corners
      const isWeekStart = dayIndex === 0;
      const isWeekEnd = dayIndex === 6;

      weekDays.push(
        <button
          key={dayKey}
          className={cn(
            "w-8 h-8 text-xs transition-all relative",
            isCurrentMonth ? 'text-gray-900' : 'text-gray-400 opacity-50',
            isToday && 'font-bold',
            // Selected week styling
            isInSelectedWeek && 'bg-blue-500 text-white',
            isInSelectedWeek && isWeekStart && 'rounded-l',
            isInSelectedWeek && isWeekEnd && 'rounded-r',
            // Hovered week styling (light background)
            isInHoveredWeek && 'bg-blue-100',
            isInHoveredWeek && isWeekStart && 'rounded-l',
            isInHoveredWeek && isWeekEnd && 'rounded-r',
          )}
          onMouseEnter={() => setHoveredDayKey(dayKey)}
          onMouseLeave={() => setHoveredDayKey(null)}
          onClick={() => {
            onDateSelect(dayDate);
            setIsHovered(false);
          }}
        >
          {/* Today indicator circle */}
          {isToday && (
            <span className={cn(
              "absolute inset-1 rounded-full border-2 pointer-events-none",
              isInSelectedWeek ? "border-blue-200" : "border-blue-300"
            )} />
          )}
          {/* Day hover circle */}
          {isDayHovered && !isToday && (
            <span className={cn(
              "absolute inset-0.5 rounded-full border-2 pointer-events-none transition-all",
              isInSelectedWeek ? "border-white" : "border-blue-500"
            )} />
          )}
          <span className="relative z-10">{dayDate.getDate()}</span>
        </button>
      );
      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }

    weeks.push(
      <div
        key={weekIndex}
        className="flex"
        onMouseEnter={() => setHoveredWeekIndex(weekIndex)}
        onMouseLeave={() => setHoveredWeekIndex(null)}
      >
        {weekDays}
      </div>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className="p-2 hover:bg-gray-100 rounded transition-colors"
        aria-label="Show calendar"
      >
        <CalendarIcon className="h-5 w-5 icon-schedule" />
      </button>

      <Card
        className={cn(
          "absolute top-full right-0 z-50 w-64 shadow-lg transition-all duration-200",
          isHovered ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        style={{ marginTop: '-8px', paddingTop: '8px' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <CardContent className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={goToPreviousMonth}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-sm">
              {displayedMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={goToNextMonth}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Day headers */}
          <div className="flex mb-2">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <div key={index} className="w-8 text-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid - week rows */}
          <div className="flex flex-col">
            {weeks}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

