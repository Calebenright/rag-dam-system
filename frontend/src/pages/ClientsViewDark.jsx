import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Search, Loader2, Sparkles } from 'lucide-react';
import { clientsApi } from '../api/clients';
import CreateClientModal from '../components/CreateClientModal';
import ClientCard from '../components/ClientCardDark';

export default function ClientsView() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  // Filter clients based on search
  const filteredClients = clients.filter((client) =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleClientClick = (clientId) => {
    navigate(`/client/${clientId}`);
  };

  const handleDeleteClient = async (clientId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this client? All documents and chat history will be lost.')) {
      await deleteMutation.mutateAsync(clientId);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 texture-dots">
      {/* Gradient accent bar at top */}
      <div className="h-1 gradient-bar" />

      {/* Header */}
      <header className="bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo/Brand accent */}
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pastel-mint/20 to-pastel-lavender/20 flex items-center justify-center border border-neutral-700">
                <Sparkles className="w-5 h-5 text-pastel-lavender" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-neutral-50">
                  Clients
                </h1>
                <p className="mt-0.5 text-sm text-neutral-500">
                  Select a client to access their AI agents and data
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center px-4 py-2.5 bg-pastel-mint/15 hover:bg-pastel-mint/25 text-pastel-mint font-medium rounded-lg transition-all border border-pastel-mint/25"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Client
            </button>
          </div>

          {/* Search bar */}
          <div className="mt-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-neutral-800/50 border border-neutral-700 rounded-lg focus:ring-1 focus:ring-pastel-sky/50 focus:border-pastel-sky text-neutral-200 placeholder-neutral-500 transition-all"
              />
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-4 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 rounded-lg border border-neutral-700">
              <span className="w-2 h-2 rounded-full bg-pastel-sky" />
              <span className="text-neutral-400">Total:</span>
              <span className="text-pastel-sky font-medium">{clients.length}</span>
            </div>
            {searchQuery && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800/50 rounded-lg border border-neutral-700">
                <span className="w-2 h-2 rounded-full bg-pastel-lavender" />
                <span className="text-neutral-400">Showing:</span>
                <span className="text-pastel-lavender font-medium">{filteredClients.length}</span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender mx-auto" />
              <p className="mt-3 text-sm text-neutral-500">Loading clients...</p>
            </div>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center py-16">
            <div className="inline-block p-8 bg-neutral-900/50 rounded-2xl border border-neutral-800 texture-grid">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-pastel-lavender/10 flex items-center justify-center border border-pastel-lavender/20">
                <FolderOpen className="h-8 w-8 text-pastel-lavender" />
              </div>
              <h3 className="text-lg font-medium text-neutral-200">
                {searchQuery ? 'No clients found' : 'No clients yet'}
              </h3>
              <p className="mt-2 text-sm text-neutral-500 max-w-xs mx-auto">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Get started by creating your first client'}
              </p>
              {!searchQuery && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-6 inline-flex items-center px-5 py-2.5 bg-pastel-mint/15 hover:bg-pastel-mint/25 text-pastel-mint font-medium rounded-lg transition-all border border-pastel-mint/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Client
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredClients.map((client, index) => (
              <ClientCard
                key={client.id}
                client={client}
                index={index}
                onClick={() => handleClientClick(client.id)}
                onDelete={(e) => handleDeleteClient(client.id, e)}
              />
            ))}
          </div>
        )}
      </main>

      {/* Create Client Modal */}
      <CreateClientModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
