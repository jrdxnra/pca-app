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
import { Button } from '@/components/ui/button';
import { Settings, Palette, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';
import { MovementCategory } from '@/lib/types';
import { MovementConfigurationToggle } from './MovementConfigurationToggle';

// Form validation schema
const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(64, 'Name must be less than 65 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color'),
  defaultConfiguration: z.object({
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
  }).optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface EditCategoryDialogProps {
  category: MovementCategory;
  trigger?: React.ReactNode;
}

export function EditCategoryDialog({ category, trigger }: EditCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDefaults, setShowDefaults] = useState(false);
  const { editCategory, removeCategory, loading } = useMovementCategoryStore();

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

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category.name,
      color: category.color,
      defaultConfiguration: category.defaultConfiguration || fallbackConfig,
    },
  });

  // Update form when category changes
  useEffect(() => {
    form.reset({
      name: category.name,
      color: category.color,
      defaultConfiguration: category.defaultConfiguration || fallbackConfig,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, category.name, category.color]);

  const onSubmit = async (data: CategoryFormData) => {
    try {
      await editCategory(category.id, data);
      setOpen(false);
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  };

  const handleDelete = async () => {
    try {
      await removeCategory(category.id);
      setOpen(false);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  const defaultTrigger = (
    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
      <Settings className="h-4 w-4" />
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
            <Palette className="h-5 w-5" />
            Edit Category
          </DialogTitle>
          <DialogDescription>
            Update the category name, color, and default configuration for new movements. Existing movements are not affected.
          </DialogDescription>
        </DialogHeader>

        {!showDeleteConfirm ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Category Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Squat, Horizontal Push" {...field} />
                    </FormControl>
                    <FormDescription>
                      Choose a descriptive name for this movement category
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Category Color */}
              <FormField
                control={form.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category Color *</FormLabel>
                    <div className="flex items-center gap-4">
                      <FormControl>
                        <input
                          type="color"
                          {...field}
                          className="w-12 h-12 rounded-lg border-2 border-gray-300 cursor-pointer"
                          style={{ backgroundColor: field.value }}
                        />
                      </FormControl>
                      <div className="flex-1">
                        <Input
                          {...field}
                          placeholder="#8B5CF6"
                          className="font-mono text-sm"
                        />
                        <FormDescription>
                          This color will be used in workout builders and movement displays
                        </FormDescription>
                      </div>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Default Configuration Section */}
              <div className="border-t pt-4">
                <button
                  type="button"
                  onClick={() => setShowDefaults(!showDefaults)}
                  className="flex items-center justify-between w-full text-left"
                >
                  <div>
                    <FormLabel className="text-base font-semibold">Default Movement Configuration</FormLabel>
                    <FormDescription>
                      Set default configuration for new movements in this category. Existing movements keep their current settings.
                    </FormDescription>
                  </div>
                  {showDefaults ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showDefaults && (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap py-2 gap-1">
                      <MovementConfigurationToggle
                        name="Reps"
                        value={form.watch('defaultConfiguration.use_reps')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_reps', value)}
                      />
                      
                      <MovementConfigurationToggle
                        name="Weight"
                        value={form.watch('defaultConfiguration.use_weight')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_weight', value)}
                        measureOptions={['lbs', 'kg']}
                        measureValue={form.watch('defaultConfiguration.weight_measure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.weight_measure', value as 'lbs' | 'kg')}
                      />
                      
                      <MovementConfigurationToggle
                        name="Distance"
                        value={form.watch('defaultConfiguration.use_distance')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_distance', value)}
                        measureOptions={['mi', 'km', 'm', 'yd', 'ft']}
                        measureValue={form.watch('defaultConfiguration.distance_measure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.distance_measure', value as 'mi' | 'km' | 'm' | 'yd' | 'ft')}
                      />
                      
                      <MovementConfigurationToggle
                        name="Pace"
                        value={form.watch('defaultConfiguration.use_pace')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_pace', value)}
                        measureOptions={['mi', 'km']}
                        measureValue={form.watch('defaultConfiguration.pace_measure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.pace_measure', value as 'mi' | 'km')}
                      />
                      
                      <MovementConfigurationToggle
                        name="Tempo"
                        value={form.watch('defaultConfiguration.use_tempo')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_tempo', value)}
                      />
                      
                      <MovementConfigurationToggle
                        name="Time"
                        value={form.watch('defaultConfiguration.use_time')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_time', value)}
                      />
                      
                      <MovementConfigurationToggle
                        name="Unilateral"
                        value={form.watch('defaultConfiguration.unilateral')}
                        onChange={(value) => form.setValue('defaultConfiguration.unilateral', value)}
                      />
                      
                      <MovementConfigurationToggle
                        name="Percentage"
                        value={form.watch('defaultConfiguration.use_percentage')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_percentage', value)}
                      />
                      
                      <MovementConfigurationToggle
                        name="RPE"
                        value={form.watch('defaultConfiguration.use_rpe')}
                        onChange={(value) => form.setValue('defaultConfiguration.use_rpe', value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <DialogFooter className="flex justify-between">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4 mr-2 icon-delete" />
                  Delete
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="outline" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <Trash2 className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Delete Category</h3>
              <p className="text-muted-foreground">
                Are you sure you want to delete "{category.name}"? This will also delete all movements in this category. This action cannot be undone.
              </p>
            </div>
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Deleting...' : 'Delete Category'}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
