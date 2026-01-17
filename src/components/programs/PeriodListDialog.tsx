"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2, Calendar, AlertTriangle, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { ClientProgramPeriod } from '@/lib/types';
import { format } from 'date-fns';

interface PeriodListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  periods: ClientProgramPeriod[];
  clientName: string;
  onDeletePeriod: (periodId: string) => void;
  onDeletePeriods?: (periodIds: string[]) => Promise<void>; // New: batch delete
  onClearAll: () => void;
  onClearAllCalendarEvents?: () => void;
  onForceClearLocalEvents?: () => void;
  calendarEventsCount?: number;
}

// Helper to safely convert dates
const safeToDate = (dateValue: any): Date => {
  if (!dateValue) return new Date();
  if (dateValue instanceof Date) return dateValue;
  if (typeof dateValue.toDate === 'function') return dateValue.toDate();
  if (dateValue.seconds !== undefined) return new Date(dateValue.seconds * 1000);
  if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
  return new Date();
};

export function PeriodListDialog({
  open,
  onOpenChange,
  periods,
  clientName,
  onDeletePeriod,
  onDeletePeriods,
  onClearAll,
  onClearAllCalendarEvents,
  onForceClearLocalEvents,
  calendarEventsCount = 0
}: PeriodListDialogProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localPeriods, setLocalPeriods] = useState<ClientProgramPeriod[]>(periods);
  const [selectedPeriods, setSelectedPeriods] = useState<Set<string>>(new Set());
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);

  // Update local periods when prop changes
  // Use ref to track previous periods to prevent unnecessary updates
  const previousPeriodsRef = React.useRef<ClientProgramPeriod[]>(periods);
  const previousPeriodsLengthRef = React.useRef<number>(periods.length);
  const periodsIdsString = periods.map(p => p.id).sort().join(',');
  const previousPeriodsIdsStringRef = React.useRef<string>(periodsIdsString);
  
  useEffect(() => {
    // Only update if periods actually changed (by IDs, not just reference)
    if (periodsIdsString !== previousPeriodsIdsStringRef.current) {
      console.log('PeriodListDialog: periods prop changed', {
        periodsCount: periods.length,
        periods: periods.map(p => ({ id: p.id, name: p.periodName }))
      });
      setLocalPeriods(periods);
      previousPeriodsRef.current = periods;
      previousPeriodsLengthRef.current = periods.length;
      previousPeriodsIdsStringRef.current = periodsIdsString;
      // Clear selection when periods change
      setSelectedPeriods(new Set());
    }
  }, [periodsIdsString, periods]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSelectedPeriods(new Set());
      setShowDangerZone(false);
    }
  }, [open]);

  const togglePeriodSelection = (periodId: string) => {
    const newSelection = new Set(selectedPeriods);
    if (newSelection.has(periodId)) {
      newSelection.delete(periodId);
    } else {
      newSelection.add(periodId);
    }
    setSelectedPeriods(newSelection);
  };

  const selectAllPeriods = () => {
    if (selectedPeriods.size === displayPeriods.length) {
      setSelectedPeriods(new Set());
    } else {
      setSelectedPeriods(new Set(displayPeriods.map(p => p.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedPeriods.size === 0) return;
    
    const selectedCount = selectedPeriods.size;
    const selectedNames = displayPeriods
      .filter(p => selectedPeriods.has(p.id))
      .map(p => p.periodName)
      .join(', ');
    
    if (confirm(`Delete ${selectedCount} selected period${selectedCount !== 1 ? 's' : ''}?\n\nPeriods: ${selectedNames}\n\nThis will delete all associated workouts and schedule events. This cannot be undone.`)) {
      setIsDeletingSelected(true);
      try {
        if (onDeletePeriods) {
          await onDeletePeriods(Array.from(selectedPeriods));
        } else {
          // Fallback: delete one by one
          for (const periodId of selectedPeriods) {
            await onDeletePeriod(periodId);
          }
        }
        setSelectedPeriods(new Set());
        console.log(`Successfully deleted ${selectedCount} periods`);
      } catch (error) {
        console.error('Error deleting selected periods:', error);
        alert(`Failed to delete periods: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setIsDeletingSelected(false);
      }
    }
  };

  const handleDelete = async (periodId: string, periodName: string) => {
    if (confirm(`Delete "${periodName}"?\n\nThis will delete all associated workouts and schedule events. This cannot be undone.`)) {
      setDeletingId(periodId);
      try {
        await onDeletePeriod(periodId);
        console.log('Period deleted successfully');
      } catch (error) {
        console.error('Error deleting period:', error);
        alert(`Failed to delete period: ${error instanceof Error ? error.message : 'Unknown error'}`);
      } finally {
        setDeletingId(null);
      }
    }
  };

  const handleClearAll = async () => {
    if (confirm(`⚠️ SCORCH EARTH MODE ⚠️\n\nDelete ALL ${periods.length} periods for ${clientName}?\n\nThis will delete:\n• All periods\n• All workouts\n• All schedule events\n\nThis cannot be undone!`)) {
      try {
        await onClearAll();
        console.log('All periods cleared successfully');
        onOpenChange(false);
      } catch (error) {
        console.error('Error clearing all periods:', error);
        alert(`Failed to clear all periods: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  };

  // Use local periods for display
  const displayPeriods = localPeriods;
  const hasSelection = selectedPeriods.size > 0;
  const allSelected = displayPeriods.length > 0 && selectedPeriods.size === displayPeriods.length;

  // Check for periods with invalid dates
  const periodsWithInvalidDates = displayPeriods.filter(p => {
    try {
      const start = safeToDate(p.startDate);
      const end = safeToDate(p.endDate);
      return isNaN(start.getTime()) || isNaN(end.getTime()) || start > end;
    } catch {
      return true;
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Manage Periods - {clientName}
          </DialogTitle>
          <DialogDescription>
            View and manage all assigned periods for this client. {displayPeriods.length} period{displayPeriods.length !== 1 ? 's' : ''} found.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning for invalid dates */}
          {periodsWithInvalidDates.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-orange-900 mb-1">
                    Invalid Period Dates Detected
                  </div>
                  <div className="text-sm text-orange-700">
                    {periodsWithInvalidDates.length} period{periodsWithInvalidDates.length !== 1 ? 's' : ''} have invalid or missing dates.
                    These periods may not display correctly in the calendar. Consider deleting and recreating them.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selection Actions Bar */}
          {displayPeriods.length > 0 && (
            <div className="flex items-center justify-between bg-gray-50 rounded-lg p-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAllPeriods}
                  className="text-sm"
                >
                  <div className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${allSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}>
                    {allSelected && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {allSelected ? 'Deselect All' : 'Select All'}
                </Button>
                {hasSelection && (
                  <span className="text-sm text-muted-foreground">
                    {selectedPeriods.size} selected
                  </span>
                )}
              </div>
              
              {hasSelection && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                  disabled={isDeletingSelected}
                  className="gap-1"
                >
                  <Trash2 className="h-3 w-3" />
                  Delete Selected ({selectedPeriods.size})
                </Button>
              )}
            </div>
          )}

          {/* Period List */}
          {displayPeriods.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No periods assigned to this client.
            </div>
          ) : (
            <div className="space-y-2">
              {displayPeriods.map((period) => {
                const startDate = safeToDate(period.startDate);
                const endDate = safeToDate(period.endDate);
                const hasInvalidDates = isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || startDate > endDate;
                const isSelected = selectedPeriods.has(period.id);

                return (
                  <div
                    key={period.id}
                    className={`border rounded-lg p-4 transition-colors cursor-pointer ${
                      hasInvalidDates 
                        ? 'border-orange-300 bg-orange-50' 
                        : isSelected 
                          ? 'border-blue-400 bg-blue-50' 
                          : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => togglePeriodSelection(period.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {/* Checkbox */}
                        <div 
                          className={`w-5 h-5 border rounded flex items-center justify-center flex-shrink-0 mt-0.5 ${
                            isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: period.periodColor }}
                            />
                            <span className="font-medium">{period.periodName}</span>
                            {hasInvalidDates && (
                              <span className="text-xs bg-orange-200 text-orange-800 px-2 py-0.5 rounded">
                                Invalid Dates
                              </span>
                            )}
                          </div>

                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium">Dates:</span>{' '}
                              {hasInvalidDates || isNaN(startDate.getTime()) ? (
                                <span className="text-orange-600">Invalid</span>
                              ) : (
                                `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`
                              )}
                            </div>
                            <div className="flex gap-4">
                              <span><span className="font-medium">Days:</span> {period.days.length}</span>
                              {period.weekTemplateId && (
                                <span className="text-blue-600">Template Applied</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(period.id, period.periodName);
                        }}
                        disabled={deletingId === period.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Danger Zone - Collapsible */}
          <div className="border-t pt-4 mt-4">
            <button
              onClick={() => setShowDangerZone(!showDangerZone)}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 w-full"
            >
              {showDangerZone ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              Advanced Options (Danger Zone)
            </button>
            
            {showDangerZone && (
              <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded-lg space-y-3">
                <p className="text-sm text-red-700 mb-3">
                  ⚠️ These actions are destructive and cannot be undone. Use with caution.
                </p>
                
                <div className="flex flex-wrap gap-2">
                  {/* Clear Calendar Events Only */}
                  {onClearAllCalendarEvents && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        if (confirm(`Clear ALL calendar events for ${clientName}?\n\nThis removes events from the schedule but keeps periods and workouts intact.\n\nThis cannot be undone.`)) {
                          try {
                            await onClearAllCalendarEvents();
                            console.log('All calendar events cleared successfully');
                          } catch (error) {
                            console.error('Error clearing calendar events:', error);
                            alert(`Failed to clear calendar events: ${error instanceof Error ? error.message : 'Unknown error'}`);
                          }
                        }
                      }}
                      className="gap-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-200"
                    >
                      <Calendar className="h-3 w-3" />
                      Clear Events Only ({calendarEventsCount})
                    </Button>
                  )}

                  {/* Scorch Earth - Clear All */}
                  {displayPeriods.length > 0 && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleClearAll}
                      className="gap-1"
                    >
                      <Trash2 className="h-3 w-3" />
                      🔥 Clear Everything ({displayPeriods.length} periods)
                    </Button>
                  )}

                  {/* Force Clear Cache */}
                  {onForceClearLocalEvents && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (confirm('Troubleshooting: This will wipe ALL local calendar events from the browser cache.\n\nUse this if you see "phantom" events that won\'t delete.\n\nContinue?')) {
                          try {
                            await onForceClearLocalEvents();
                            console.log('Local events cleared successfully');
                            alert('Local events cleared. Please refresh the page.');
                          } catch (error) {
                            console.error('Error clearing local events:', error);
                          }
                        }
                      }}
                      className="gap-1 text-gray-500 hover:text-gray-700"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Force Clear Cache
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

