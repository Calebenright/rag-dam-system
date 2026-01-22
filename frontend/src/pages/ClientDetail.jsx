import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, MessageSquare, Database, Loader2, Upload, Settings, FileSpreadsheet
} from 'lucide-react';
import { clientsApi } from '../api/clients';
import { documentsApi } from '../api/documents';
import DocumentUpload from '../components/DocumentUpload';
import SourcesManager from '../components/SourcesManager';
import EnhancedChatInterface from '../components/EnhancedChatInterface';
import SheetsManager from '../components/SheetsManager';
import clsx from 'clsx';

export default function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const [agentTab, setAgentTab] = useState('chat'); // 'chat', 'sources', 'sheets', or 'upload'
  const [selectedSheetId, setSelectedSheetId] = useState(null);

  // Fetch client details
  const { data: client, isLoading: isLoadingClient } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.getById(clientId),
  });

  // Fetch documents
  const { data: documents = [], isLoading: isLoadingDocs } = useQuery({
    queryKey: ['documents', clientId],
    queryFn: () => documentsApi.getByClientId(clientId),
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
                <img
                  src={client.thumbnail_url}
                  alt={client.name}
                  className="w-9 h-9 rounded-lg object-cover border-2 border-pastel-lavender/30"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pastel-mint/20 to-pastel-lavender/20 border border-neutral-700 flex items-center justify-center">
                  <span className="text-sm font-semibold text-pastel-lavender">
                    {client.name?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-neutral-100">{client.name}</h1>
                  <span className="w-2 h-2 rounded-full bg-pastel-mint" />
                </div>
                {client.description && (
                  <p className="text-xs text-neutral-500 truncate max-w-xs">{client.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right: Settings */}
          <button className="p-2 text-neutral-500 hover:text-pastel-peach hover:bg-neutral-800 rounded-lg transition-all">
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
                onClick={() => setAgentTab('sheets')}
                className={clsx(
                  'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  agentTab === 'sheets'
                    ? 'bg-pastel-mint/15 text-pastel-mint border-l-2 border-l-pastel-mint'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
              >
                <FileSpreadsheet className="w-4 h-4 mr-3" />
                Sheets
                {agentTab === 'sheets' && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-mint" />
                )}
              </button>

              <button
                onClick={() => setAgentTab('upload')}
                className={clsx(
                  'w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                  agentTab === 'upload'
                    ? 'bg-pastel-peach/15 text-pastel-peach border-l-2 border-l-pastel-peach'
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200'
                )}
              >
                <Upload className="w-4 h-4 mr-3" />
                Upload
                {agentTab === 'upload' && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-pastel-peach" />
                )}
              </button>
            </div>
          </nav>

          {/* Sidebar footer with color accent */}
          <div className="p-3 border-t border-neutral-800">
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-pastel-mint" />
                <span className="w-2 h-2 rounded-full bg-pastel-sky" />
                <span className="w-2 h-2 rounded-full bg-pastel-lavender" />
                <span className="w-2 h-2 rounded-full bg-pastel-peach" />
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
              selectedSheetId={selectedSheetId}
            />
          ) : agentTab === 'sources' ? (
            <SourcesManager
              documents={documents}
              clientId={clientId}
              isLoading={isLoadingDocs}
            />
          ) : agentTab === 'sheets' ? (
            <SheetsManager
              clientId={clientId}
              onSelectSheet={setSelectedSheetId}
              selectedSheetId={selectedSheetId}
            />
          ) : (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-pastel-peach/15 flex items-center justify-center border border-pastel-peach/20">
                    <Upload className="w-5 h-5 text-pastel-peach" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-neutral-100">Upload Sources</h2>
                    <p className="text-sm text-neutral-500">Add documents to your knowledge base</p>
                  </div>
                </div>
                <DocumentUpload clientId={clientId} />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
