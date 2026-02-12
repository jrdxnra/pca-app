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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Dumbbell } from 'lucide-react';
import { useMovementStore } from '@/lib/stores/useMovementStore';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { MovementConfigurationToggle } from './MovementConfigurationToggle';

// Form validation schema
const movementSchema = z.object({
  name: z.string().min(1, 'Movement name is required').max(100, 'Name must be less than 100 characters'),
  links: z.string().optional(), // Will be split into array
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

interface AddMovementDialogProps {
  categoryId: string;
  trigger?: React.ReactNode;
}

export function AddMovementDialog({ categoryId, trigger }: AddMovementDialogProps) {
  const [open, setOpen] = useState(false);
  const { addMovement, loading } = useMovementStore();
  const { categories } = useMovementCategoryStore();

  // Get category to extract default configuration
  const category = categories.find(c => c.id === categoryId);

  // Define fallback defaults
  const fallbackConfig = {
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
  };

  const form = useForm<MovementFormData>({
    resolver: zodResolver(movementSchema),
    defaultValues: {
      name: '',
      links: '',
      configuration: category?.defaultConfiguration || fallbackConfig,
    },
  });

  // Update defaults when category changes
  useEffect(() => {
    if (category?.defaultConfiguration) {
      const currentConfig = form.getValues('configuration');
      const categoryConfig = category.defaultConfiguration;

      // Only reset if config actually changed
      const configChanged = JSON.stringify(currentConfig) !== JSON.stringify(categoryConfig);
      if (configChanged) {
        form.setValue('configuration', categoryConfig as any);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id]);

  const onSubmit = async (data: MovementFormData) => {
    try {
      // Process links string into array
      const links = data.links
        ? data.links.split('\n').map(link => link.trim()).filter(link => link.length > 0)
        : [];

      const movementData: any = {
        name: data.name,
        categoryId,
        links,
        configuration: data.configuration,
      };

      await addMovement(movementData);

      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to add movement:', error);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Plus className="h-4 w-4 mr-1.5 icon-add" />
      Add Movement
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Add Movement
          </DialogTitle>
          <DialogDescription>
            Create a new movement with configuration options for workout programming.
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
                    Enter the name of the exercise or movement
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />


            {/* Video Links */}
            <FormField
              control={form.control}
              name="links"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Video Links</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="https://youtube.com/watch?v=example1&#10;https://youtube.com/watch?v=example2"
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional video URLs (one per line) for demonstration or instruction
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

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="outline" disabled={loading}>
                {loading ? 'Adding...' : 'Add Movement'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}