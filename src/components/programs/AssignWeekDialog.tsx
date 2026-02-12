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
import { ClientProgramPeriod } from '@/lib/types';

interface WeekTemplate {
    id: string;
    name: string;
    color: string;
}

interface AssignWeekDialogProps {
    weekTemplates: WeekTemplate[];
    currentPeriod: ClientProgramPeriod | undefined;
    onAssignWeek: (periodId: string, weekTemplateId: string) => Promise<void>;
    loading?: boolean;
}

export function AssignWeekDialog({
    weekTemplates,
    currentPeriod,
    onAssignWeek,
    loading = false,
}: AssignWeekDialogProps) {
    const [open, setOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
        currentPeriod?.weekTemplateId || ''
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Update selection when dialog opens or period changes
    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (newOpen && currentPeriod) {
            setSelectedTemplateId(currentPeriod.weekTemplateId || '');
        }
    };

    const handleSubmit = async () => {
        if (!currentPeriod || !selectedTemplateId) return;

        setIsSubmitting(true);
        try {
            await onAssignWeek(currentPeriod.id, selectedTemplateId);
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
                <Button size="sm" variant="outline" type="button" disabled={!currentPeriod}>
                    <CalendarDays className="h-4 w-4 mr-2 icon-template" />
                    {currentPeriod?.weekTemplateId ? 'Change Week' : 'Assign Week'}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Assign Week Template</DialogTitle>
                    <DialogDescription>
                        {currentPeriod ? (
                            <>
                                Set the default Week Template for the period <strong>{currentPeriod.periodName}</strong>.
                                This allows "Smart Create" to generate workouts based on your template.
                            </>
                        ) : (
                            "No active period found. Please assign a period first."
                        )}
                    </DialogDescription>
                </DialogHeader>

                {currentPeriod && (
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
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={!selectedTemplateId || isSubmitting || loading}>
                        {isSubmitting ? 'Saving...' : 'Save Assignment'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
