"use client";

import { useState, useEffect } from 'react';
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

interface MovementListProps {
  movements: Movement[];
  categoryId: string;
  categoryColor: string;
  loading: boolean;
}

export function MovementList({ movements, categoryId, categoryColor, loading }: MovementListProps) {
  const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set());
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedMovementId, setDraggedMovementId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [optimisticMovements, setOptimisticMovements] = useState<Movement[]>(movements);
  const { removeMovement, reorderMovements, editMovement } = useMovementStore();
  
  // Sync optimistic movements when movements prop changes (but not during drag)
  useEffect(() => {
    if (draggedIndex === null) {
      setOptimisticMovements(movements);
    }
  }, [movements, draggedIndex]);
  
  // Inline edit state for expanded movements
  const [editFormData, setEditFormData] = useState<Record<string, any>>({});
  const [hasChanges, setHasChanges] = useState<Record<string, boolean>>({});

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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    setDraggedMovementId(movements[index].id);
    setDropIndex(null);
    e.dataTransfer.effectAllowed = 'move';
    // Make dragged element semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    if (draggedIndex !== null && draggedMovementId) {
      // Find current position of dragged item in optimistic array
      const currentDraggedIndex = optimisticMovements.findIndex(m => m.id === draggedMovementId);
      if (currentDraggedIndex === -1) return;
      
      // Calculate drop position (above or below)
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const mouseY = e.clientY;
      
      // Determine if dropping above or below this item
      const targetIndex = mouseY < midpoint ? index : index + 1;
      const newDropIndex = Math.max(0, Math.min(targetIndex, optimisticMovements.length));
      
      if (newDropIndex !== dropIndex && newDropIndex !== currentDraggedIndex) {
        setDropIndex(newDropIndex);
        
        // Optimistically reorder immediately for smooth feel
        const reordered = [...optimisticMovements];
        const [movedItem] = reordered.splice(currentDraggedIndex, 1);
        const adjustedDropIndex = currentDraggedIndex < newDropIndex ? newDropIndex - 1 : newDropIndex;
        reordered.splice(adjustedDropIndex, 0, movedItem);
        setOptimisticMovements(reordered);
      }
    }
  };

  const handleDragLeave = () => {
    // Don't clear dropIndex on drag leave - keep it for smooth experience
  };

  const handleDrop = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    
    if (draggedMovementId && dropIndex !== null) {
      // Get the original indices from the original movements array
      const originalDraggedIndex = movements.findIndex(m => m.id === draggedMovementId);
      const targetMovement = optimisticMovements[dropIndex];
      const originalDropIndex = targetMovement ? movements.findIndex(m => m.id === targetMovement.id) : -1;
      
      if (originalDraggedIndex !== -1 && originalDropIndex !== -1 && originalDraggedIndex !== originalDropIndex) {
        // Save to Firebase in background (optimistic update already done)
        reorderMovements(categoryId, originalDraggedIndex, originalDropIndex).catch(error => {
          console.error('Failed to reorder movements:', error);
          // Revert on error
          setOptimisticMovements(movements);
          alert('Failed to reorder movements. Please try again.');
        });
      }
    }
    
    setDraggedIndex(null);
    setDraggedMovementId(null);
    setDropIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggedMovementId(null);
    setDropIndex(null);
    // Reset opacity of all cards
    document.querySelectorAll('[draggable="true"]').forEach(el => {
      if (el instanceof HTMLElement) {
        el.style.opacity = '1';
      }
    });
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

  // Use optimistic movements for display during drag
  const displayMovements = draggedIndex !== null ? optimisticMovements : movements;

  return (
    <div className="space-y-2 relative">
      {displayMovements.map((movement, index) => {
        const isExpanded = expandedMovements.has(movement.id);
        const configBadges = getConfigurationBadges(movement.configuration);
        const currentEditData = editFormData[movement.id];
        const isDragging = draggedMovementId === movement.id;
        const showDropLineAbove = dropIndex === index;
        const showDropLineBelow = dropIndex === index + 1;

        return (
          <div key={movement.id} className="relative">
            {/* Drop indicator line above */}
            {showDropLineAbove && (
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center">
                <div className="w-2 h-2 rounded-full bg-purple-400 -ml-1"></div>
                <div className="flex-1 h-0.5 bg-purple-400"></div>
              </div>
            )}
            
            <Card 
              className={`overflow-hidden py-0 transition-all duration-200 ${
                isDragging ? 'opacity-50 scale-95' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              style={{
                transition: 'transform 0.2s ease-out, opacity 0.2s ease-out'
              }}
            >
            <CardContent className="p-0">
              {/* Movement Header */}
              <div 
                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => toggleExpanded(movement.id)}
              >
                <div className="flex items-center gap-3 flex-1">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                  
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
                      onChange={(e) => updateEditField(movement.id, 'name', e.target.value)}
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
                              updateEditField(movement.id, 'links', newLinks);
                            }}
                            placeholder="https://example.com/video"
                            className="text-sm"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const newLinks = (currentEditData.links || []).filter((_unused: any, i: number) => i !== linkIndex);
                              updateEditField(movement.id, 'links', newLinks);
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
                          updateEditField(movement.id, 'links', newLinks);
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
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_reps: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Weight"
                        value={currentEditData.configuration.use_weight}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_weight: value
                        })}
                        measureOptions={['lbs', 'kg']}
                        measureValue={currentEditData.configuration.weight_measure}
                        onMeasureChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          weight_measure: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Distance"
                        value={currentEditData.configuration.use_distance}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_distance: value
                        })}
                        measureOptions={['mi', 'km', 'm', 'yd', 'ft']}
                        measureValue={currentEditData.configuration.distance_measure}
                        onMeasureChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          distance_measure: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Pace"
                        value={currentEditData.configuration.use_pace}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_pace: value
                        })}
                        measureOptions={['mi', 'km']}
                        measureValue={currentEditData.configuration.pace_measure}
                        onMeasureChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          pace_measure: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Tempo"
                        value={currentEditData.configuration.use_tempo}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_tempo: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Time"
                        value={currentEditData.configuration.use_time}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_time: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Unilateral"
                        value={currentEditData.configuration.unilateral}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          unilateral: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="Percentage"
                        value={currentEditData.configuration.use_percentage}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
                          ...currentEditData.configuration,
                          use_percentage: value
                        })}
                      />
                      
                      <MovementConfigurationToggle
                        name="RPE"
                        value={currentEditData.configuration.use_rpe}
                        onChange={(value) => updateEditField(movement.id, 'configuration', {
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
                      onClick={() => handleDeleteMovement(movement.id, movement.name)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveEdit(movement.id)}
                      disabled={!hasChanges[movement.id]}
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Drop indicator line below */}
          {showDropLineBelow && (
            <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center">
              <div className="w-2 h-2 rounded-full bg-purple-400 -ml-1"></div>
              <div className="flex-1 h-0.5 bg-purple-400"></div>
            </div>
          )}
        </div>
        );
      })}
    </div>
  );
}