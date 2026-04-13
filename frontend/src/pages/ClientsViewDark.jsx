import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { Plus, FolderOpen, Search, Loader2, Sparkles, Sun, Moon } from 'lucide-react';
import { clientsApi } from '../api/clients';
import CreateClientModal from '../components/CreateClientModal';
import ClientCard from '../components/ClientCardDark';
import SettingsModal from '../components/SettingsModal';
import { useTheme } from '../contexts/ThemeContext';

// Pod filter options
const POD_FILTERS = [
  { value: 'all', label: 'All', color: null },
  { value: '1', label: 'Pod 1', color: 'bg-success-500', textColor: 'text-success-500' },
  { value: '2', label: 'Pod 2', color: 'bg-blue-300', textColor: 'text-blue-300' },
  { value: '3', label: 'Pod 3', color: 'bg-warning-500', textColor: 'text-warning-500' },
  { value: '4', label: 'Pod 4', color: 'bg-purple-300', textColor: 'text-purple-300' },
];

export default function ClientsView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [podFilter, setPodFilter] = useState('all');
  const [editingClient, setEditingClient] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: clientsApi.getAll,
  });

  // Delete client mutation
  const deleteMutation = useMutation({
    mutationFn: clientsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
    },
  });

  // Filter clients based on search, pod filter, and sort with superclients first
  const filteredClients = clients
    .filter((client) => {
      if (!client.name.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      if (podFilter === 'all') return true;
      if (podFilter === 'superclient') return client.is_superclient;
      return !client.is_superclient && client.pod_number === parseInt(podFilter);
    })
    .sort((a, b) => {
      if (a.is_superclient && !b.is_superclient) return -1;
      if (!a.is_superclient && b.is_superclient) return 1;
      return a.name.localeCompare(b.name);
    });

  const handleClientClick = (clientId) => {
    navigate(`/client/${clientId}`);
  };

  const handleDeleteClient = async (clientId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this client? All documents and chat history will be lost.')) {
      await deleteMutation.mutateAsync(clientId);
    }
  };

  const makeSuperclientMutation = useMutation({
    mutationFn: (clientId) => clientsApi.update(clientId, { is_superclient: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(['clients']);
    },
  });

  const handleMakeSuperclient = async (clientId, e) => {
    e.stopPropagation();
    if (window.confirm('Make this client the Superclient? Superclients have access to Leads verification and other global tools.')) {
      await makeSuperclientMutation.mutateAsync(clientId);
    }
  };

  const handleEditClient = (client, e) => {
    e.stopPropagation();
    setEditingClient(client);
  };

  const superclientExists = clients.some(c => c.is_superclient);

  return (
    <div className="h-screen bg-neutral-950 flex flex-col">
      {/* Gradient accent bar at top */}
      <div className="h-0.5 gradient-bar-bp flex-shrink-0" />

      {/* Header */}
      <header className="bg-neutral-900/80 backdrop-blur-sm sticky top-0 z-10 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="px-6 py-3">
          <div className="flex items-center gap-4">
            {/* Left: brand + pod filters */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <div className="w-9 h-9 hex flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(36,122,242,0.2), rgba(181,61,242,0.2))' }}>
                <Sparkles className="w-4 h-4 text-purple-300" />
              </div>
              <h1 className="text-lg font-semibold text-neutral-50">Clients</h1>
            </div>

            <div className="flex items-center gap-1.5">
              {POD_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setPodFilter(filter.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    podFilter === filter.value
                      ? filter.color
                        ? `${filter.color}/20 ${filter.textColor} border border-current`
                        : 'bg-neutral-700 text-neutral-100 border border-neutral-600'
                      : 'bg-neutral-800/50 text-neutral-400 border border-transparent hover:bg-neutral-800 hover:text-neutral-300'
                  }`}
                >
                  {filter.color && (
                    <span className={`w-2 h-2 rounded-full ${filter.color}`} />
                  )}
                  {filter.label}
                </button>
              ))}
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right: search, theme, new client */}
            <div className="flex items-center gap-1.5">
              {searchOpen ? (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    placeholder="Search clients..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                    autoFocus
                    className="w-56 pl-9 pr-4 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 text-neutral-200 placeholder-neutral-500 transition-all text-sm"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setSearchOpen(true)}
                  className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all"
                  title="Search"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={toggleTheme}
                className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all"
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center px-3 py-2 bg-success-500/15 hover:bg-success-500/25 text-success-500 font-medium rounded-lg transition-all border border-success-500/25 text-sm"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                New Client
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content - fills remaining space */}
      <main className="flex-1 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto" />
              <p className="mt-3 text-sm text-neutral-500">Loading clients...</p>
            </div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-8 bg-neutral-900/50 rounded-2xl card-gradient">
              <div className="w-16 h-16 mx-auto mb-4 hex bg-purple-500/10 flex items-center justify-center">
                <FolderOpen className="h-8 w-8 text-purple-500" />
              </div>
              <h3 className="text-lg font-medium text-neutral-200">
                {searchQuery || podFilter !== 'all' ? 'No clients found' : 'No clients yet'}
              </h3>
              <p className="mt-2 text-sm text-neutral-500 max-w-xs mx-auto">
                {searchQuery || podFilter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Get started by creating your first client'}
              </p>
              {!searchQuery && podFilter === 'all' && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-6 inline-flex items-center px-5 py-2.5 bg-success-500/15 hover:bg-success-500/25 text-success-500 font-medium rounded-lg transition-all border border-success-500/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Client
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
            {filteredClients.map((client, index) => (
              <ClientCard
                key={client.id}
                client={client}
                index={index}
                onClick={() => handleClientClick(client.id)}
                onDelete={(e) => handleDeleteClient(client.id, e)}
                onMakeSuperclient={(e) => handleMakeSuperclient(client.id, e)}
                onEdit={(e) => handleEditClient(client, e)}
                superclientExists={superclientExists}
              />
            ))}
          </div>
        )}
      </main>

      {/* Subtle footer */}
      <div className="flex-shrink-0 px-6 py-2 text-center">
        <Link to="/report" className="text-[11px] text-neutral-700 hover:text-neutral-500 transition-colors">
          Report a bug
        </Link>
      </div>

      {/* Create Client Modal */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Settings/Edit Modal */}
      <SettingsModal
        isOpen={!!editingClient}
        onClose={() => setEditingClient(null)}
        client={editingClient}
      />
    </div>
  );
}
