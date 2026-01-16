"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WorkoutStructureTemplate } from '@/lib/types';

interface WorkoutEditorFormProps {
  title: string;
  notes: string;
  time: string;
  currentTemplateId: string | undefined;
  errors: Record<string, string>;
  workoutStructureTemplates: WorkoutStructureTemplate[];
  workoutTypes: any[];
  onTitleChange: (title: string) => void;
  onNotesChange: (notes: string) => void;
  onTimeChange: (time: string) => Promise<void>;
  onTemplateChange: (templateId: string) => void;
  getTemplateAbbreviationList: (template: WorkoutStructureTemplate, workoutTypes: any[]) => Array<{ abbrev: string; color: string }>;
}

export function WorkoutEditorForm({
  title,
  notes,
  time,
  currentTemplateId,
  errors,
  workoutStructureTemplates,
  workoutTypes,
  onTitleChange,
  onNotesChange,
  onTimeChange,
  onTemplateChange,
  getTemplateAbbreviationList
}: WorkoutEditorFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Workout Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="e.g., Upper Body Push Day"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>
          <div>
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => onTimeChange(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="notes">Workout Notes</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="General notes about this workout..."
            rows={3}
            className={errors.notes ? 'border-red-500' : ''}
          />
          {errors.notes && (
            <p className="text-red-500 text-sm mt-1">{errors.notes}</p>
          )}
        </div>
        <div>
          <Label htmlFor="structure">Workout Structure</Label>
          <Select
            value={currentTemplateId || 'none'}
            onValueChange={onTemplateChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select structure" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None (Custom)</SelectItem>
              {workoutStructureTemplates.map(template => {
                const abbrevList = getTemplateAbbreviationList(template, workoutTypes);
                return (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2 w-full">
                      <span>{template.name}</span>
                      {abbrevList.length > 0 && (
                        <div className="flex items-center gap-1 ml-auto">
                          {abbrevList.map((item, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center justify-center rounded-md px-2 py-0.5 text-xs font-medium text-white border-0"
                              style={{ backgroundColor: item.color }}
                            >
                              {item.abbrev}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
