import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MessageSquare, Database, Loader2, Settings, PanelLeftClose, PanelLeft, Megaphone, Sun, Moon
} from 'lucide-react';
import { clientsApi } from '../api/clients';
import { documentsApi } from '../api/documents';
import SourcesManager from '../components/SourcesManager';
import EnhancedChatInterface from '../components/EnhancedChatInterface';


import ChatHistory from '../components/ChatHistory';
import AdPreviewPanel from '../components/AdPreviewPanel';
import LandingPagePanel from '../components/LandingPagePanel';
import AdCopyGenerator from '../components/AdCopyGenerator';
import SettingsModal, { getPodColor } from '../components/SettingsModal';
import clsx from 'clsx';
import { useTheme } from '../contexts/ThemeContext';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [agentTab, setAgentTab] = useState('chat'); // 'chat', 'sources', or 'adgen'
  const [showSettings, setShowSettings] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [chatHistoryExpanded, setChatHistoryExpanded] = useState(false);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [highlightDocumentId, setHighlightDocumentId] = useState(null);
  const [adPreviewMessage, setAdPreviewMessage] = useState(null);
  const [landingPageMessage, setLandingPageMessage] = useState(null);

  // Navigate from chat source citation to Sources tab and highlight the document
  const handleNavigateToSource = (documentId) => {
    setHighlightDocumentId(documentId);
    setAgentTab('sources');
  };

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
    staleTime: 60000, // 1 minute - reduces egress, manual actions invalidate the cache anyway
  });

  if (isLoadingClient) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950">
        <Loader2 className="w-6 h-6 animate-spin text-purple-300" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950">
        <div className="text-center">
          <h2 className="text-xl font-medium text-neutral-200">Client not found</h2>
          <button
            onClick={() => navigate('/')}
            className="mt-4 text-blue-300 hover:text-blue-300/80 transition-colors"
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
      <div className="h-0.5 gradient-bar-bp flex-shrink-0" />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className={clsx(
          "bg-neutral-900/50 border-r border-neutral-800 flex flex-col flex-shrink-0 transition-all duration-200",
          sidebarCollapsed ? "w-14" : "w-52"
        )}>
          {/* Client Header in Sidebar */}
          <div className={clsx("border-b border-neutral-800 flex-shrink-0", sidebarCollapsed ? "p-2" : "px-3 py-3")}>
            <div className={clsx("flex items-center", sidebarCollapsed ? "justify-center" : "gap-3")}>
              <button
                onClick={() => navigate('/')}
                className="flex items-center justify-center w-7 h-7 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all flex-shrink-0"
                title="Back to clients"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>

              {!sidebarCollapsed && (
                <div className="flex items-center gap-2 min-w-0">
                  {client.thumbnail_url ? (
                    <div
                      className={clsx(
                        "w-10 h-6 rounded overflow-hidden flex items-center justify-center border",
                        `${podColor.border}/30`
                      )}
                      style={{ backgroundColor: client.thumbnail_bg_color || '#000000' }}
                    >
                      <img
                        src={client.thumbnail_url}
                        alt={client.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className={clsx("w-7 h-7 rounded border border-neutral-700 flex items-center justify-center flex-shrink-0", podColor.bgLight)}>
                      <span className={clsx("text-xs font-semibold", podColor.text)}>
                        {client.name?.charAt(0)?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h1 className="text-sm font-semibold text-neutral-100 truncate">{client.name}</h1>
                      <span className={clsx("w-1.5 h-1.5 rounded-full flex-shrink-0", podColor.bg)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <nav className={clsx("flex-1", sidebarCollapsed ? "p-2" : "p-3")}>
            <div className="space-y-1">
              <button
                onClick={() => setAgentTab('chat')}
                className={clsx(
                  'w-full flex items-center rounded-lg text-sm font-medium transition-all',
                  sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                  agentTab === 'chat'
                    ? 'nav-active bg-white/5 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
                title={sidebarCollapsed ? 'Client Agent' : undefined}
              >
                <MessageSquare className={clsx("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && (
                  <>
                    Client Agent
                    {agentTab === 'chat' && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </>
                )}
              </button>

              <button
                onClick={() => setAgentTab('adgen')}
                className={clsx(
                  'w-full flex items-center rounded-lg text-sm font-medium transition-all',
                  sidebarCollapsed ? 'px-2.5 py-2.5 justify-center' : 'px-3 py-2.5',
                  agentTab === 'adgen'
                    ? 'nav-active bg-white/5 text-white'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
                title={sidebarCollapsed ? 'Ad Copy' : undefined}
              >
                <Megaphone className={clsx("w-4 h-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && (
                  <>
                    Ad Copy
                    {agentTab === 'adgen' && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-white" />
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
                    ? 'nav-active bg-white/5 text-white'
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
                        ? 'bg-white/15 text-white'
                        : 'bg-neutral-800 text-neutral-500'
                    )}>
                      {documents.length}
                    </span>
                  </>
                )}
              </button>


            </div>
          </nav>

          {/* Sidebar footer */}
          <div className={clsx("border-t border-neutral-800", sidebarCollapsed ? "p-2" : "p-3")}>
            <div className={clsx("flex", sidebarCollapsed ? "flex-col items-center gap-2" : "items-center justify-between")}>
              {!sidebarCollapsed && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-300 transition-all"
                >
                  <Settings className="w-4 h-4" />
                  <span>Settings</span>
                </button>
              )}
              {sidebarCollapsed && (
                <button
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all mx-auto"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
              <div className={clsx("flex items-center", sidebarCollapsed ? "flex-col gap-2" : "gap-1 ml-auto")}>
                <button
                  onClick={toggleTheme}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all"
                  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all"
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
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 flex overflow-hidden bg-neutral-950">
          {agentTab === 'chat' ? (
            <>
              <div className="flex-1 flex flex-col overflow-hidden">
                <EnhancedChatInterface
                  clientId={clientId}
                  client={client}
                  conversationId={currentConversationId}
                  onConversationChange={setCurrentConversationId}
                  onNavigateToSource={handleNavigateToSource}
                  onOpenAdPreview={(msg) => {
                    setAdPreviewMessage(prev => prev?.content === msg?.content ? null : msg);
                    setLandingPageMessage(null);
                  }}
                  adPreviewMessage={adPreviewMessage}
                  onOpenLandingPagePreview={(msg) => {
                    setLandingPageMessage(prev => prev?.content === msg?.content ? null : msg);
                    setAdPreviewMessage(null);
                  }}
                  landingPageMessage={landingPageMessage}
                />
              </div>
              {adPreviewMessage && (
                <AdPreviewPanel
                  message={adPreviewMessage}
                  onClose={() => setAdPreviewMessage(null)}
                  clientId={clientId}
                  conversationId={currentConversationId}
                />
              )}
              {landingPageMessage && (
                <LandingPagePanel
                  message={landingPageMessage}
                  onClose={() => setLandingPageMessage(null)}
                  clientId={clientId}
                  conversationId={currentConversationId}
                />
              )}
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
              highlightDocumentId={highlightDocumentId}
              onHighlightHandled={() => setHighlightDocumentId(null)}
            />
          ) : agentTab === 'adgen' ? (
            <AdCopyGenerator clientId={clientId} />
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
