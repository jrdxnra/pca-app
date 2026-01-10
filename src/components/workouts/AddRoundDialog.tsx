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
import { Plus } from 'lucide-react';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';

// Form validation schema
const roundSchema = z.object({
  name: z.string().min(1, 'Round name is required'),
});

type RoundFormData = z.infer<typeof roundSchema>;

interface AddRoundDialogProps {
  trigger?: React.ReactNode;
}

// Common round names for quick selection
const COMMON_ROUNDS = [
  'PP/MB/Ballistics',
  'Movement Skill',
  'Strength 1',
  'Strength 2',
  'ESD',
  'Warm-up',
  'Cool-down',
  'Accessory',
  'Conditioning',
  'Core',
];

export function AddRoundDialog({ trigger }: AddRoundDialogProps) {
  const [open, setOpen] = useState(false);
  const { addRound } = useWorkoutStore();

  const form = useForm<RoundFormData>({
    resolver: zodResolver(roundSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = async (data: RoundFormData) => {
    try {
      addRound({
        name: data.name,
        exercises: [],
      });

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to add round:', error);
    }
  };

  const handleQuickAdd = (roundName: string) => {
    form.setValue('name', roundName);
  };

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4 mr-1.5 icon-add" />
      Add Round
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Round</DialogTitle>
          <DialogDescription>
            Add a new round to your workout. Choose from common round types or create a custom one.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Quick Selection */}
            <div>
              <label className="text-sm font-medium mb-3 block">
                Quick Selection
              </label>
              <div className="grid grid-cols-2 gap-2">
                {COMMON_ROUNDS.map((roundName) => (
                  <Button
                    key={roundName}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleQuickAdd(roundName)}
                    className="justify-start text-left h-auto py-2"
                  >
                    {roundName}
                  </Button>
                ))}
              </div>
            </div>

            {/* Custom Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Round Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Strength 3, Mobility, etc." {...field} />
                  </FormControl>
                  <FormDescription>
                    Choose from above or enter a custom round name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                Add Round
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
