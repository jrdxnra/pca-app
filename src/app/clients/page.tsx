"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Search, Users, Trash2, RotateCcw, Layers, X, Calendar, Target } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { ClientHistoryImportDialog } from '@/components/clients/ClientHistoryImportDialog';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { Client } from '@/lib/types';

interface ClientDraft {
  name: string;
  email: string;
  phone: string;
  birthday: string;
  goals: string;
  notes: string;
  targetSessionsPerWeek: string;
}

function toDraft(client: Client): ClientDraft {
  return {
    name: client.name || '',
    email: client.email || '',
    phone: client.phone || '',
    birthday: client.birthday || '',
    goals: client.goals || '',
    notes: client.notes || '',
    targetSessionsPerWeek:
      typeof client.targetSessionsPerWeek === 'number' ? String(client.targetSessionsPerWeek) : '',
  };
}

export default function ClientsPage() {
  const {
    clients,
    loading,
    error,
    searchTerm,
    includeDeleted,
    fetchClients,
    searchClients,
    setSearchTerm,
    setIncludeDeleted,
    editClient,
    deleteClient,
    permanentDeleteClient,
    restoreClient,
    clearError,
  } = useClientStore();

  const { periods, weekTemplates, workoutCategories, fetchAll: fetchAllConfig } = useConfigurationStore();
  const { clientPrograms, assignPeriod, fetchClientPrograms } = useClientPrograms();

  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClientDraft | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [periodDialogClient, setPeriodDialogClient] = useState<Client | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchAllConfig();
    fetchClientPrograms();
  }, [fetchClients, fetchAllConfig, fetchClientPrograms]);

  useEffect(() => {
    if (clients.length === 0) {
      setSelectedClientId(null);
      setDraft(null);
      return;
    }

    const existingSelected = selectedClientId ? clients.find((c) => c.id === selectedClientId) : null;
    if (existingSelected) return;

    const firstActive = clients.find((c) => !c.isDeleted) || clients[0];
    setSelectedClientId(firstActive.id);
  }, [clients, selectedClientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (!selectedClient) {
      setDraft(null);
      return;
    }
    setDraft(toDraft(selectedClient));
  }, [selectedClient]);

  const dirtyPayload = useMemo(() => {
    if (!selectedClient || !draft) return null;

    const normalizeText = (value: string): string | undefined => {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    };

    const normalizeNumber = (value: string): number | undefined => {
      const trimmed = value.trim();
      if (!trimmed) return undefined;
      const parsed = Number(trimmed);
      if (!Number.isFinite(parsed)) return undefined;
      return parsed;
    };

    const next = {
      name: draft.name.trim(),
      email: normalizeText(draft.email),
      phone: normalizeText(draft.phone),
      birthday: normalizeText(draft.birthday),
      goals: normalizeText(draft.goals),
      notes: normalizeText(draft.notes),
      targetSessionsPerWeek: normalizeNumber(draft.targetSessionsPerWeek),
    };

    const payload: Partial<Omit<Client, 'id' | 'createdAt'>> = {};

    if (next.name !== (selectedClient.name || '')) payload.name = next.name;
    if (next.email !== selectedClient.email) payload.email = next.email;
    if (next.phone !== selectedClient.phone) payload.phone = next.phone;
    if (next.birthday !== selectedClient.birthday) payload.birthday = next.birthday;
    if (next.goals !== selectedClient.goals) payload.goals = next.goals;
    if (next.notes !== selectedClient.notes) payload.notes = next.notes;
    if (next.targetSessionsPerWeek !== selectedClient.targetSessionsPerWeek) {
      payload.targetSessionsPerWeek = next.targetSessionsPerWeek;
    }

    return payload;
  }, [selectedClient, draft]);

  const isDirty = Boolean(dirtyPayload && Object.keys(dirtyPayload).length > 0);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchClients(localSearchTerm);
  };

  const handleClearSearch = () => {
    setLocalSearchTerm('');
    setSearchTerm('');
    fetchClients();
  };

  const handleSave = async () => {
    if (!selectedClient || !dirtyPayload || Object.keys(dirtyPayload).length === 0) return;

    setIsSaving(true);
    try {
      await editClient(selectedClient.id, dirtyPayload);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This action can be undone.`)) {
      await deleteClient(id);
    }
  };

  const handlePermanentDeleteClient = async (id: string, name: string) => {
    if (
      confirm(
        `⚠️ PERMANENTLY DELETE ${name}?\n\nThis action CANNOT be undone. All client data will be lost forever.\n\nAre you absolutely sure?`
      )
    ) {
      await permanentDeleteClient(id);
    }
  };

  const handleRestoreClient = async (id: string, name: string) => {
    if (confirm(`Restore ${name}?`)) {
      await restoreClient(id);
    }
  };

  const handleAssignPeriod = async (assignment: {
    clientId: string;
    periodId: string;
    startDate: Date;
    endDate: Date;
    weekTemplateId?: string;
    defaultTime?: string;
    isAllDay?: boolean;
    dayTimes?: Array<{ time?: string; isAllDay: boolean; category?: string; deleted?: boolean }>;
  }) => {
    await assignPeriod(assignment);
    await fetchClientPrograms(assignment.clientId);
    setPeriodDialogOpen(false);
    setPeriodDialogClient(null);
  };

  return (
    <div className="w-full px-1 pt-1 pb-4 space-y-2">
      <Card className="py-2">
        <CardContent className="py-1 px-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <form onSubmit={handleSearch} className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 icon-clients" />
                <Input
                  placeholder="Search clients..."
                  value={localSearchTerm}
                  onChange={(e) => setLocalSearchTerm(e.target.value)}
                  className="pl-10 h-9"
                />
              </div>
              <Button type="submit" size="sm" disabled={loading}>
                Search
              </Button>
              {searchTerm && (
                <Button type="button" variant="outline" size="sm" onClick={handleClearSearch}>
                  Clear
                </Button>
              )}
            </form>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeDeleted"
                  checked={includeDeleted}
                  onChange={(e) => setIncludeDeleted(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="includeDeleted" className="text-sm text-muted-foreground">
                  Show deleted
                </label>
              </div>
              <AddClientDialog />
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <p className="text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && clients.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading clients...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading || clients.length > 0 ? (
        <div className="flex flex-col lg:flex-row gap-4">
          <aside className="hidden lg:block lg:w-72 shrink-0">
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4 icon-clients" />
                  Clients
                </CardTitle>
                <CardDescription>
                  {clients.length} total
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {clients.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clients found.</p>
                ) : (
                  clients.map((client) => (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => setSelectedClientId(client.id)}
                      className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                        selectedClientId === client.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted'
                      } ${client.isDeleted ? 'opacity-70 border-dashed' : ''}`}
                    >
                      <p className="text-sm font-medium truncate">{client.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {client.email || 'No email'}
                      </p>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>
          </aside>

          <main className="flex-1 space-y-4">
            <Card className="lg:hidden">
              <CardContent className="pt-4">
                <Select
                  value={selectedClientId || ''}
                  onValueChange={(value) => setSelectedClientId(value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {selectedClient ? (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          {selectedClient.name}
                          {selectedClient.isDeleted && (
                            <span className="text-xs bg-muted px-2 py-1 rounded">Deleted</span>
                          )}
                        </CardTitle>
                        <CardDescription>
                          Edit details directly. Save applies changed fields only.
                        </CardDescription>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {!selectedClient.isDeleted ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setPeriodDialogClient(selectedClient);
                                setPeriodDialogOpen(true);
                              }}
                              title="Assign Period"
                            >
                              <Layers className="h-4 w-4 mr-1" />
                              Period
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClient(selectedClient.id, selectedClient.name)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreClient(selectedClient.id, selectedClient.name)}
                            >
                              <RotateCcw className="h-4 w-4 mr-1" />
                              Restore
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handlePermanentDeleteClient(selectedClient.id, selectedClient.name)}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete Forever
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {draft && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Name</label>
                            <Input
                              value={draft.name}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Email</label>
                            <Input
                              value={draft.email}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, email: e.target.value } : prev))}
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Phone</label>
                            <Input
                              value={draft.phone}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Birthday</label>
                            <Input
                              type="date"
                              value={draft.birthday}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, birthday: e.target.value } : prev))}
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Goals</label>
                            <Textarea
                              value={draft.goals}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, goals: e.target.value } : prev))}
                              className="h-28 max-h-28 resize-none overflow-auto [field-sizing:fixed]"
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-sm font-medium">Notes</label>
                            <Textarea
                              value={draft.notes}
                              onChange={(e) => setDraft((prev) => (prev ? { ...prev, notes: e.target.value } : prev))}
                              className="h-28 max-h-28 resize-none overflow-auto [field-sizing:fixed]"
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                          <div className="space-y-1">
                            <label className="text-sm font-medium flex items-center gap-1">
                              <Target className="h-4 w-4" />
                              Target Sessions / Week
                            </label>
                            <Input
                              type="number"
                              min={0}
                              max={14}
                              value={draft.targetSessionsPerWeek}
                              onChange={(e) =>
                                setDraft((prev) =>
                                  prev ? { ...prev, targetSessionsPerWeek: e.target.value } : prev
                                )
                              }
                              disabled={selectedClient.isDeleted}
                            />
                          </div>
                          <div className="text-sm text-muted-foreground">
                            <p className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              Week {selectedClient.sessionCounts?.thisWeek || 0} / Month {selectedClient.sessionCounts?.thisMonth || 0} / Year {selectedClient.sessionCounts?.thisYear || 0}
                            </p>
                          </div>
                        </div>

                        {!selectedClient.isDeleted && (
                          <div className="flex items-center justify-between border-t pt-3">
                            <p className="text-sm text-muted-foreground">
                              {isDirty ? 'Unsaved changes' : 'All changes saved'}
                            </p>
                            <Button onClick={handleSave} disabled={!isDirty || isSaving}>
                              {isSaving ? 'Saving...' : 'Save Client Changes'}
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>

                {!selectedClient.isDeleted && (
                  <Card>
                    <CardContent className="pt-4">
                      <ClientHistoryImportDialog
                        key={selectedClient.id}
                        clientId={selectedClient.id}
                        clientName={selectedClient.name}
                        inline
                      />
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 icon-clients mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Select a client</h3>
                    <p className="text-muted-foreground">
                      Choose a client from the left sidebar to edit details and import history.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </main>
        </div>
      ) : null}

      {periodDialogClient && (
        <PeriodAssignmentDialog
          clientId={periodDialogClient.id}
          clientName={periodDialogClient.name}
          periods={periods || []}
          workoutCategories={workoutCategories || []}
          weekTemplates={weekTemplates || []}
          onAssignPeriod={handleAssignPeriod}
          existingAssignments={clientPrograms.find((cp) => cp.clientId === periodDialogClient.id)?.periods || []}
          open={periodDialogOpen}
          onOpenChange={(open) => {
            setPeriodDialogOpen(open);
            if (!open) {
              setPeriodDialogClient(null);
            }
          }}
        />
      )}
    </div>
  );
}
