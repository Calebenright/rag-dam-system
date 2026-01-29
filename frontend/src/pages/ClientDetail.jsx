import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MessageSquare, Database, Loader2, Settings, BarChart3, Users, PanelLeftClose, PanelLeft
} from 'lucide-react';
import { clientsApi } from '../api/clients';
import { documentsApi } from '../api/documents';
import SourcesManager from '../components/SourcesManager';
import EnhancedChatInterface from '../components/EnhancedChatInterface';
import DataboardManager from '../components/DataboardManager';
import LeadsManager from '../components/LeadsManager';
import ChatHistory from '../components/ChatHistory';
import SettingsModal, { getPodColor } from '../components/SettingsModal';
import clsx from 'clsx';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [agentTab, setAgentTab] = useState('chat'); // 'chat', 'sources', 'databoards', or 'leads'
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);

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
        <aside className={clsx(
          "bg-neutral-900/50 border-r border-neutral-800 flex flex-col flex-shrink-0 texture-dots transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-52"
        )}>
          <nav className={clsx("flex-1", sidebarCollapsed ? "p-2" : "p-3")}>
            <div className="space-y-1">
              <button
                onClick={() => setAgentTab('chat')}
                className={clsx(
                  'w-full flex items-center rounded-lg text-sm font-medium transition-all',
                  sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                  agentTab === 'chat'
                    ? 'bg-pastel-lavender/15 text-pastel-lavender border-l-2 border-l-pastel-lavender'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
                title={sidebarCollapsed ? 'Client Agent' : undefined}
              >
                <MessageSquare className={clsx("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && (
                  <>
                    Client Agent
                    {agentTab === 'chat' && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-lavender" />
                    )}
                  </>
                )}
              </button>

              <button
                onClick={() => setAgentTab('sources')}
                className={clsx(
                  'w-full flex items-center rounded-lg text-sm font-medium transition-all',
                  sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                  agentTab === 'sources'
                    ? 'bg-pastel-sky/15 text-pastel-sky border-l-2 border-l-pastel-sky'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
                title={sidebarCollapsed ? `Sources (${documents.length})` : undefined}
              >
                <Database className={clsx("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && (
                  <>
                    Sources
                    <span className={clsx(
                      "ml-auto text-xs px-2 py-0.5 rounded-full font-medium",
                      agentTab === 'sources'
                        ? 'bg-pastel-sky/25 text-pastel-sky'
                        : 'bg-neutral-800 text-neutral-500'
                    )}>
                      {documents.length}
                    </span>
                  </>
                )}
              </button>

              <button
                onClick={() => setAgentTab('databoards')}
                className={clsx(
                  'w-full flex items-center rounded-lg text-sm font-medium transition-all',
                  sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                  agentTab === 'databoards'
                    ? 'bg-pastel-mint/15 text-pastel-mint border-l-2 border-l-pastel-mint'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
                title={sidebarCollapsed ? 'Databoards' : undefined}
              >
                <BarChart3 className={clsx("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && (
                  <>
                    Databoards
                    {agentTab === 'databoards' && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-mint" />
                    )}
                  </>
                )}
              </button>

              {isSuperclient && (
                <button
                  onClick={() => setAgentTab('leads')}
                  className={clsx(
                    'w-full flex items-center rounded-lg text-sm font-medium transition-all',
                    sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                    agentTab === 'leads'
                      ? 'bg-pastel-coral/15 text-pastel-coral border-l-2 border-l-pastel-coral'
                      : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                  )}
                  title={sidebarCollapsed ? 'Leads (Local only)' : 'Leads feature requires local environment'}
                >
                  <Users className={clsx("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                  {!sidebarCollapsed && (
                    <>
                      <span className="flex flex-col items-start">
                        <span>Leads</span>
                        <span className="text-[10px] text-neutral-500 font-normal">Local only</span>
                      </span>
                      {agentTab === 'leads' && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-coral" />
                      )}
                    </>
                  )}
                </button>
              )}

            </div>
          </nav>

          {/* Sidebar footer */}
          <div className={clsx("border-t border-neutral-800", sidebarCollapsed ? "p-2" : "p-3")}>
            <div className="flex items-center justify-between">
              {!sidebarCollapsed && (
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-pastel-mint" />
                    <span className="w-2 h-2 rounded-full bg-pastel-sky" />
                    <span className="w-2 h-2 rounded-full bg-pastel-lavender" />
                    <span className="w-2 h-2 rounded-full bg-pastel-coral" />
                  </div>
                  <span>RAG System</span>
                </div>
              )}
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className={clsx(
                  "p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all",
                  sidebarCollapsed && "mx-auto"
                )}
                title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {sidebarCollapsed ? (
                  <PanelLeft className="w-4 h-4" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 flex overflow-hidden bg-neutral-950 texture-grid">
          {agentTab === 'chat' ? (
            <>
              <div className="flex-1 flex flex-col overflow-hidden">
                <EnhancedChatInterface
                  clientId={clientId}
                  client={client}
                  conversationId={currentConversationId}
                  onConversationChange={setCurrentConversationId}
                />
              </div>
              <ChatHistory
                clientId={clientId}
                currentConversationId={currentConversationId}
                onSelectConversation={setCurrentConversationId}
                onNewConversation={() => setCurrentConversationId(null)}
                isExpanded={chatHistoryExpanded}
                onToggle={() => setChatHistoryExpanded(!chatHistoryExpanded)}
              />
            </>
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
