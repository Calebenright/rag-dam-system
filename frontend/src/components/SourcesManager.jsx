import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDropzone } from 'react-dropzone';
import {
  FileText, Trash2, Loader2, Search,
  Grid, List, X, ExternalLink,
  Calendar, Tag, FileType, Sparkles, RefreshCw, File,
  Upload, Link, CheckCircle, AlertCircle, FileSpreadsheet,
  ChevronDown, Square, CheckSquare, Layers, FolderPlus, Folder
} from 'lucide-react';
import { documentsApi } from '../api/documents';
import clsx from 'clsx';

// Color style mappings
const colorStyles = {
  mint: {
    bg: 'bg-pastel-mint',
    bgLight: 'bg-pastel-mint/10',
    bgLighter: 'bg-pastel-mint/15',
    text: 'text-pastel-mint',
    border: 'border-pastel-mint/20',
  },
  lavender: {
    bg: 'bg-pastel-lavender',
    bgLight: 'bg-pastel-lavender/10',
    bgLighter: 'bg-pastel-lavender/15',
    text: 'text-pastel-lavender',
    border: 'border-pastel-lavender/20',
  },
  sky: {
    bg: 'bg-pastel-sky',
    bgLight: 'bg-pastel-sky/10',
    bgLighter: 'bg-pastel-sky/15',
    text: 'text-pastel-sky',
    border: 'border-pastel-sky/20',
  },
  peach: {
    bg: 'bg-pastel-peach',
    bgLight: 'bg-pastel-peach/10',
    bgLighter: 'bg-pastel-peach/15',
    text: 'text-pastel-peach',
    border: 'border-pastel-peach/20',
  },
  coral: {
    bg: 'bg-pastel-coral',
    bgLight: 'bg-pastel-coral/10',
    bgLighter: 'bg-pastel-coral/15',
    text: 'text-pastel-coral',
    border: 'border-pastel-coral/20',
  },
  lemon: {
    bg: 'bg-pastel-lemon',
    bgLight: 'bg-pastel-lemon/10',
    bgLighter: 'bg-pastel-lemon/15',
    text: 'text-pastel-lemon',
    border: 'border-pastel-lemon/20',
  },
};

// Color assignments for file types
const FILE_COLORS = {
  pdf: 'coral',
  doc: 'sky',
  docx: 'sky',
  txt: 'lavender',
  csv: 'mint',
  xlsx: 'mint',
  xls: 'mint',
  json: 'lemon',
  md: 'lavender',
  google_doc: 'sky',
  google_sheet: 'mint',
};

const getFileColor = (fileName, fileType) => {
  if (fileType === 'google_sheet') return 'mint';
  if (fileType === 'google_doc') return 'sky';
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return FILE_COLORS[ext] || 'lavender';
};

const getFileExtension = (fileName, fileType) => {
  if (fileType === 'google_sheet') return 'SHEET';
  if (fileType === 'google_doc') return 'DOC';
  return fileName?.split('.').pop()?.toUpperCase() || 'FILE';
};

const getTypeCategory = (doc) => {
  if (doc.file_type === 'google_sheet') return 'Google Sheets';
  if (doc.file_type === 'google_doc') return 'Google Docs';
  const ext = doc.file_name?.split('.').pop()?.toLowerCase();
  if (['pdf'].includes(ext)) return 'PDFs';
  if (['doc', 'docx'].includes(ext)) return 'Documents';
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'Spreadsheets';
  if (['txt', 'md'].includes(ext)) return 'Text Files';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'Images';
  return 'Other';
};

export default function SourcesManager({ documents, clientId, isLoading }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTab, setUploadTab] = useState('file');
  const [googleUrl, setGoogleUrl] = useState('');
  const [googleError, setGoogleError] = useState('');
  const [addedDoc, setAddedDoc] = useState(null);
  const [uploadingFiles, setUploadingFiles] = useState([]);
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [groupBy, setGroupBy] = useState('type'); // 'type', 'date', 'none', 'custom'
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [customGroups, setCustomGroups] = useState([]);

  const queryClient = useQueryClient();

  // Fetch custom groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groups = await documentsApi.getGroups(clientId);
        setCustomGroups(groups || []);
      } catch (error) {
        console.error('Error fetching groups:', error);
      }
    };
    if (clientId) fetchGroups();
  }, [clientId, documents]);

  // Poll for updates when there are unprocessed documents (reduced frequency)
  useEffect(() => {
    const hasUnprocessed = documents?.some(doc => !doc.processed);
    if (!hasUnprocessed) return;

    // Poll every 10 seconds instead of 3 - processing takes time anyway
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['documents', clientId], exact: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [documents, clientId, queryClient]);

  const deleteMutation = useMutation({
    mutationFn: documentsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', clientId]);
      setSelectedDoc(null);
    },
  });

  const syncMutation = useMutation({
    mutationFn: documentsApi.syncGoogleDoc,
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', clientId]);
    },
  });

  const [syncAllResult, setSyncAllResult] = useState(null);
  const syncAllMutation = useMutation({
    mutationFn: () => documentsApi.syncAllGoogleDocs(clientId),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['documents', clientId]);
      setSyncAllResult(data);
      setTimeout(() => setSyncAllResult(null), 5000);
    },
  });

  const bulkGroupMutation = useMutation({
    mutationFn: ({ documentIds, group }) => documentsApi.bulkUpdateGroup(documentIds, group),
    onSuccess: () => {
      queryClient.invalidateQueries(['documents', clientId]);
      setSelectedSources(new Set());
      setIsSelectionMode(false);
      setShowGroupModal(false);
      setNewGroupName('');
    },
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file }) => {
      return documentsApi.upload(clientId, file, (progressEvent) => {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setUploadingFiles((prev) =>
          prev.map((f) => f.name === file.name ? { ...f, progress } : f)
        );
      });
    },
    onSuccess: (data, { file }) => {
      setUploadingFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: 'success' } : f)
      );
      queryClient.invalidateQueries(['documents', clientId]);
      setTimeout(() => {
        setUploadingFiles((prev) => prev.filter((f) => f.name !== file.name));
      }, 2000);
    },
    onError: (error, { file }) => {
      setUploadingFiles((prev) =>
        prev.map((f) => f.name === file.name ? { ...f, status: 'error', error: error.message } : f)
      );
    },
  });

  const googleMutation = useMutation({
    mutationFn: (url) => documentsApi.addGoogleDoc(clientId, url),
    onSuccess: (data) => {
      setGoogleUrl('');
      setGoogleError('');
      setAddedDoc({ name: data.file_name, type: data.file_type });
      queryClient.invalidateQueries(['documents', clientId]);
      setTimeout(() => setAddedDoc(null), 5000);
    },
    onError: (error) => {
      setGoogleError(error.response?.data?.error || error.message);
    },
  });

  const onDrop = useCallback((acceptedFiles) => {
    acceptedFiles.forEach((file) => {
      setUploadingFiles((prev) => [...prev, {
        name: file.name,
        size: file.size,
        status: 'uploading',
        progress: 0,
      }]);
      uploadMutation.mutate({ file });
    });
  }, [uploadMutation]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'text/csv': ['.csv'],
    },
    maxSize: 10485760,
  });

  const handleGoogleSubmit = (e) => {
    e.preventDefault();
    if (!googleUrl.trim()) return;
    if (!googleUrl.includes('docs.google.com')) {
      setGoogleError('Please enter a valid Google Docs or Google Sheets URL');
      return;
    }
    setGoogleError('');
    setAddedDoc(null);
    googleMutation.mutate(googleUrl.trim());
  };

  const getUrlType = (url) => {
    if (url.includes('/spreadsheets/')) return 'sheet';
    if (url.includes('/document/')) return 'doc';
    return null;
  };

  const urlType = getUrlType(googleUrl);

  const googleSourceCount = useMemo(() => {
    return documents?.filter(d => d.source_type === 'google').length || 0;
  }, [documents]);

  const handleDelete = async (docId, e) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to delete this source?')) {
      await deleteMutation.mutateAsync(docId);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSources.size === 0) return;
    if (window.confirm(`Are you sure you want to delete ${selectedSources.size} source${selectedSources.size > 1 ? 's' : ''}?`)) {
      for (const docId of selectedSources) {
        await deleteMutation.mutateAsync(docId);
      }
      setSelectedSources(new Set());
      setIsSelectionMode(false);
    }
  };

  const toggleSourceSelection = (docId, e) => {
    e?.stopPropagation();
    setSelectedSources(prev => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const allFilteredIds = Object.values(groupedDocs).flat().map(doc => doc.id);
    if (selectedSources.size === allFilteredIds.length) {
      setSelectedSources(new Set());
    } else {
      setSelectedSources(new Set(allFilteredIds));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedSources(new Set());
  };

  // Helper to get date group label
  const getDateGroup = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return 'This Week';
    if (diffDays <= 30) return 'This Month';
    if (diffDays <= 90) return 'Last 3 Months';
    return 'Older';
  };

  // Group documents based on groupBy setting
  const groupedDocs = useMemo(() => {
    let filtered = [...(documents || [])];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title?.toLowerCase().includes(query) ||
        doc.file_name?.toLowerCase().includes(query) ||
        doc.topic?.toLowerCase().includes(query) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filterType !== 'all') {
      filtered = filtered.filter(doc => getTypeCategory(doc) === filterType);
    }

    // Sort all by date first
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Group based on groupBy setting
    const groups = {};

    if (groupBy === 'none') {
      // No grouping - all in one group
      groups['All Sources'] = filtered;
    } else if (groupBy === 'date') {
      // Group by date ranges
      filtered.forEach(doc => {
        const dateGroup = getDateGroup(doc.created_at);
        if (!groups[dateGroup]) groups[dateGroup] = [];
        groups[dateGroup].push(doc);
      });
    } else if (groupBy === 'custom') {
      // Group by custom groups
      filtered.forEach(doc => {
        const customGroup = doc.custom_group || 'Ungrouped';
        if (!groups[customGroup]) groups[customGroup] = [];
        groups[customGroup].push(doc);
      });
    } else {
      // Group by type category (default)
      filtered.forEach(doc => {
        const category = getTypeCategory(doc);
        if (!groups[category]) groups[category] = [];
        groups[category].push(doc);
      });
    }

    return groups;
  }, [documents, searchQuery, filterType, groupBy]);

  const typeCategories = useMemo(() => {
    const cats = new Set();
    documents?.forEach(doc => cats.add(getTypeCategory(doc)));
    return Array.from(cats).sort();
  }, [documents]);

  const totalFiltered = Object.values(groupedDocs).flat().length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 texture-dots">
        <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender" />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full bg-neutral-950">
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="p-3 border-b border-neutral-800 space-y-2 bg-neutral-900/30">
          <div className="flex items-center gap-2">
            {/* Selection mode controls */}
            {isSelectionMode ? (
              <>
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700/50 transition-all"
                >
                  {selectedSources.size === totalFiltered && totalFiltered > 0 ? (
                    <CheckSquare className="w-4 h-4 text-pastel-sky" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  <span>{selectedSources.size === totalFiltered && totalFiltered > 0 ? 'Deselect All' : 'Select All'}</span>
                </button>
                <span className="text-sm text-neutral-400">
                  {selectedSources.size} selected
                </span>
                <button
                  onClick={() => setShowGroupModal(true)}
                  disabled={selectedSources.size === 0}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium',
                    selectedSources.size > 0
                      ? 'bg-pastel-lavender/15 text-pastel-lavender hover:bg-pastel-lavender/25'
                      : 'bg-neutral-800/50 text-neutral-500 cursor-not-allowed'
                  )}
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Add to Group</span>
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={selectedSources.size === 0 || deleteMutation.isPending}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium',
                    selectedSources.size > 0
                      ? 'bg-pastel-coral/15 text-pastel-coral hover:bg-pastel-coral/25'
                      : 'bg-neutral-800/50 text-neutral-500 cursor-not-allowed'
                  )}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  <span>Delete Selected</span>
                </button>
                <div className="flex-1" />
                <button
                  onClick={exitSelectionMode}
                  className="flex items-center gap-2 px-3 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700/50 transition-all"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </>
            ) : (
              <>
                {/* Selection mode toggle - on the left */}
                {totalFiltered > 0 && (
                  <button
                    onClick={() => setIsSelectionMode(true)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700/50 transition-all"
                  >
                    <Square className="w-4 h-4" />
                    <span className="hidden sm:inline">Select</span>
                  </button>
                )}

                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search sources..."
                    className="w-full pl-9 pr-4 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:border-pastel-sky focus:outline-none"
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Type filter dropdown */}
                <div className="relative">
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="appearance-none pl-3 pr-8 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:border-pastel-sky focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Types</option>
                    {typeCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                </div>

                {/* Group by dropdown */}
                <div className="relative">
                  <select
                    value={groupBy}
                    onChange={(e) => setGroupBy(e.target.value)}
                    className="appearance-none pl-8 pr-8 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-300 focus:border-pastel-sky focus:outline-none cursor-pointer"
                  >
                    <option value="type">Group by Type</option>
                    <option value="date">Group by Date</option>
                    <option value="custom">Custom Groups</option>
                    <option value="none">No Grouping</option>
                  </select>
                  <Layers className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500 pointer-events-none" />
                </div>

                {googleSourceCount > 0 && (
                  <button
                    onClick={() => syncAllMutation.mutate()}
                    disabled={syncAllMutation.isPending}
                    className={clsx(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all text-sm font-medium',
                      syncAllMutation.isPending
                        ? 'bg-pastel-sky/15 text-pastel-sky'
                        : 'bg-pastel-mint/15 text-pastel-mint hover:bg-pastel-mint/25'
                    )}
                  >
                    <RefreshCw className={`w-4 h-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">{syncAllMutation.isPending ? 'Syncing...' : 'Sync'}</span>
                  </button>
                )}

                <div className="flex items-center bg-neutral-800/50 rounded-lg p-1 border border-neutral-700">
                  <button
                    onClick={() => setViewMode('list')}
                    className={clsx('p-1.5 rounded transition-all', viewMode === 'list' ? 'bg-pastel-sky/20 text-pastel-sky' : 'text-neutral-400 hover:text-neutral-300')}
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('grid')}
                    className={clsx('p-1.5 rounded transition-all', viewMode === 'grid' ? 'bg-pastel-sky/20 text-pastel-sky' : 'text-neutral-400 hover:text-neutral-300')}
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setShowUpload(!showUpload)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-medium',
                    showUpload
                      ? 'bg-pastel-peach/20 text-pastel-peach'
                      : 'bg-pastel-lavender/15 text-pastel-lavender hover:bg-pastel-lavender/25'
                  )}
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Add Source</span>
                </button>
              </>
            )}
          </div>

          {syncAllResult && (
            <div className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
              syncAllResult.synced > 0 ? 'bg-pastel-mint/15 text-pastel-mint' : 'bg-pastel-sky/15 text-pastel-sky'
            )}>
              <RefreshCw className="w-4 h-4" />
              <span>{syncAllResult.synced > 0 ? `${syncAllResult.synced} source${syncAllResult.synced > 1 ? 's' : ''} updated` : 'All sources up to date'}</span>
              <button onClick={() => setSyncAllResult(null)} className="ml-auto p-1 hover:bg-neutral-800 rounded">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Upload section */}
          {showUpload && (
            <div className="bg-neutral-800/30 rounded-xl border border-neutral-700 p-4">
              {/* Tab switcher */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setUploadTab('file')}
                  className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    uploadTab === 'file' ? 'bg-pastel-lavender/20 text-pastel-lavender' : 'text-neutral-400 hover:text-neutral-200'
                  )}
                >
                  <FileText className="w-4 h-4" />
                  Upload File
                </button>
                <button
                  onClick={() => setUploadTab('google')}
                  className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                    uploadTab === 'google' ? 'bg-pastel-sky/20 text-pastel-sky' : 'text-neutral-400 hover:text-neutral-200'
                  )}
                >
                  <Link className="w-4 h-4" />
                  Google Link
                </button>
              </div>

              {uploadTab === 'file' ? (
                <div>
                  <div
                    {...getRootProps()}
                    className={clsx(
                      'border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer text-center',
                      isDragActive ? 'border-pastel-sky bg-pastel-sky/10' : 'border-neutral-700 hover:border-pastel-lavender'
                    )}
                  >
                    <input {...getInputProps()} />
                    <Upload className={clsx('mx-auto h-8 w-8 mb-2', isDragActive ? 'text-pastel-sky' : 'text-neutral-500')} />
                    <p className="text-sm text-neutral-300">{isDragActive ? 'Drop files here' : 'Drag & drop or click to browse'}</p>
                    <p className="text-xs text-neutral-500 mt-1">PDF, DOCX, TXT, XLSX, CSV, Images (max 10MB)</p>
                  </div>

                  {uploadingFiles.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {uploadingFiles.map((file) => (
                        <div key={file.name} className="flex items-center gap-3 p-2 bg-neutral-900/50 rounded-lg">
                          <File className="w-5 h-5 text-pastel-lavender" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-neutral-200 truncate">{file.name}</p>
                            {file.status === 'uploading' && (
                              <div className="mt-1 bg-neutral-700 rounded-full h-1 overflow-hidden">
                                <div className="bg-pastel-sky h-full transition-all" style={{ width: `${file.progress}%` }} />
                              </div>
                            )}
                          </div>
                          {file.status === 'uploading' && <Loader2 className="w-4 h-4 animate-spin text-pastel-sky" />}
                          {file.status === 'success' && <CheckCircle className="w-4 h-4 text-pastel-mint" />}
                          {file.status === 'error' && <AlertCircle className="w-4 h-4 text-pastel-coral" />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <form onSubmit={handleGoogleSubmit} className="flex gap-2">
                    <div className="flex-1 relative">
                      <input
                        type="url"
                        value={googleUrl}
                        onChange={(e) => setGoogleUrl(e.target.value)}
                        placeholder="https://docs.google.com/..."
                        className="w-full px-3 py-2 bg-neutral-900/50 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:border-pastel-sky focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={!googleUrl.trim() || googleMutation.isPending}
                      className="flex items-center gap-2 px-4 py-2 bg-pastel-sky/20 text-pastel-sky rounded-lg hover:bg-pastel-sky/30 transition-all disabled:opacity-50 text-sm font-medium"
                    >
                      {googleMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                      Add
                    </button>
                  </form>
                  {urlType && <p className="mt-2 text-xs text-pastel-sky">Detected: Google {urlType === 'sheet' ? 'Sheets' : 'Docs'}</p>}
                  {googleError && <p className="mt-2 text-xs text-pastel-coral">{googleError}</p>}
                  {addedDoc && (
                    <div className="mt-2 flex items-center gap-2 text-pastel-mint text-sm">
                      <CheckCircle className="w-4 h-4" />
                      Added: {addedDoc.name}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-neutral-500">Document must be set to "Anyone with the link can view"</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sources display */}
        <div className={clsx("flex-1 flex overflow-hidden", selectedDoc && "")}>
          <div className={clsx("flex-1 overflow-y-auto p-3 scrollbar-dark texture-grid", selectedDoc && "w-1/2")}>
            {totalFiltered === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-neutral-900/50 rounded-2xl inline-block mb-4 border border-neutral-800">
                  <FileText className="h-12 w-12 text-pastel-lavender" />
                </div>
                <h3 className="text-sm font-medium text-neutral-100">
                  {searchQuery || filterType !== 'all' ? 'No sources found' : 'No sources yet'}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {searchQuery || filterType !== 'all' ? 'Try a different search or filter' : 'Click "Add Source" to get started'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-4">
                {Object.entries(groupedDocs).map(([category, docs]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <h3 className="text-sm font-medium text-neutral-400">{category}</h3>
                      <span className="text-xs text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">{docs.length}</span>
                    </div>
                    <div className="space-y-2">
                      {docs.map((doc) => {
                        const colorName = getFileColor(doc.file_name, doc.file_type);
                        const styles = colorStyles[colorName] || colorStyles.lavender;
                        const isSelected = selectedSources.has(doc.id);

                        return (
                          <div
                            key={doc.id}
                            onClick={() => isSelectionMode ? toggleSourceSelection(doc.id) : setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                            className={clsx(
                              'bg-neutral-900/50 rounded-lg border p-3 cursor-pointer transition-all group',
                              isSelected ? 'border-pastel-sky bg-pastel-sky/10' :
                              selectedDoc?.id === doc.id ? 'border-pastel-sky bg-pastel-sky/5' : 'border-neutral-800 hover:border-neutral-700'
                            )}
                          >
                            <div className="flex items-center gap-3">
                              {isSelectionMode && (
                                <button
                                  onClick={(e) => toggleSourceSelection(doc.id, e)}
                                  className="flex-shrink-0"
                                >
                                  {isSelected ? (
                                    <CheckSquare className="w-5 h-5 text-pastel-sky" />
                                  ) : (
                                    <Square className="w-5 h-5 text-neutral-500 hover:text-neutral-300" />
                                  )}
                                </button>
                              )}
                              <div className={clsx('w-1 h-10 rounded-full', styles.bg)} />
                              <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center border', styles.bgLight, styles.border)}>
                                {doc.file_type === 'google_sheet' ? (
                                  <FileSpreadsheet className={clsx('w-5 h-5', styles.text)} />
                                ) : (
                                  <File className={clsx('w-5 h-5', styles.text)} />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="text-sm font-medium text-neutral-100 truncate">
                                    {doc.file_name}
                                  </h3>
                                  {!doc.processed && <Loader2 className="w-4 h-4 animate-spin text-pastel-sky flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className={clsx('text-xs px-1.5 py-0.5 rounded', styles.bgLight, styles.text)}>
                                    {getFileExtension(doc.file_name, doc.file_type)}
                                  </span>
                                  <span className="text-xs text-neutral-500">{new Date(doc.created_at).toLocaleDateString()}</span>
                                </div>
                              </div>
                              {!isSelectionMode && (
                                <button
                                  onClick={(e) => handleDelete(doc.id, e)}
                                  className="p-2 text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-pastel-coral hover:bg-pastel-coral/10 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedDocs).map(([category, docs]) => (
                  <div key={category}>
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <h3 className="text-sm font-medium text-neutral-400">{category}</h3>
                      <span className="text-xs text-neutral-600 bg-neutral-800 px-2 py-0.5 rounded-full">{docs.length}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {docs.map((doc) => {
                        const colorName = getFileColor(doc.file_name, doc.file_type);
                        const styles = colorStyles[colorName] || colorStyles.lavender;
                        const isSelected = selectedSources.has(doc.id);

                        return (
                          <div
                            key={doc.id}
                            onClick={() => isSelectionMode ? toggleSourceSelection(doc.id) : setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                            className={clsx(
                              'bg-neutral-900/50 rounded-xl border p-4 cursor-pointer transition-all group relative overflow-hidden',
                              isSelected ? 'border-pastel-sky bg-pastel-sky/10' :
                              selectedDoc?.id === doc.id ? 'border-pastel-sky bg-pastel-sky/5' : 'border-neutral-800 hover:border-neutral-700'
                            )}
                          >
                            <div className={clsx('absolute top-0 left-0 right-0 h-1', styles.bg)} />
                            {isSelectionMode && (
                              <button
                                onClick={(e) => toggleSourceSelection(doc.id, e)}
                                className="absolute top-3 right-3 z-10"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-5 h-5 text-pastel-sky" />
                                ) : (
                                  <Square className="w-5 h-5 text-neutral-500 hover:text-neutral-300" />
                                )}
                              </button>
                            )}
                            <div className="text-center pt-2">
                              <div className={clsx('w-14 h-14 mx-auto rounded-xl flex items-center justify-center border mb-3', styles.bgLight, styles.border)}>
                                {doc.file_type === 'google_sheet' ? (
                                  <FileSpreadsheet className={clsx('w-7 h-7', styles.text)} />
                                ) : (
                                  <File className={clsx('w-7 h-7', styles.text)} />
                                )}
                              </div>
                              <h3 className="text-sm font-medium text-neutral-100 truncate">
                                {doc.file_name}
                              </h3>
                              <div className="flex items-center justify-center gap-2 mt-2">
                                <span className={clsx('text-xs px-2 py-0.5 rounded-full', styles.bgLighter, styles.text)}>
                                  {getFileExtension(doc.file_name, doc.file_type)}
                                </span>
                                {!doc.processed && <Loader2 className="w-3 h-3 animate-spin text-pastel-sky" />}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Source details panel */}
          {selectedDoc && (() => {
            const colorName = getFileColor(selectedDoc.file_name, selectedDoc.file_type);
            const styles = colorStyles[colorName] || colorStyles.lavender;

            return (
              <div className="w-1/2 border-l border-neutral-800 flex flex-col overflow-hidden bg-neutral-900/30">
                <div className={clsx('h-1', styles.bg)} />
                <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-neutral-100 truncate">Source Details</h2>
                  <button onClick={() => setSelectedDoc(null)} className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-dark">
                  <div className="flex items-start gap-4">
                    <div className={clsx('w-16 h-16 rounded-xl flex items-center justify-center border', styles.bgLighter, styles.border)}>
                      {selectedDoc.file_type === 'google_sheet' ? (
                        <FileSpreadsheet className={clsx('w-8 h-8', styles.text)} />
                      ) : (
                        <File className={clsx('w-8 h-8', styles.text)} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-neutral-100">
                        {selectedDoc.file_name}
                      </h3>
                      {selectedDoc.title && selectedDoc.title !== selectedDoc.file_name && (
                        <p className="text-sm text-neutral-500 mt-1">AI Title: {selectedDoc.title}</p>
                      )}
                      {!selectedDoc.processed && (
                        <div className="flex items-center gap-2 mt-2 text-pastel-sky">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Processing...</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <FileType className="w-4 h-4" />
                        <span className="text-xs">Type</span>
                      </div>
                      <p className={clsx('text-sm font-medium', styles.text)}>
                        {getFileExtension(selectedDoc.file_name, selectedDoc.file_type)}
                      </p>
                    </div>
                    <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <Calendar className="w-4 h-4" />
                        <span className="text-xs">Added</span>
                      </div>
                      <p className="text-sm text-neutral-200">{new Date(selectedDoc.created_at).toLocaleDateString()}</p>
                    </div>
                    {selectedDoc.topic && (
                      <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800 col-span-2">
                        <div className="flex items-center gap-2 text-neutral-500 mb-1">
                          <Sparkles className="w-4 h-4" />
                          <span className="text-xs">Topic</span>
                        </div>
                        <p className="text-sm text-neutral-200">{selectedDoc.topic}</p>
                      </div>
                    )}
                    {selectedDoc.custom_group && (
                      <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800 col-span-2">
                        <div className="flex items-center gap-2 text-neutral-500 mb-1">
                          <Folder className="w-4 h-4" />
                          <span className="text-xs">Group</span>
                        </div>
                        <p className="text-sm text-pastel-lavender">{selectedDoc.custom_group}</p>
                      </div>
                    )}
                  </div>

                  {selectedDoc.summary && (
                    <div className="bg-neutral-800/30 rounded-lg p-4 border border-neutral-800">
                      <h4 className="text-sm font-medium text-neutral-400 mb-2">Summary</h4>
                      <p className="text-sm text-neutral-200 leading-relaxed">{selectedDoc.summary}</p>
                    </div>
                  )}

                  {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-neutral-500 mb-2">
                        <Tag className="w-4 h-4" />
                        <span className="text-sm">Tags</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.tags.map((tag, idx) => {
                          const tagColors = [colorStyles.mint, colorStyles.sky, colorStyles.lavender, colorStyles.peach];
                          const tagStyle = tagColors[idx % tagColors.length];
                          return (
                            <span key={idx} className={clsx('px-3 py-1 text-sm rounded-full border', tagStyle.bgLight, tagStyle.text, tagStyle.border)}>
                              {tag}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {selectedDoc.file_type === 'google_sheet' && selectedDoc.sheet_tabs && selectedDoc.sheet_tabs.length > 0 && (
                    <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                      <div className="flex items-center gap-2 text-neutral-500 mb-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span className="text-xs">Tabs ({selectedDoc.sheet_tabs.length})</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {selectedDoc.sheet_tabs.map((tab, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs bg-pastel-mint/10 text-pastel-mint rounded border border-pastel-mint/20"
                          >
                            {tab.title || tab}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDoc.source_type === 'google' && selectedDoc.last_synced && (
                    <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-neutral-500">Last synced</p>
                          <p className="text-sm text-neutral-200">{new Date(selectedDoc.last_synced).toLocaleString()}</p>
                        </div>
                        <button
                          onClick={() => syncMutation.mutate(selectedDoc.id)}
                          disabled={syncMutation.isPending}
                          className="flex items-center gap-1 px-3 py-1.5 bg-pastel-sky/15 text-pastel-sky rounded-lg hover:bg-pastel-sky/25 transition-all disabled:opacity-50"
                        >
                          <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                          <span className="text-xs">Sync</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t border-neutral-700 space-y-2">
                    {selectedDoc.file_url && (
                      <a
                        href={selectedDoc.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-pastel-sky/15 text-pastel-sky rounded-lg hover:bg-pastel-sky/25 transition-all font-medium"
                      >
                        <ExternalLink className="w-4 h-4" />
                        {selectedDoc.source_type === 'google' ? 'Open in Google' : 'View Original'}
                      </a>
                    )}
                    <button
                      onClick={(e) => handleDelete(selectedDoc.id, e)}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-pastel-coral/10 text-pastel-coral rounded-lg hover:bg-pastel-coral/20 transition-all font-medium"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Source
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Group Assignment Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-neutral-900 border border-neutral-700 rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-neutral-100">Add to Group</h3>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setNewGroupName('');
                }}
                className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-neutral-400 mb-4">
              Add {selectedSources.size} source{selectedSources.size > 1 ? 's' : ''} to a group
            </p>

            {/* Existing groups */}
            {customGroups.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">Existing Groups</p>
                <div className="flex flex-wrap gap-2">
                  {customGroups.map(group => (
                    <button
                      key={group}
                      onClick={() => bulkGroupMutation.mutate({ documentIds: Array.from(selectedSources), group })}
                      disabled={bulkGroupMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-neutral-300 transition-all"
                    >
                      <Folder className="w-4 h-4 text-pastel-lavender" />
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new group */}
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                {customGroups.length > 0 ? 'Or Create New Group' : 'Create Group'}
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Enter group name..."
                  className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:border-pastel-sky focus:outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newGroupName.trim()) {
                      bulkGroupMutation.mutate({ documentIds: Array.from(selectedSources), group: newGroupName.trim() });
                    }
                  }}
                />
                <button
                  onClick={() => bulkGroupMutation.mutate({ documentIds: Array.from(selectedSources), group: newGroupName.trim() })}
                  disabled={!newGroupName.trim() || bulkGroupMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-pastel-lavender/20 text-pastel-lavender rounded-lg hover:bg-pastel-lavender/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkGroupMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderPlus className="w-4 h-4" />
                  )}
                  Add
                </button>
              </div>
            </div>

            {/* Remove from group option */}
            {customGroups.length > 0 && (
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <button
                  onClick={() => bulkGroupMutation.mutate({ documentIds: Array.from(selectedSources), group: null })}
                  disabled={bulkGroupMutation.isPending}
                  className="text-sm text-neutral-500 hover:text-neutral-300 transition-all"
                >
                  Remove from all groups
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
