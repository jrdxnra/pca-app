"use client";

import { useState } from 'react';
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
import { Plus, Palette } from 'lucide-react';
import { useMovementCategoryStore } from '@/lib/stores/useMovementCategoryStore';

// Form validation schema
const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(64, 'Name must be less than 65 characters'),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Must be a valid hex color'),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface AddCategoryDialogProps {
  trigger?: React.ReactNode;
}

export function AddCategoryDialog({ trigger }: AddCategoryDialogProps) {
  const [open, setOpen] = useState(false);
  const { addCategory, loading } = useMovementCategoryStore();

  const form = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: '',
      color: '#8B5CF6', // Default purple color
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    try {
      await addCategory(data);
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to add category:', error);
    }
  };

  const defaultTrigger = (
    <Button variant="outline" size="sm">
      <Plus className="h-4 w-4 mr-1.5 icon-add" />
      Add Category
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Add Movement Category
          </DialogTitle>
          <DialogDescription>
            Create a new category to organize your movements. The color will be used throughout the app for visual organization.
          </DialogDescription>
        </DialogHeader>

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
                {loading ? 'Adding...' : 'Add Category'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
