"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface BuilderDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deleteDialogData: {
    workoutId: string;
    dateKey: string;
    linkedEventId?: string;
    currentCategory?: string;
  } | null;
  showCategorySelector: boolean;
  deleteDialogNewCategory: string;
  onShowCategorySelector: (show: boolean) => void;
  onSetNewCategory: (category: string) => void;
  workoutCategories: any[];
  loading: boolean;
  onDeleteWorkoutKeepEvent: () => void;
  onDeleteWorkoutChangeCategory: () => void;
  onDeleteWorkoutAndEvent: () => void;
  onCancel: () => void;
}

export function BuilderDeleteDialog({
  open,
  onOpenChange,
  deleteDialogData,
  showCategorySelector,
  deleteDialogNewCategory,
  onShowCategorySelector,
  onSetNewCategory,
  workoutCategories,
  loading,
  onDeleteWorkoutKeepEvent,
  onDeleteWorkoutChangeCategory,
  onDeleteWorkoutAndEvent,
  onCancel
}: BuilderDeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) {
        onShowCategorySelector(false);
        onSetNewCategory('');
      }
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Workout</DialogTitle>
          <DialogDescription>
            {deleteDialogData?.linkedEventId 
              ? 'This workout is linked to a calendar event. What would you like to do?'
              : 'Are you sure you want to delete this workout? This cannot be undone.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {deleteDialogData?.linkedEventId ? (
            <>
              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-3"
                onClick={onDeleteWorkoutKeepEvent}
                disabled={loading}
              >
                <div>
                  <div className="font-medium">Delete workout only</div>
                  <div className="text-xs text-gray-500">Keep the calendar event with current category - you can link a new workout later</div>
                </div>
              </Button>

              {/* Change category option */}
              {!showCategorySelector ? (
                <Button
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => onShowCategorySelector(true)}
                  disabled={loading}
                >
                  <div>
                    <div className="font-medium">Delete workout and change event category</div>
                    <div className="text-xs text-gray-500">
                      Keep the event but assign a different workout category
                      {deleteDialogData.currentCategory && (
                        <span className="block mt-1">Current: <strong>{deleteDialogData.currentCategory}</strong></span>
                      )}
                    </div>
                  </div>
                </Button>
              ) : (
                <div className="border rounded-lg p-3 space-y-3">
                  <div className="text-sm font-medium">Select new category:</div>
                  <Select 
                    value={deleteDialogNewCategory} 
                    onValueChange={onSetNewCategory}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {workoutCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: cat.color }}
                            />
                            {cat.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        onShowCategorySelector(false);
                        onSetNewCategory('');
                      }}
                      disabled={loading}
                    >
                      Back
                    </Button>
                    <Button
                      size="sm"
                      onClick={onDeleteWorkoutChangeCategory}
                      disabled={loading || !deleteDialogNewCategory}
                    >
                      {loading ? 'Saving...' : 'Confirm'}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                variant="outline"
                className="w-full justify-start text-left h-auto py-3 border-red-200 hover:bg-red-50"
                onClick={onDeleteWorkoutAndEvent}
                disabled={loading}
              >
                <div>
                  <div className="font-medium text-red-600">Delete workout and event</div>
                  <div className="text-xs text-gray-500">Remove both the workout and the linked calendar event</div>
                </div>
              </Button>
            </>
          ) : (
            <Button
              variant="destructive"
              className="w-full"
              onClick={onDeleteWorkoutKeepEvent}
              disabled={loading}
            >
              {loading ? 'Deleting...' : 'Delete Workout'}
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="ghost" 
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
