import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MessageSquare, Database, Loader2, Settings, BarChart3, Users
} from 'lucide-react';
import { clientsApi } from '../api/clients';
import { documentsApi } from '../api/documents';
import SourcesManager from '../components/SourcesManager';
import EnhancedChatInterface from '../components/EnhancedChatInterface';
import DataboardManager from '../components/DataboardManager';
import LeadsManager from '../components/LeadsManager';
import SettingsModal, { getPodColor } from '../components/SettingsModal';
import clsx from 'clsx';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [agentTab, setAgentTab] = useState('chat'); // 'chat', 'sources', 'databoards', or 'leads'
  const [showSettings, setShowSettings] = useState(false);

  // Check if this is the Dodeka superclient (case-insensitive name check)

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getById(clientId),
    staleTime: 60000, // 1 minute - client data rarely changes
  });

  // Fetch documents
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['documents', clientId],
    queryFn: () => documentsApi.getByClientId(clientId),
    staleTime: 5000, // 5 seconds - allow polling to work but prevent duplicate fetches
  });

  if (isLoadingClient) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 texture-dots">
        <Loader2 className="w-6 h-6 animate-spin text-pastel-lavender" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 texture-dots">
        <div className="text-center">
          <h2 className="text-xl font-medium text-neutral-200">Client not found</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-pastel-sky hover:text-pastel-sky/80 transition-colors"
          >
            Return to dashboard
          </button>
        </div>
      </div>
    );
  }

  // Only show Leads tab for superclient
  const isSuperclient = client.is_superclient === true;
  const podColor = getPodColor(client);

  return (
    <div className="h-screen bg-neutral-950 flex flex-col">
      {/* Gradient accent bar at top */}
      <div className="h-1 gradient-bar flex-shrink-0" />

      {/* Top Header */}
      <header className="bg-neutral-900/80 backdrop-blur-sm border-b border-neutral-800 px-4 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: Back + Client Info */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center justify-center w-8 h-8 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              {client.thumbnail_url ? (
                <div
                  className={clsx(
                    "w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center border-2",
                    `${podColor.border}/30`
                  )}
                  style={{ backgroundColor: client.thumbnail_bg_color || '#000000' }}
                >
                  <img
                    src={client.thumbnail_url}
                    alt={client.name}
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              ) : (
                <div className={clsx("w-9 h-9 rounded-lg border border-neutral-700 flex items-center justify-center", podColor.bgLight)}>
                  <span className={clsx("text-sm font-semibold", podColor.text)}>
                    {client.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-neutral-100">{client.name}</h1>
                  <span className={clsx("w-2 h-2 rounded-full", podColor.bg)} />
                </div>
                {client.description && (
                  <p className="text-xs text-neutral-500 truncate max-w-xs">{client.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-neutral-500 hover:text-pastel-peach hover:bg-neutral-800 rounded-lg transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 bg-neutral-900/50 border-r border-neutral-800 flex flex-col flex-shrink-0 texture-dots">
          <nav className="p-3 flex-1">
            <div className="space-y-1">
              <button
                onClick={() => setAgentTab('chat')}
                className={clsx(
                  'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  agentTab === 'chat'
                    ? 'bg-pastel-lavender/15 text-pastel-lavender border-l-2 border-l-pastel-lavender'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
              >
                <MessageSquare className="w-4 h-4 mr-3" />
                AI Chat
                {agentTab === 'chat' && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-lavender" />
                )}
              </button>

              <button
                onClick={() => setAgentTab('sources')}
                className={clsx(
                  'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  agentTab === 'sources'
                    ? 'bg-pastel-sky/15 text-pastel-sky border-l-2 border-l-pastel-sky'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
              >
                <Database className="w-4 h-4 mr-3" />
                Sources
                <span className={clsx(
                  "ml-auto text-xs px-2 py-0.5 rounded-full font-medium",
                  agentTab === 'sources'
                    ? 'bg-pastel-sky/25 text-pastel-sky'
                    : 'bg-neutral-800 text-neutral-500'
                )}>
                  {documents.length}
                </span>
              </button>

              <button
                onClick={() => setAgentTab('databoards')}
                className={clsx(
                  'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  agentTab === 'databoards'
                    ? 'bg-pastel-mint/15 text-pastel-mint border-l-2 border-l-pastel-mint'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
              >
                <BarChart3 className="w-4 h-4 mr-3" />
                Databoards
                {agentTab === 'databoards' && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-mint" />
                )}
              </button>

              {isSuperclient && (
                <button
                  onClick={() => setAgentTab('leads')}
                  className={clsx(
                    'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                    agentTab === 'leads'
                      ? 'bg-pastel-coral/15 text-pastel-coral border-l-2 border-l-pastel-coral'
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                  )}
                >
                  <Users className="w-4 h-4 mr-3" />
                  Leads
                  {agentTab === 'leads' && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-coral" />
                  )}
                </button>
              )}

            </div>
          </nav>

          {/* Sidebar footer with color accent */}
          <div className="p-3 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-pastel-mint" />
                <span className="w-2 h-2 rounded-full bg-pastel-sky" />
                <span className="w-2 h-2 rounded-full bg-pastel-lavender" />
                <span className="w-2 h-2 rounded-full bg-pastel-coral" />
              </div>
              <span>RAG System</span>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 flex flex-col overflow-hidden bg-neutral-950 texture-grid">
          {agentTab === 'chat' ? (
            <EnhancedChatInterface
              clientId={clientId}
              client={client}
            />
          ) : agentTab === 'sources' ? (
            <SourcesManager
              documents={documents}
              clientId={clientId}
              isLoading={isLoadingDocs}
            />
          ) : agentTab === 'databoards' ? (
            <DataboardManager clientId={clientId} />
          ) : agentTab === 'leads' ? (
            <LeadsManager />
          ) : null}
        </main>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        client={client}
        showApiTab={true}
      />
    </div>
  );
}
