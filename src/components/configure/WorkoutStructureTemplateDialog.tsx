"use client";

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, X, ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import { WorkoutStructureTemplate, WorkoutStructureTemplateSection, WorkoutIntent } from '@/lib/types';
import { WorkoutType } from '@/lib/firebase/services/workoutTypes';
import { WorkoutTypeConfigurationForm } from './WorkoutTypeConfigurationForm';
import { resolveWorkoutType } from '@/lib/workouts/workoutTypeUtils';

const templateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().optional(),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface WorkoutStructureTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: WorkoutStructureTemplate;
  workoutTypes: WorkoutType[];
  workoutIntents: WorkoutIntent[];
  onSave: (template: Omit<WorkoutStructureTemplate, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>) => void;
}

export function WorkoutStructureTemplateDialog({
  open,
  onOpenChange,
  template,
  workoutTypes,
  workoutIntents,
  onSave
}: WorkoutStructureTemplateDialogProps) {
  const [sections, setSections] = useState<WorkoutStructureTemplateSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const form = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (template) {
      form.reset({
        name: template.name,
        description: template.description || '',
      });
      setSections(template.sections || []);
      setExpandedSections(new Set());
    } else {
      form.reset({
        name: '',
        description: '',
      });
      setSections([]);
      setExpandedSections(new Set());
    }
  }, [template, form]);

  const addWorkoutType = (workoutType: WorkoutType) => {
    const firstIntent = workoutIntents[0];
    const newSection: WorkoutStructureTemplateSection = {
      workoutTypeId: workoutType.id,
      workoutTypeName: workoutType.name,
      workoutIntentId: firstIntent?.id,
      workoutIntentKey: firstIntent?.key,
      workoutIntentName: firstIntent?.name,
      order: sections.length,
      configuration: {
        useRPE: false,
        usePercentage: false,
        useTempo: false,
        useTime: false,
      }
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (index: number) => {
    const newSections = sections.filter((_, i) => i !== index);
    // Update order indices
    const updatedSections = newSections.map((section, i) => ({
      ...section,
      order: i
    }));
    setSections(updatedSections);
  };

  const updateSection = (index: number, updates: Partial<WorkoutStructureTemplateSection>) => {
    const newSections = [...sections];
    newSections[index] = { ...newSections[index], ...updates };
    setSections(newSections);
  };

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const onSubmit = (data: TemplateFormData) => {
    onSave({
      name: data.name,
      description: data.description,
      sections: sections,
    });
    onOpenChange(false);
  };

  const availableWorkoutTypes = workoutTypes.filter(
    wt => !sections.some(s => s.workoutTypeId === wt.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'Edit Workout Structure Template' : 'Create Workout Structure Template'}
          </DialogTitle>
          <DialogDescription>
            Define the workout types and their configuration for this template.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Template Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Basic Workout" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Brief description of this template" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Add Workout Types */}
            {availableWorkoutTypes.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Add Workout Types</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {availableWorkoutTypes.map((workoutType) => (
                      <Button
                        type="button"
                        key={workoutType.id}
                        variant="outline"
                        size="sm"
                        onClick={() => addWorkoutType(workoutType)}
                        className="h-8"
                      >
                        <Plus className="h-3 w-3 mr-1.5 icon-add" />
                        {workoutType.name}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Template Sections */}
            {sections.length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Template Sections</CardTitle>
                  <p className="text-xs text-gray-500">
                    Expand a section row to set <span className="font-medium">Section Intent</span> and default configuration.
                  </p>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {sections.map((section, index) => {
                      const isExpanded = expandedSections.has(index);
                      const workoutType = resolveWorkoutType(workoutTypes, section.workoutTypeId, section.workoutTypeName);
                      const selectedIntent = workoutIntents.find((intent) => intent.id === section.workoutIntentId);
                      
                      return (
                        <div key={`${section.workoutTypeId}-${index}`} className="border rounded-lg">
                          <div className="flex items-center justify-between p-3">
                            <div className="flex items-center gap-3">
                              <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                              <Badge 
                                style={{ backgroundColor: workoutType?.color || '#6b7280' }}
                                className="text-white font-medium"
                              >
                                {section.workoutTypeName}
                              </Badge>
                              {selectedIntent && (
                                <Badge
                                  style={{ backgroundColor: selectedIntent.color || '#64748b' }}
                                  className="text-white font-medium"
                                >
                                  {selectedIntent.name}
                                </Badge>
                              )}
                              <span className="text-sm text-gray-600">Order: {section.order}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleSection(index)}
                                className="h-8 w-8 p-0"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => removeSection(index)}
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div className="border-t bg-white">
                              <WorkoutTypeConfigurationForm
                                mode="full"
                                configuration={section.configuration}
                                intentOptions={workoutIntents.map((intent) => ({
                                  id: intent.id,
                                  name: intent.name,
                                  description: intent.description,
                                }))}
                                sectionIntentId={section.workoutIntentId}
                                sectionIntentDescription={selectedIntent?.description}
                                onSectionIntentChange={(intentId) => {
                                  const intent = workoutIntents.find((item) => item.id === intentId);
                                  updateSection(index, {
                                    workoutIntentId: intent?.id,
                                    workoutIntentKey: intent?.key,
                                    workoutIntentName: intent?.name,
                                  });
                                }}
                                onChange={(config) => updateSection(index, { configuration: config })}
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sections.length === 0}>
                {template ? 'Update Template' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
