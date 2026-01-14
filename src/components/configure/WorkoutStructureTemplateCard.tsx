"use client";

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, Edit, Trash2, GripVertical } from 'lucide-react';
import { WorkoutStructureTemplate } from '@/lib/types';
import { WorkoutType } from '@/lib/firebase/services/workoutTypes';
import { WorkoutTypeConfigurationForm } from './WorkoutTypeConfigurationForm';

interface WorkoutStructureTemplateCardProps {
  template: WorkoutStructureTemplate;
  workoutTypes: WorkoutType[];
  onEdit: (template: WorkoutStructureTemplate) => void;
  onDelete: (id: string) => void;
  onUpdateSection: (templateId: string, sectionIndex: number, updates: any) => void;
  onReorderSections: (templateId: string, fromIndex: number, toIndex: number) => void;
}

export function WorkoutStructureTemplateCard({
  template,
  workoutTypes,
  onEdit,
  onDelete,
  onUpdateSection,
  onReorderSections
}: WorkoutStructureTemplateCardProps) {
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());

  const toggleSection = (index: number) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSections(newExpanded);
  };

  const getWorkoutTypeColor = (workoutTypeId: string) => {
    const workoutType = workoutTypes.find(wt => wt.id === workoutTypeId);
    return workoutType?.color || '#6b7280';
  };

  const sortedSections = [...template.sections].sort((a, b) => a.order - b.order);

  return (
    <Card className="w-full py-0">
      <CardHeader className="pb-1 px-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold leading-tight text-center flex-1">{template.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(template)}
              className="h-8 w-8 p-0"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(template.id)}
              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {template.description && (
          <p className="text-sm text-gray-600 mt-1">{template.description}</p>
        )}
      </CardHeader>
      <CardContent className="pt-1 px-3">
        <div className="space-y-2">
          {sortedSections.map((section, index) => {
            const isExpanded = expandedSections.has(index);
            const workoutType = workoutTypes.find(wt => wt.id === section.workoutTypeId);
            
            return (
              <div key={`${section.workoutTypeId}-${index}`} className="border rounded-lg">
                <div className="flex items-center justify-between px-3 py-2">
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-4 w-4 text-gray-400 cursor-grab" />
                    <Badge 
                      style={{ backgroundColor: getWorkoutTypeColor(section.workoutTypeId) }}
                      className="text-white font-medium"
                    >
                      {section.workoutTypeName}
                    </Badge>
                    <span className="text-sm text-gray-600">Order: {section.order}</span>
                  </div>
                  <Button
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
                </div>
                
                {isExpanded && (
                  <div className="border-t bg-white">
                    <WorkoutTypeConfigurationForm
                      configuration={section.configuration}
                      onChange={(config) => onUpdateSection(template.id, index, { configuration: config })}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
