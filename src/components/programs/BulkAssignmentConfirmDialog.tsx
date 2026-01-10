'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Users, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { PatternMatchResult, formatTimeForDisplay, getTotalEventCount } from '@/lib/utils/event-patterns';

interface BulkAssignmentConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  patternResults: PatternMatchResult[];
  onConfirm: (selectedPatterns: PatternMatchResult[]) => void;
  isLoading?: boolean;
}

export function BulkAssignmentConfirmDialog({
  open,
  onOpenChange,
  clientName,
  patternResults,
  onConfirm,
  isLoading = false
}: BulkAssignmentConfirmDialogProps) {
  // Track which patterns are selected (all selected by default)
  const [selectedPatternKeys, setSelectedPatternKeys] = useState<Set<string>>(
    new Set(patternResults.map(pr => `${pr.pattern.dayOfWeek}-${pr.pattern.time}`))
  );
  
  // Reset selection when dialog opens with new patterns
  const patternCount = patternResults.length;
  const [lastPatternCount, setLastPatternCount] = useState(patternCount);
  if (patternCount !== lastPatternCount) {
    setSelectedPatternKeys(
      new Set(patternResults.map(pr => `${pr.pattern.dayOfWeek}-${pr.pattern.time}`))
    );
    setLastPatternCount(patternCount);
  }
  
  const togglePattern = (patternKey: string) => {
    setSelectedPatternKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(patternKey)) {
        newSet.delete(patternKey);
      } else {
        newSet.add(patternKey);
      }
      return newSet;
    });
  };
  
  const selectedPatterns = patternResults.filter(pr => 
    selectedPatternKeys.has(`${pr.pattern.dayOfWeek}-${pr.pattern.time}`)
  );
  
  const totalSelected = getTotalEventCount(selectedPatterns);
  const totalAvailable = getTotalEventCount(patternResults);
  
  const handleConfirm = () => {
    onConfirm(selectedPatterns);
  };
  
  // If only one pattern with one event, show simpler dialog
  const isSingleEvent = patternResults.length === 1 && patternResults[0].events.length === 1;
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 icon-clients" />
            {isSingleEvent ? 'Assign Session' : 'Bulk Assign Sessions'}
          </DialogTitle>
          <DialogDescription>
            {isSingleEvent 
              ? `Assign this session to ${clientName}?`
              : `Found recurring sessions that can be assigned to ${clientName}`
            }
          </DialogDescription>
        </DialogHeader>
        
        {!isSingleEvent && (
          <div className="space-y-3 py-4">
            {patternResults.map((result) => {
              const patternKey = `${result.pattern.dayOfWeek}-${result.pattern.time}`;
              const isSelected = selectedPatternKeys.has(patternKey);
              
              return (
                <div 
                  key={patternKey}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                    isSelected ? 'bg-primary/5 border-primary/30' : 'bg-muted/30 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={patternKey}
                      checked={isSelected}
                      onCheckedChange={() => togglePattern(patternKey)}
                      disabled={isLoading}
                    />
                    <Label 
                      htmlFor={patternKey}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{result.pattern.dayName}</span>
                      <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                      <span>{formatTimeForDisplay(result.pattern.time)}</span>
                    </Label>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {result.events.length} {result.events.length === 1 ? 'event' : 'events'}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        
        {!isSingleEvent && (
          <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              <strong>{totalSelected}</strong> of {totalAvailable} events selected
            </span>
          </div>
        )}
        
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={isLoading || totalSelected === 0}
          >
            {isLoading 
              ? 'Assigning...' 
              : isSingleEvent 
                ? 'Assign Session'
                : `Assign ${totalSelected} ${totalSelected === 1 ? 'Session' : 'Sessions'}`
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}























