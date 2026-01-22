import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileText, Trash2, Tag, TrendingUp, Hash, Calendar, Loader2 } from 'lucide-react';
import { documentsApi } from '../api/documents';
import clsx from 'clsx';

export default function DocumentList({ documents, clientId }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', clientId]);
      setSelectedDoc(null);
    },
  });

  const handleDelete = async (docId) => {
    if (window.confirm('Are you sure you want to delete this document?')) {
      await deleteMutation.mutateAsync(docId);
    }
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'positive':
        return 'text-accent-green bg-accent-green/10 border-accent-green/30';
      case 'negative':
        return 'text-red-400 bg-red-500/10 border-red-500/30';
      default:
        return 'text-gray-400 bg-dark-700/50 border-dark-700';
    }
  };

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-dark-800/50 backdrop-blur-sm rounded-2xl border border-dark-700">
        <div className="p-4 bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 rounded-2xl inline-block mb-4">
          <FileText className="h-12 w-12 text-accent-purple" />
        </div>
        <h3 className="mt-2 text-sm font-medium text-gray-100">No documents yet</h3>
        <p className="mt-1 text-sm text-gray-400">
          Upload documents to get started with AI analysis
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Documents list */}
      <div className="lg:col-span-2 space-y-3">
        {documents.map((doc) => (
          <div
            key={doc.id}
            onClick={() => setSelectedDoc(doc)}
            className={clsx(
              'bg-dark-800/50 backdrop-blur-sm rounded-xl border p-4 cursor-pointer transition-all',
              selectedDoc?.id === doc.id
                ? 'border-accent-cyan shadow-neon'
                : 'border-dark-700 hover:border-accent-purple hover:shadow-glow-purple'
            )}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <FileText className="w-5 h-5 text-accent-purple mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-sm font-medium text-gray-100 truncate">
                      {doc.processed ? doc.title : doc.file_name}
                    </h3>
                    {!doc.processed && (
                      <Loader2 className="w-4 h-4 animate-spin text-accent-cyan" />
                    )}
                  </div>
                  {doc.processed && doc.topic && (
                    <p className="mt-1 text-xs text-gray-400">
                      {doc.topic}
                    </p>
                  )}
                  {doc.processed && doc.sentiment && (
                    <span
                      className={clsx(
                        'inline-block mt-2 px-2 py-0.5 text-xs font-medium rounded-full border',
                        getSentimentColor(doc.sentiment)
                      )}
                    >
                      {doc.sentiment}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(doc.id);
                }}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all hover:scale-110"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Document details */}
      <div className="lg:col-span-1">
        {selectedDoc ? (
          <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl border border-dark-700 p-6 sticky top-24">
            <h3 className="text-lg font-semibold bg-gradient-to-r from-accent-cyan to-accent-purple bg-clip-text text-transparent mb-4">
              Document Details
            </h3>

            {!selectedDoc.processed ? (
              <div className="text-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-accent-cyan mx-auto" />
                <p className="mt-2 text-sm text-gray-400">Processing document...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Title */}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Title
                  </h4>
                  <p className="text-sm text-gray-100">{selectedDoc.title}</p>
                </div>

                {/* Summary */}
                <div>
                  <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                    Summary
                  </h4>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {selectedDoc.summary}
                  </p>
                </div>

                {/* Tags */}
                {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                      <Tag className="w-3 h-3 mr-1 text-accent-purple" />
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDoc.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-1 text-xs bg-accent-purple/10 text-accent-purple border border-accent-purple/30 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Keywords */}
                {selectedDoc.keywords && selectedDoc.keywords.length > 0 && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                      <Hash className="w-3 h-3 mr-1 text-accent-cyan" />
                      Keywords
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDoc.keywords.slice(0, 10).map((keyword, idx) => (
                        <span
                          key={idx}
                          className="inline-block px-2 py-1 text-xs bg-dark-700/50 text-gray-300 border border-dark-700 rounded-md"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sentiment */}
                {selectedDoc.sentiment && (
                  <div>
                    <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center">
                      <TrendingUp className="w-3 h-3 mr-1 text-accent-green" />
                      Sentiment Analysis
                    </h4>
                    <div className="flex items-center space-x-3">
                      <span
                        className={clsx(
                          'px-3 py-1 text-sm font-medium rounded-full border',
                          getSentimentColor(selectedDoc.sentiment)
                        )}
                      >
                        {selectedDoc.sentiment}
                      </span>
                      <span className="text-sm text-gray-400">
                        Score: {selectedDoc.sentiment_score?.toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="pt-4 border-t border-dark-700">
                  <div className="space-y-2 text-xs text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="w-3 h-3 mr-2" />
                      {new Date(selectedDoc.created_at).toLocaleString()}
                    </div>
                    <div>
                      Size: {(selectedDoc.file_size / 1024).toFixed(2)} KB
                    </div>
                    <div>Type: {selectedDoc.file_type}</div>
                  </div>
                </div>

                {/* Download link */}
                {selectedDoc.file_url && (
                  <a
                    href={selectedDoc.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full text-center px-4 py-2 bg-gradient-to-r from-accent-cyan to-accent-purple text-white rounded-lg hover:scale-105 hover:shadow-neon transition-all text-sm font-medium"
                  >
                    View Original File
                  </a>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-dark-800/50 backdrop-blur-sm rounded-2xl border border-dark-700 p-6 text-center text-gray-400 sticky top-24">
            <div className="p-3 bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 rounded-xl inline-block mb-2">
              <FileText className="w-12 h-12 text-accent-purple" />
            </div>
            <p className="text-sm">Select a document to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
