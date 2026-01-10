"use client";

import React, { useState } from 'react';
import { Plus, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PeriodAssignmentDialog } from './PeriodAssignmentDialog';
import { AssignProgramTemplateDialog } from './AssignProgramTemplateDialog';

interface AddAssignmentDropdownProps {
  // Period assignment props
  clientId: string | null;
  clientName: string;
  periods: any[];
  workoutCategories: any[];
  weekTemplates: any[];
  onAssignPeriod: (assignment: {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{time?: string; isAllDay: boolean}>;
  }) => void;
  existingAssignments: any[];
  
  // Program assignment props
  programs: any[];
  clients: any[];
  onAssignProgram: (assignment: {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
  }) => Promise<void>;
}

export function AddAssignmentDropdown({
  clientId,
  clientName,
  periods,
  workoutCategories,
  weekTemplates,
  onAssignPeriod,
  existingAssignments,
  programs,
  clients,
  onAssignProgram
}: AddAssignmentDropdownProps) {
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);
  const [programDialogOpen, setProgramDialogOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <>
      <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 w-9 p-0">
            <Plus className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setPeriodDialogOpen(true);
              setDropdownOpen(false);
            }}
            disabled={!clientId}
          >
            <Calendar className="h-4 w-4 mr-2 icon-period" />
            Assign Period
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setProgramDialogOpen(true);
              setDropdownOpen(false);
            }}
          >
            <Users className="h-4 w-4 mr-2 icon-clients" />
            Assign Program Template
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {clientId && (
        <PeriodAssignmentDialog
          clientId={clientId}
          clientName={clientName}
          periods={periods}
          workoutCategories={workoutCategories}
          weekTemplates={weekTemplates}
          onAssignPeriod={(assignment) => {
            onAssignPeriod(assignment);
            setPeriodDialogOpen(false);
          }}
          existingAssignments={existingAssignments}
          open={periodDialogOpen}
          onOpenChange={setPeriodDialogOpen}
        />
      )}

      <AssignProgramTemplateDialog
        programs={programs}
        clients={clients}
        onAssignProgram={async (assignment) => {
          await onAssignProgram(assignment);
          setProgramDialogOpen(false);
        }}
        open={programDialogOpen}
        onOpenChange={setProgramDialogOpen}
      />
    </>
  );
}

