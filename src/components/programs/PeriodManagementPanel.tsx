"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2,
  X
} from 'lucide-react';
import { ClientProgramPeriod, WeekTemplate } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

interface WorkoutCategory {
  id: string;
  name: string;
  color: string;
}

interface PeriodManagementPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPeriod: ClientProgramPeriod | null;
  clientName: string;
  onUpdatePeriod: (periodId: string, updates: Partial<ClientProgramPeriod>) => void;
  onDeletePeriod: (periodId: string) => void;
  onApplyWeekTemplate: (periodId: string, weekTemplateId: string) => void;
  weekTemplates: WeekTemplate[];
  workoutCategories: WorkoutCategory[];
  position?: { x: number; y: number };
}

export function PeriodManagementPanel({
  isOpen,
  onClose,
  selectedPeriod,
  clientName,
  onUpdatePeriod,
  onDeletePeriod,
  onApplyWeekTemplate,
  weekTemplates,
  workoutCategories,
  position
}: PeriodManagementPanelProps) {
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Helper function to safely convert dates
  const safeToDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) {
      return dateValue;
    }
    // Handle Firestore Timestamp objects with toDate() method
    if (typeof dateValue.toDate === 'function') {
      return dateValue.toDate();
    }
    // Handle plain Firestore timestamp objects {seconds: ..., nanoseconds: ...}
    if (dateValue.seconds !== undefined) {
      return new Date(dateValue.seconds * 1000);
    }
    if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      return new Date(dateValue);
    }
    console.warn('Unknown date format:', dateValue);
    return new Date();
  };

  const formatDate = (timestamp: any) => {
    const date = safeToDate(timestamp);
    console.log('formatDate debug:', {
      input: timestamp,
      convertedDate: date,
      isoString: date.toISOString(),
      formatted: date.toISOString().split('T')[0]
    });
    return date.toISOString().split('T')[0];
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  useEffect(() => {
    if (selectedPeriod) {
      const formattedStartDate = formatDate(selectedPeriod.startDate);
      const formattedEndDate = formatDate(selectedPeriod.endDate);
      
      console.log('Setting dates:');
      console.log('- formattedStartDate:', formattedStartDate);
      console.log('- formattedEndDate:', formattedEndDate);
      console.log('- startDate state will be set to:', formattedStartDate);
      console.log('- endDate state will be set to:', formattedEndDate);
      
      setStartDate(formattedStartDate);
      setEndDate(formattedEndDate);
      
      // Debug: Check what the state actually contains after setting
      setTimeout(() => {
        console.log('After state update - startDate:', formattedStartDate);
        console.log('After state update - endDate:', formattedEndDate);
      }, 100);
    }
  }, [selectedPeriod]);

  if (!selectedPeriod) return null;

  const handleDateChange = () => {
    if (!startDate || !endDate) return;

    // Create dates at noon to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    
    const newStartDate = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
    const newEndDate = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);

    if (newStartDate >= newEndDate) {
      alert('End date must be after start date');
      return;
    }

    console.log('Updating period dates:', {
      startDate: newStartDate.toDateString(),
      endDate: newEndDate.toDateString(),
      startTimestamp: newStartDate,
      endTimestamp: newEndDate
    });

    // Update the period with new dates
    onUpdatePeriod(selectedPeriod.id, {
      startDate: Timestamp.fromDate(newStartDate),
      endDate: Timestamp.fromDate(newEndDate)
    });
  };

  const handleTimeChange = (dayIndex: number, time: string, isAllDay: boolean) => {
    const updatedDays = [...selectedPeriod.days];
    if (updatedDays[dayIndex]) {
      updatedDays[dayIndex] = {
        ...updatedDays[dayIndex],
        time: isAllDay ? undefined : time,
        isAllDay: isAllDay
      };
      
      onUpdatePeriod(selectedPeriod.id, { days: updatedDays });
    }
  };

  const handleDeletePeriod = () => {
    if (confirm('Are you sure you want to delete this period?')) {
      onDeletePeriod(selectedPeriod.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Period Management - {clientName}
          </DialogTitle>
          <DialogDescription>
            Manage period dates and weekly schedule timing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period Overview */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full" 
                style={{ backgroundColor: selectedPeriod.periodColor }}
              />
              <span className="text-sm text-muted-foreground">{selectedPeriod.periodName}</span>
            </div>
          </div>

          {/* Date Editing Section */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Adjust Period Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      console.log('Start date changed to:', e.target.value);
                      setStartDate(e.target.value);
                    }}
                    className="w-full mt-1 p-2 border rounded-md"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      console.log('End date changed to:', e.target.value);
                      setEndDate(e.target.value);
                    }}
                    className="w-full mt-1 p-2 border rounded-md"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleDateChange} size="sm">
                  Update Dates
                </Button>
              </div>
            </CardContent>
          </Card>


          {/* Actions */}
          <div className="flex justify-between">
            <Button variant="destructive" onClick={handleDeletePeriod}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Period
            </Button>
            <Button onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}