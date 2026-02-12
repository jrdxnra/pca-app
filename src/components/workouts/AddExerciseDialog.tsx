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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';
import { useMovements } from '@/hooks/queries/useMovements';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { Movement } from '@/lib/types';

// Form validation schema
const exerciseSchema = z.object({
  movementId: z.string().min(1, 'Movement is required'),
  sets: z.number().min(1, 'Sets must be at least 1'),
  reps: z.string().min(1, 'Reps is required'),
  targetRPE: z.number().min(1).max(10).optional(),
  percentageIncrease: z.string().optional(),
  tempo: z.string().optional(),
  rest: z.string().optional(),
  notes: z.string().optional(),
});

type ExerciseFormData = z.infer<typeof exerciseSchema>;

interface AddExerciseDialogProps {
  roundIndex: number;
  trigger?: React.ReactNode;
}

export function AddExerciseDialog({ roundIndex, trigger }: AddExerciseDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedMovement, setSelectedMovement] = useState<Movement | null>(null);
  const [showQuickAddMovement, setShowQuickAddMovement] = useState(false);
  const [newMovementName, setNewMovementName] = useState('');
  const [isAddingMovement, setIsAddingMovement] = useState(false);
  const { addExercise } = useWorkoutStore();
  const { addMovement } = useMovementStore();
  const { categories, fetchCategories } = useMovementCategoryStore();
  const queryClient = useQueryClient();

  // Lazy load movements - only fetch when dialog is open
  const { data: movements = [], isLoading: movementsLoading } = useMovements(
    true, // includeCategory
    open // Only fetch when dialog is open
  );

  const form = useForm<ExerciseFormData>({
    resolver: zodResolver(exerciseSchema),
    defaultValues: {
      movementId: '',
      sets: 3,
      reps: '10',
      targetRPE: undefined,
      percentageIncrease: '',
      tempo: '',
      rest: '',
      notes: '',
    },
  });

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Reset movement selection when category changes
  useEffect(() => {
    if (selectedCategoryId) {
      setSelectedMovement(null);
      form.setValue('movementId', '');
    }
  }, [selectedCategoryId, form]);

  // Auto-populate form fields when a movement is selected
  useEffect(() => {
    if (selectedMovement && selectedMovement.configuration) {
      const config = selectedMovement.configuration;
      
      // Set default values based on movement configuration
      if (config.useReps) {
        form.setValue('reps', '10'); // Default reps
      }
      
      if (config.useTempo) {
        form.setValue('tempo', ''); // Can be populated with a default tempo if needed
      }
      
      if (config.useRPE) {
        form.setValue('targetRPE', 7); // Default RPE
      }
    }
  }, [selectedMovement, form]);

  // Filter movements by selected category
  const filteredMovements = selectedCategoryId
    ? movements.filter(movement => movement.categoryId === selectedCategoryId)
    : [];

  const handleQuickAddMovement = async () => {
    if (!newMovementName.trim() || !selectedCategoryId) return;
    
    setIsAddingMovement(true);
    try {
      // Create movement with default configuration
      const movementId = await addMovement({
        name: newMovementName.trim(),
        categoryId: selectedCategoryId,
        configuration: {
          useReps: true,
          useTempo: false,
          useTime: false,
          useWeight: true,
          weightMeasure: 'lbs',
          useDistance: false,
          distanceMeasure: 'mi',
          usePace: false,
          paceMeasure: 'mi',
          unilateral: false,
          usePercentage: false,
          useRPE: true,
        },
        links: [],
      });
      
      // Invalidate movements cache to refetch with new movement
      await queryClient.invalidateQueries({ queryKey: queryKeys.movements.list({ includeCategory: true }) });
      
      // Wait a moment for the query to refetch, then find and select the new movement
      setTimeout(async () => {
        const updatedMovements = queryClient.getQueryData<Movement[]>(
          queryKeys.movements.list({ includeCategory: true })
        ) || movements;
        const newMovement = updatedMovements.find(m => m.id === movementId);
        if (newMovement) {
          setSelectedMovement(newMovement);
          form.setValue('movementId', movementId);
        }
      }, 100);
      
      // Close quick add dialog
      setShowQuickAddMovement(false);
      setNewMovementName('');
    } catch (error) {
      console.error('Failed to add movement:', error);
      alert('Failed to add movement. Please try again.');
    } finally {
      setIsAddingMovement(false);
    }
  };

  const onSubmit = async (data: ExerciseFormData) => {
    try {
      addExercise(roundIndex, {
        movementId: data.movementId,
        sets: data.sets,
        reps: data.reps,
        targetRPE: data.targetRPE,
        percentageIncrease: data.percentageIncrease || undefined,
        tempo: data.tempo || undefined,
        rest: data.rest || undefined,
        notes: data.notes || undefined,
      });

      // Reset form and close dialog
      form.reset();
      setSelectedCategoryId('');
      setSelectedMovement(null);
      setOpen(false);
    } catch (error) {
      console.error('Failed to add exercise:', error);
    }
  };

  const defaultTrigger = (
    <Button size="sm">
      <Plus className="h-4 w-4 mr-1.5 icon-add" />
      Add Exercise
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Exercise</DialogTitle>
          <DialogDescription>
            Add a new exercise to this round with sets, reps, and RPE targets.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Category Selection */}
            <div className="space-y-2">
              <FormLabel>Category *</FormLabel>
              <Select 
                value={selectedCategoryId} 
                onValueChange={setSelectedCategoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: category.color }}
                        />
                        {category.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Movement Selection */}
            {selectedCategoryId && (
              <FormField
                control={form.control}
                name="movementId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Movement *</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        if (value === '__add_new__') {
                          setShowQuickAddMovement(true);
                        } else {
                          field.onChange(value);
                          const movement = movements.find(m => m.id === value);
                          setSelectedMovement(movement || null);
                        }
                      }} 
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a movement" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="max-h-[200px]">
                        {filteredMovements.map((movement) => (
                          <SelectItem key={movement.id} value={movement.id}>
                            {movement.name}
                          </SelectItem>
                        ))}
                        {/* Add New Movement option - always last */}
                        <SelectItem 
                          value="__add_new__" 
                          className="text-primary font-semibold border-t mt-1 pt-1"
                        >
                          <div className="flex items-center gap-2">
                            <Plus className="h-4 w-4" />
                            Add New Movement...
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Basic Exercise Parameters - Only show when movement is selected */}
            {selectedMovement && (
            <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="sets"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sets *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reps"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reps *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 10, 8-12, AMRAP" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="targetRPE"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target RPE</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        step="0.5"
                        placeholder="7.5"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                        value={field.value || ''}
                      />
                    </FormControl>
                    <FormDescription>1-10 scale</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="percentageIncrease"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>% Increase</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., +5%" {...field} />
                    </FormControl>
                    <FormDescription>Progressive overload</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Advanced Parameters */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tempo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tempo</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 3010" {...field} />
                    </FormControl>
                    <FormDescription>Eccentric-Pause-Concentric-Pause</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rest Period</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 60s, 2min" {...field} />
                    </FormControl>
                    <FormDescription>Rest between sets</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input placeholder="Additional coaching notes..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add Exercise
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Quick Add Movement Dialog */}
      <Dialog open={showQuickAddMovement} onOpenChange={setShowQuickAddMovement}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Quick Add Movement</DialogTitle>
            <DialogDescription>
              Add a new movement with default settings. You can edit the full configuration later on the Movements page.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label htmlFor="movement-name" className="text-sm font-medium mb-2 block">
                Movement Name *
              </label>
              <Input
                id="movement-name"
                placeholder="e.g., Barbell Squat"
                value={newMovementName}
                onChange={(e) => setNewMovementName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newMovementName.trim()) {
                    handleQuickAddMovement();
                  }
                }}
                autoFocus
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will create a movement with default presets (reps, weight, RPE). 
              Edit the full configuration on the Movements page later.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowQuickAddMovement(false);
                setNewMovementName('');
              }}
              disabled={isAddingMovement}
            >
              Cancel
            </Button>
            <Button
              onClick={handleQuickAddMovement}
              disabled={!newMovementName.trim() || isAddingMovement}
            >
              {isAddingMovement ? 'Adding...' : 'Add Movement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
