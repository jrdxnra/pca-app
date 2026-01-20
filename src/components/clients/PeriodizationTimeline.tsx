"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { Timestamp } from 'firebase/firestore';

interface Period {
  id: string;
  name: string;
  color: string;
  focus: string;
  order?: number;
}

interface ClientPeriodAssignment {
  id: string;
  periodConfigId: string;
  periodName: string;
  periodColor: string;
  startDate: Date | Timestamp;
  endDate: Date | Timestamp;
}

interface PeriodizationTimelineProps {
  periods: Period[];
  clientPeriods?: ClientPeriodAssignment[];
  title?: string;
}

// Helper to safely convert dates
const safeToDate = (dateValue: Date | Timestamp | string | number | undefined): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue === 'object' && 'toDate' in dateValue) return dateValue.toDate();
  if (typeof dateValue === 'object' && 'seconds' in dateValue) {
    const tsObj = dateValue as { seconds: number; nanoseconds: number };
    return new Date(tsObj.seconds * 1000);
  }
  if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
  return new Date();
};

export function PeriodizationTimeline({
  periods,
  clientPeriods = [],
  title = 'Periodization Timeline'
}: PeriodizationTimelineProps) {
  // Sort periods by order
  const sortedPeriods = [...periods].sort((a, b) => (a.order || 0) - (b.order || 0));

  // Calculate total duration for visualization
  let overallStart: Date | null = null;
  let overallEnd: Date | null = null;

  if (clientPeriods.length > 0) {
    const dates = clientPeriods.map(p => ({
      start: safeToDate(p.startDate),
      end: safeToDate(p.endDate)
    }));
    overallStart = new Date(Math.min(...dates.map(d => d.start.getTime())));
    overallEnd = new Date(Math.max(...dates.map(d => d.end.getTime())));
  }

  const totalDays = overallStart && overallEnd ? differenceInDays(overallEnd, overallStart) + 1 : 0;

  const getPositionAndWidth = (start: Date, end: Date) => {
    if (!overallStart || !overallEnd || totalDays === 0) return { left: 0, width: 0 };
    
    const startDaysFromBeginning = differenceInDays(start, overallStart);
    const durationDays = differenceInDays(end, start) + 1;
    
    const left = (startDaysFromBeginning / totalDays) * 100;
    const width = (durationDays / totalDays) * 100;
    
    return { left, width };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          {title}
        </CardTitle>
        {clientPeriods.length > 0 && overallStart && overallEnd && (
          <CardDescription>
            {format(overallStart, 'MMM d, yyyy')} - {format(overallEnd, 'MMM d, yyyy')} 
            ({totalDays} {totalDays === 1 ? 'day' : 'days'})
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {clientPeriods.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No periods assigned yet
          </div>
        ) : (
          <>
            {/* Timeline visualization */}
            <div className="space-y-6">
              {/* Timeline bar */}
              <div className="relative">
                {/* Background track */}
                <div className="h-12 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                  {/* Period blocks */}
                  {clientPeriods.map((period) => {
                    const start = safeToDate(period.startDate);
                    const end = safeToDate(period.endDate);
                    const { left, width } = getPositionAndWidth(start, end);
                    
                    return (
                      <div
                        key={period.id}
                        className="absolute h-full flex items-center justify-center text-white text-xs font-semibold cursor-default hover:opacity-90 transition-opacity"
                        style={{
                          left: `${left}%`,
                          width: `${width}%`,
                          backgroundColor: period.periodColor,
                          minWidth: '30px'
                        }}
                        title={`${period.periodName} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`}
                      >
                        {width > 8 && <span className="truncate px-1">{period.periodName}</span>}
                      </div>
                    );
                  })}
                </div>

                {/* Date labels */}
                {overallStart && overallEnd && (
                  <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                    <span>{format(overallStart, 'MMM d')}</span>
                    <span>{format(overallEnd, 'MMM d')}</span>
                  </div>
                )}
              </div>

              {/* Period details list */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {clientPeriods.map((period) => {
                  const start = safeToDate(period.startDate);
                  const end = safeToDate(period.endDate);
                  const duration = differenceInDays(end, start) + 1;
                  const periodConfig = periods.find(p => p.id === period.periodConfigId);

                  return (
                    <div
                      key={period.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-gray-50 border border-gray-200"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: period.periodColor }}
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{period.periodName}</p>
                          {periodConfig && (
                            <p className="text-xs text-muted-foreground">{periodConfig.focus}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {format(start, 'MMM d')} - {format(end, 'MMM d')}
                        </p>
                        <Badge variant="outline" className="text-xs mt-1">
                          {duration} {duration === 1 ? 'day' : 'days'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            {sortedPeriods.length > 0 && (
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Available Periods:</p>
                <div className="flex flex-wrap gap-2">
                  {sortedPeriods.map((period) => (
                    <div key={period.id} className="flex items-center gap-1">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: period.color }}
                      />
                      <span className="text-xs">{period.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
