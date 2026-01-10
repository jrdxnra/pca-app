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
// Removed Select components to prevent infinite loop issues
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Plus, Calendar, Dumbbell } from 'lucide-react';
import { format } from 'date-fns';
import { useProgramStore } from '@/lib/stores/useProgramStore';
import { useWorkoutStore } from '@/lib/stores/useWorkoutStore';
import { Program } from '@/lib/types';

// Form validation schema
const scheduleWorkoutSchema = z.object({
  programId: z.string().min(1, 'Program is required'),
  workoutTemplateId: z.string().min(1, 'Workout template is required'),
  sessionType: z.string().min(1, 'Session type is required'),
  keepLinked: z.boolean().default(true),
});

type ScheduleWorkoutFormData = z.infer<typeof scheduleWorkoutSchema>;

interface ScheduleWorkoutDialogProps {
  date: Date;
  clientId: string;
  programs: Program[];
  trigger: React.ReactNode;
}

export function ScheduleWorkoutDialog({ 
  date, 
  clientId, 
  programs,
  trigger 
}: ScheduleWorkoutDialogProps) {
  const [open, setOpen] = useState(false);
  const { scheduleWorkout, loading } = useProgramStore();
  const { workoutTemplates, fetchWorkoutTemplates } = useWorkoutStore();

  const form = useForm<ScheduleWorkoutFormData>({
    resolver: zodResolver(scheduleWorkoutSchema),
    defaultValues: {
      programId: '',
      workoutTemplateId: '',
      sessionType: '',
      keepLinked: true,
    },
  });

  useEffect(() => {
    fetchWorkoutTemplates();
  }, [fetchWorkoutTemplates]);

  // Filter programs for the selected client
  const clientPrograms = programs.filter(program => 
    program.clientId === clientId &&
    new Date(program.startDate.toDate()) <= date &&
    new Date(program.endDate.toDate()) >= date
  );

  const onSubmit = async (data: ScheduleWorkoutFormData) => {
    try {
      await scheduleWorkout(
        data.programId,
        clientId,
        date,
        data.workoutTemplateId,
        data.sessionType,
        data.keepLinked
      );

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error('Failed to schedule workout:', error);
    }
  };

  const selectedTemplate = workoutTemplates.find(
    template => template.id === form.watch('workoutTemplateId')
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Workout
          </DialogTitle>
          <DialogDescription>
            Schedule a workout for {format(date, 'EEEE, MMMM do, yyyy')}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Program Selection */}
            <FormField
              control={form.control}
              name="programId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Program *</FormLabel>
                  <FormControl>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onChange={(e) => field.onChange(e.target.value)} 
                      defaultValue={field.value}
                    >
                      <option value="">Select a program</option>
                      {clientPrograms.length === 0 ? (
                        <option disabled>No active programs for this date</option>
                      ) : (
                        clientPrograms.map((program) => (
                          <option key={program.id} value={program.id}>
                            {program.name} ({format(program.startDate.toDate(), 'MMM d')} - {format(program.endDate.toDate(), 'MMM d, yyyy')})
                          </option>
                        ))
                      )}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Workout Template Selection */}
            <FormField
              control={form.control}
              name="workoutTemplateId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Workout Template *</FormLabel>
                  <FormControl>
                    <select 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      onChange={(e) => field.onChange(e.target.value)} 
                      defaultValue={field.value}
                    >
                      <option value="">Select a workout template</option>
                      {workoutTemplates.length === 0 ? (
                        <option disabled>No workout templates available</option>
                      ) : (
                        workoutTemplates.map((template) => (
                          <option key={template.id} value={template.id}>
                            {template.name} ({template.rounds.length} rounds)
                          </option>
                        ))
                      )}
                    </select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Session Type */}
            <FormField
              control={form.control}
              name="sessionType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Session Type *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Upper Body Strength, Conditioning, etc." 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Describe the focus or type of this workout session
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Template Linking Option */}
            <FormField
              control={form.control}
              name="keepLinked"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Keep linked to template
                    </FormLabel>
                    <FormDescription>
                      If checked, changes to the template will update this workout. 
                      If unchecked, this becomes an independent copy.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            {/* Template Preview */}
            {selectedTemplate && (
              <div className="space-y-3">
                <FormLabel>Template Preview</FormLabel>
                <div className="border rounded-lg p-4 bg-muted/50">
                  <div className="flex items-center gap-2 mb-3">
                    <Dumbbell className="h-4 w-4" />
                    <span className="font-medium">{selectedTemplate.name}</span>
                    <Badge variant="secondary">{selectedTemplate.rounds.length} rounds</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    {selectedTemplate.rounds.map((round, index) => (
                      <div key={index} className="text-sm">
                        <span className="font-medium">{round.name}</span>
                        <span className="text-muted-foreground ml-2">
                          ({round.exercises.length} exercises)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
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
              <Button type="submit" disabled={loading || clientPrograms.length === 0}>
                {loading ? 'Scheduling...' : 'Schedule Workout'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
