"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Client } from '@/lib/types';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { QuickWorkoutBuilderDialog } from '@/components/programs/QuickWorkoutBuilderDialog';

interface BuilderHeaderProps {
  clientId: string | null;
  clients: Client[];
  loading: boolean;
  calendarDate: Date;
  onClientChange: (clientId: string) => void;
  onNavigate: (direction: 'prev' | 'next' | 'today') => void;
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
  periods: any[];
  workoutCategories: any[];
  weekTemplates: any[];
  clientPrograms: any[];
}

export function BuilderHeader({
  clientId,
  clients,
  loading,
  calendarDate,
  onClientChange,
  onNavigate,
  onAssignPeriod,
  periods,
  workoutCategories,
  weekTemplates,
  clientPrograms
}: BuilderHeaderProps) {
  const selectedClient = clients.find(c => c.id === clientId);
  
  const getNavigationLabel = () => {
    const weekStart = new Date(calendarDate);
    weekStart.setDate(calendarDate.getDate() - calendarDate.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  };

  return (
    <Card className="py-2">
      <CardContent className="py-1 px-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Left: Client Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 icon-clients" />
              <label className="text-sm font-medium">Client:</label>
            </div>
            <Select value={clientId || ''} onValueChange={onClientChange} disabled={loading}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select client" />
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
            {clientId && (
              <>
                <QuickWorkoutBuilderDialog
                  clientId={clientId}
                  clientName={selectedClient?.name || 'Unknown Client'}
                />
                <PeriodAssignmentDialog
                  clientId={clientId}
                  clientName={selectedClient?.name || 'Unknown Client'}
                  periods={periods || []}
                  workoutCategories={workoutCategories || []}
                  weekTemplates={weekTemplates || []}
                  onAssignPeriod={onAssignPeriod}
                  existingAssignments={clientPrograms.find(cp => cp.clientId === clientId)?.periods || []}
                />
              </>
            )}
          </div>

          {/* Right: Date Navigation */}
          <div className="flex items-center gap-1 md:gap-2">
            <Button variant="outline" size="sm" onClick={() => onNavigate('today')} className="text-xs md:text-sm px-2">
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('prev')}
              className="p-1 md:p-2"
            >
              <ChevronLeft className="h-3 w-3 md:h-4 md:w-4 icon-schedule" />
            </Button>
            <div className="min-w-[110px] md:min-w-[140px] text-center font-medium text-sm">
              {getNavigationLabel()}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('next')}
              className="p-1 md:p-2"
            >
              <ChevronRight className="h-3 w-3 md:h-4 md:w-4 icon-schedule" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
