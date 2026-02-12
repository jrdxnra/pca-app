"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Layers, Plus, Trash2, X } from 'lucide-react';
import { ClientProgramPeriod } from '@/lib/types';
import { createWeekTemplate } from '@/lib/firebase/services/weekTemplates';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';

interface Period {
  id: string;
  name: string;
  color: string;
  focus: string;
}

interface WorkoutCategory {
  id: string;
  name: string;
  color: string;
}

interface WeekTemplate {
  id: string;
  name: string;
  color: string;
  order?: number;
  days: {
    day: string;
    workoutCategory: string;
    variations?: string[];
  }[];
}

interface TemplateEditorState {
  name: string;
  color: string;
  days: {
    day: string;
    workoutCategory: string;
    time: string;
    // NEW: List of workout structure templates
    variations: string[];
    deleted: boolean;
  }[];
}

interface PeriodAssignmentDialogProps {
  clientId: string;
  clientName: string;
  periods: Period[];
  workoutCategories: WorkoutCategory[];
  weekTemplates: WeekTemplate[];
  onAssignPeriod: (assignment: {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{ time?: string; isAllDay: boolean }>;
  }) => void;
  existingAssignments: ClientProgramPeriod[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function PeriodAssignmentDialog({
  clientId,
  clientName,
  periods,
  workoutCategories,
  weekTemplates,
  onAssignPeriod,
  existingAssignments,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange
}: PeriodAssignmentDialogProps) {
  const { fetchWeekTemplates, fetchWorkoutStructureTemplates, workoutStructureTemplates } = useConfigurationStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setIsOpen = controlledOnOpenChange || setInternalOpen;
  const [selectedPeriod, setSelectedPeriod] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedWeekTemplate, setSelectedWeekTemplate] = useState<string>('');

  // Unified editor state - used for both existing templates and new custom ones
  const [editorOpen, setEditorOpen] = useState(false);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editorState, setEditorState] = useState<TemplateEditorState | null>(null);
  const [saving, setSaving] = useState(false);

  const colorOptions = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1', '#6b7280'
  ];


  // Find rest day category from config (case insensitive)
  const restDayCategory = workoutCategories.find(wc => wc.name.toLowerCase() === 'rest day');
  const restDayName = restDayCategory?.name || workoutCategories[workoutCategories.length - 1]?.name || 'Rest Day';

  // Check if a category is a rest day (no time needed)
  const isRestDay = (categoryName: string) => categoryName.toLowerCase() === 'rest day';

  // Build default template for new custom week
  const buildDefaultTemplate = (): TemplateEditorState => ({
    name: '',
    color: '#10b981',
    days: [
      { day: 'Monday', workoutCategory: workoutCategories[0]?.name || 'Workout', time: '', variations: [], deleted: false },
      { day: 'Tuesday', workoutCategory: workoutCategories[1]?.name || 'Workout', time: '', variations: [], deleted: false },
      { day: 'Wednesday', workoutCategory: restDayName, time: '', variations: [], deleted: false },
      { day: 'Thursday', workoutCategory: workoutCategories[0]?.name || 'Workout', time: '', variations: [], deleted: false },
      { day: 'Friday', workoutCategory: workoutCategories[1]?.name || 'Workout', time: '', variations: [], deleted: false },
      { day: 'Saturday', workoutCategory: restDayName, time: '', variations: [], deleted: false },
      { day: 'Sunday', workoutCategory: restDayName, time: '', variations: [], deleted: false }
    ]
  });

  // Build editor state from an existing template
  const buildEditorFromTemplate = (template: WeekTemplate): TemplateEditorState => ({
    name: template.name,
    color: template.color,
    days: template.days.map(d => ({
      day: d.day,
      workoutCategory: d.workoutCategory,
      time: '',
      variations: d.variations || [],
      deleted: false
    }))
  });

  // Handle template selection from dropdown
  const handleTemplateSelect = (templateId: string) => {
    setSelectedWeekTemplate(templateId);

    if (templateId === 'none' || !templateId) {
      setEditorOpen(false);
      setEditorState(null);
      setIsCreatingNew(false);
      return;
    }

    const template = weekTemplates.find(wt => wt.id === templateId);
    if (template) {
      setEditorState(buildEditorFromTemplate(template));
      setEditorOpen(true);
      setIsCreatingNew(false);
    }
  };

  // Handle "New custom week" button
  const handleNewCustomWeek = () => {
    if (editorOpen && isCreatingNew) {
      // Toggle off if already creating new
      setEditorOpen(false);
      setEditorState(null);
      setIsCreatingNew(false);
      setSelectedWeekTemplate('');
    } else {
      // Open new custom builder, reset any previous state
      setSelectedWeekTemplate('');
      setEditorState(buildDefaultTemplate());
      setEditorOpen(true);
      setIsCreatingNew(true);
    }
  };

  // Update a day in editor
  const updateEditorDay = (index: number, updates: Partial<TemplateEditorState['days'][0]>) => {
    if (!editorState) return;
    setEditorState(prev => {
      if (!prev) return prev;
      const updatedDays = [...prev.days];
      updatedDays[index] = { ...updatedDays[index], ...updates };
      return { ...prev, days: updatedDays };
    });
  };

  // Delete a day in editor
  const deleteEditorDay = (index: number) => {
    updateEditorDay(index, { deleted: true });
  };

  // Restore a day in editor
  const restoreEditorDay = (index: number) => {
    updateEditorDay(index, { deleted: false });
  };

  // Add a day to editor
  const addEditorDay = () => {
    if (!editorState) return;
    setEditorState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        days: [
          ...prev.days,
          { day: 'New Day', workoutCategory: workoutCategories[0]?.name || '', time: '', variations: [], deleted: false }
        ]
      };
    });
  };

  // Save custom week as new template
  const handleSaveCustomWeek = async () => {
    if (!editorState || !editorState.name.trim()) {
      alert('Please enter a name for the custom week.');
      return;
    }

    const activeDays = editorState.days.filter(d => !d.deleted);
    if (!activeDays.length) {
      alert('Add at least one day to the custom week.');
      return;
    }

    setSaving(true);
    try {
      const id = await createWeekTemplate({
        name: editorState.name.trim(),
        color: editorState.color,
        days: activeDays.map(d => ({ day: d.day, workoutCategory: d.workoutCategory, variations: d.variations })),
        order: (weekTemplates?.length || 0)
      });

      await fetchWeekTemplates();
      setSelectedWeekTemplate(id);
      setIsCreatingNew(false);
      // Keep editor open with the saved template's data (times are preserved)
    } catch (error) {
      console.error('Error creating custom week template:', error);
      alert('Failed to create custom week template. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Submit the period assignment
  const handleSubmit = () => {
    if (!selectedPeriod || !startDate || !endDate) {
      return;
    }

    const period = periods.find(p => p.id === selectedPeriod);
    if (!period) return;

    // Create dates at noon to avoid timezone issues
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);

    const startDateObj = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
    const endDateObj = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);

    // Validate times if editor is open
    if (editorOpen && editorState) {
      const activeDays = editorState.days.filter(d => !d.deleted);
      const hasAllTimes = activeDays.every(day => {
        if (isRestDay(day.workoutCategory)) return true;
        return day.time && day.time.trim() !== '';
      });

      if (!hasAllTimes) {
        alert('Please set a time for all workout days.');
        return;
      }
    }

    // Build dayTimes array from editor state
    const finalDayTimes = editorState?.days.map(day => ({
      time: day.deleted ? undefined : (day.time || undefined),
      isAllDay: false,
      category: day.workoutCategory,
      deleted: day.deleted
    })) || [];

    onAssignPeriod({
      clientId,
      periodId: selectedPeriod,
      startDate: startDateObj,
      endDate: endDateObj,
      weekTemplateId: selectedWeekTemplate === 'none' ? undefined : selectedWeekTemplate || undefined,
      defaultTime: undefined,
      isAllDay: false,
      dayTimes: finalDayTimes
    });

    // Reset form
    setSelectedPeriod('');
    setStartDate('');
    setEndDate('');
    setSelectedWeekTemplate('');
    setEditorOpen(false);
    setEditorState(null);
    setIsCreatingNew(false);
    setIsOpen(false);
  };

  const getSelectedPeriod = () => {
    return periods.find(p => p.id === selectedPeriod);
  };

  const isDateRangeValid = () => {
    if (!startDate || !endDate) return false;
    const start = new Date(startDate);
    const end = new Date(endDate);
    return start <= end;
  };

  // Helper function to safely convert dates
  const safeToDate = (dateValue: any): Date => {
    if (!dateValue) return new Date();
    if (dateValue instanceof Date) return dateValue;
    if (typeof dateValue.toDate === 'function') return dateValue.toDate();
    if (dateValue.seconds !== undefined) return new Date(dateValue.seconds * 1000);
    if (typeof dateValue === 'string' || typeof dateValue === 'number') return new Date(dateValue);
    return new Date();
  };

  // Check for overlap with ANY existing assignment (not just same period type)
  const hasOverlap = () => {
    if (!startDate || !endDate) return false;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return existingAssignments.some(assignment => {
      const assignmentStart = safeToDate(assignment.startDate);
      assignmentStart.setHours(0, 0, 0, 0);
      const assignmentEnd = safeToDate(assignment.endDate);
      assignmentEnd.setHours(23, 59, 59, 999);

      // Check if date ranges overlap (regardless of period type)
      return start <= assignmentEnd && end >= assignmentStart;
    });
  };

  // Get the overlapping assignment details
  const getOverlappingAssignment = () => {
    if (!startDate || !endDate) return null;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    return existingAssignments.find(assignment => {
      const assignmentStart = safeToDate(assignment.startDate);
      assignmentStart.setHours(0, 0, 0, 0);
      const assignmentEnd = safeToDate(assignment.endDate);
      assignmentEnd.setHours(23, 59, 59, 999);

      return start <= assignmentEnd && end >= assignmentStart;
    });
  };

  // Check if a specific date is within an existing assignment
  const isDateAssigned = (date: Date) => {
    const checkDate = new Date(date);
    checkDate.setHours(12, 0, 0, 0);

    return existingAssignments.some(assignment => {
      const assignmentStart = safeToDate(assignment.startDate);
      assignmentStart.setHours(0, 0, 0, 0);
      const assignmentEnd = safeToDate(assignment.endDate);
      assignmentEnd.setHours(23, 59, 59, 999);

      return checkDate >= assignmentStart && checkDate <= assignmentEnd;
    });
  };

  // Check if form can be submitted - BLOCKS overlapping assignments
  const canSubmit = () => {
    if (!selectedPeriod || !startDate || !endDate || !isDateRangeValid()) {
      return false;
    }

    // Block if there's any overlap with existing assignments
    if (hasOverlap()) {
      return false;
    }

    if (editorOpen && editorState) {
      const activeDays = editorState.days.filter(d => !d.deleted);
      return activeDays.every(day => {
        if (isRestDay(day.workoutCategory)) return true;
        return day.time && day.time.trim() !== '';
      });
    }

    return true;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {controlledOpen === undefined && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" type="button">
            <Layers className="h-4 w-4 mr-2 icon-template" />
            Assign<span className="hidden lg:inline"> Period</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="!max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5 icon-template" />
            Assign Period to {clientName}
          </DialogTitle>
          <DialogDescription>
            Select a period configuration and assign it to this client with optional timing settings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Period Selection */}
          <div className="space-y-2">
            <Label htmlFor="period">Period Configuration</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select a period..." />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.id} value={period.id}>
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: period.color }}
                    />
                    <span>{period.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {period.focus}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {getSelectedPeriod() && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getSelectedPeriod()?.color }}
                />
                <span>Selected: {getSelectedPeriod()?.name}</span>
              </div>
            )}
          </div>

          {/* Date Range Selection with Visual Calendar */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">Start Date</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">End Date</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            {/* Mini Calendar Preview showing assigned dates */}
            {existingAssignments.length > 0 && (
              <div className="p-3 bg-muted/30 rounded-lg border">
                <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                  <span className="inline-block w-3 h-3 bg-gray-300 rounded"></span>
                  <span>Already assigned dates (unavailable)</span>
                  {startDate && endDate && isDateRangeValid() && !hasOverlap() && (
                    <>
                      <span className="inline-block w-3 h-3 bg-green-500 rounded ml-2"></span>
                      <span>Your selection</span>
                    </>
                  )}
                  {hasOverlap() && (
                    <>
                      <span className="inline-block w-3 h-3 bg-red-500 rounded ml-2"></span>
                      <span>Conflict</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Existing periods:{' '}
                  {existingAssignments.map((a, i) => (
                    <span key={a.id || i} className="inline-flex items-center gap-1 mr-2">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: a.periodColor || '#6b7280' }}
                      />
                      {a.periodName} ({safeToDate(a.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {safeToDate(a.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Week Template Selection */}
          <div className="space-y-2">
            <Label htmlFor="weekTemplate">Week Template (Optional)</Label>
            <div className="flex gap-2">
              <Select value={selectedWeekTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a week template to apply..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No template</SelectItem>
                  {weekTemplates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: template.color }}
                      />
                      <span>{template.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewCustomWeek}
                className="shrink-0"
              >
                <Plus className={`h-4 w-4 mr-1.5 icon-add transition-transform ${editorOpen && isCreatingNew ? 'rotate-45' : ''}`} />
                {editorOpen && isCreatingNew ? 'Cancel' : 'New custom week'}
              </Button>
            </div>
          </div>

          {/* Unified Template Editor - shows for both existing templates and new custom */}
          {editorOpen && editorState && (
            <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">
                    {isCreatingNew ? 'New Custom Week' : `Customize: ${editorState.name}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isCreatingNew
                      ? 'Build a week template and set times for each day.'
                      : 'Customize workout categories and times for each day.'}
                  </p>
                </div>
                {isCreatingNew && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => {
                      setEditorOpen(false);
                      setEditorState(null);
                      setIsCreatingNew(false);
                    }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveCustomWeek}
                      disabled={saving || !editorState.name.trim()}
                    >
                      {saving ? 'Saving...' : 'Save Template'}
                    </Button>
                  </div>
                )}
              </div>

              {/* Template name and color - only show when creating new */}
              {isCreatingNew && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="templateName">Template Name</Label>
                    <Input
                      id="templateName"
                      placeholder="e.g., Hybrid Intro Week"
                      value={editorState.name}
                      onChange={(e) => setEditorState(prev => prev ? { ...prev, name: e.target.value } : prev)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Color</Label>
                    <div className="flex flex-wrap gap-2">
                      {colorOptions.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className={`w-7 h-7 rounded-full border-2 ${editorState.color === color ? 'border-gray-900' : 'border-gray-300'}`}
                          style={{ backgroundColor: color }}
                          onClick={() => setEditorState(prev => prev ? { ...prev, color } : prev)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Days & Times</Label>
                <Button variant="outline" size="sm" onClick={addEditorDay}>
                  <Plus className="h-4 w-4 mr-1.5 icon-add" />
                  Add day
                </Button>
              </div>

              <div className="space-y-3">
                {editorState.days.map((day, index) => {
                  if (day.deleted) {
                    return (
                      <div key={index} className="flex items-center gap-3 p-3 border rounded-lg bg-gray-100 opacity-50">
                        <span className="text-sm text-muted-foreground line-through flex-1">{day.day} - Deleted</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => restoreEditorDay(index)}
                          className="h-7 text-xs"
                        >
                          Restore
                        </Button>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="flex flex-col md:flex-row md:items-center gap-3 p-3 border rounded-lg bg-muted/10">
                      <Input
                        value={day.day}
                        onChange={(e) => updateEditorDay(index, { day: e.target.value })}
                        className="w-full md:w-36 text-sm"
                      />
                      <Select
                        value={day.workoutCategory}
                        onValueChange={(value) => updateEditorDay(index, { workoutCategory: value })}
                      >
                        <SelectTrigger className="w-full md:w-48 h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {workoutCategories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: category.color }} />
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!isRestDay(day.workoutCategory) ? (
                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <input
                            type="time"
                            value={day.time}
                            onChange={(e) => updateEditorDay(index, { time: e.target.value })}
                            className="text-sm p-2 border rounded text-center w-full md:w-32"
                          />
                          {!day.time && (
                            <span className="text-xs text-red-500 shrink-0">Required</span>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">No timing needed</div>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteEditorDay(index)}
                        className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      {/* Variations Selector */}
                      {
                        !day.deleted && !isRestDay(day.workoutCategory) && (
                          <div className="md:ml-2 w-full md:w-auto flex-1">
                            <Select
                              value="variations"
                              onValueChange={(value) => {
                                if (!day.variations.includes(value)) {
                                  updateEditorDay(index, { variations: [...day.variations, value] });
                                }
                              }}
                            >
                              <SelectTrigger className="w-full h-9 bg-white">
                                <SelectValue placeholder={day.variations.length > 0 ? `${day.variations.length} variations` : "Add variations..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {workoutStructureTemplates.map(t => (
                                  <SelectItem key={t.id} value={t.id} disabled={day.variations.includes(t.id)}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {day.variations.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {day.variations.map((vId, vIndex) => {
                                  const vName = workoutStructureTemplates.find(t => t.id === vId)?.name || 'Unknown';
                                  return (
                                    <Badge key={vIndex} variant="secondary" className="text-[10px] h-5 px-1 gap-1">
                                      {vName}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const newVars = day.variations.filter((_, i) => i !== vIndex);
                                          updateEditorDay(index, { variations: newVars });
                                        }}
                                        className="hover:text-red-500"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )
                      }
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Validation Messages */}
          {
            startDate && endDate && !isDateRangeValid() && (
              <div className="text-sm text-red-600">
                End date must be after start date.
              </div>
            )
          }

          {
            hasOverlap() && (() => {
              const overlappingPeriod = getOverlappingAssignment();

              if (overlappingPeriod) {
                const overlapStart = safeToDate(overlappingPeriod.startDate);
                const overlapEnd = safeToDate(overlappingPeriod.endDate);
                return (
                  <div className="text-sm text-red-600 bg-red-50 p-3 rounded border border-red-200">
                    <div className="font-medium mb-1">🚫 Cannot Assign - Date Range Conflict</div>
                    <div className="text-xs">
                      The selected dates overlap with an existing &quot;{overlappingPeriod.periodName}&quot; period
                      ({overlapStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {' '}
                      {overlapEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}).
                    </div>
                    <div className="text-xs mt-1 text-red-700">
                      Please choose different dates or delete the existing period first.
                    </div>
                  </div>
                );
              }
              return null;
            })()
          }

          {/* Submit Button */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit()}
            >
              Assign Period
            </Button>
          </div>
        </div >
      </DialogContent >
    </Dialog >
  );
}
