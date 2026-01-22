import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Bot, User, Loader2, FileText, Trash2, ImagePlus, X, Image as ImageIcon, FolderImage } from 'lucide-react';
import { chatApi } from '../api/chat';

export default function ChatInterface({ clientId, client }) {
  const [message, setMessage] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [includeSourceImages, setIncludeSourceImages] = useState(false);
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

  // Fetch available images for this client
  const { data: sourceImages = [] } = useQuery({
    queryKey: ['chatImages', clientId],
    queryFn: () => chatApi.getImages(clientId),
  });

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: ({ msg, options }) => chatApi.sendMessage(clientId, msg, options),
    onSuccess: () => {
      queryClient.invalidateQueries(['chat', clientId]);
    },
  });

  // Handle image selection
  const handleImageSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 5) {
      alert('Maximum 5 images allowed');
      return;
    }

    const newImages = [...selectedImages, ...files].slice(0, 5);
    setSelectedImages(newImages);

    // Generate previews
    const newPreviews = newImages.map((file) => URL.createObjectURL(file));
    setImagePreviews(newPreviews);
  };

  // Remove selected image
  const removeImage = (index) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    const newPreviews = imagePreviews.filter((_, i) => i !== index);

    // Revoke old preview URL
    URL.revokeObjectURL(imagePreviews[index]);

    setSelectedImages(newImages);
    setImagePreviews(newPreviews);
  };

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Clear history mutation
  const clearMutation = useMutation({
    mutationFn: () => chatApi.clearHistory(clientId),
    onSuccess: () => {
      queryClient.invalidateQueries(['chat', clientId]);
    },
  });

  // Scroll to bottom helper function
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Also scroll on initial load
  useEffect(() => {
    scrollToBottom();
  }, [isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message.trim() || sendMutation.isPending) return;

    const currentMessage = message.trim();
    const currentImages = [...selectedImages];
    const shouldIncludeSourceImages = includeSourceImages;

    // Clear input immediately
    setMessage('');
    setSelectedImages([]);
    setImagePreviews([]);
    setIncludeSourceImages(false);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = '48px';
    }

    // Scroll to bottom
    scrollToBottom();

    sendMutation.mutate({
      msg: currentMessage,
      options: {
        images: currentImages,
        includeSourceImages: shouldIncludeSourceImages,
      },
    });
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear the chat history?')) {
      clearMutation.mutate();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-280px)] bg-neutral-900 rounded-xl border border-neutral-700">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-700 bg-neutral-800/30">
        <div>
          <h3 className="text-base font-medium text-neutral-50 flex items-center gap-2">
            <div className="p-1.5 bg-pastel-lavender/20 rounded-lg">
              <Bot className="w-4 h-4 text-pastel-lavender" />
            </div>
            AI Assistant
          </h3>
          <p className="text-xs text-neutral-400 mt-0.5">
            Ask questions about {client.name}'s documents
          </p>
        </div>
        <button
          onClick={handleClearHistory}
          disabled={messages.length === 0}
          className="p-2 text-neutral-500 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Clear history"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-5 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Bot className="w-12 h-12 text-neutral-700 mb-3" />
            <h3 className="text-base font-medium text-neutral-200 mb-1">
              Start a conversation
            </h3>
            <p className="text-sm text-neutral-500 max-w-sm">
              Ask questions about the documents you've uploaded. The AI will use
              the context from your files to provide accurate answers.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`flex items-start space-x-3 max-w-3xl ${
                  msg.role === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    msg.role === 'user'
                      ? 'bg-pastel-sky/20'
                      : 'bg-pastel-lavender/20'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <User className="w-4 h-4 text-pastel-sky" />
                  ) : (
                    <Bot className="w-4 h-4 text-pastel-lavender" />
                  )}
                </div>

                {/* Message bubble */}
                <div
                  className={`rounded-xl px-4 py-3 ${
                    msg.role === 'user'
                      ? 'bg-neutral-800 text-neutral-100'
                      : 'bg-neutral-800/50 text-neutral-200 border border-neutral-800'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* Image attachment indicator for user messages */}
                  {msg.role === 'user' && msg.content.includes('[Attached') && (
                    <div className="mt-2 pt-2 border-t border-neutral-700">
                      <div className="flex items-center text-xs text-neutral-500">
                        <ImageIcon className="w-3 h-3 mr-1" />
                        Images attached
                      </div>
                    </div>
                  )}

                  {/* Context documents indicator */}
                  {msg.role === 'assistant' &&
                    msg.context_docs &&
                    msg.context_docs.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-neutral-700">
                        <div className="flex items-center text-xs text-neutral-500">
                          <FileText className="w-3 h-3 mr-1" />
                          {msg.context_docs.length} document(s)
                          {msg.sources?.some(s => s.isImage) && (
                            <span className="ml-2 flex items-center">
                              <ImageIcon className="w-3 h-3 mr-1" />
                              images
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {sendMutation.isPending && (
          <div className="flex justify-start">
            <div className="flex items-start space-x-3 max-w-3xl">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-pastel-lavender/20 flex items-center justify-center">
                <Bot className="w-4 h-4 text-pastel-lavender" />
              </div>
              <div className="rounded-xl px-4 py-3 bg-neutral-800/50 border border-neutral-700">
                <Loader2 className="w-4 h-4 animate-spin text-pastel-lavender" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-neutral-800 p-4">
        {/* Image previews */}
        {imagePreviews.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {imagePreviews.map((preview, index) => (
              <div key={index} className="relative group">
                <img
                  src={preview}
                  alt={`Preview ${index + 1}`}
                  className="h-14 w-14 object-cover rounded-lg border border-neutral-700"
                />
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-1.5 -right-1.5 bg-neutral-700 text-neutral-300 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Source images toggle */}
        {sourceImages.length > 0 && (
          <div className="flex items-center mb-3">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={includeSourceImages}
                onChange={(e) => setIncludeSourceImages(e.target.checked)}
                className="rounded border-neutral-600 bg-neutral-800 text-pastel-mint focus:ring-pastel-mint/30"
              />
              <span className="ml-2 text-xs text-neutral-500 flex items-center">
                <FolderImage className="w-3.5 h-3.5 mr-1" />
                Include images from sources ({sourceImages.length})
              </span>
            </label>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex items-end space-x-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* Image upload button */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={selectedImages.length >= 5}
            className="flex-shrink-0 p-2.5 bg-pastel-peach/10 text-pastel-peach hover:bg-pastel-peach/20 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-pastel-peach/20"
            title="Attach images (max 5)"
          >
            <ImagePlus className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder={
                selectedImages.length > 0
                  ? 'Ask about the images...'
                  : 'Ask a question...'
              }
              rows={1}
              className="w-full px-4 py-2.5 bg-neutral-800 border border-neutral-700 text-neutral-100 placeholder-neutral-500 rounded-lg focus:ring-1 focus:ring-neutral-600 focus:border-neutral-600 resize-none transition-all"
              style={{
                minHeight: '44px',
                maxHeight: '120px',
              }}
            />
          </div>
          <button
            type="submit"
            disabled={!message.trim() || sendMutation.isPending}
            className="flex-shrink-0 p-2.5 bg-pastel-mint/15 text-pastel-mint rounded-lg hover:bg-pastel-mint/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-pastel-mint/25"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-600 text-center">
          Enter to send · Shift+Enter for new line
          {selectedImages.length > 0 && ` · ${selectedImages.length}/5 images`}
        </p>
      </div>
    </div>
  );
}
