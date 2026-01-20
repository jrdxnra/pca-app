"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Save } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getMonth, getYear, addMonths, startOfYear } from 'date-fns';
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
  onSave?: (periods: ClientPeriodAssignment[]) => Promise<void>;
}

// Helper to safely convert dates (kept for potential future use)
// const safeToDate = (dateValue: Date | Timestamp | string | number | undefined): Date => {
//   if (!dateValue) return new Date();
//   if (dateValue instanceof Date) return dateValue;
//   if (typeof dateValue === 'object' && 'toDate' in dateValue) return dateValue.toDate();
//   if (typeof dateValue === 'object' && 'seconds' in dateValue) {
//     const tsObj = dateValue as { seconds: number; nanoseconds: number };
//     return new Date(tsObj.seconds * 1000);
//   }
//   if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
//   return new Date();
// };

export function PeriodizationTimeline({
  periods,
  title = 'Training Phases',
  onSave
}: PeriodizationTimelineProps) {
  const [monthPeriods, setMonthPeriods] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // Generate exactly 12 months starting from January of current year
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(new Date()), i));

  const monthKey = (date: Date) => `${getMonth(date)}-${getYear(date)}`;

  const getPeriodForMonth = (monthDate: Date) => {
    const key = monthKey(monthDate);
    return monthPeriods[key];
  };

  const setPeriodForMonth = (monthDate: Date, periodId: string) => {
    const key = monthKey(monthDate);
    setMonthPeriods(prev => ({
      ...prev,
      [key]: periodId
    }));
  };

  const sortedPeriods = [...periods].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleSave = async () => {
    if (!onSave) return;
    
    setSaving(true);
    try {
      const newPeriods: ClientPeriodAssignment[] = [];
      
      Object.entries(monthPeriods).forEach(([monthKeyStr, periodId]) => {
        if (!periodId) return;
        
        const [monthNum, yearNum] = monthKeyStr.split('-').map(Number);
        const monthDate = new Date(yearNum, monthNum, 1);
        const monthStart = startOfMonth(monthDate);
        const monthEnd = endOfMonth(monthDate);
        
        const periodConfig = periods.find(p => p.id === periodId);
        if (!periodConfig) return;
        
        newPeriods.push({
          id: `${periodId}-${monthKeyStr}`,
          periodConfigId: periodId,
          periodName: periodConfig.name,
          periodColor: periodConfig.color,
          startDate: monthStart,
          endDate: monthEnd
        });
      });

      await onSave(newPeriods);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>

      {/* Month columns - all 12 on one row */}
      <div className="flex gap-0 w-full">
        {months.map((monthDate) => {
          const key = monthKey(monthDate);
          const selectedPeriodId = getPeriodForMonth(monthDate);
          const selectedPeriod = periods.find(p => p.id === selectedPeriodId);

          return (
            <div key={key} className="flex flex-col flex-1 min-w-0" style={{ minWidth: 'calc(100% / 12)' }}>
              {/* Month header */}
              <div className="text-xs font-semibold text-muted-foreground text-center py-0.5 border-b border-r h-6 flex items-center justify-center">
                {format(monthDate, 'MMM')}
              </div>

              {/* Selected period or dropdown */}
              {selectedPeriod ? (
                <Select value={selectedPeriodId || ''} onValueChange={(value) => setPeriodForMonth(monthDate, value)}>
                  <SelectTrigger className="h-16 text-xs w-full rounded-none border-r flex-1 p-1" style={{ backgroundColor: selectedPeriod.color, color: 'white', border: 'none' }}>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Clear</SelectItem>
                    {sortedPeriods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: period.color }} />
                          <span className="text-xs">{period.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select value="" onValueChange={(value) => setPeriodForMonth(monthDate, value)}>
                  <SelectTrigger className="h-16 text-xs w-full rounded-none border-r border-l p-1 bg-gray-50" style={{ border: 'none' }}>
                    <SelectValue placeholder="-" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedPeriods.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: period.color }} />
                          <span className="text-xs">{period.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          );
        })}
      </div>

      {/* Save button and legend */}
      <div className="space-y-2 pt-2 border-t">
        {onSave && (
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} size="sm" variant="outline" className="gap-1">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}

        {/* Available periods legend */}
        {sortedPeriods.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Available Periods:</p>
            <div className="flex flex-wrap gap-2">
              {sortedPeriods.map((period) => (
                <div key={period.id} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: period.color }} />
                  <span className="text-xs">{period.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
