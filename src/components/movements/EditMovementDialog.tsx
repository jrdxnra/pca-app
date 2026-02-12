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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Dumbbell } from 'lucide-react';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { MovementConfigurationToggle } from './MovementConfigurationToggle';

const movementSchema = z.object({
  name: z.string().min(1, 'Movement name is required').max(64, 'Name must be less than 65 characters'),
  instructions: z.string().optional(),
  links: z.array(z.object({
    url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  })).optional(),
  configuration: z.object({
    useReps: z.boolean(),
    useTempo: z.boolean(),
    useTime: z.boolean(),
    timeMeasure: z.enum(['s', 'm']),
    useWeight: z.boolean(),
    weightMeasure: z.enum(['lbs', 'kg', 'bw']),
    useDistance: z.boolean(),
    distanceMeasure: z.enum(['mi', 'km', 'm', 'yd', 'ft']),
    usePace: z.boolean(),
    paceMeasure: z.enum(['mi', 'km']),
    unilateral: z.boolean(),
    usePercentage: z.boolean(),
    useRPE: z.boolean(),
  }),
});

type MovementFormData = z.infer<typeof movementSchema>;

interface EditMovementDialogProps {
  movement: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditMovementDialog({ movement, open, onOpenChange }: EditMovementDialogProps) {
  const { editMovement, loading } = useMovementStore();

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      name: '',
      instructions: '',
      links: [{ url: '' }],
      configuration: {
        useReps: true,
        useTempo: false,
        useTime: false,
        timeMeasure: 's' as const,
        useWeight: true,
        weightMeasure: 'lbs' as const,
        useDistance: false,
        distanceMeasure: 'mi' as const,
        usePace: false,
        paceMeasure: 'mi' as const,
        unilateral: false,
        usePercentage: false,
        useRPE: false,
      },
    },
  });

  // Update form when movement changes
  useEffect(() => {
    if (movement) {
      form.reset({
        name: movement.name || '',
        instructions: movement.instructions || '',
        links: movement.links && movement.links.length > 0
          ? movement.links.map((url: string) => ({ url }))
          : [{ url: '' }],
        configuration: {
          useReps: movement.configuration?.useReps ?? true,
          useTempo: movement.configuration?.useTempo ?? false,
          useTime: movement.configuration?.useTime ?? false,
          timeMeasure: movement.configuration?.timeMeasure || 's',
          useWeight: movement.configuration?.useWeight ?? true,
          weightMeasure: movement.configuration?.weightMeasure || 'lbs',
          useDistance: movement.configuration?.useDistance ?? false,
          distanceMeasure: movement.configuration?.distanceMeasure || 'mi',
          usePace: movement.configuration?.usePace ?? false,
          paceMeasure: movement.configuration?.paceMeasure || 'mi',
          unilateral: movement.configuration?.unilateral ?? false,
          usePercentage: movement.configuration?.usePercentage ?? false,
          useRPE: movement.configuration?.useRPE ?? false,
        },
      });
    }
  }, [movement, form]);

  const onSubmit = async (data: MovementFormData) => {
    if (!movement) return;

    try {
      const movementData: any = {
        name: data.name,
        configuration: {
          useReps: data.configuration.useReps,
          useTempo: data.configuration.useTempo,
          useTime: data.configuration.useTime,
          timeMeasure: data.configuration.timeMeasure,
          useWeight: data.configuration.useWeight,
          weightMeasure: data.configuration.weightMeasure,
          useDistance: data.configuration.useDistance,
          distanceMeasure: data.configuration.distanceMeasure,
          usePace: data.configuration.usePace,
          paceMeasure: data.configuration.paceMeasure,
          unilateral: data.configuration.unilateral,
          usePercentage: data.configuration.usePercentage,
          useRPE: data.configuration.useRPE,
        },
        links: (data.links || []).filter(link => link.url?.trim() !== '').map(link => link.url!),
      };

      // Only include instructions if it has a value
      if (data.instructions && data.instructions.trim() !== '') {
        movementData.instructions = data.instructions;
      }

      await editMovement(movement.id, movementData);
      form.reset();
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to update movement:', error);
      // TODO: Show user-friendly error message
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Edit Movement
          </DialogTitle>
          <DialogDescription>
            Update the movement details and configuration options.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Movement Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Movement Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Back Squat, Push-ups" {...field} />
                  </FormControl>
                  <FormDescription>
                    Enter a clear, descriptive name for this movement.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Instructions */}
            <FormField
              control={form.control}
              name="instructions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Instructions</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed instructions for performing this movement..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional instructions for proper form and technique.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Configuration Options */}
            <div className="space-y-4">
              <FormLabel className="text-base font-semibold">Movement Configuration</FormLabel>
              <FormDescription>
                Choose the default variables used for this movement.
              </FormDescription>

              <div className="flex flex-wrap py-2 gap-1">
                <MovementConfigurationToggle
                  name="Reps"
                  value={form.watch('configuration.useReps')}
                  onChange={(value) => form.setValue('configuration.useReps', value)}
                />

                <MovementConfigurationToggle
                  name="Weight"
                  value={form.watch('configuration.useWeight')}
                  onChange={(value) => form.setValue('configuration.useWeight', value)}
                  measureOptions={['lbs', 'kg', 'bw']}
                  measureValue={form.watch('configuration.weightMeasure')}
                  onMeasureChange={(value) => form.setValue('configuration.weightMeasure', value as 'lbs' | 'kg' | 'bw')}
                />

                <MovementConfigurationToggle
                  name="Distance"
                  value={form.watch('configuration.useDistance')}
                  onChange={(value) => form.setValue('configuration.useDistance', value)}
                  measureOptions={['mi', 'km', 'm', 'yd', 'ft']}
                  measureValue={form.watch('configuration.distanceMeasure')}
                  onMeasureChange={(value) => form.setValue('configuration.distanceMeasure', value as 'mi' | 'km' | 'm' | 'yd' | 'ft')}
                />

                <MovementConfigurationToggle
                  name="Pace"
                  value={form.watch('configuration.usePace')}
                  onChange={(value) => form.setValue('configuration.usePace', value)}
                  measureOptions={['mi', 'km']}
                  measureValue={form.watch('configuration.paceMeasure')}
                  onMeasureChange={(value) => form.setValue('configuration.paceMeasure', value as 'mi' | 'km')}
                />

                <MovementConfigurationToggle
                  name="Tempo"
                  value={form.watch('configuration.useTempo')}
                  onChange={(value) => form.setValue('configuration.useTempo', value)}
                />

                <MovementConfigurationToggle
                  name="Time"
                  value={form.watch('configuration.useTime')}
                  onChange={(value) => form.setValue('configuration.useTime', value)}
                  measureOptions={['s', 'm']}
                  measureValue={form.watch('configuration.timeMeasure')}
                  onMeasureChange={(value) => form.setValue('configuration.timeMeasure', value as 's' | 'm')}
                />

                <MovementConfigurationToggle
                  name="Unilateral"
                  value={form.watch('configuration.unilateral')}
                  onChange={(value) => form.setValue('configuration.unilateral', value)}
                />

                <MovementConfigurationToggle
                  name="Percentage"
                  value={form.watch('configuration.usePercentage')}
                  onChange={(value) => form.setValue('configuration.usePercentage', value)}
                />

                <MovementConfigurationToggle
                  name="RPE"
                  value={form.watch('configuration.useRPE')}
                  onChange={(value) => form.setValue('configuration.useRPE', value)}
                />
              </div>
            </div>

            {/* Links */}
            <FormField
              control={form.control}
              name="links"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Links</FormLabel>
                  <FormDescription>
                    Add video URLs or other resources for this movement.
                  </FormDescription>
                  {field.value?.map((link, index) => (
                    <div key={index} className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder="https://example.com/video"
                          {...form.register(`links.${index}.url`)}
                        />
                      </FormControl>
                      {field.value && field.value.length > 1 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newLinks = field.value?.filter((_, i) => i !== index);
                            field.onChange(newLinks);
                          }}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newLinks = [...(field.value || []), { url: '' }];
                      field.onChange(newLinks);
                    }}
                  >
                    Add Link
                  </Button>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={loading}>
                {loading ? 'Updating...' : 'Update Movement'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
