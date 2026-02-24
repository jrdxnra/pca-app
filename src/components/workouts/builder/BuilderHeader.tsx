"use client";

import { Users, ChevronLeft, ChevronRight, ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColumnVisibilityToggle } from '@/components/workouts/ColumnVisibilityToggle';

import { Client } from '@/lib/types';
import { QuickWorkoutBuilderDialog } from '@/components/programs/QuickWorkoutBuilderDialog';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { AssignWeekDialog } from '@/components/programs/AssignWeekDialog';
import { safeToDate } from '@/lib/utils/dateHelpers';
import { ClientProgramPeriod } from '@/lib/types';

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

  onAssignWeek: (assignment: {
    weekTemplateId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
  }) => Promise<void>;

  // Quick workout
  onWorkoutCreated: () => void;

  // Week order
  weekOrder: 'ascending' | 'descending';
  onWeekOrderChange: (order: 'ascending' | 'descending') => void;

  // Day view toggle
  showDayView: boolean;
  onShowDayViewChange: (show: boolean) => void;

  // Column visibility
  viewMode: 'month' | 'week' | 'day';
  visibleColumns: {
    tempo?: boolean;
    distance?: boolean;
    rpe?: boolean;
    percentage?: boolean;
  };
  onColumnVisibilityChange: (column: 'tempo' | 'distance' | 'rpe' | 'percentage', visible: boolean) => void;
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
  weekTemplates,
  clientPrograms,
  onAssignPeriod,
  onAssignWeek,
  onWorkoutCreated,
  weekOrder,
  onWeekOrderChange,
  showDayView,
  onShowDayViewChange,
  viewMode,
  visibleColumns,
  onColumnVisibilityChange,
}: BuilderHeaderProps) {
  const clientName = clientId ? (clients.find(c => c.id === clientId)?.name || 'Unknown Client') : '';
  const existingAssignments = clientId ? (clientPrograms.find(cp => cp.clientId === clientId)?.periods || []) : [];

  return (
    <div className="flex flex-wrap items-center justify-between gap-1 gap-y-4">
      {/* Left aligned - Client Selector & Navigation */}
      <div className="flex items-center gap-1 lg:gap-2">
        {/* Client Selector Group */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 icon-clients" />
          </div>

          <Select
            value={clientIdImmediate || ''}
            onValueChange={onClientChange}
            disabled={loading}
          >
            <SelectTrigger className={`w-[130px] ${!clientId ? 'border-green-300 bg-green-50' : ''}`}>
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
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-200 mx-0.5"></div>

        {/* Navigation */}
        <Button variant="outline" size="sm" onClick={() => onNavigate('today')} className="text-sm px-3 h-8">
          Today
        </Button>
        <div className="flex items-center rounded-md border border-input shadow-sm">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('prev')}
            className="p-1 h-8 w-8 rounded-l-md rounded-r-none border-r hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4 icon-builder" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('next')}
            className="p-1 h-8 w-8 rounded-r-md rounded-l-none hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4 icon-builder" />
          </Button>
        </div>
        <div className="min-w-[110px] font-medium text-sm px-2 tabular-nums">
          {navigationLabel}
        </div>

        {/* Separator */}
        <div className="h-4 w-px bg-slate-200 mx-0.5"></div>

        {/* Sort Toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onWeekOrderChange(weekOrder === 'ascending' ? 'descending' : 'ascending')}
          className="h-8 w-8 p-0 rounded-full hover:bg-purple-50 hover:text-purple-600 text-slate-500 transition-colors"
          title={`Sort weeks: ${weekOrder} (click to toggle)`}
        >
          <ArrowUp
            className={`h-5 w-5 transition-transform duration-200 ${weekOrder === 'descending' ? 'rotate-180' : ''
              }`}
          />
        </Button>

        {/* Day/Week Toggle */}
        <div className="flex items-center gap-0.5 bg-slate-50 p-0.5 rounded-lg">
          <button
            onClick={() => onShowDayViewChange(true)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200
              ${showDayView
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'}
            `}
          >
            Day
          </button>
          <button
            onClick={() => onShowDayViewChange(false)}
            className={`
              px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200
              ${!showDayView
                ? 'bg-white text-purple-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'}
            `}
          >
            Week
          </button>
        </div>
      </div>

      {/* Right aligned - Tools, Filters, Sort */}
      <div className="flex items-center gap-2">
        {/* Column Visibility Toggle (Moved here, before Sort) */}
        <ColumnVisibilityToggle
          visibleColumns={visibleColumns}
          availableColumns={{
            tempo: true,
            distance: true,
            rpe: true,
            percentage: true
          }}
          onToggle={onColumnVisibilityChange}
        />
        {/* Tools & Toggles */}
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
        {clientId && (
          <AssignWeekDialog
            clientId={clientId}
            weekTemplates={weekTemplates}
            onAssignWeek={onAssignWeek}
            loading={loading}
          />
        )}





      </div>
    </div>
  );
}
