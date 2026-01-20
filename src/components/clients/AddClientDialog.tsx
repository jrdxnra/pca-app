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
import { PeriodizationTimeline } from './PeriodizationTimeline';
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
}

export function AddClientDialog({ trigger, client, open: controlledOpen, onOpenChange: controlledOnOpenChange, periods = [], clientPrograms = [] }: AddClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { addClient, editClient, loading } = useClientStore();
  const { assignPeriod } = useClientPrograms(client?.id);
  
  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  
  const isEditMode = !!client;
  
  // Get current client's periods
  const clientProgram = isEditMode ? clientPrograms.find(cp => cp.clientId === client?.id) : undefined;
  const clientPeriods = clientProgram?.periods || [];

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

      // Reset form and close dialog
      form.reset();
      setOpen(false);
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'add'} client:`, error);
      // Error is handled by the store
    }
  };

  const handleSavePeriods = async (newPeriods: any[]) => {
    if (!isEditMode || !client) return;
    
    try {
      // Clear existing periods first (optional - or just add new ones)
      for (const period of newPeriods) {
        await assignPeriod({
          clientId: client.id,
          periodId: period.periodConfigId,
          startDate: period.startDate,
          endDate: period.endDate,
        });
      }
    } catch (error) {
      console.error('Failed to save periods:', error);
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

            {/* Periodization Timeline - Only show in edit mode when periods exist */}
            {isEditMode && clientPeriods.length > 0 && (
              <div className="border-t pt-3 mt-3">
                <h3 className="text-sm font-semibold mb-3">Training Phases</h3>
                <PeriodizationTimeline
                  periods={periods}
                  clientPeriods={clientPeriods}
                  title=""
                  onSave={handleSavePeriods}
                />
              </div>
            )}

            <DialogFooter className="sticky bottom-0 bg-background pt-3 border-t">
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
