"use client";

import React, { useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Save, Plus, X, Flag } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getMonth, getYear, addMonths, startOfYear, parse } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Input } from '@/components/ui/input';

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

interface EventGoal {
  id: string;
  description: string;
  date: string; // ISO date string
}

interface PeriodizationTimelineProps {
  periods: Period[];
  clientPeriods?: ClientPeriodAssignment[];
  clientEventGoals?: EventGoal[]; // Saved event goals from client
  clientCreatedAt?: Date | { toDate(): Date }; // Client's creation date for year range
  title?: string;
  onSave?: (periods: ClientPeriodAssignment[], goals: EventGoal[]) => Promise<void>;
  showSaveButton?: boolean;
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

export const PeriodizationTimeline = forwardRef(function PeriodizationTimeline({
  periods,
  clientPeriods = [],
  clientEventGoals = [],
  clientCreatedAt,
  title = 'Training Phases',
  onSave,
  showSaveButton = true
}: PeriodizationTimelineProps, ref) {
  const [monthPeriods, setMonthPeriods] = useState<Record<string, string>>({});
  const [eventGoals, setEventGoals] = useState<EventGoal[]>([]);
  const [saving, setSaving] = useState(false);

  // Initialize displayYear based on client creation date
  const getInitialDisplayYear = () => {
    if (clientCreatedAt) {
      let createdDate: Date;
      if (clientCreatedAt instanceof Date) {
        createdDate = clientCreatedAt;
      } else if ('toDate' in clientCreatedAt) {
        createdDate = (clientCreatedAt as { toDate(): Date }).toDate();
      } else {
        createdDate = new Date();
      }
      return getYear(createdDate);
    }
    return getYear(new Date());
  };

  const [displayYear, setDisplayYear] = useState<number>(getInitialDisplayYear());

  // Initialize monthPeriods from clientPeriods on mount
  React.useEffect(() => {
    if (clientPeriods.length > 0) {
      const initialized: Record<string, string> = {};
      clientPeriods.forEach(cp => {
        // Convert both start and end dates
        let startDate: Date;
        let endDate: Date;
        
        if (cp.startDate instanceof Date) {
          startDate = cp.startDate;
        } else if ('toDate' in cp.startDate) {
          startDate = (cp.startDate as { toDate(): Date }).toDate();
        } else {
          startDate = new Date(cp.startDate);
        }
        
        if (cp.endDate instanceof Date) {
          endDate = cp.endDate;
        } else if ('toDate' in cp.endDate) {
          endDate = (cp.endDate as { toDate(): Date }).toDate();
        } else {
          endDate = new Date(cp.endDate);
        }
        
        // Calculate all months between start and end date
        let currentMonth = startOfMonth(startDate);
        const end = endOfMonth(endDate);
        
        while (currentMonth <= end) {
          const month = getMonth(currentMonth);
          const year = getYear(currentMonth);
          const key = `${month}-${year}`;
          initialized[key] = cp.periodConfigId;
          currentMonth = addMonths(currentMonth, 1);
        }
      });
      console.log('[PeriodizationTimeline] Initialized monthPeriods from clientPeriods:', initialized);
      setMonthPeriods(initialized);
    }
  }, [clientPeriods]);

  // Initialize eventGoals from client's saved goals
  React.useEffect(() => {
    if (clientEventGoals.length > 0) {
      setEventGoals(clientEventGoals);
    } else {
      // Default empty goal for new clients
      setEventGoals([{ id: '1', description: '', date: '' }]);
    }
  }, [clientEventGoals]);


  const getYearRange = () => {
    const currentYear = getYear(new Date());
    
    // Determine start year from client creation date or current year
    let startYear = currentYear;
    if (clientCreatedAt) {
      let createdDate: Date;
      if (clientCreatedAt instanceof Date) {
        createdDate = clientCreatedAt;
      } else if ('toDate' in clientCreatedAt) {
        createdDate = (clientCreatedAt as { toDate(): Date }).toDate();
      } else {
        createdDate = new Date();
      }
      startYear = getYear(createdDate);
    }
    
    return { start: startYear, end: currentYear + 2 };
  };

  // Generate 12 months for the selected year
  const months = Array.from({ length: 12 }, (_, i) => addMonths(startOfYear(new Date(displayYear, 0, 1)), i));
  const yearRange = getYearRange();

  const monthKey = (date: Date) => `${getMonth(date)}-${getYear(date)}`;

  const getPeriodForMonth = (monthDate: Date) => {
    const key = monthKey(monthDate);
    return monthPeriods[key];
  };

  const setPeriodForMonth = (monthDate: Date, periodId: string) => {
    const key = monthKey(monthDate);
    console.log('[PeriodizationTimeline] Setting period for month:', { key, periodId, monthDate: monthDate.toISOString() });
    setMonthPeriods(prev => {
      const updated = {
        ...prev,
        [key]: periodId
      };
      console.log('[PeriodizationTimeline] monthPeriods updated:', updated);
      return updated;
    });
  };

  const sortedPeriods = [...periods].sort((a, b) => (a.order || 0) - (b.order || 0));

  const getEventGoalsForMonth = useCallback((monthDate: Date) => {
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    return eventGoals.filter(goal => {
      const goalDate = parse(goal.date, 'yyyy-MM-dd', new Date());
      return goalDate >= monthStart && goalDate <= monthEnd;
    });
  }, [eventGoals]);

  const addEventGoal = useCallback(() => {
    const newId = Date.now().toString();
    const newGoal: EventGoal = {
      id: newId,
      description: '',
      date: ''
    };
    setEventGoals(prev => [...prev, newGoal]);
  }, []);

  const updateEventGoal = useCallback((id: string, field: 'description' | 'date', value: string) => {
    setEventGoals(prev => prev.map(goal => 
      goal.id === id ? { ...goal, [field]: value } : goal
    ));
  }, []);

  const removeEventGoal = useCallback((id: string) => {
    setEventGoals(prev => prev.filter(goal => goal.id !== id));
  }, []);

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
        
        console.log('Creating period:', {
          monthKeyStr,
          monthNum,
          yearNum,
          monthDate: monthDate.toISOString(),
          monthStart: monthStart.toISOString(),
          monthEnd: monthEnd.toISOString(),
          isValidStart: !isNaN(monthStart.getTime()),
          isValidEnd: !isNaN(monthEnd.getTime())
        });
        
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

      // Filter out empty goals
      const validGoals = eventGoals.filter(g => g.description.trim() || g.date.trim());

      await onSave(newPeriods, validGoals);
    } finally {
      setSaving(false);
    }
  };

  // Expose method to get current period selections for parent to save
  useImperativeHandle(ref, () => ({
    async getSaveData() {
      console.log('[PeriodizationTimeline] getSaveData called with monthPeriods:', monthPeriods);
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

      // Filter out empty goals
      const validGoals = eventGoals.filter(g => g.description.trim() || g.date.trim());

      console.log('[PeriodizationTimeline] getSaveData returning:', { periods: newPeriods.length, goals: validGoals.length });
      return { periods: newPeriods, goals: validGoals };
    }
  }));

  return (
    <div className="space-y-3">
      {/* Header with Year Navigation and Save Button */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          <div className="flex items-center gap-1">
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDisplayYear(displayYear - 1);
              }}
              disabled={displayYear <= yearRange.start}
            >
              ←
            </Button>
            <span className="text-sm font-medium w-12 text-center">{displayYear}</span>
            <Button 
              type="button"
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDisplayYear(displayYear + 1);
              }}
              disabled={displayYear >= yearRange.end}
            >
              →
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            type="button"
            variant="destructive" 
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMonthPeriods({});
              setEventGoals([{ id: '1', description: '', date: '' }]);
            }}
            className="text-xs"
          >
            Clear All
          </Button>
          {showSaveButton && onSave && (
            <Button type="button" onClick={handleSave} disabled={saving} size="sm" variant="outline" className="gap-1">
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </div>
      </div>

      {/* Month columns - all 12 on one row */}
      <div className="flex gap-0 w-full">
        {months.map((monthDate) => {
          const key = monthKey(monthDate);
          const selectedPeriodId = getPeriodForMonth(monthDate);
          const selectedPeriod = periods.find(p => p.id === selectedPeriodId);
          const monthEventGoals = getEventGoalsForMonth(monthDate);

          return (
            <div key={key} className="flex flex-col flex-1 min-w-0 relative" style={{ minWidth: 'calc(100% / 12)' }}>
              {/* Month header */}
              <div className="text-xs font-semibold text-muted-foreground text-center py-0.5 border-b border-r h-6 flex items-center justify-center relative">
                {format(monthDate, 'MMM')}
                {monthEventGoals.length > 0 && (
                  <Flag className="h-3 w-3 absolute right-0.5 text-red-500 fill-red-500" />
                )}
              </div>

              {/* Period selector */}
              <Select value={selectedPeriodId || ''} onValueChange={(value) => {
                console.log('[PeriodizationTimeline] Dropdown onChange fired:', { monthDate: monthDate.toISOString(), selectedValue: value });
                setPeriodForMonth(monthDate, value);
              }}>
                <SelectTrigger 
                  className="h-16 text-xs w-full rounded-none border-r flex-1 p-0 flex items-center justify-center" 
                  style={{ 
                    backgroundColor: selectedPeriod?.color || '#f3f4f6',
                    color: selectedPeriod ? 'white' : 'inherit',
                    border: 'none'
                  }}
                >
                  {selectedPeriod ? (
                    <span className="text-xs">{selectedPeriod.name.substring(0, 4).toUpperCase()}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
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
            </div>
          );
        })}
      </div>

      {/* Event Goals Section */}
      <div className="space-y-2 max-w-md pt-2 border-t">
        <p className="text-xs font-semibold text-muted-foreground">Event Goals:</p>
        
        {/* Event Goals List */}
        {eventGoals.length > 0 && (
          <div className="space-y-1.5">
            {eventGoals.map((goal) => (
              <div key={goal.id} className="flex gap-2 items-center group">
                <div className="flex-1 flex gap-2">
                  <Input 
                    placeholder="Description"
                    value={goal.description}
                    onChange={(e) => updateEventGoal(goal.id, 'description', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    className="h-8 text-sm flex-1"
                  />
                  <Input 
                    type="date"
                    value={goal.date}
                    onChange={(e) => updateEventGoal(goal.id, 'date', e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                    className="h-8 text-sm w-32"
                  />
                </div>
                <Button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    removeEventGoal(goal.id);
                  }}
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
        
        <Button 
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            addEventGoal();
          }}
          size="sm" 
          variant="outline"
          className="gap-1 h-7 w-fit"
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
    </div>
  );
});

// Memoize to prevent unnecessary re-renders when parent (AddClientDialog) re-renders
PeriodizationTimeline.displayName = 'PeriodizationTimeline';
export const MemoizedPeriodizationTimeline = React.memo(PeriodizationTimeline);
