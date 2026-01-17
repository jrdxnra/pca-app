"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dumbbell, 
  Trash2,
  ExternalLink,
  GripVertical
} from 'lucide-react';
import { Movement } from '@/lib/types';
import { AddMovementDialog } from './AddMovementDialog';
import { MovementConfigurationToggle } from './MovementConfigurationToggle';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface MovementListProps {
  movements: Movement[];
  categoryId: string;
  categoryColor: string;
  loading: boolean;
}

// Sortable Movement Item Component
function SortableMovementItem({
  movement,
  index,
  isExpanded,
  currentEditData,
  editFormData,
  hasChanges,
  expandedMovements,
  onToggleExpanded,
  onUpdateEditField,
  onSaveEdit,
  onDeleteMovement,
  getConfigurationBadges,
}: {
  movement: Movement;
  index: number;
  isExpanded: boolean;
  currentEditData: any;
  editFormData: Record<string, any>;
  hasChanges: Record<string, boolean>;
  expandedMovements: Set<string>;
  onToggleExpanded: (id: string) => void;
  onUpdateEditField: (id: string, field: string, value: any) => void;
  onSaveEdit: (id: string) => void;
  onDeleteMovement: (id: string, name: string) => void;
  getConfigurationBadges: (config: Movement['configuration']) => string[];
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: movement.id, disabled: isExpanded });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const configBadges = getConfigurationBadges(movement.configuration);

  return (
    <div ref={setNodeRef} style={style} className="relative">
      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          {/* Movement Header */}
          <div className="flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors">
            <div 
              className="flex items-center gap-3 flex-1 cursor-pointer"
              onClick={() => onToggleExpanded(movement.id)}
            >
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm leading-tight">{movement.name}</h4>
              </div>
            </div>
          </div>

          {/* Expanded Edit Content */}
          {isExpanded && currentEditData && (
            <div className="border-t p-3 space-y-3 bg-muted/20">
              {/* Movement Name */}
              <div>
                <label className="text-sm font-medium mb-1 block">Movement Name:</label>
                <Input
                  value={currentEditData.name}
                  onChange={(e) => onUpdateEditField(movement.id, 'name', e.target.value)}
                  className="text-sm"
                  placeholder="Movement name"
                />
              </div>

              {/* Links */}
              <div>
                <label className="text-sm font-medium mb-1 block">Links:</label>
                <div className="space-y-2">
                  {(currentEditData.links || []).map((link: string, linkIndex: number) => (
                    <div key={linkIndex} className="flex gap-2">
                      <Input
                        value={link}
                        onChange={(e) => {
                          const newLinks = [...(currentEditData.links || [])];
                          newLinks[linkIndex] = e.target.value;
                          onUpdateEditField(movement.id, 'links', newLinks);
                        }}
                        placeholder="https://example.com/video"
                        className="text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const newLinks = (currentEditData.links || []).filter((_unused: any, i: number) => i !== linkIndex);
                          onUpdateEditField(movement.id, 'links', newLinks);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newLinks = [...(currentEditData.links || []), ''];
                      onUpdateEditField(movement.id, 'links', newLinks);
                    }}
                  >
                    Add Link
                  </Button>
                </div>
              </div>

              {/* Configuration */}
              <div>
                <label className="text-sm font-medium mb-1 block">Configuration:</label>
                <div className="flex flex-wrap py-2 gap-1">
                  <MovementConfigurationToggle
                    name="Reps"
                    value={currentEditData.configuration.use_reps}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_reps: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Weight"
                    value={currentEditData.configuration.use_weight}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_weight: value
                    })}
                    measureOptions={['lbs', 'kg']}
                    measureValue={currentEditData.configuration.weight_measure}
                    onMeasureChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      weight_measure: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Distance"
                    value={currentEditData.configuration.use_distance}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_distance: value
                    })}
                    measureOptions={['mi', 'km', 'm', 'yd', 'ft']}
                    measureValue={currentEditData.configuration.distance_measure}
                    onMeasureChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      distance_measure: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Pace"
                    value={currentEditData.configuration.use_pace}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_pace: value
                    })}
                    measureOptions={['mi', 'km']}
                    measureValue={currentEditData.configuration.pace_measure}
                    onMeasureChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      pace_measure: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Tempo"
                    value={currentEditData.configuration.use_tempo}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_tempo: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Time"
                    value={currentEditData.configuration.use_time}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_time: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Unilateral"
                    value={currentEditData.configuration.unilateral}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      unilateral: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="Percentage"
                    value={currentEditData.configuration.use_percentage}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_percentage: value
                    })}
                  />
                  
                  <MovementConfigurationToggle
                    name="RPE"
                    value={currentEditData.configuration.use_rpe}
                    onChange={(value) => onUpdateEditField(movement.id, 'configuration', {
                      ...currentEditData.configuration,
                      use_rpe: value
                    })}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDeleteMovement(movement.id, movement.name)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
                <Button
                  size="sm"
                  onClick={() => onSaveEdit(movement.id)}
                  disabled={!hasChanges[movement.id]}
                >
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Memoize MovementList to prevent unnecessary re-renders when parent re-renders
export const MovementList = React.memo(function MovementList({ movements, categoryId, categoryColor, loading }: MovementListProps) {
  const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const { removeMovement, reorderMovements, editMovement } = useMovementStore();
  
  // Inline edit state for expanded movements
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const getConfigurationBadges = (config: Movement['configuration']) => {
    const badges = [];
    if (config.use_reps) badges.push('Reps');
    if (config.use_weight) badges.push(`Weight (${config.weight_measure})`);
    if (config.use_time) badges.push('Time');
    if (config.use_distance) badges.push(`Distance (${config.distance_measure})`);
    if (config.use_tempo) badges.push('Tempo');
    if (config.use_pace) badges.push(`Pace (${config.pace_measure})`);
    if (config.use_rpe) badges.push('RPE');
    if (config.use_percentage) badges.push('%');
    if (config.unilateral) badges.push('Unilateral');
    return badges;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Loading movements...</span>
      </div>
    );
  }

  if (movements.length === 0) {
    return (
      <div className="text-center py-12">
        <Dumbbell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No movements yet</h3>
        <p className="text-muted-foreground mb-4">
          Add your first movement to this category to get started.
        </p>
        <AddMovementDialog 
          categoryId={categoryId}
          trigger={
            <Button>
              <Dumbbell className="h-4 w-4 mr-2" />
              Add First Movement
            </Button>
          }
        />
      </div>
    );
  }

  const handleDeleteMovement = async (movementId: string, movementName: string) => {
    if (window.confirm(`Are you sure you want to delete "${movementName}"? This action cannot be undone.`)) {
      try {
        await removeMovement(movementId);
      } catch (error) {
        console.error('Failed to delete movement:', error);
        alert('Failed to delete movement. Please try again.');
      }
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over ? (over.id as string) : null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setOverId(null);

    if (over && active.id !== over.id) {
      const oldIndex = movements.findIndex(m => m.id === active.id);
      const newIndex = movements.findIndex(m => m.id === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        // Optimistically update immediately
        const reordered = arrayMove(movements, oldIndex, newIndex);
        
        // Save to Firebase in background
        reorderMovements(categoryId, oldIndex, newIndex).catch(error => {
          console.error('Failed to reorder movements:', error);
          alert('Failed to reorder movements. Please try again.');
        });
      }
    }
  };

  const toggleExpanded = (movementId: string) => {
    const newExpanded = new Set(expandedMovements);
    if (newExpanded.has(movementId)) {
      newExpanded.delete(movementId);
      // Clear edit data when closing
      const newEditData = { ...editFormData };
      delete newEditData[movementId];
      setEditFormData(newEditData);
      const newHasChanges = { ...hasChanges };
      delete newHasChanges[movementId];
      setHasChanges(newHasChanges);
    } else {
      newExpanded.add(movementId);
      // Initialize edit data when opening
      const movement = movements.find(m => m.id === movementId);
      if (movement) {
        setEditFormData(prev => ({
          ...prev,
          [movementId]: {
            name: movement.name,
            configuration: { ...movement.configuration },
            links: movement.links || []
          }
        }));
        setHasChanges(prev => ({
          ...prev,
          [movementId]: false
        }));
      }
    }
    setExpandedMovements(newExpanded);
  };

  const updateEditField = (movementId: string, field: string, value: any) => {
    setEditFormData(prev => ({
      ...prev,
      [movementId]: {
        ...prev[movementId],
        [field]: value
      }
    }));
    setHasChanges(prev => ({
      ...prev,
      [movementId]: true
    }));
  };

  const saveEdit = async (movementId: string) => {
    try {
      const movement = movements.find(m => m.id === movementId);
      if (!movement) return;

      const currentEditData = editFormData[movementId];
      if (!currentEditData) return;

      const updateData: any = {
        name: currentEditData.name,
        configuration: currentEditData.configuration,
        links: currentEditData.links
      };

      await editMovement(movementId, updateData);
      setHasChanges(prev => ({
        ...prev,
        [movementId]: false
      }));
    } catch (error) {
      console.error('Failed to update movement:', error);
      alert('Failed to update movement. Please try again.');
    }
  };

  // Get active movement for drag overlay
  const activeMovement = activeId ? movements.find(m => m.id === activeId) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={movements.map(m => m.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 relative">
          {movements.map((movement, index) => {
            const isExpanded = expandedMovements.has(movement.id);
            const currentEditData = editFormData[movement.id];
            const isOver = overId === movement.id && activeId !== movement.id;

            return (
              <div key={movement.id} className="relative">
                {/* Drop indicator line - show when dragging over this item */}
                {isOver && (
                  <div className="absolute top-0 left-0 right-0 z-10 flex items-center pointer-events-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-purple-400 -ml-0.5"></div>
                    <div className="flex-1 h-px bg-purple-400"></div>
                  </div>
                )}
                
                <SortableMovementItem
                  movement={movement}
                  index={index}
                  isExpanded={isExpanded}
                  currentEditData={currentEditData}
                  editFormData={editFormData}
                  hasChanges={hasChanges}
                  expandedMovements={expandedMovements}
                  onToggleExpanded={toggleExpanded}
                  onUpdateEditField={updateEditField}
                  onSaveEdit={saveEdit}
                  onDeleteMovement={handleDeleteMovement}
                  getConfigurationBadges={getConfigurationBadges}
                />
              </div>
            );
          })}
        </div>
      </SortableContext>

      {/* Drag Overlay - shows the item being dragged */}
      <DragOverlay>
        {activeMovement ? (
          <Card className="overflow-hidden py-0 opacity-90 shadow-lg">
            <CardContent className="p-0">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50">
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm leading-tight">{activeMovement.name}</h4>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}, (prevProps, nextProps) => {
  // Only re-render if these props actually change
  return (
    prevProps.movements.length === nextProps.movements.length &&
    prevProps.categoryId === nextProps.categoryId &&
    prevProps.categoryColor === nextProps.categoryColor &&
    prevProps.loading === nextProps.loading &&
    prevProps.movements.every((m, i) => m.id === nextProps.movements[i]?.id)
  );
});
