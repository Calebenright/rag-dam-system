import { FolderOpen, Trash2, FileText, MessageSquare, Crown, Settings } from 'lucide-react';
import { getPodColor } from './SettingsModal';

export default function ClientCard({ client, index = 0, onClick, onDelete, onMakeSuperclient, onEdit, superclientExists }) {
  // Use pod color from client settings
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
      style={{ border: '1px solid #1e2022' }}
    >
      {/* Colored top accent bar */}
      <div className={`h-0.5 ${accent.bg}`} />

      {/* Thumbnail */}
      <div
        className="aspect-video relative overflow-hidden"
        style={{ backgroundColor: client.thumbnail_bg_color || '#000000' }}
      >
        {client.thumbnail_url ? (
          <div className="w-full h-full">
            <img
              src={client.thumbnail_url}
              alt={client.name}
              className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
        ) : (
          <div className={`flex items-center justify-center h-full ${accent.bgLight}`}>
            <div className={`hex w-16 h-16 ${accent.bgLight} flex items-center justify-center`}>
              <FolderOpen className={`w-8 h-8 ${accent.text}`} />
            </div>
          </div>
        )}

        {/* Hover overlay with quick stats */}
        <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 rounded-lg border border-neutral-700">
            <FileText className="w-4 h-4 text-blue-300" />
            <span className="text-xs text-neutral-300">Sources</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 rounded-lg border border-neutral-700">
            <MessageSquare className="w-4 h-4 text-purple-300" />
            <span className="text-xs text-neutral-300">Chat</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
          {onEdit && (
            <button
              onClick={onEdit}
              className="p-1.5 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-lg hover:text-blue-300 hover:bg-blue-300/10"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          {!client.is_superclient && !superclientExists && onMakeSuperclient && (
            <button
              onClick={onMakeSuperclient}
              className="p-1.5 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-lg hover:text-red-500 hover:bg-red-500/10"
              title="Make Superclient"
            >
              <Crown className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onDelete}
            className="p-1.5 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-lg hover:text-red-500 hover:bg-red-500/10"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Superclient badge */}
        {client.is_superclient && (
          <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-red-500/20 backdrop-blur-sm rounded-lg border border-red-500/30">
            <Crown className="w-3 h-3 text-red-500" />
            <span className="text-xs font-medium text-red-500">Superclient</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Color indicator */}
          <div className={`w-1 h-10 rounded-full ${accent.bg} flex-shrink-0`} />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-50 truncate">{client.name}</h3>
            {client.description && (
              <p className="mt-1 text-sm text-neutral-400 line-clamp-2">
                {client.description}
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-3 pt-3 border-t border-neutral-800 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            {new Date(client.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${accent.bg}`} />
            <span className={`text-xs font-medium ${accent.text}`}>Active</span>
          </div>
        </div>
      </div>
    </div>
  );
}
