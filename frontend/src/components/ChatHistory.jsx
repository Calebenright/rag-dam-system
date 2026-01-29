import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { History, Plus, Trash2, MessageSquare, ChevronRight, Loader2 } from 'lucide-react';
import { chatApi } from '../api/chat';
import clsx from 'clsx';

function formatRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ChatHistory({
  clientId,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isExpanded,
  onToggle
}) {
  const queryClient = useQueryClient();
  const [hoveredId, setHoveredId] = useState(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', clientId],
    queryFn: () => chatApi.getConversations(clientId),
    staleTime: 10000,
    enabled: isExpanded
  });

  const deleteMutation = useMutation({
    mutationFn: (conversationId) => chatApi.deleteConversation(clientId, conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations', clientId]);
    }
  });

  const cleanupMutation = useMutation({
    mutationFn: () => chatApi.cleanupOldMessages(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries(['conversations', clientId]);
    }
  });

  const handleDelete = (e, conversationId) => {
    e.stopPropagation();
    if (confirm('Delete this conversation?')) {
      deleteMutation.mutate(conversationId);
      if (conversationId === currentConversationId) {
        onNewConversation();
      }
    }
  };

  // Collapsed state - just show toggle button
  if (!isExpanded) {
    return (
      <div className="border-l border-neutral-800 bg-neutral-900/30 flex flex-col items-center py-3 px-1">
        <button
          onClick={onToggle}
          className="p-2 text-neutral-500 hover:text-pastel-lavender hover:bg-neutral-800 rounded-lg transition-all"
          title="Chat history"
        >
          <History className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-56 border-l border-neutral-800 bg-neutral-900/30 flex flex-col transition-all duration-200">
      {/* Header */}
      <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-neutral-300">
          <History className="w-4 h-4 text-pastel-lavender" />
          <span>History</span>
        </div>
        <button
          onClick={onToggle}
          className="p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded transition-all"
          title="Hide history"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-2 border-b border-neutral-800">
        <button
          onClick={onNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-pastel-lavender bg-pastel-lavender/10 hover:bg-pastel-lavender/20 rounded-lg transition-all"
        >
          <Plus className="w-4 h-4" />
          New Chat
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-xs">
            No conversations yet
          </div>
        ) : (
          conversations.map((conv) => (
            <div
              key={conv.id}
              onClick={() => onSelectConversation(conv.id)}
              onMouseEnter={() => setHoveredId(conv.id)}
              onMouseLeave={() => setHoveredId(null)}
              className={clsx(
                "group relative px-3 py-2 rounded-lg cursor-pointer transition-all text-sm",
                conv.id === currentConversationId
                  ? "bg-pastel-lavender/15 text-pastel-lavender"
                  : "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
              )}
            >
              <div className="flex items-start gap-2">
                <MessageSquare className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50" />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xs font-medium">{conv.title}</p>
                  <p className="text-[10px] text-neutral-500 mt-0.5">
                    {formatRelativeTime(conv.lastActivity)}
                  </p>
                </div>
                {hoveredId === conv.id && (
                  <button
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="p-1 text-neutral-500 hover:text-red-400 rounded transition-all"
                    title="Delete conversation"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer - Cleanup Button */}
      {conversations.length > 0 && (
        <div className="p-2 border-t border-neutral-800">
          <button
            onClick={() => cleanupMutation.mutate()}
            disabled={cleanupMutation.isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-1.5 text-[10px] text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50 rounded transition-all"
            title="Delete chats older than 30 days"
          >
            {cleanupMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <Trash2 className="w-3 h-3" />
                Clean up old chats
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
