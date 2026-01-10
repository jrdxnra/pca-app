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
        form.setValue('configuration', categoryConfig);
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