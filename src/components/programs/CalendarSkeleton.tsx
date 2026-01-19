"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton loader that matches the TwoColumnWeekView structure
 * Shows the calendar grid immediately while events load
 */
export function CalendarSkeleton({ includeWeekends = false }: { includeWeekends?: boolean }) {
  const weekDays = includeWeekends ? 7 : 5;
  const timeSlots = Array.from({ length: 12 }, (_, i) => i + 6); // 6 AM to 5 PM

  return (
    <Card className="py-1 gap-1" style={{ display: 'block', overflow: 'visible' }}>
      <CardContent className="p-0 pt-1" style={{ overflow: 'visible' }}>
        <div className="relative">
          {/* All-day events section */}
          <div className="border-b border-border mb-2 pb-2">
            <div className="flex gap-1 px-1">
              <div className="w-24 flex-shrink-0"></div>
              {Array.from({ length: weekDays }).map((_, dayIndex) => (
                <div key={dayIndex} className="flex-1 min-w-0">
                  <Skeleton className="h-6 w-full mb-1" />
                </div>
              ))}
            </div>
          </div>

          {/* Time slots */}
          <div className="flex gap-1">
            {/* Time column */}
            <div className="w-24 flex-shrink-0 pt-1">
              {timeSlots.map((hour) => (
                <div key={hour} className="h-16 flex items-start justify-end pr-2">
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>

            {/* Day columns */}
            {Array.from({ length: weekDays }).map((_, dayIndex) => (
              <div key={dayIndex} className="flex-1 min-w-0 border-r border-border last:border-r-0">
                {timeSlots.map((hour) => (
                  <div
                    key={hour}
                    className="h-16 border-b border-border last:border-b-0 relative"
                  >
                    {/* Occasional event skeleton for visual feedback */}
                    {dayIndex === 2 && hour === 9 && (
                      <div className="absolute top-1 left-1 right-1">
                        <Skeleton className="h-8 w-full rounded" />
                      </div>
                    )}
                    {dayIndex === 4 && hour === 14 && (
                      <div className="absolute top-1 left-1 right-1">
                        <Skeleton className="h-6 w-3/4 rounded" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Skeleton for day view - shows time slots with occasional event placeholders
 */
export function DayViewSkeleton() {
  const timeSlots = Array.from({ length: 12 }, (_, i) => i + 6);

  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-2">
          {timeSlots.map((hour) => (
            <div key={hour} className="flex gap-4 items-start">
              <div className="w-20 flex-shrink-0">
                <Skeleton className="h-4 w-16" />
              </div>
              <div className="flex-1">
                {/* Occasional event skeleton */}
                {hour % 3 === 0 && (
                  <Skeleton className="h-12 w-full rounded mb-2" />
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
