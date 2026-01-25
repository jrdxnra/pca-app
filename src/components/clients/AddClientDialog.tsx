"use client";

import { useState, useEffect, useRef, useMemo } from 'react';
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
import { Client, Period, ClientProgram } from '@/lib/types';
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
  const { addClient, editClient, loading } = useClientStore();
  
  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  
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

  const onSubmit = async (data: ClientFormData, shouldClose: boolean = true) => {
    console.log('[AddClientDialog] onSubmit called, isEditMode:', isEditMode, 'shouldClose:', shouldClose);
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

      // Reset form and optionally close dialog
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
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{isEditMode ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          <DialogDescription>
            {isEditMode 
              ? 'Update client information below.'
              : 'Add a new client to your roster. Fill in their details below.'
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Client Name */}
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., John Smith" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Email */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input 
                        type="email" 
                        placeholder="e.g., john@example.com" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Phone */}
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., (555) 123-4567" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Birthday */}
              <FormField
                control={form.control}
                name="birthday"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Birthday</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Target Sessions Per Week */}
              <FormField
                control={form.control}
                name="targetSessionsPerWeek"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sessions/Week</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === 'none' ? undefined : parseInt(value, 10))}
                      value={field.value?.toString() ?? 'none'}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select target" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num} {num === 1 ? 'session' : 'sessions'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription className="text-xs">
                      Target sessions
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Goals */}
            <FormField
              control={form.control}
              name="goals"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fitness Goals</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="What does this client want to achieve? (e.g., lose weight, build muscle, improve performance...)"
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Their primary objectives and what they want to accomplish
                  </FormDescription>
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
                {loading 
                  ? (isEditMode ? 'Updating...' : 'Adding...') 
                  : (isEditMode ? 'Update Client' : 'Add Client')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
