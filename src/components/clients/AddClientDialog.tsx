"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Timestamp } from 'firebase/firestore';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil } from 'lucide-react';
import { useClientStore } from '@/lib/stores/useClientStore';
import { Client, ClientProgram } from '@/lib/types';
import { Period } from '@/lib/firebase/services/periods';
import { PeriodizationTimeline, MemoizedPeriodizationTimeline } from './PeriodizationTimeline';
import { useClientPrograms } from '@/hooks/useClientPrograms';

// Form validation schema
const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  goals: z.string().optional(),
  notes: z.string().optional(),
  targetSessionsPerWeek: z.number().min(0).max(14).optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface AddClientDialogProps {
  trigger?: React.ReactNode;
  client?: Client | null; // If provided, dialog will be in edit mode
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  periods?: Period[];
  clientPrograms?: ClientProgram[];
  onClientProgramsRefresh?: () => Promise<void>; // Callback to refresh client programs after save
  onClientRefresh?: () => Promise<void>; // Callback to refresh client data after save
}

export function AddClientDialog({ trigger, client, open: controlledOpen, onOpenChange: controlledOnOpenChange, periods = [], clientPrograms = [], onClientProgramsRefresh, onClientRefresh }: AddClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const { addClient, editClient, loading } = useClientStore();
  const { assignPeriod } = useClientPrograms(client?.id);
  const periodizationRef = useRef<any>(null);

  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;

  // Handle scroll restoration when dialog closes
  useEffect(() => {
    if (open) {
      // Dialog opening - save scroll position
      setScrollPosition(window.scrollY);
    } else {
      // Dialog closing - wait for animations to complete, then restore scroll
      const timer = setTimeout(() => {
        window.scrollTo(0, scrollPosition);
      }, 275);
      return () => clearTimeout(timer);
    }
  }, [open, scrollPosition]);

  const isEditMode = !!client;

  // Get current client's periods
  const clientProgram = isEditMode ? clientPrograms.find(cp => cp.clientId === client?.id) : undefined;
  const clientPeriods = clientProgram?.periods || [];

  // Memoize the conversion of trainingPhases to clientPeriods format
  const convertedTrainingPhases = useMemo(() => {
    if (!client?.trainingPhases) return [];
    return client.trainingPhases.map(tp => ({
      id: tp.id,
      periodConfigId: tp.periodConfigId,
      periodName: tp.periodName,
      periodColor: tp.periodColor,
      startDate: new Date(tp.startDate),
      endDate: new Date(tp.endDate),
      days: []
    }));
  }, [client?.trainingPhases]);

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name || '',
      email: client?.email || '',
      phone: client?.phone || '',
      birthday: client?.birthday || '',
      goals: client?.goals || '',
      notes: client?.notes || '',
      targetSessionsPerWeek: client?.targetSessionsPerWeek || undefined,
    },
  });

  // Reset form when client changes or dialog opens (for edit mode)
  useEffect(() => {
    if (open && client) {
      form.reset({
        name: client.name || '',
        email: client.email || '',
        phone: client.phone || '',
        birthday: client.birthday || '',
        goals: client.goals || '',
        notes: client.notes || '',
        targetSessionsPerWeek: client.targetSessionsPerWeek || undefined,
      });
    } else if (open && !client) {
      // Reset to empty for add mode
      form.reset({
        name: '',
        email: '',
        phone: '',
        birthday: '',
        goals: '',
        notes: '',
        targetSessionsPerWeek: undefined,
      });
    }
  }, [open, client, form]);

  const onSubmit = async (data: ClientFormData) => {
    console.log('[AddClientDialog] onSubmit called, isEditMode:', isEditMode);
    try {
      if (isEditMode && client) {
        await editClient(client.id, {
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          birthday: data.birthday || undefined,
          goals: data.goals || undefined,
          notes: data.notes || undefined,
          targetSessionsPerWeek: data.targetSessionsPerWeek,
        });
      } else {
        await addClient({
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          birthday: data.birthday || undefined,
          goals: data.goals || undefined,
          notes: data.notes || undefined,
          targetSessionsPerWeek: data.targetSessionsPerWeek,
        });
      }

      // Also save periods if in edit mode
      if (isEditMode && client && periodizationRef.current) {
        setPeriodSaving(true);
        try {
          console.log('[AddClientDialog] About to getSaveData from periodization timeline');
          const saveData = await periodizationRef.current.getSaveData();
          console.log('[AddClientDialog] getSaveData returned:', saveData);
          // Save periods and goals to database via handleSavePeriods
          await handleSavePeriods(saveData.periods, saveData.goals);
          console.log('Period selections and goals saved to database:', saveData.periods.length, 'periods,', saveData.goals.length, 'goals');
        } catch (error) {
          console.error('Failed to save periods:', error);
        } finally {
          setPeriodSaving(false);
        }
      }

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'add'} client:`, error);
      // Error is handled by the store
    }
  };

  const [periodSaving, setPeriodSaving] = useState(false);

  const handleSavePeriods = async (newPeriods: any[], goals: any[]) => {
    if (!isEditMode || !client) return;

    setPeriodSaving(true);
    try {
      // Convert periods to TrainingPhase format for simple storage on client document
      const trainingPhases = newPeriods.map(period => ({
        id: period.id,
        periodConfigId: period.periodConfigId,
        periodName: period.periodName,
        periodColor: period.periodColor,
        startDate: period.startDate instanceof Date
          ? period.startDate.toISOString().split('T')[0]
          : period.startDate,
        endDate: period.endDate instanceof Date
          ? period.endDate.toISOString().split('T')[0]
          : period.endDate
      }));

      // Save both training phases and event goals directly to client document
      await editClient(client.id, {
        trainingPhases,
        eventGoals: goals
      });

      // Refresh client data to get updated trainingPhases and eventGoals
      if (onClientRefresh) {
        await onClientRefresh();
      }

      // Refresh client programs to ensure UI updates
      if (onClientProgramsRefresh) {
        await onClientProgramsRefresh();
      }

      console.log('Training phases and event goals saved to client profile:', trainingPhases.length, 'phases,', goals.length, 'goals');
    } catch (error) {
      console.error('Failed to save training phases:', error);
    } finally {
      setPeriodSaving(false);
    }
  };

  const defaultTrigger = (
    <Button variant="outline">
      <Plus className="h-4 w-4 mr-1.5 icon-add" />
      Add Client
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isEditMode && (
        <DialogTrigger asChild>
          {trigger || defaultTrigger}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="sticky top-0 bg-background z-10">
          <DialogTitle>{isEditMode ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update client information below.'
              : 'Add a new client to your roster. Fill in their details below.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2">
            <div className="grid grid-cols-12 gap-2">
              {/* Client Name */}
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="John Smith" {...field} className="text-sm h-8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email */}
              <div className="col-span-3">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Email</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                          className="text-sm h-8"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Phone */}
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="(555) 123-4567" {...field} className="text-sm h-8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Birthday */}
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="birthday"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Birthday</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="text-sm h-8" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Target Sessions Per Week */}
              <div className="col-span-2">
                <FormField
                  control={form.control}
                  name="targetSessionsPerWeek"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Sessions/Week</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === 'none' ? undefined : parseInt(value, 10))}
                        value={field.value?.toString() ?? 'none'}
                      >
                        <FormControl>
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="None" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((num) => (
                            <SelectItem key={num} value={num.toString()}>
                              {num}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {/* Goals */}
              <FormField
                control={form.control}
                name="goals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Fitness Goals</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., lose weight, build muscle, improve performance"
                        className="min-h-[60px] text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs">Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Injuries, preferences, schedule, etc."
                        className="min-h-[60px] text-sm"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Periodization Timeline - Show in edit mode (even if no periods assigned yet) */}
            {isEditMode && (
              <div className="border-t pt-3 mt-3">
                <MemoizedPeriodizationTimeline
                  ref={periodizationRef}
                  periods={periods}
                  clientPeriods={convertedTrainingPhases}
                  clientEventGoals={client?.eventGoals || []}
                  clientCreatedAt={client?.createdAt}
                  title="Training Phases"
                  onSave={handleSavePeriods}
                  showSaveButton={false}
                />
              </div>
            )}

            <DialogFooter className="sticky bottom-0 bg-background pt-3 border-t flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={loading || periodSaving}
              >
                Cancel
              </Button>
              {isEditMode && clientPeriods.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={loading || periodSaving}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    form.handleSubmit(async (data) => { await onSubmit(data); })();
                  }}
                >
                  {loading || periodSaving ? 'Saving...' : 'Save'}
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={loading || periodSaving}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                   form.handleSubmit(onSubmit)();
                }}
              >
                {loading || periodSaving
                  ? (isEditMode ? 'Saving...' : 'Adding...')
                  : (isEditMode ? 'Save & Close' : 'Add Client')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
