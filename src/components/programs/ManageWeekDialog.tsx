"use client";

import { useState, useMemo } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { CalendarDays, Trash2, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ClientProgramPeriod } from '@/lib/types';
import { safeToDate } from '@/lib/utils/dateHelpers';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface WeekTemplate {
    id: string;
    name: string;
    color: string;
}

interface ManageWeekDialogProps {
    clientId: string;
    clientName?: string;
    weekTemplates: WeekTemplate[];
    existingAssignments: ClientProgramPeriod[];
    selectedDate?: Date;
    onAssignWeek: (assignment: {
        weekTemplateId: string;
        clientId: string;
        startDate: Date;
        endDate: Date;
    }) => Promise<void>;
    onDeleteDays: (periodId: string, daysToDelete: string[]) => Promise<void>;
    onArchivePeriod: (periodId: string) => Promise<void>;
    loading?: boolean;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function ManageWeekDialog({
    clientId,
    clientName,
    weekTemplates,
    existingAssignments,
    selectedDate,
    onAssignWeek,
    onDeleteDays,
    onArchivePeriod,
    loading = false,
}: ManageWeekDialogProps) {
    const [open, setOpen] = useState(false);
    
    // Assignment state
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: selectedDate || new Date(),
        to: selectedDate
            ? new Date(selectedDate.getTime() + 28 * 24 * 60 * 60 * 1000)
            : new Date(new Date().getTime() + 28 * 24 * 60 * 60 * 1000)
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Management state
    const [selectedDays, setSelectedDays] = useState<Record<string, Set<string>>>({});
    const [archivedPeriods, setArchivedPeriods] = useState<Set<string>>(new Set());

    const relevantAssignments = useMemo(() => {
        if (!selectedDate) return existingAssignments;
        
        return existingAssignments.filter(period => {
            const periodStart = safeToDate(period.startDate);
            const periodEnd = safeToDate(period.endDate);
            return selectedDate >= periodStart && selectedDate <= periodEnd;
        });
    }, [existingAssignments, selectedDate]);

    const activeAssignments = useMemo(() => {
        return relevantAssignments.filter(p => !archivedPeriods.has(p.id));
    }, [relevantAssignments, archivedPeriods]);

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setSelectedTemplateId('');
            setSelectedDays({});
            setArchivedPeriods(new Set());
            setDateRange({
                from: selectedDate || new Date(),
                to: selectedDate 
                    ? new Date(selectedDate.getTime() + 28 * 24 * 60 * 60 * 1000) 
                    : new Date(new Date().getTime() + 28 * 24 * 60 * 60 * 1000)
            });
        }
    };

    const handleSubmit = async () => {
        const rangeStart = dateRange?.from;
        const rangeEnd = dateRange?.to;
        if (!selectedTemplateId || !rangeStart || !rangeEnd) return;

        setIsSubmitting(true);
        try {
            await onAssignWeek({
                clientId,
                weekTemplateId: selectedTemplateId,
                startDate: rangeStart,
                endDate: rangeEnd
            });
            setOpen(false);
        } catch (error) {
            console.error('Failed to assign week template:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const toggleDay = (periodId: string, day: string) => {
        setSelectedDays(prev => {
            const currentSet = prev[periodId] || new Set();
            const newSet = new Set(currentSet); // Create a new Set to avoid mutation
            
            if (newSet.has(day)) {
                newSet.delete(day);
            } else {
                newSet.add(day);
            }
            
            return {
                ...prev,
                [periodId]: newSet
            };
        });
    };

    const selectAllDays = (periodId: string, days: string[]) => {
        setSelectedDays(prev => ({
            ...prev,
            [periodId]: new Set(days)
        }));
    };

    const handleDeleteSelectedDays = async (periodId: string) => {
        const daysToDelete = Array.from(selectedDays[periodId] || []);
        if (daysToDelete.length === 0) {
            alert('Please select at least one day to delete');
            return;
        }

        if (confirm(`Delete ${daysToDelete.length} selected day(s)?`)) {
            try {
                await onDeleteDays(periodId, daysToDelete);
                setSelectedDays(prev => {
                    const newState = { ...prev };
                    delete newState[periodId];
                    return newState;
                });
            } catch (error) {
                console.error('Failed to delete days:', error);
                alert('Failed to delete days. Please try again.');
            }
        }
    };

    const handleArchivePeriod = async (periodId: string) => {
        if (confirm('Archive this assignment? It will be hidden from view but not deleted.')) {
            try {
                await onArchivePeriod(periodId);
                setArchivedPeriods(prev => new Set([...prev, periodId]));
            } catch (error) {
                console.error('Failed to archive period:', error);
                alert('Failed to archive. Please try again.');
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" type="button" disabled={!clientId || loading}>
                    <CalendarDays className="h-4 w-4 mr-2 icon-template" />
                    Manage Week
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>
                        Manage Week Assignments{clientName ? ` - ${clientName}` : ''}
                    </DialogTitle>
                    <DialogDescription>
                        Assign new week templates and manage existing assignments.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Assignment Section */}
                    <div className="border rounded-lg p-4 bg-muted/30">
                        <h3 className="font-medium mb-3">Assign New Week Template</h3>
                        <div className="grid gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="week-template">Select Week Template</Label>
                                <Select
                                    value={selectedTemplateId}
                                    onValueChange={setSelectedTemplateId}
                                >
                                    <SelectTrigger id="week-template">
                                        <SelectValue placeholder="Select a week template..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {weekTemplates.map((template) => (
                                            <SelectItem key={template.id} value={template.id}>
                                                <div className="flex items-center gap-2">
                                                    <div
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: template.color }}
                                                    />
                                                    {template.name}
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {weekTemplates.find(t => t.id === selectedTemplateId) && (
                                <div className="text-sm text-muted-foreground bg-background p-2 rounded border">
                                    <strong>Selected:</strong> {weekTemplates.find(t => t.id === selectedTemplateId)?.name}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Date Range</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "w-full justify-start text-left font-normal",
                                                !dateRange && "text-muted-foreground"
                                            )}
                                        >
                                            <CalendarDays className="mr-2 h-4 w-4" />
                                            {dateRange?.from ? (
                                                dateRange.to ? (
                                                    <>
                                                        {format(dateRange.from, "LLL dd, y")} -{" "}
                                                        {format(dateRange.to, "LLL dd, y")}
                                                    </>
                                                ) : (
                                                    format(dateRange.from, "LLL dd, y")
                                                )
                                            ) : (
                                                <span>Pick a date range</span>
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            initialFocus
                                            mode="range"
                                            defaultMonth={dateRange?.from}
                                            selected={dateRange}
                                            onSelect={(range) => setDateRange(range)}
                                            numberOfMonths={2}
                                        />
                                    </PopoverContent>
                                </Popover>
                            </div>

                            <Button 
                                type="button"
                                onClick={handleSubmit} 
                                disabled={!selectedTemplateId || !dateRange?.from || !dateRange?.to || isSubmitting || loading}
                                className="w-full"
                            >
                                {isSubmitting ? 'Assigning...' : 'Assign Week Template'}
                            </Button>
                        </div>
                    </div>

                    <Separator />

                    {/* Management Section */}
                    <div>
                        <h3 className="font-medium mb-3">Existing Assignments</h3>
                        {activeAssignments.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <CalendarDays className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>No active week assignments found.</p>
                                <p className="text-sm">Click &quot;New Assignment&quot; to add one.</p>
                            </div>
                        ) : (
                            activeAssignments.map((period) => {
                                const periodDays = period.days || [];
                                const daysInPeriod = Array.from(new Set(periodDays.map(d => {
                                    const dayDate = safeToDate(d.date);
                                    return dayDate.toLocaleDateString('en-US', { weekday: 'long' });
                                })));
                                
                                const selectedDaysForPeriod = selectedDays[period.id] || new Set();
                                const allDaysSelected = daysInPeriod.length > 0 && daysInPeriod.every(day => selectedDaysForPeriod.has(day));

                                return (
                                    <div key={period.id} className="border rounded-lg p-4 space-y-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <div 
                                                        className="w-3 h-3 rounded-full"
                                                        style={{ backgroundColor: period.periodColor }}
                                                    />
                                                    <h4 className="font-medium">{period.periodName}</h4>
                                                </div>
                                                <p className="text-sm text-muted-foreground mt-1">
                                                    {format(safeToDate(period.startDate), 'MMM d, yyyy')} - {format(safeToDate(period.endDate), 'MMM d, yyyy')}
                                                </p>
                                                {period.weekTemplateId && (
                                                    <Badge variant="outline" className="mt-2">
                                                        Template: {weekTemplates.find(wt => wt.id === period.weekTemplateId)?.name || 'Unknown'}
                                                    </Badge>
                                                )}
                                            </div>
                                            
                                            <div className="flex gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleArchivePeriod(period.id)}
                                                    title="Archive this assignment"
                                                >
                                                    <Archive className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDeleteSelectedDays(period.id)}
                                                    disabled={!selectedDaysForPeriod.size}
                                                    title="Delete selected days"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>

                                        <Separator />

                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between">
                                                <Label className="text-sm font-medium">Active Days ({daysInPeriod.length})</Label>
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => {
                                                        if (allDaysSelected) {
                                                            setSelectedDays(prev => {
                                                                const newState = { ...prev };
                                                                delete newState[period.id];
                                                                return newState;
                                                            });
                                                        } else {
                                                            selectAllDays(period.id, daysInPeriod);
                                                        }
                                                    }}
                                                    className="text-xs h-7"
                                                >
                                                    {allDaysSelected ? 'Deselect All' : 'Select All'}
                                                </Button>
                                            </div>
                                            
                                            {daysInPeriod.length === 0 ? (
                                                <p className="text-sm text-muted-foreground italic">No days assigned</p>
                                            ) : (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                                    {DAYS_OF_WEEK.map((day) => {
                                                        const dayExists = daysInPeriod.includes(day);
                                                        if (!dayExists) return null;
                                                        
                                                        const isChecked = selectedDaysForPeriod.has(day);
                                                        
                                                        return (
                                                            <div
                                                                key={day}
                                                                className={cn(
                                                                    "flex items-center space-x-2 p-2 rounded border cursor-pointer transition-colors",
                                                                    isChecked ? "bg-primary/10 border-primary" : "hover:bg-muted"
                                                                )}
                                                                onClick={(e) => {
                                                                    e.preventDefault();
                                                                    toggleDay(period.id, day);
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    checked={isChecked}
                                                                    className="pointer-events-none"
                                                                />
                                                                <span className="text-sm flex-1">
                                                                    {day.slice(0, 3)}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                            
                                            {selectedDaysForPeriod.size > 0 && (
                                                <p className="text-xs text-muted-foreground mt-2">
                                                    {selectedDaysForPeriod.size} day(s) selected for deletion
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                        
                        {archivedPeriods.size > 0 && (
                            <div className="text-xs text-muted-foreground text-center pt-2">
                                {archivedPeriods.size} assignment(s) archived in this session
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
