import { FolderOpen, Trash2, FileText, MessageSquare, Crown, Settings } from 'lucide-react';
import { getPodColor } from './SettingsModal';

export default function ClientCard({ client, index = 0, onClick, onDelete, onMakeSuperclient, onEdit, superclientExists }) {
  const podColor = getPodColor(client);
  const accent = {
    bg: podColor.bg,
    bgLight: podColor.bgLight,
    border: podColor.border,
    text: podColor.text,
  };

  return (
    <div
      onClick={onClick}
      className="group relative bg-neutral-900/50 rounded-xl overflow-hidden cursor-pointer transition-all duration-200 hover:bg-neutral-900/80"
      style={{ border: '1px solid var(--color-border)' }}
    >
      {/* Colored top accent bar */}
      <div className={`h-0.5 ${accent.bg}`} />

      {/* Thumbnail - smaller aspect ratio */}
      <div
        className="aspect-[16/10] relative overflow-hidden"
        style={{ backgroundColor: client.thumbnail_bg_color || '#000000' }}
      >
        {client.thumbnail_url ? (
          <img
            src={client.thumbnail_url}
            alt={client.name}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className={`flex items-center justify-center h-full ${accent.bgLight}`}>
            <div className={`hex w-12 h-12 ${accent.bgLight} flex items-center justify-center`}>
              <FolderOpen className={`w-6 h-6 ${accent.text}`} />
            </div>
          </div>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900/80 rounded-lg border border-neutral-700">
            <FileText className="w-3.5 h-3.5 text-blue-300" />
            <span className="text-xs text-neutral-300">Sources</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-neutral-900/80 rounded-lg border border-neutral-700">
            <MessageSquare className="w-3.5 h-3.5 text-purple-300" />
            <span className="text-xs text-neutral-300">Chat</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-1.5 right-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-md hover:text-blue-300 hover:bg-blue-300/10"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          )}
          {!client.is_superclient && !superclientExists && onMakeSuperclient && (
            <button
              onClick={onMakeSuperclient}
              className="p-1 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-md hover:text-red-500 hover:bg-red-500/10"
              title="Make Superclient"
            >
              <Crown className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-md hover:text-red-500 hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Superclient badge */}
        {client.is_superclient && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 px-1.5 py-0.5 bg-red-500/20 backdrop-blur-sm rounded-md border border-red-500/30">
            <Crown className="w-3 h-3 text-red-500" />
            <span className="text-[10px] font-medium text-red-500">Superclient</span>
          </div>
        )}
      </div>

      {/* Content - tighter padding */}
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className={`w-1 h-8 rounded-full ${accent.bg} flex-shrink-0`} />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm text-neutral-50 truncate">{client.name}</h3>
            {client.description && (
              <p className="text-xs text-neutral-400 truncate mt-0.5">{client.description}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
