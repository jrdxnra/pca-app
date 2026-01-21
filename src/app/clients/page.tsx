"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Users, Trash2, RotateCcw, Layers, X, Cake, Calendar, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useClientStore } from '@/lib/stores/useClientStore';
import { useConfigurationStore } from '@/lib/stores/useConfigurationStore';
import { useClientPrograms } from '@/hooks/useClientPrograms';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
import { PeriodAssignmentDialog } from '@/components/programs/PeriodAssignmentDialog';
import { Client } from '@/lib/types';

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
    deleteClient,
    permanentDeleteClient,
    restoreClient,
    clearError,
  } = useClientStore();

  const { periods, weekTemplates, workoutCategories, fetchAll: fetchAllConfig } = useConfigurationStore();
  const { clientPrograms, assignPeriod, fetchClientPrograms } = useClientPrograms();

  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Period assignment dialog state
  const [periodDialogClient, setPeriodDialogClient] = useState<Client | null>(null);
  const [periodDialogOpen, setPeriodDialogOpen] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchAllConfig();
    fetchClientPrograms(); // Fetch all client programs like schedule page does
  }, [fetchClients, fetchAllConfig, fetchClientPrograms]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchClients(localSearchTerm);
  };

  const handleClearSearch = () => {
    setLocalSearchTerm('');
    setSearchTerm('');
    fetchClients();
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}? This action can be undone.`)) {
      try {
        await deleteClient(id);
      } catch (error) {
        console.error('Failed to delete client:', error);
      }
    }
  };

  const handlePermanentDeleteClient = async (id: string, name: string) => {
    if (confirm(`⚠️ PERMANENTLY DELETE ${name}?\n\nThis action CANNOT be undone. All client data will be lost forever.\n\nAre you absolutely sure?`)) {
      try {
        await permanentDeleteClient(id);
      } catch (error) {
        console.error('Failed to permanently delete client:', error);
      }
    }
  };

  const handleRestoreClient = async (id: string, name: string) => {
    if (confirm(`Restore ${name}?`)) {
      try {
        await restoreClient(id);
      } catch (error) {
        console.error('Failed to restore client:', error);
      }
    }
  };

  // Handle period assignment - matches schedule page logic exactly
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
    try {
      // Use the shared hook for period assignment
      // This handles creating periods, calendar events, and workouts consistently
      await assignPeriod(assignment);
      
      // Refresh client programs after assignment
      await fetchClientPrograms(assignment.clientId);
      
      setPeriodDialogOpen(false);
      setPeriodDialogClient(null);
    } catch (error) {
      console.error('Error assigning period:', error);
    }
  };

  return (
    <div className="w-full px-1 pt-1 pb-4 space-y-2">
      {/* Toolbar */}
      <Card className="py-2">
        <CardContent className="py-1 px-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Left - Search */}
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

            {/* Right - Actions */}
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

      {/* Error Display */}
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

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <span className="ml-2">Loading clients...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clients List */}
      {!loading && (
        <>
          {/* Results Count */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {searchTerm ? `Found ${clients.length} clients for "${searchTerm}"` : ''}
              {includeDeleted && ` (including deleted)`}
            </p>
          </div>

          {/* Empty State */}
          {clients.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="h-12 w-12 icon-clients mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No clients found</h3>
                  <p className="text-muted-foreground">
                    {searchTerm 
                      ? "Try adjusting your search terms or clear the search to see all clients."
                      : "Get started by adding your first client."
                    }
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Clients Grid */}
          {clients.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => (
                <Card 
                  key={client.id} 
                  className={`hover:shadow-md transition-shadow flex flex-col ${
                    client.isDeleted ? 'opacity-60 border-dashed' : ''
                  }`}
                >
                  <CardHeader className="relative">
                    <CardTitle className="text-lg flex items-center justify-between pr-6">
                      <span>{client.name}</span>
                      {client.isDeleted && (
                        <span className="text-xs bg-muted px-2 py-1 rounded">
                          Deleted
                        </span>
                      )}
                    </CardTitle>
                    {client.email && (
                      <CardDescription>{client.email}</CardDescription>
                    )}
                    {!client.isDeleted && (
                      <button
                        onClick={() => handleDeleteClient(client.id, client.name)}
                        className="absolute top-3 right-3 text-destructive hover:text-destructive/80 transition-colors"
                        title="Delete client"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <div className="space-y-2 flex-1">
                      {client.phone && (
                        <div>
                          <p className="text-sm font-medium">Phone:</p>
                          <p className="text-sm text-muted-foreground">{client.phone}</p>
                        </div>
                      )}
                      
                      {client.goals && (
                        <div>
                          <p className="text-sm font-medium">Goals:</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {client.goals}
                          </p>
                        </div>
                      )}
                      
                      {client.notes && (
                        <div>
                          <p className="text-sm font-medium">Notes:</p>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {client.notes}
                          </p>
                        </div>
                      )}

                      {/* Birthday */}
                      {client.birthday && (
                        <div className="flex items-center gap-2">
                          <Cake className="h-4 w-4 icon-birthday" />
                          <p className="text-sm text-pink-600">
                            {new Date(client.birthday + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                          </p>
                        </div>
                      )}

                      {/* Personal Records Count */}
                      <div>
                        <p className="text-sm font-medium">Personal Records:</p>
                        <p className="text-sm text-muted-foreground">
                          {Object.keys(client.personalRecords || {}).length} movements tracked
                        </p>
                      </div>

                      {/* Session Counts */}
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-sm font-medium flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 icon-schedule" />
                            Sessions
                          </p>
                          {client.targetSessionsPerWeek && (
                            <span className="text-xs flex items-center gap-1 text-muted-foreground">
                              <Target className="h-3 w-3" />
                              {client.targetSessionsPerWeek}/week
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-1 text-center">
                          <div className="bg-muted/50 rounded p-1.5">
                            <p className="text-xs text-muted-foreground">Week</p>
                            <p className="text-sm font-semibold flex items-center justify-center gap-0.5">
                              {client.sessionCounts?.thisWeek || 0}
                              {client.targetSessionsPerWeek && (
                                <>
                                  {(client.sessionCounts?.thisWeek || 0) > client.targetSessionsPerWeek && (
                                    <TrendingUp className="h-3 w-3 text-green-500" />
                                  )}
                                  {(client.sessionCounts?.thisWeek || 0) < client.targetSessionsPerWeek && (
                                    <TrendingDown className="h-3 w-3 text-amber-500" />
                                  )}
                                  {(client.sessionCounts?.thisWeek || 0) === client.targetSessionsPerWeek && (
                                    <Minus className="h-3 w-3 text-blue-500" />
                                  )}
                                </>
                              )}
                            </p>
                          </div>
                          <div className="bg-muted/50 rounded p-1.5">
                            <p className="text-xs text-muted-foreground">Month</p>
                            <p className="text-sm font-semibold">{client.sessionCounts?.thisMonth || 0}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-1.5">
                            <p className="text-xs text-muted-foreground">Qtr</p>
                            <p className="text-sm font-semibold">{client.sessionCounts?.thisQuarter || 0}</p>
                          </div>
                          <div className="bg-muted/50 rounded p-1.5">
                            <p className="text-xs text-muted-foreground">Year</p>
                            <p className="text-sm font-semibold">{client.sessionCounts?.thisYear || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      {!client.isDeleted ? (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1"
                            onClick={() => {
                              setEditingClient(client);
                              setEditDialogOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPeriodDialogClient(client);
                              setPeriodDialogOpen(true);
                            }}
                            title="Assign Period"
                          >
                            <Layers className="h-4 w-4 icon-clients" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleRestoreClient(client.id, client.name)}
                            className="flex-1"
                          >
                            <RotateCcw className="h-4 w-4 mr-2 icon-clients" />
                            Restore
                          </Button>
                          <Button 
                            variant="destructive" 
                            size="sm" 
                            onClick={() => handlePermanentDeleteClient(client.id, client.name)}
                            className="flex-1"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Forever
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit Client Dialog */}
      <AddClientDialog
        client={editingClient || null}
        open={!!editingClient && editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open);
          if (!open) {
            setEditingClient(null);
          }
        }}
        periods={periods || []}
        clientPrograms={clientPrograms}
        onClientRefresh={async () => {
          // Refetch all clients to get updated trainingPhases and eventGoals
          await fetchClients();
          // Update the local editingClient with the refreshed data from the store
          if (editingClient) {
            const refreshedClient = clients.find(c => c.id === editingClient.id);
            if (refreshedClient) {
              setEditingClient(refreshedClient);
            }
          }
        }}
        onClientProgramsRefresh={async () => {
          if (editingClient) {
            await fetchClientPrograms(editingClient.id);
          }
        }}
      />

      {/* Period Assignment Dialog - matches schedule page props exactly */}
      {periodDialogClient && (
        <PeriodAssignmentDialog
          clientId={periodDialogClient.id}
          clientName={periodDialogClient.name}
          periods={periods || []}
          workoutCategories={workoutCategories || []}
          weekTemplates={weekTemplates || []}
          onAssignPeriod={handleAssignPeriod}
          existingAssignments={clientPrograms.find(cp => cp.clientId === periodDialogClient.id)?.periods || []}
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
