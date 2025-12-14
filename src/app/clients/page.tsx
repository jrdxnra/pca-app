"use client";

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, Search, Users, Trash2, RotateCcw } from 'lucide-react';
import { useClientStore } from '@/lib/stores/useClientStore';
import { AddClientDialog } from '@/components/clients/AddClientDialog';
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

  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-muted-foreground">
            Manage your clients and track their progress
          </p>
        </div>
        <AddClientDialog />
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Search Clients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or email..."
                value={localSearchTerm}
                onChange={(e) => setLocalSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={loading}>
              Search
            </Button>
            {searchTerm && (
              <Button type="button" variant="outline" onClick={handleClearSearch}>
                Clear
              </Button>
            )}
          </form>
          
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="includeDeleted"
              checked={includeDeleted}
              onChange={(e) => setIncludeDeleted(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="includeDeleted" className="text-sm">
              Show deleted clients
            </label>
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
              {searchTerm ? `Found ${clients.length} clients for "${searchTerm}"` : `${clients.length} clients total`}
              {includeDeleted && ` (including deleted)`}
            </p>
          </div>

          {/* Empty State */}
          {clients.length === 0 && !loading && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No clients found</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm 
                      ? "Try adjusting your search terms or clear the search to see all clients."
                      : "Get started by adding your first client."
                    }
                  </p>
                  <AddClientDialog trigger={
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Your First Client
                    </Button>
                  } />
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
                  className={`hover:shadow-md transition-shadow ${
                    client.isDeleted ? 'opacity-60 border-dashed' : ''
                  }`}
                >
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
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
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
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

                      {/* Personal Records Count */}
                      <div>
                        <p className="text-sm font-medium">Personal Records:</p>
                        <p className="text-sm text-muted-foreground">
                          {Object.keys(client.personalRecords || {}).length} movements tracked
                        </p>
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
                            onClick={() => handleDeleteClient(client.id, client.name)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
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
                            <RotateCcw className="h-4 w-4 mr-2" />
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
      />
    </div>
  );
}
