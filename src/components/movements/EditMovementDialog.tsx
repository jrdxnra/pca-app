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
    use_reps: z.boolean(),
    use_tempo: z.boolean(),
    use_time: z.boolean(),
    use_weight: z.boolean(),
    weight_measure: z.enum(['lbs', 'kg']),
    use_distance: z.boolean(),
    distance_measure: z.enum(['mi', 'km', 'm', 'yd', 'ft']),
    use_pace: z.boolean(),
    pace_measure: z.enum(['mi', 'km']),
    unilateral: z.boolean(),
    use_percentage: z.boolean(),
    use_rpe: z.boolean(),
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
        use_reps: true,
        use_tempo: false,
        use_time: false,
        use_weight: true,
        weight_measure: 'lbs' as const,
        use_distance: false,
        distance_measure: 'mi' as const,
        use_pace: false,
        pace_measure: 'mi' as const,
        unilateral: false,
        use_percentage: false,
        use_rpe: false,
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
          use_reps: movement.configuration?.use_reps ?? true,
          use_tempo: movement.configuration?.use_tempo ?? false,
          use_time: movement.configuration?.use_time ?? false,
          use_weight: movement.configuration?.use_weight ?? true,
          weight_measure: movement.configuration?.weight_measure || 'lbs',
          use_distance: movement.configuration?.use_distance ?? false,
          distance_measure: movement.configuration?.distance_measure || 'mi',
          use_pace: movement.configuration?.use_pace ?? false,
          pace_measure: movement.configuration?.pace_measure || 'mi',
          unilateral: movement.configuration?.unilateral ?? false,
          use_percentage: movement.configuration?.use_percentage ?? false,
          use_rpe: movement.configuration?.use_rpe ?? false,
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
          use_reps: data.configuration.use_reps,
          use_tempo: data.configuration.use_tempo,
          use_time: data.configuration.use_time,
          use_weight: data.configuration.use_weight,
          weight_measure: data.configuration.weight_measure,
          use_distance: data.configuration.use_distance,
          distance_measure: data.configuration.distance_measure,
          use_pace: data.configuration.use_pace,
          pace_measure: data.configuration.pace_measure,
          unilateral: data.configuration.unilateral,
          use_percentage: data.configuration.use_percentage,
          use_rpe: data.configuration.use_rpe,
        },
        links: data.links.filter(link => link.url.trim() !== '').map(link => link.url),
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
                  value={form.watch('configuration.use_reps')}
                  onChange={(value) => form.setValue('configuration.use_reps', value)}
                />
                
                <MovementConfigurationToggle
                  name="Weight"
                  value={form.watch('configuration.use_weight')}
                  onChange={(value) => form.setValue('configuration.use_weight', value)}
                  measureOptions={['lbs', 'kg']}
                  measureValue={form.watch('configuration.weight_measure')}
                  onMeasureChange={(value) => form.setValue('configuration.weight_measure', value as 'lbs' | 'kg')}
                />
                
                <MovementConfigurationToggle
                  name="Distance"
                  value={form.watch('configuration.use_distance')}
                  onChange={(value) => form.setValue('configuration.use_distance', value)}
                  measureOptions={['mi', 'km', 'm', 'yd', 'ft']}
                  measureValue={form.watch('configuration.distance_measure')}
                  onMeasureChange={(value) => form.setValue('configuration.distance_measure', value as 'mi' | 'km' | 'm' | 'yd' | 'ft')}
                />
                
                <MovementConfigurationToggle
                  name="Pace"
                  value={form.watch('configuration.use_pace')}
                  onChange={(value) => form.setValue('configuration.use_pace', value)}
                  measureOptions={['mi', 'km']}
                  measureValue={form.watch('configuration.pace_measure')}
                  onMeasureChange={(value) => form.setValue('configuration.pace_measure', value as 'mi' | 'km')}
                />
                
                <MovementConfigurationToggle
                  name="Tempo"
                  value={form.watch('configuration.use_tempo')}
                  onChange={(value) => form.setValue('configuration.use_tempo', value)}
                />
                
                <MovementConfigurationToggle
                  name="Time"
                  value={form.watch('configuration.use_time')}
                  onChange={(value) => form.setValue('configuration.use_time', value)}
                />
                
                <MovementConfigurationToggle
                  name="Unilateral"
                  value={form.watch('configuration.unilateral')}
                  onChange={(value) => form.setValue('configuration.unilateral', value)}
                />
                
                <MovementConfigurationToggle
                  name="Percentage"
                  value={form.watch('configuration.use_percentage')}
                  onChange={(value) => form.setValue('configuration.use_percentage', value)}
                />
                
                <MovementConfigurationToggle
                  name="RPE"
                  value={form.watch('configuration.use_rpe')}
                  onChange={(value) => form.setValue('configuration.use_rpe', value)}
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
