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

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: category.name,
      color: category.color,
      defaultConfiguration: { ...fallbackConfig, ...(category.defaultConfiguration || {}) },
    },
  });

  // Update form when category changes
  useEffect(() => {
    form.reset({
      name: category.name,
      color: category.color,
      defaultConfiguration: { ...fallbackConfig, ...(category.defaultConfiguration || {}) },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id, category.name, category.color]);

  const onSubmit = async (data: CategoryFormData) => {
    try {
      await editCategory(category.id, data as any);
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
                        value={form.watch('defaultConfiguration.useReps') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.useReps', value)}
                      />

                      <MovementConfigurationToggle
                        name="Weight"
                        value={form.watch('defaultConfiguration.useWeight') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.useWeight', value)}
                        measureOptions={['lbs', 'kg', 'bw']}
                        measureValue={form.watch('defaultConfiguration.weightMeasure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.weightMeasure', value as 'lbs' | 'kg' | 'bw')}
                      />

                      <MovementConfigurationToggle
                        name="Distance"
                        value={form.watch('defaultConfiguration.useDistance') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.useDistance', value)}
                        measureOptions={['mi', 'km', 'm', 'yd', 'ft']}
                        measureValue={form.watch('defaultConfiguration.distanceMeasure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.distanceMeasure', value as 'mi' | 'km' | 'm' | 'yd' | 'ft')}
                      />

                      <MovementConfigurationToggle
                        name="Pace"
                        value={form.watch('defaultConfiguration.usePace') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.usePace', value)}
                        measureOptions={['mi', 'km']}
                        measureValue={form.watch('defaultConfiguration.paceMeasure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.paceMeasure', value as 'mi' | 'km')}
                      />

                      <MovementConfigurationToggle
                        name="Tempo"
                        value={form.watch('defaultConfiguration.useTempo') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.useTempo', value)}
                      />

                      <MovementConfigurationToggle
                        name="Time"
                        value={form.watch('defaultConfiguration.useTime') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.useTime', value)}
                        measureOptions={['s', 'm']}
                        measureValue={form.watch('defaultConfiguration.timeMeasure')}
                        onMeasureChange={(value) => form.setValue('defaultConfiguration.timeMeasure', value as 's' | 'm')}
                      />

                      <MovementConfigurationToggle
                        name="Unilateral"
                        value={form.watch('defaultConfiguration.unilateral') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.unilateral', value)}
                      />

                      <MovementConfigurationToggle
                        name="Percentage"
                        value={form.watch('defaultConfiguration.usePercentage') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.usePercentage', value)}
                      />

                      <MovementConfigurationToggle
                        name="RPE"
                        value={form.watch('defaultConfiguration.useRPE') ?? false}
                        onChange={(value) => form.setValue('defaultConfiguration.useRPE', value)}
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
                Are you sure you want to delete &quot;{category.name}&quot;? This will also delete all movements in this category. This action cannot be undone.
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
