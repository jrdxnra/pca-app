import { create } from 'zustand';
import { Client, PersonalRecord } from '@/lib/types';
import { 
  getAllClients, 
  createClient, 
  updateClient, 
  softDeleteClient,
  permanentDeleteClient,
  restoreClient,
  searchClients,
  updatePersonalRecord,
  getPersonalRecord,
  getAllPersonalRecords,
  subscribeToClients
} from '@/lib/firebase/services/clients';

// Cache duration in milliseconds (30 seconds)
const CACHE_DURATION = 30 * 1000;

interface ClientStore {
  // State
  clients: Client[];
  currentClient: Client | null;
  loading: boolean;
  error: string | null;
  searchTerm: string;
  includeDeleted: boolean;
  
  // Cache tracking
  _lastFetchTime: number | null;
  
  // Actions
  fetchClients: (force?: boolean) => Promise<void>;
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'personalRecords'>) => Promise<string>;
  editClient: (id: string, updates: Partial<Omit<Client, 'id' | 'createdAt'>>) => Promise<void>;
  deleteClient: (id: string) => Promise<void>;
  permanentDeleteClient: (id: string) => Promise<void>;
  restoreClient: (id: string) => Promise<void>;
  searchClients: (term: string) => Promise<void>;
  setCurrentClient: (client: Client | null) => void;
  setSearchTerm: (term: string) => void;
  setIncludeDeleted: (include: boolean) => void;
  clearError: () => void;
  
  // Personal Records
  updatePR: (clientId: string, movementId: string, oneRepMax: number, method?: 'tested' | 'estimated') => Promise<void>;
  getPR: (clientId: string, movementId: string) => Promise<PersonalRecord | null>;
  getAllPRs: (clientId: string) => Promise<Record<string, PersonalRecord>>;
  
  // Real-time subscription
  subscribeToClients: () => () => void;
}

export const useClientStore = create<ClientStore>((set, get) => ({
  // Initial State
  clients: [],
  currentClient: null,
  loading: false,
  error: null,
  searchTerm: '',
  includeDeleted: false,
  _lastFetchTime: null,

  // Actions
  fetchClients: async (force = false) => {
    const { _lastFetchTime, clients } = get();
    
    // Skip fetch if we have cached data and it's still fresh (unless forced)
    if (!force && clients.length > 0 && _lastFetchTime && Date.now() - _lastFetchTime < CACHE_DURATION) {
      return;
    }
    
    set({ loading: true, error: null });
    try {
      const { includeDeleted } = get();
      const fetchedClients = await getAllClients(includeDeleted);
      set({ clients: fetchedClients, loading: false, _lastFetchTime: Date.now() });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to fetch clients',
        loading: false 
      });
    }
  },

  addClient: async (clientData) => {
    set({ loading: true, error: null });
    try {
      const id = await createClient(clientData);
      
      // Auto-create "Quick Workouts" program for the new client
      try {
        const { createClientProgram } = await import('@/lib/firebase/services/clientPrograms');
        const { createProgram, getAllPrograms } = await import('@/lib/firebase/services/programs');
        const { Timestamp } = await import('firebase/firestore');
        
        // First, ensure "Quick Workouts" program template exists
        const allPrograms = await getAllPrograms();
        let quickWorkoutsTemplate = allPrograms.find(p => p.name === 'Quick Workouts' && p.isTemplate);
        
        if (!quickWorkoutsTemplate) {
          const templateId = await createProgram({
            name: 'Quick Workouts',
            description: 'Template for unplanned workouts and one-off sessions',
            isTemplate: true,
            createdBy: 'system'
          });
          quickWorkoutsTemplate = { id: templateId, name: 'Quick Workouts', isTemplate: true } as any;
        }
        
        const now = Timestamp.now();
        const farFuture = Timestamp.fromDate(new Date(2099, 11, 31));
        
        await createClientProgram({
          clientId: id,
          programTemplateId: quickWorkoutsTemplate.id,
          startDate: now,
          endDate: farFuture,
          status: 'active',
          createdBy: 'system',
          periods: [{
            id: `quick-period-${Date.now()}`,
            periodConfigId: 'quick-workouts-config',
            periodName: 'Ongoing',
            periodColor: '#10b981', // Green color for ongoing
            startDate: now,
            endDate: farFuture,
            days: [] // Empty days array - workouts will be added as needed
          }]
        });
      } catch (programError) {
        // Don't fail the entire client creation if program creation fails
      }
      
      // Refresh clients list
      await get().fetchClients();
      
      set({ loading: false });
      return id;
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to add client',
        loading: false 
      });
      throw error;
    }
  },

  editClient: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      await updateClient(id, updates);
      
      // Update local state
      const { clients, currentClient } = get();
      const updatedClients = clients.map(client => 
        client.id === id ? { ...client, ...updates } : client
      );
      
      // Update current client if it's the one being edited
      const updatedCurrentClient = currentClient?.id === id 
        ? { ...currentClient, ...updates } 
        : currentClient;
      
      set({ 
        clients: updatedClients, 
        currentClient: updatedCurrentClient,
        loading: false 
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update client',
        loading: false 
      });
      throw error;
    }
  },

  deleteClient: async (id) => {
    set({ loading: true, error: null });
    try {
      await softDeleteClient(id);
      
      // Update local state
      const { clients, currentClient, includeDeleted } = get();
      
      if (includeDeleted) {
        // Mark as deleted in local state
        const updatedClients = clients.map(client => 
          client.id === id ? { ...client, isDeleted: true } : client
        );
        set({ clients: updatedClients });
      } else {
        // Remove from local state
        const filteredClients = clients.filter(client => client.id !== id);
        set({ clients: filteredClients });
      }
      
      // Clear current client if it's the one being deleted
      if (currentClient?.id === id) {
        set({ currentClient: null });
      }
      
      set({ loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to delete client',
        loading: false 
      });
      throw error;
    }
  },

  permanentDeleteClient: async (id) => {
    set({ loading: true, error: null });
    try {
      await permanentDeleteClient(id);
      
      // Remove from local state completely
      const { clients, currentClient } = get();
      const filteredClients = clients.filter(client => client.id !== id);
      
      // Clear current client if it's the one being deleted
      if (currentClient?.id === id) {
        set({ currentClient: null });
      }
      
      set({ clients: filteredClients, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to permanently delete client',
        loading: false 
      });
      throw error;
    }
  },

  restoreClient: async (id) => {
    set({ loading: true, error: null });
    try {
      await restoreClient(id);
      
      // Update local state
      const { clients } = get();
      const updatedClients = clients.map(client => 
        client.id === id ? { ...client, isDeleted: false } : client
      );
      
      set({ clients: updatedClients, loading: false });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to restore client',
        loading: false 
      });
      throw error;
    }
  },

  searchClients: async (term) => {
    set({ loading: true, error: null, searchTerm: term });
    try {
      const { includeDeleted } = get();
      
      if (term.trim() === '') {
        // If search is empty, fetch all clients
        await get().fetchClients();
      } else {
        const clients = await searchClients(term, includeDeleted);
        set({ clients, loading: false });
      }
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to search clients',
        loading: false 
      });
    }
  },

  setCurrentClient: (client) => {
    set({ currentClient: client });
  },

  setSearchTerm: (term) => {
    set({ searchTerm: term });
  },

  setIncludeDeleted: (include) => {
    set({ includeDeleted: include });
    // Refresh clients list with new filter
    get().fetchClients();
  },

  clearError: () => {
    set({ error: null });
  },

  // Personal Records
  updatePR: async (clientId, movementId, oneRepMax, method = 'estimated') => {
    try {
      await updatePersonalRecord(clientId, movementId, oneRepMax, method);
      
      // Refresh the specific client in local state
      const { clients, currentClient } = get();
      const updatedClients = await Promise.all(
        clients.map(async (client) => {
          if (client.id === clientId) {
            const updatedPRs = await getAllPersonalRecords(clientId);
            return { ...client, personalRecords: updatedPRs };
          }
          return client;
        })
      );
      
      // Update current client if it's the one being updated
      let updatedCurrentClient = currentClient;
      if (currentClient?.id === clientId) {
        const updatedPRs = await getAllPersonalRecords(clientId);
        updatedCurrentClient = { ...currentClient, personalRecords: updatedPRs };
      }
      
      set({ 
        clients: updatedClients,
        currentClient: updatedCurrentClient
      });
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'Failed to update personal record'
      });
      throw error;
    }
  },

  getPR: async (clientId, movementId) => {
    try {
      return await getPersonalRecord(clientId, movementId);
    } catch (error) {
      console.error('Failed to get personal record:', error);
      return null;
    }
  },

  getAllPRs: async (clientId) => {
    try {
      return await getAllPersonalRecords(clientId);
    } catch (error) {
      console.error('Failed to get all personal records:', error);
      return {};
    }
  },

  subscribeToClients: () => {
    const { includeDeleted } = get();
    return subscribeToClients((clients) => {
      set({ clients });
    }, includeDeleted);
  },
}));
