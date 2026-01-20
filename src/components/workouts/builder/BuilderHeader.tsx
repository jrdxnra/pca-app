"use client";

import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnVisibilityToggle } from '@/components/workouts/ColumnVisibilityToggle';
import { CategoryFilter } from '@/components/workouts/CategoryFilter';
import { Client } from '@/lib/types';
import { QuickWorkoutBuilderDialog } from '@/components/programs/QuickWorkoutBuilderDialog';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';

interface BuilderHeaderProps {
  // Client selection
  clients: Client[];
  clientId: string | null;
  clientIdImmediate: string | null;
  onClientChange: (clientId: string) => void;
  loading: boolean;
  
  // Date navigation
  calendarDate: Date;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
  navigationLabel: string;
  
  // Period assignment
  periods: any[];
  workoutCategories: any[];
  selectedCategories: string[];
  onCategorySelectionChange: (categories: string[]) => void;
  weekTemplates: any[];
  clientPrograms: any[];
  onAssignPeriod: (assignment: {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{ time?: string; isAllDay: boolean; category?: string; deleted?: boolean }>;
  }) => Promise<void>;
  
  // Quick workout
  onWorkoutCreated: () => void;
  
  // Week order
  weekOrder: 'ascending' | 'descending';
  onWeekOrderChange: (order: 'ascending' | 'descending') => void;
  
  // Column visibility
  viewMode: 'month' | 'week' | 'day';
}

export function BuilderHeader({
  clients,
  clientId,
  clientIdImmediate,
  onClientChange,
  loading,
  calendarDate,
  onNavigate,
  navigationLabel,
  periods,
  workoutCategories,
  selectedCategories,
  onCategorySelectionChange,
  weekTemplates,
  clientPrograms,
  onAssignPeriod,
  onWorkoutCreated,
  weekOrder,
  onWeekOrderChange,
  viewMode,
}: BuilderHeaderProps) {
  const clientName = clientId ? (clients.find(c => c.id === clientId)?.name || 'Unknown Client') : '';
  const existingAssignments = clientId ? (clientPrograms.find(cp => cp.clientId === clientId)?.periods || []) : [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {/* Left aligned - Client Selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 icon-clients" />
          <label className="text-sm font-medium">Client:</label>
        </div>
        <Select 
          value={clientIdImmediate || ''} 
          onValueChange={onClientChange} 
          disabled={loading}
        >
          <SelectTrigger className={`w-[200px] ${!clientId ? 'border-green-300 bg-green-50' : ''}`}>
            <SelectValue placeholder="Select client" />
          </SelectTrigger>
          <SelectContent>
            {clients.map((client) => (
              client.id && (
                <SelectItem key={client.id} value={client.id}>
                  {client.name}
                </SelectItem>
              )
            ))}
          </SelectContent>
        </Select>
        {clientId && (
          <QuickWorkoutBuilderDialog
            clientId={clientId}
            clientName={clientName}
            onWorkoutCreated={onWorkoutCreated}
          />
        )}
        <PeriodAssignmentDialog
          clientId={clientId || ''}
          clientName={clientName}
          periods={periods}
          workoutCategories={workoutCategories}
          weekTemplates={weekTemplates}
          onAssignPeriod={onAssignPeriod}
          existingAssignments={existingAssignments}
        />
        
        {/* Filters - Category and Column Visibility */}
        {viewMode === 'day' && workoutCategories.length > 0 && (
          <CategoryFilter
            categories={workoutCategories}
            selectedCategories={selectedCategories}
            onSelectionChange={onCategorySelectionChange}
          />
        )}
        
        <ColumnVisibilityToggle
          visibleColumns={{}}
          availableColumns={{
            tempo: true,
            distance: true,
            rpe: true,
            percentage: true
          }}
          onToggle={() => {}}
        />
      </div>

      {/* Right aligned - Week Order, Week Selector (matches Schedule page) */}
      <div className="flex items-center gap-0.5 md:gap-1">
        {/* Week order dropdown */}
        <div className="flex items-center gap-1">
          <label htmlFor="weekOrder" className="text-xs md:text-sm font-medium">Week:</label>
          <Select 
            value={weekOrder} 
            onValueChange={(value) => onWeekOrderChange(value as 'ascending' | 'descending')}
          >
            <SelectTrigger className="w-[90px] md:w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ascending">Ascending</SelectItem>
              <SelectItem value="descending">Descending</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Button variant="outline" size="sm" onClick={() => onNavigate('today')} className="text-xs md:text-sm px-2 h-8">
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('prev')}
          className="p-1"
        >
          <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 icon-builder" />
        </Button>
        <div className="min-w-[90px] md:min-w-[110px] text-center font-medium text-xs md:text-sm">
          {navigationLabel}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onNavigate('next')}
          className="p-1"
        >
          <ChevronRight className="h-3 w-3 md:h-4 md:w-4 icon-builder" />
        </Button>
      </div>
    </div>
  );
}
