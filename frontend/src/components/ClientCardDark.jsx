import { FolderOpen, Trash2, FileText, MessageSquare } from 'lucide-react';

// Pastel accent colors for cards
const accents = [
  { bg: 'bg-pastel-mint', bgLight: 'bg-pastel-mint/10', border: 'border-pastel-mint/30', text: 'text-pastel-mint' },
  { bg: 'bg-pastel-lavender', bgLight: 'bg-pastel-lavender/10', border: 'border-pastel-lavender/30', text: 'text-pastel-lavender' },
  { bg: 'bg-pastel-sky', bgLight: 'bg-pastel-sky/10', border: 'border-pastel-sky/30', text: 'text-pastel-sky' },
  { bg: 'bg-pastel-peach', bgLight: 'bg-pastel-peach/10', border: 'border-pastel-peach/30', text: 'text-pastel-peach' },
  { bg: 'bg-pastel-coral', bgLight: 'bg-pastel-coral/10', border: 'border-pastel-coral/30', text: 'text-pastel-coral' },
];

export default function ClientCard({ client, index = 0, onClick, onDelete }) {
  // Use index for consistent accent color assignment
  const accent = accents[index % accents.length];

  return (
    <div
      onClick={onClick}
      className="group relative bg-neutral-900/50 rounded-xl border border-neutral-800 overflow-hidden cursor-pointer transition-all duration-200 hover:border-neutral-700 hover:bg-neutral-900/80"
    >
      {/* Colored top accent bar */}
      <div className={`h-1 ${accent.bg}`} />

      {/* Thumbnail */}
      <div className="aspect-video relative overflow-hidden bg-neutral-800/50">
        {client.thumbnail_url ? (
          <img
            src={client.thumbnail_url}
            alt={client.name}
            className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
          />
        ) : (
          <div className={`flex items-center justify-center h-full ${accent.bgLight} texture-grid`}>
            <div className={`w-16 h-16 rounded-2xl ${accent.bgLight} flex items-center justify-center border ${accent.border}`}>
              <FolderOpen className={`w-8 h-8 ${accent.text}`} />
            </div>
          </div>
        )}

        {/* Hover overlay with quick stats */}
        <div className="absolute inset-0 bg-neutral-950/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 rounded-lg border border-neutral-700">
            <FileText className="w-4 h-4 text-pastel-sky" />
            <span className="text-xs text-neutral-300">Sources</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-900/80 rounded-lg border border-neutral-700">
            <MessageSquare className="w-4 h-4 text-pastel-lavender" />
            <span className="text-xs text-neutral-300">Chat</span>
          </div>
        </div>

        {/* Delete button */}
        <button
          onClick={onDelete}
          className="absolute top-2 right-2 p-1.5 bg-neutral-900/80 backdrop-blur-sm text-neutral-400 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:text-pastel-coral hover:bg-pastel-coral/10"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Color indicator */}
          <div className={`w-1 h-10 rounded-full ${accent.bg} flex-shrink-0`} />

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-neutral-50 truncate">{client.name}</h3>
            {client.description ? (
              <p className="mt-1 text-sm text-neutral-400 line-clamp-2">
                {client.description}
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-500 italic">
                No description
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
