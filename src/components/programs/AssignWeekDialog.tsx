"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
    DialogFooter,
    DialogTrigger,
} from '@/components/ui/dialog';
import { CalendarDays } from 'lucide-react';
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';

interface WeekTemplate {
    id: string;
    name: string;
    color: string;
}

interface AssignWeekDialogProps {
    clientId: string;
    weekTemplates: WeekTemplate[];
    onAssignWeek: (assignment: {
        weekTemplateId: string;
        clientId: string;
        startDate: Date;
        endDate: Date;
    }) => Promise<void>;
    loading?: boolean;
}

export function AssignWeekDialog({
    clientId,
    weekTemplates,
    onAssignWeek,
    loading = false,
}: AssignWeekDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
        from: new Date(),
        to: new Date(new Date().setDate(new Date().getDate() + 28)) // Default to 4 weeks
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset state when dialog opens
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            setSelectedTemplateId('');
        }
    };

    const handleSubmit = async () => {
        if (!selectedTemplateId || !dateRange.from || !dateRange.to) return;

        setIsSubmitting(true);
        try {
            await onAssignWeek({
                clientId,
                weekTemplateId: selectedTemplateId,
                startDate: dateRange.from,
                endDate: dateRange.to
            });
            setOpen(false);
        } catch (error) {
            console.error('Failed to assign week template:', error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedTemplate = weekTemplates.find(t => t.id === selectedTemplateId);

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button size="sm" variant="outline" type="button" disabled={!clientId || loading}>
                    <CalendarDays className="h-4 w-4 mr-2 icon-template" />
                    Assign Week
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Week Template</DialogTitle>
                    <DialogDescription>
                        Assign a week template to this client over a specific date range.
                        This will automatically generate workouts based on the template layout.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
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

                    {selectedTemplate && (
                        <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded border">
                            <strong>Selected:</strong> {selectedTemplate.name}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Date Range</Label>
                        <div className="grid gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        id="date"
                                        variant={"outline"}
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
                                        onSelect={(range: any) => setDateRange(range)}
                                        numberOfMonths={2}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!selectedTemplateId || !dateRange?.from || !dateRange?.to || isSubmitting || loading}>
                        {isSubmitting ? 'Assigning...' : 'Assign Week Template'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
