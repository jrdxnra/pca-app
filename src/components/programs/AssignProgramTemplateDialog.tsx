"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar, Users, Clock, Calendar as CalendarIcon, Layers } from 'lucide-react';
import { Program, Client } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

interface AssignProgramTemplateDialogProps {
  programs: Program[];
  clients: Client[];
  onAssignProgram: (assignment: {
    programId: string;
    clientId: string;
    startDate: Date;
    endDate: Date;
    notes?: string;
  }) => Promise<void>;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AssignProgramTemplateDialog({
  programs,
  clients,
  onAssignProgram,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: AssignProgramTemplateDialogProps) {
  
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;
  const [selectedProgram, setSelectedProgram] = useState<string>('');
  const [selectedClient, setSelectedClient] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-select client if only one is passed (used from client cards)
  useEffect(() => {
    if (clients.length === 1) {
      setSelectedClient(clients[0].id);
    }
  }, [clients]);

  const handleSubmit = async () => {
    if (!selectedProgram || !selectedClient || !startDate || !endDate) {
      alert('Please fill in all required fields');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (start >= end) {
      alert('End date must be after start date');
      return;
    }

    setIsSubmitting(true);
    try {
      await onAssignProgram({
        programId: selectedProgram,
        clientId: selectedClient,
        startDate: start,
        endDate: end,
        notes: notes || undefined
      });
      
      // Reset form
      setSelectedProgram('');
      setSelectedClient('');
      setStartDate('');
      setEndDate('');
      setNotes('');
      setIsOpen(false);
    } catch (error) {
      console.error('Error assigning program:', error);
      alert('Error assigning program. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedProgramData = programs.find(p => p.id === selectedProgram);
  const selectedClientData = clients.find(c => c.id === selectedClient);

  // Calculate program duration
  const programDuration = selectedProgramData ? 
    `${selectedProgramData.weeks?.length || 0} weeks` : '';

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full sm:w-auto">
            <Layers className="h-4 w-4 mr-2 icon-template" />
            Assign Program Template
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 icon-template" />
            Assign Program Template
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Program Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Select Program Template
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Program Template</label>
                <Select value={selectedProgram} onValueChange={setSelectedProgram}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Choose a program template" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.filter(p => p.isTemplate).map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{program.name}</span>
                          {program.weeks && program.weeks.length > 0 && (
                            <Badge variant="outline" className="text-xs">
                              {program.weeks.length} weeks
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedProgramData && (
                <div className="p-3 bg-muted/50 rounded-md">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium">{selectedProgramData.name}</h4>
                      {selectedProgramData.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedProgramData.description}
                        </p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {programDuration}
                        </span>
                        {selectedProgramData.weeks && selectedProgramData.weeks.length > 0 && (
                          <span>
                            {selectedProgramData.weeks.length} weeks
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Client Selection - only show dropdown if multiple clients */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 icon-clients" />
                {clients.length === 1 ? 'Client' : 'Select Client'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {clients.length > 1 ? (
                <div>
                  <label className="text-sm font-medium">Client</label>
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger className="w-full mt-1">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          <div className="flex items-center gap-2">
                            <span>{client.name}</span>
                            {client.email && (
                              <span className="text-xs text-muted-foreground">
                                ({client.email})
                              </span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {selectedClientData && (
                <div className={clients.length > 1 ? "mt-3 p-3 bg-muted/50 rounded-md" : "p-3 bg-muted/50 rounded-md"}>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedClientData.name}</span>
                    {selectedClientData.email && (
                      <span className="text-sm text-muted-foreground">
                        • {selectedClientData.email}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full mt-1 p-2 border rounded-md"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this assignment..."
                  className="w-full mt-1 p-2 border rounded-md h-20 resize-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedProgram || !selectedClient || !startDate || !endDate}
            >
              {isSubmitting ? 'Assigning...' : 'Assign Program'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
