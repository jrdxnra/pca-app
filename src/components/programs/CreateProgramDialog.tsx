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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useEffect } from 'react';

// Form validation schema
const programSchema = z.object({
  name: z.string().min(1, 'Program name is required'),
  description: z.string().optional(),
  totalWeeks: z.number().min(1, 'Must be at least 1 week').max(52, 'Cannot exceed 52 weeks'),
});

type ProgramFormData = z.infer<typeof programSchema>;

interface CreateProgramDialogProps {
  trigger?: React.ReactNode;
}

export function CreateProgramDialog({ trigger }: CreateProgramDialogProps) {
  const [open, setOpen] = useState(false);
  const { addProgram, loading } = useProgramStore();

  const form = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      name: '',
      description: '',
      totalWeeks: 12,
    },
  });

  const onSubmit = async (data: ProgramFormData) => {
    try {
      await addProgram({
        name: data.name,
        description: data.description,
        totalWeeks: data.totalWeeks,
        isTemplate: true,
        createdBy: 'current-coach-id', // TODO: Get from auth context
        periodization: [
          {
            weekStart: 1,
            weekEnd: Math.ceil(data.totalWeeks / 3),
            focus: 'Foundation',
            color: '#8b5cf6', // Purple
          },
          {
            weekStart: Math.ceil(data.totalWeeks / 3) + 1,
            weekEnd: Math.ceil((data.totalWeeks * 2) / 3),
            focus: 'Development',
            color: '#06b6d4', // Cyan
          },
          {
            weekStart: Math.ceil((data.totalWeeks * 2) / 3) + 1,
            weekEnd: data.totalWeeks,
            focus: 'Peak',
            color: '#eab308', // Yellow
          },
        ],
      });

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to create program:', error);
    }
  };

  const watchedTotalWeeks = form.watch('totalWeeks');

  const defaultTrigger = (
    <Button>
      <Plus className="h-4 w-4 mr-1.5 icon-add" />
      Create Program
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Program Template</DialogTitle>
          <DialogDescription>
            Create a reusable program template that can be assigned to multiple clients.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Program Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Powerlifting 201, Strength Foundation" {...field} />
                  </FormControl>
                  <FormDescription>
                    Give this program template a descriptive name
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Program Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., 12-week powerlifting program focusing on squat, bench, deadlift" {...field} />
                  </FormControl>
                  <FormDescription>
                    Optional description of what this program focuses on
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Duration */}
            <FormField
              control={form.control}
              name="totalWeeks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duration (Weeks) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      max="52"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    How many weeks this program template should run
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Periodization Preview */}
            {watchedTotalWeeks && (
              <div className="space-y-3">
                <FormLabel>Periodization Preview</FormLabel>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800">
                    <div className="font-medium text-purple-700 dark:text-purple-300">Foundation</div>
                    <div className="text-purple-600 dark:text-purple-400">
                      Weeks 1-{Math.ceil(watchedTotalWeeks / 3)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-cyan-100 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                    <div className="font-medium text-cyan-700 dark:text-cyan-300">Development</div>
                    <div className="text-cyan-600 dark:text-cyan-400">
                      Weeks {Math.ceil(watchedTotalWeeks / 3) + 1}-{Math.ceil((watchedTotalWeeks * 2) / 3)}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
                    <div className="font-medium text-yellow-700 dark:text-yellow-300">Peak</div>
                    <div className="text-yellow-600 dark:text-yellow-400">
                      Weeks {Math.ceil((watchedTotalWeeks * 2) / 3) + 1}-{watchedTotalWeeks}
                    </div>
                  </div>
                </div>
                <FormDescription>
                  Default periodization phases will be created. You can customize these after creating the program.
                </FormDescription>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Create Program'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
