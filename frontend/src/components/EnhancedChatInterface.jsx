import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Send, Bot, User, Loader2, FileText, Trash2, Image as ImageIcon,
  Copy, Check, Download, Code, FileSpreadsheet, X, BookOpen, ChevronDown, ChevronUp, Sparkles, AlertCircle, Table2
} from 'lucide-react';
import { chatApi } from '../api/chat';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import { saveAs } from 'file-saver';
import Papa from 'papaparse';
import clsx from 'clsx';

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
function SourceCitations({ sources }) {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-neutral-700/50">
      <div className="flex items-center gap-3">
        <span className="text-[10px] text-neutral-500 uppercase tracking-wider">Sources</span>
        <div className="flex items-center -space-x-1">
          {sources.slice(0, 5).map((source, idx) => {
            const colorName = citationColors[idx % citationColors.length];
            const styles = citationColorStyles[colorName];
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
                  title={source.title || 'Untitled'}
                >
                  <FileText className={clsx('w-3 h-3', styles.text)} />
                </div>
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-neutral-800 rounded-lg text-xs text-neutral-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-neutral-700">
                  <div className="font-medium truncate max-w-[150px]">{source.title || 'Untitled'}</div>
                  {source.similarity && (
                    <div className={clsx('text-[10px]', styles.text)}>
                      {Math.round(source.similarity * 100)}% match
                    </div>
                  )}
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
function ChatMessage({ msg, idx, isNew, onCopyCode, copiedCode, onExportCSV, onExportText }) {
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
      return <ul className="list-disc list-inside mb-3 space-y-1 text-neutral-300">{children}</ul>;
    },
    ol({ children }) {
      return <ol className="list-decimal list-inside mb-3 space-y-1 text-neutral-300">{children}</ol>;
    },
    li({ children }) {
      return <li className="text-sm">{children}</li>;
    },
    strong({ children }) {
      return <strong className="font-semibold text-neutral-100">{children}</strong>;
    },
    em({ children }) {
      return <em className="italic text-neutral-300">{children}</em>;
    },
    blockquote({ children }) {
      return (
        <blockquote className="border-l-2 border-pastel-lavender/50 pl-3 my-3 text-neutral-400 italic">
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
        <code className="bg-pastel-peach/10 text-pastel-peach px-1.5 py-0.5 rounded text-sm font-mono border border-pastel-peach/20" {...props}>
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
      return <thead className="bg-pastel-sky/5">{children}</thead>;
    },
    th({ children }) {
      return (
        <th className="px-3 py-2 text-left text-xs font-medium text-pastel-sky uppercase tracking-wider border-b border-neutral-700">
          {children}
        </th>
      );
    },
    td({ children }) {
      return (
        <td className="px-3 py-2 text-sm text-neutral-300 border-b border-neutral-800">
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
      return <hr className="my-4 border-neutral-700" />;
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
            <SourceCitations sources={msg.sources} />
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
        </div>
      </div>
    </div>
  );
}

export default function EnhancedChatInterface({ clientId, client, selectedSheetId = null }) {
  const [message, setMessage] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);
  const [pendingMessage, setPendingMessage] = useState(null); // For optimistic UI
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  // Fetch chat history
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['chat', clientId],
    queryFn: () => chatApi.getHistory(clientId),
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
        // Regular chat
        return chatApi.sendMessage(clientId, data.message, {
          images: data.image ? [data.image] : [],
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat', clientId] });
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
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-3 p-3 bg-pastel-lavender/10 rounded-xl border border-pastel-lavender/20">
                <div className="w-8 h-8 rounded-lg bg-pastel-lavender/20 flex items-center justify-center">
                  <Code className="w-4 h-4 text-pastel-lavender" />
                </div>
                <span className="text-pastel-lavender font-medium">Code</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-pastel-mint/10 rounded-xl border border-pastel-mint/20">
                <div className="w-8 h-8 rounded-lg bg-pastel-mint/20 flex items-center justify-center">
                  <FileSpreadsheet className="w-4 h-4 text-pastel-mint" />
                </div>
                <span className="text-pastel-mint font-medium">Data</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-pastel-peach/10 rounded-xl border border-pastel-peach/20">
                <div className="w-8 h-8 rounded-lg bg-pastel-peach/20 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-pastel-peach" />
                </div>
                <span className="text-pastel-peach font-medium">Images</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-pastel-sky/10 rounded-xl border border-pastel-sky/20">
                <div className="w-8 h-8 rounded-lg bg-pastel-sky/20 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-pastel-sky" />
                </div>
                <span className="text-pastel-sky font-medium">Q&A</span>
              </div>
            </div>
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
              className="w-full px-4 py-3 bg-neutral-800/50 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-xl focus:ring-1 focus:ring-pastel-sky/50 focus:border-pastel-sky resize-none transition-all disabled:opacity-50"
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
    </div>
  );
}
