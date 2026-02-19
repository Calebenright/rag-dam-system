import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Bot, User, Loader2, FileText, Trash2, Image as ImageIcon,
  Copy, Check, Download, Code, FileSpreadsheet, X, BookOpen, ChevronDown, ChevronUp, Sparkles, AlertCircle, Table2, ExternalLink, Pencil, MessageSquare, Megaphone, Layout
} from 'lucide-react';
import { chatApi } from '../api/chat';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import clsx from 'clsx';

// Default quick prompts for the empty chat state
const DEFAULT_QUICK_PROMPTS = [
  {
    id: 'prompt-1',
    icon: 'Code',
    color: 'lavender',
    prompt: 'Write LinkedIn Ad Copy for a social media post using the messaging framework',
  },
  {
    id: 'prompt-2',
    icon: 'FileSpreadsheet',
    color: 'mint',
    prompt: 'Analyze the data in my documents and summarize the key metrics and trends',
  },
  {
    id: 'prompt-3',
    icon: 'ImageIcon',
    color: 'peach',
    prompt: 'Describe and analyze the images in my document library',
  },
  {
    id: 'prompt-4',
    icon: 'FileText',
    color: 'sky',
    prompt: 'What are the tasks from the latest meeting?',
  },
];

// Icon lookup for quick prompts
const PROMPT_ICONS = {
  Code: Code,
  FileSpreadsheet: FileSpreadsheet,
  ImageIcon: ImageIcon,
  FileText: FileText,
  MessageSquare: MessageSquare,
  Sparkles: Sparkles,
  BookOpen: BookOpen,
};

// Quick prompt color styles
const promptColorStyles = {
  lavender: { bg: 'bg-pastel-lavender/10', border: 'border-pastel-lavender/20', text: 'text-pastel-lavender', iconBg: 'bg-pastel-lavender/20', hoverBg: 'hover:bg-pastel-lavender/20' },
  mint: { bg: 'bg-pastel-mint/10', border: 'border-pastel-mint/20', text: 'text-pastel-mint', iconBg: 'bg-pastel-mint/20', hoverBg: 'hover:bg-pastel-mint/20' },
  peach: { bg: 'bg-pastel-peach/10', border: 'border-pastel-peach/20', text: 'text-pastel-peach', iconBg: 'bg-pastel-peach/20', hoverBg: 'hover:bg-pastel-peach/20' },
  sky: { bg: 'bg-pastel-sky/10', border: 'border-pastel-sky/20', text: 'text-pastel-sky', iconBg: 'bg-pastel-sky/20', hoverBg: 'hover:bg-pastel-sky/20' },
};

// Helper to get/set quick prompts from localStorage
function getQuickPrompts(clientId) {
  try {
    const stored = localStorage.getItem(`dodeka-quick-prompts-${clientId}`);
    if (stored) return JSON.parse(stored);
  } catch {}
  return DEFAULT_QUICK_PROMPTS;
}

function saveQuickPrompts(clientId, prompts) {
  try {
    localStorage.setItem(`dodeka-quick-prompts-${clientId}`, JSON.stringify(prompts));
  } catch {}
}

// Edit Quick Prompts Modal
function EditQuickPromptsModal({ isOpen, onClose, prompts, onSave }) {
  const [editPrompts, setEditPrompts] = useState(prompts);

  useEffect(() => {
    if (isOpen) setEditPrompts(prompts);
  }, [isOpen, prompts]);

  if (!isOpen) return null;

  const updatePrompt = (idx, field, value) => {
    setEditPrompts(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  };

  const handleSave = () => {
    onSave(editPrompts);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-neutral-900 border border-neutral-700 rounded-2xl w-full max-w-lg mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
          <h3 className="text-base font-semibold text-neutral-100">Edit Quick Prompts</h3>
          <button onClick={onClose} className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-dark">
          {editPrompts.map((prompt, idx) => {
            const colorStyle = promptColorStyles[prompt.color] || promptColorStyles.lavender;
            return (
              <div key={prompt.id} className={clsx('p-4 rounded-xl border', colorStyle.bg, colorStyle.border)}>
                <div className="flex items-center gap-3 mb-3">
                  {/* Color picker */}
                  <div className="flex gap-1.5">
                    {Object.keys(promptColorStyles).map(color => (
                      <button
                        key={color}
                        onClick={() => updatePrompt(idx, 'color', color)}
                        className={clsx(
                          'w-5 h-5 rounded-full border-2 transition-all',
                          `bg-pastel-${color}`,
                          prompt.color === color ? 'border-white scale-110' : 'border-transparent opacity-50 hover:opacity-80'
                        )}
                      />
                    ))}
                  </div>
                  {/* Icon picker */}
                  <div className="flex gap-1 ml-auto">
                    {Object.entries(PROMPT_ICONS).map(([name, IconComp]) => (
                      <button
                        key={name}
                        onClick={() => updatePrompt(idx, 'icon', name)}
                        className={clsx(
                          'p-1.5 rounded-lg transition-all',
                          prompt.icon === name
                            ? `${colorStyle.iconBg} ${colorStyle.text}`
                            : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800'
                        )}
                      >
                        <IconComp className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
                {/* Prompt text */}
                <textarea
                  value={prompt.prompt}
                  onChange={e => updatePrompt(idx, 'prompt', e.target.value)}
                  placeholder="What should the agent do when this button is clicked?"
                  rows={2}
                  className="w-full px-3 py-2 bg-neutral-800/60 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-sky/50 focus:border-pastel-sky resize-none scrollbar-hide"
                />
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-800">
          <button
            onClick={() => setEditPrompts(DEFAULT_QUICK_PROMPTS)}
            className="text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            Reset to defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 text-sm bg-pastel-lavender/20 text-pastel-lavender hover:bg-pastel-lavender/30 rounded-lg transition-colors font-medium"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Color style mappings - explicit classes for Tailwind to detect
const citationColorStyles = {
  mint: {
    bg: 'bg-pastel-mint',
    bgLight: 'bg-pastel-mint/10',
    bgMedium: 'bg-pastel-mint/60',
    text: 'text-pastel-mint',
    border: 'border-pastel-mint/30',
  },
  sky: {
    bg: 'bg-pastel-sky',
    bgLight: 'bg-pastel-sky/10',
    bgMedium: 'bg-pastel-sky/60',
    text: 'text-pastel-sky',
    border: 'border-pastel-sky/30',
  },
  lavender: {
    bg: 'bg-pastel-lavender',
    bgLight: 'bg-pastel-lavender/10',
    bgMedium: 'bg-pastel-lavender/60',
    text: 'text-pastel-lavender',
    border: 'border-pastel-lavender/30',
  },
  peach: {
    bg: 'bg-pastel-peach',
    bgLight: 'bg-pastel-peach/10',
    bgMedium: 'bg-pastel-peach/60',
    text: 'text-pastel-peach',
    border: 'border-pastel-peach/30',
  },
};

const citationColors = ['mint', 'sky', 'lavender', 'peach'];

// Source Citation Component - Circle icons at bottom
function SourceCitations({ sources, onNavigateToSource }) {
  if (!sources || sources.length === 0) return null;

  const isGoogleSource = (source) => {
    return source.sourceType === 'google' ||
      (source.fileUrl && (source.fileUrl.includes('docs.google.com') || source.fileUrl.includes('sheets.google.com')));
  };

  return (
    <div className="mt-4 pt-3 border-t border-neutral-700/50">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Sources</span>
        <div className="flex items-center -space-x-1">
          {sources.slice(0, 5).map((source, idx) => {
            const colorName = citationColors[idx % citationColors.length];
            const styles = citationColorStyles[colorName];
            const isGoogle = isGoogleSource(source);
            return (
              <div
                key={source.id || idx}
                className={clsx(
                  'relative group'
                )}
              >
                <div
                  className={clsx(
                    'w-7 h-7 rounded-full flex items-center justify-center border-2 border-neutral-900 transition-all cursor-pointer hover:scale-110 hover:z-10',
                    styles.bgLight,
                    styles.border
                  )}
                  title={`${source.title || 'Untitled'} — Click to view in Sources`}
                  onClick={() => onNavigateToSource && onNavigateToSource(source.id)}
                >
                  {isGoogle
                    ? <ExternalLink className={clsx('w-3 h-3', styles.text)} />
                    : <FileText className={clsx('w-3 h-3', styles.text)} />
                  }
                </div>
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-neutral-800 rounded-lg text-xs text-neutral-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-neutral-700">
                  <div className="font-medium truncate max-w-[180px]">{source.title || 'Untitled'}</div>
                  {(source.usage || source.similarity) && (
                    <div className={clsx('text-[10px]', styles.text)}>
                      {source.usage
                        ? `${Math.round(source.usage * 100)}% used`
                        : `${Math.round(source.similarity * 100)}% match`
                      }
                    </div>
                  )}
                  {isGoogle && (
                    <div className="text-[10px] text-neutral-400 mt-0.5 flex items-center gap-1">
                      <ExternalLink className="w-2.5 h-2.5" />
                      Google source
                    </div>
                  )}
                  <div className="text-[10px] text-neutral-500 mt-0.5">Click to view in Sources</div>
                  <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-neutral-800" />
                </div>
              </div>
            );
          })}
          {sources.length > 5 && (
            <div className="w-7 h-7 rounded-full bg-neutral-800 border-2 border-neutral-900 flex items-center justify-center text-[10px] text-neutral-400 font-medium">
              +{sources.length - 5}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Message component with animation
function ChatMessage({ msg, idx, isNew, onCopyCode, copiedCode, onExportCSV, onExportText, onNavigateToSource, onOpenAds, isAdSelected, onOpenLandingPage, isLPSelected }) {
  const isUser = msg.role === 'user';

  // Custom markdown components
  const MarkdownComponents = {
    p({ children }) {
      return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
    },
    h1({ children }) {
      return <h1 className="text-lg font-bold text-neutral-100 mb-3 mt-4 first:mt-0">{children}</h1>;
    },
    h2({ children }) {
      return <h2 className="text-base font-bold text-neutral-100 mb-2 mt-3 first:mt-0">{children}</h2>;
    },
    h3({ children }) {
      return <h3 className="text-sm font-bold text-neutral-200 mb-2 mt-3 first:mt-0">{children}</h3>;
    },
    ul({ children }) {
      return <ul className="list-disc pl-5 mb-3 space-y-1.5 text-neutral-300 [&_ul]:mt-1.5 [&_ul]:mb-0 [&_ul]:list-[circle] [&_ul_ul]:list-[square]">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal pl-5 mb-3 space-y-1.5 text-neutral-300 [&_ol]:mt-1.5 [&_ol]:mb-0">{children}</ol>;
    },
    li({ children }) {
      return <li className="text-sm pl-1 marker:text-neutral-500">{children}</li>;
    },
    strong({ children }) {
      return <strong className="font-semibold text-neutral-100">{children}</strong>;
    },
    em({ children }) {
      return <em className="italic text-neutral-300">{children}</em>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-pastel-lavender/40 pl-4 my-3 py-2 bg-pastel-lavender/5 rounded-r-lg text-neutral-400 italic">
          {children}
        </blockquote>
      );
    },
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const codeString = String(children).replace(/\n$/, '');
      const codeId = `code-${idx}-${Math.random().toString(36).substr(2, 9)}`;

      if (!inline && (match || codeString.includes('\n'))) {
        const language = match ? match[1] : 'text';
        return (
          <div className="relative group my-3 rounded-lg overflow-hidden border border-neutral-700">
            <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-800 border-b border-neutral-700">
              <span className="text-xs font-medium text-pastel-lavender">{language}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onCopyCode(codeString, codeId)}
                  className="px-2 py-0.5 text-neutral-400 hover:text-pastel-mint rounded text-xs flex items-center gap-1 transition-all"
                >
                  {copiedCode === codeId ? (
                    <>
                      <Check className="w-3 h-3 text-pastel-mint" />
                      <span className="text-pastel-mint">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Copy
                    </>
                  )}
                </button>
                <button
                  onClick={() => onExportText(codeString, `code.${language}`)}
                  className="px-2 py-0.5 text-neutral-400 hover:text-pastel-sky rounded text-xs flex items-center gap-1 transition-all"
                >
                  <Download className="w-3 h-3" />
                  Save
                </button>
              </div>
            </div>
            <SyntaxHighlighter
              style={oneDark}
              language={language}
              PreTag="div"
              customStyle={{
                margin: 0,
                background: '#1a1a1e',
                fontSize: '0.8rem',
                padding: '1rem',
              }}
              {...props}
            >
              {codeString}
            </SyntaxHighlighter>
          </div>
        );
      }

      return (
        <code className="bg-pastel-peach/15 text-pastel-peach px-1.5 py-0.5 rounded text-[13px] font-mono border border-pastel-peach/20" {...props}>
          {children}
        </code>
      );
    },
    table({ children }) {
      return (
        <div className="my-3 overflow-x-auto rounded-lg border border-neutral-700">
          <table className="min-w-full divide-y divide-neutral-700">
            {children}
          </table>
        </div>
      );
    },
    thead({ children }) {
      return <thead className="bg-pastel-sky/8">{children}</thead>;
    },
    tbody({ children }) {
      return <tbody className="divide-y divide-neutral-800">{children}</tbody>;
    },
    tr({ children }) {
      return <tr className="hover:bg-neutral-800/40 transition-colors">{children}</tr>;
    },
    th({ children }) {
      return (
        <th className="px-3 py-2.5 text-left text-xs font-semibold text-pastel-sky uppercase tracking-wider border-b border-neutral-700">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-3 py-2 text-sm text-neutral-300">
          {children}
        </td>
      );
    },
    a({ href, children }) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-pastel-sky hover:text-pastel-mint underline transition-colors"
        >
          {children}
        </a>
      );
    },
    pre({ children }) {
      return <div className="my-2">{children}</div>;
    },
    hr() {
      return (
        <div className="my-5 flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-neutral-700 to-transparent" />
        </div>
      );
    },
  };

  return (
    <div
      className={clsx(
        'flex transition-all duration-300 ease-out',
        isUser ? 'justify-end' : 'justify-start',
        isNew && 'animate-fade-in-up'
      )}
    >
      <div
        className={clsx(
          'flex items-start gap-3 max-w-3xl',
          isUser && 'flex-row-reverse'
        )}
      >
        {/* Avatar */}
        <div
          className={clsx(
            'flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border transition-transform hover:scale-105',
            isUser
              ? 'bg-pastel-sky/15 border-pastel-sky/25'
              : 'bg-pastel-lavender/15 border-pastel-lavender/25'
          )}
        >
          {isUser ? (
            <User className="w-4 h-4 text-pastel-sky" />
          ) : (
            <Bot className="w-4 h-4 text-pastel-lavender" />
          )}
        </div>

        {/* Message bubble */}
        <div
          className={clsx(
            'rounded-xl px-4 py-3 transition-all',
            isUser
              ? 'bg-pastel-sky/10 text-neutral-100 border border-pastel-sky/20'
              : 'bg-neutral-900/70 text-neutral-200 border border-neutral-800'
          )}
        >
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
          ) : (
            <div className="text-sm">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={MarkdownComponents}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Sources - Always visible at bottom for assistant messages */}
          {!isUser && msg.sources && msg.sources.length > 0 && (
            <SourceCitations sources={msg.sources} onNavigateToSource={onNavigateToSource} />
          )}

          {/* Fallback for context_docs if no sources */}
          {!isUser && !msg.sources && msg.context_docs && msg.context_docs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-700/50">
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <FileText className="w-3.5 h-3.5" />
                <span>{msg.context_docs.length} document(s) referenced</span>
              </div>
            </div>
          )}

          {/* Message actions for assistant messages */}
          {!isUser && (
            <div className="mt-2 pt-2 border-t border-neutral-700/30 flex items-center gap-1">
              <button
                onClick={() => onOpenAds && onOpenAds(msg)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  isAdSelected
                    ? 'bg-pastel-peach/20 text-pastel-peach border border-pastel-peach/30'
                    : 'text-neutral-500 hover:text-pastel-peach hover:bg-pastel-peach/10'
                )}
                title="Preview as Ad"
              >
                <Megaphone className="w-3 h-3" />
                Ads
              </button>
              <button
                onClick={() => onOpenLandingPage && onOpenLandingPage(msg)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  isLPSelected
                    ? 'bg-pastel-sky/20 text-pastel-sky border border-pastel-sky/30'
                    : 'text-neutral-500 hover:text-pastel-sky hover:bg-pastel-sky/10'
                )}
                title="Preview as Landing Page"
              >
                <Layout className="w-3 h-3" />
                Landing Page
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EnhancedChatInterface({ clientId, client, selectedSheetId = null, conversationId = null, onConversationChange = null, onNavigateToSource = null, onOpenAdPreview = null, adPreviewMessage = null, onOpenLandingPagePreview = null, landingPageMessage = null }) {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null); // For optimistic UI
  const [activeConversationId, setActiveConversationId] = useState(conversationId);
  const [quickPrompts, setQuickPrompts] = useState(() => getQuickPrompts(clientId));
  const [showEditPrompts, setShowEditPrompts] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Sync conversationId prop with state
  useEffect(() => {
    setActiveConversationId(conversationId);
    setPendingMessage(null);
  }, [conversationId]);

  // Fetch chat history for the active conversation
  // When activeConversationId is null, we're starting a new chat - return empty array
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', clientId, activeConversationId],
    queryFn: () => activeConversationId ? chatApi.getHistory(clientId, activeConversationId) : Promise.resolve([]),
    staleTime: 30000, // Cache for 30 seconds - updates come via optimistic updates
    refetchOnWindowFocus: false,
  });

  // Send message mutation - uses sheets endpoint if a sheet is selected
  const sendMutation = useMutation({
    mutationFn: async (data) => {
      if (selectedSheetId && !data.image) {
        // Use sheet-aware chat endpoint
        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/chat/${clientId}/sheets`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: data.message,
            spreadsheetId: selectedSheetId,
          }),
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.error);
        return result.data;
      } else {
        // Regular chat with conversation tracking
        return chatApi.sendMessage(clientId, data.message, {
          images: data.image ? [data.image] : [],
          conversationId: activeConversationId,
        });
      }
    },
    onSuccess: (data) => {
      // Update conversation ID if we got a new one
      const newConversationId = data?.conversationId;
      if (newConversationId && newConversationId !== activeConversationId) {
        setActiveConversationId(newConversationId);
        if (onConversationChange) {
          onConversationChange(newConversationId);
        }
        // Only invalidate conversations list when a new conversation is created
        queryClient.invalidateQueries({ queryKey: ['conversations', clientId] });
      }

      // Optimistically update chat messages with the response
      const targetConvoId = newConversationId || activeConversationId;
      queryClient.setQueryData(['chat', clientId, targetConvoId], (old = []) => {
        // Add the pending user message and assistant response
        const newMessages = [...old];
        // Add user message from pending state
        if (pendingMessage) {
          newMessages.push({
            role: 'user',
            content: pendingMessage.content,
            created_at: new Date().toISOString()
          });
        }
        // Add assistant message from response
        if (data?.message) {
          newMessages.push(data.message);
        }
        return newMessages;
      });

      setPendingMessage(null);
    },
    onError: (error) => {
      console.error('Chat error:', error);
      // Keep pending message visible so user can see what failed
    },
  });

  // Clear history mutation
  const clearMutation = useMutation({
    mutationFn: () => chatApi.clearHistory(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', clientId] });
    },
  });

  // Scroll to bottom helper function
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({
        top: messagesContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // Auto-scroll when messages change or pending message appears
  useEffect(() => {
    scrollToBottom();
  }, [messages, pendingMessage, sendMutation.isPending]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!message.trim() && !selectedImage) || sendMutation.isPending) return;

    const currentMessage = message.trim() || 'Analyze this image';
    const currentImage = selectedImage;

    // Set pending message for optimistic UI
    setPendingMessage({
      role: 'user',
      content: currentMessage,
      hasImage: !!currentImage
    });

    // Clear input immediately
    setMessage('');
    setSelectedImage(null);
    setImagePreview(null);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
    }

    sendMutation.mutate({
      message: currentMessage,
      image: currentImage
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      clearMutation.mutate();
    }
  };

  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Send a quick prompt as if the user typed it
  const sendQuickPrompt = (promptText) => {
    if (sendMutation.isPending) return;
    setPendingMessage({ role: 'user', content: promptText, hasImage: false });
    sendMutation.mutate({ message: promptText, image: null });
  };

  // Save edited quick prompts
  const handleSavePrompts = (newPrompts) => {
    setQuickPrompts(newPrompts);
    saveQuickPrompts(clientId, newPrompts);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const exportToCSV = (content) => {
    try {
      const parsed = Papa.parse(content, { header: true });
      const csv = Papa.unparse(parsed.data);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `export-${Date.now()}.csv`);
    } catch (error) {
      const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `export-${Date.now()}.csv`);
    }
  };

  const exportAsText = (content, filename = 'export.txt') => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    saveAs(blob, filename);
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-3">
          <div className={clsx(
            'w-9 h-9 rounded-xl flex items-center justify-center border',
            selectedSheetId
              ? 'bg-pastel-mint/15 border-pastel-mint/20'
              : 'bg-pastel-lavender/15 border-pastel-lavender/20'
          )}>
            {selectedSheetId ? (
              <FileSpreadsheet className="w-5 h-5 text-pastel-mint" />
            ) : (
              <Sparkles className="w-5 h-5 text-pastel-lavender" />
            )}
          </div>
          <div>
            <h3 className="text-base font-semibold text-neutral-50 flex items-center gap-2">
              {selectedSheetId ? 'Sheet Editor' : 'AI Assistant'}
              <span className={clsx(
                'w-2 h-2 rounded-full animate-pulse',
                selectedSheetId ? 'bg-pastel-mint' : 'bg-pastel-mint'
              )} />
            </h3>
            <p className="text-xs text-neutral-500">
              {selectedSheetId
                ? 'AI can read & edit your connected sheet'
                : `Ask about ${client?.name || 'your'} documents`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selectedSheetId && (
            <span className="px-2 py-1 text-[10px] bg-pastel-mint/10 text-pastel-mint rounded-full border border-pastel-mint/20">
              Sheet Mode
            </span>
          )}
          <button
            onClick={handleClearHistory}
            disabled={messages.length === 0}
            className="p-2 text-neutral-500 hover:text-pastel-coral hover:bg-pastel-coral/10 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Clear history"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-dark">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-pastel-lavender" />
          </div>
        ) : messages.length === 0 && !pendingMessage ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-5 bg-neutral-900/50 rounded-2xl mb-4 border border-neutral-800">
              <Bot className="w-14 h-14 text-pastel-lavender" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">
              Start a conversation
            </h3>
            <p className="text-sm text-neutral-500 max-w-sm mb-6">
              Ask questions about your documents, upload images, or request analysis.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm max-w-md">
              {quickPrompts.map((qp) => {
                const colorStyle = promptColorStyles[qp.color] || promptColorStyles.lavender;
                const IconComp = PROMPT_ICONS[qp.icon] || FileText;
                return (
                  <button
                    key={qp.id}
                    onClick={() => sendQuickPrompt(qp.prompt)}
                    disabled={sendMutation.isPending}
                    className={clsx(
                      'flex items-center gap-3 p-3 rounded-xl border transition-all text-left group',
                      colorStyle.bg, colorStyle.border, colorStyle.hoverBg,
                      'hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50'
                    )}
                  >
                    <div className={clsx('w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center', colorStyle.iconBg)}>
                      <IconComp className={clsx('w-4 h-4', colorStyle.text)} />
                    </div>
                    <span className={clsx('text-xs leading-snug line-clamp-2 min-w-0 flex-1', colorStyle.text)}>{qp.prompt}</span>
                  </button>
                );
              })}
            </div>
            {/* Edit button */}
            <button
              onClick={() => setShowEditPrompts(true)}
              className="mt-4 flex items-center gap-1.5 text-[11px] text-neutral-500 hover:text-neutral-300 transition-colors"
            >
              <Pencil className="w-3 h-3" />
              Edit prompts
            </button>
          </div>
        ) : (
          <>
            {/* Render actual messages */}
            {messages.map((msg, idx) => (
              <ChatMessage
                key={msg.id || idx}
                msg={msg}
                idx={idx}
                isNew={false}
                onCopyCode={copyToClipboard}
                copiedCode={copiedCode}
                onExportCSV={exportToCSV}
                onExportText={exportAsText}
                onNavigateToSource={onNavigateToSource}
                onOpenAds={(m) => onOpenAdPreview && onOpenAdPreview(m)}
                isAdSelected={adPreviewMessage && (adPreviewMessage.id === msg.id || adPreviewMessage.content === msg.content)}
                onOpenLandingPage={(m) => onOpenLandingPagePreview && onOpenLandingPagePreview(m)}
                isLPSelected={landingPageMessage && (landingPageMessage.id === msg.id || landingPageMessage.content === msg.content)}
              />
            ))}

            {/* Optimistic pending user message */}
            {pendingMessage && (
              <div className="flex justify-end animate-fade-in-up">
                <div className="flex items-start gap-3 max-w-3xl flex-row-reverse">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center border bg-pastel-sky/15 border-pastel-sky/25">
                    <User className="w-4 h-4 text-pastel-sky" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-pastel-sky/10 text-neutral-100 border border-pastel-sky/20">
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{pendingMessage.content}</p>
                    {pendingMessage.hasImage && (
                      <div className="mt-2 text-xs text-pastel-peach flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" />
                        Image attached
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Loading indicator */}
            {sendMutation.isPending && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="flex items-start gap-3 max-w-3xl">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-pastel-lavender/15 flex items-center justify-center border border-pastel-lavender/25">
                    <Bot className="w-4 h-4 text-pastel-lavender" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-neutral-900/70 border border-neutral-800">
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-pastel-lavender rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-pastel-lavender rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-pastel-lavender rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-neutral-400 ml-1">Thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Error indicator */}
            {sendMutation.isError && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="flex items-start gap-3 max-w-3xl">
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-pastel-coral/15 flex items-center justify-center border border-pastel-coral/25">
                    <AlertCircle className="w-4 h-4 text-pastel-coral" />
                  </div>
                  <div className="rounded-xl px-4 py-3 bg-pastel-coral/5 border border-pastel-coral/20">
                    <p className="text-sm text-pastel-coral font-medium">Failed to send message</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      {sendMutation.error?.response?.data?.error || sendMutation.error?.message || 'Please check your connection and try again.'}
                    </p>
                    <button
                      onClick={() => {
                        sendMutation.reset();
                        setPendingMessage(null);
                      }}
                      className="mt-2 text-xs text-pastel-sky hover:text-pastel-sky/80 underline"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 p-4 bg-neutral-900/50">
        {/* Image preview */}
        {imagePreview && (
          <div className="mb-3 relative inline-block animate-fade-in-up">
            <img
              src={imagePreview}
              alt="Preview"
              className="h-16 rounded-lg border-2 border-pastel-peach/30"
            />
            <button
              onClick={removeImage}
              className="absolute -top-2 -right-2 p-1 bg-pastel-coral text-white rounded-full hover:bg-pastel-coral/80 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                // Auto-resize textarea
                if (textareaRef.current) {
                  textareaRef.current.style.height = '48px';
                  textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask a question..."
              rows={1}
              disabled={sendMutation.isPending}
              className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-xl focus:ring-1 focus:ring-pastel-sky/50 focus:border-pastel-sky resize-none transition-all disabled:opacity-50 scrollbar-hide"
              style={{
                minHeight: '48px',
                maxHeight: '120px',
              }}
            />
          </div>

          {/* Image upload button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sendMutation.isPending}
            className="flex-shrink-0 p-3 bg-pastel-peach/10 text-pastel-peach rounded-xl hover:bg-pastel-peach/20 transition-all border border-pastel-peach/20 disabled:opacity-50"
            title="Upload image"
          >
            <ImageIcon className="w-5 h-5" />
          </button>

          {/* Send button */}
          <button
            type="submit"
            disabled={(!message.trim() && !selectedImage) || sendMutation.isPending}
            className="flex-shrink-0 p-3 bg-pastel-mint/15 text-pastel-mint rounded-xl hover:bg-pastel-mint/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed border border-pastel-mint/25"
          >
            {sendMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-600 text-center">
          <span className="text-pastel-sky">Enter</span> to send · <span className="text-pastel-lavender">Shift+Enter</span> for new line
        </p>
      </div>

      {/* CSS for animations */}
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.3s ease-out forwards;
        }
      `}</style>

      {/* Edit Quick Prompts Modal */}
      <EditQuickPromptsModal
        isOpen={showEditPrompts}
        onClose={() => setShowEditPrompts(false)}
        prompts={quickPrompts}
        onSave={handleSavePrompts}
      />
    </div>
  );
}
