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
import { Plus, Pencil } from 'lucide-react';
import { useClientStore } from '@/lib/stores/useClientStore';
import { Client } from '@/lib/types';

// Form validation schema
const clientSchema = z.object({
  name: z.string().min(1, 'Client name is required'),
  email: z.string().email('Must be a valid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  birthday: z.string().optional(),
  goals: z.string().optional(),
  notes: z.string().optional(),
  targetSessionsPerWeek: z.string().transform((val) => val === '' ? undefined : Number(val)).pipe(z.number().min(0).max(14).optional()),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface AddClientDialogProps {
  trigger?: React.ReactNode;
  client?: Client | null; // If provided, dialog will be in edit mode
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AddClientDialog({ trigger, client, open: controlledOpen, onOpenChange: controlledOnOpenChange }: AddClientDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const { addClient, editClient, loading } = useClientStore();
  
  // Use controlled or internal state
  const open = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setOpen = controlledOnOpenChange || setInternalOpen;
  
  const isEditMode = !!client;

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
          targetSessionsPerWeek: data.targetSessionsPerWeek || undefined,
        });
      } else {
        await addClient({
          name: data.name,
          email: data.email || undefined,
          phone: data.phone || undefined,
          birthday: data.birthday || undefined,
          goals: data.goals || undefined,
          notes: data.notes || undefined,
          targetSessionsPerWeek: data.targetSessionsPerWeek || undefined,
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
                    <FormControl>
                      <Input 
                        type="number" 
                        min={0}
                        max={14}
                        placeholder="e.g., 3"
                        {...field}
                        value={field.value ?? ''}
                      />
                    </FormControl>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes about this client (injuries, preferences, schedule, etc.)"
                      className="min-h-[80px]"
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Medical history, preferences, or other important information
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
