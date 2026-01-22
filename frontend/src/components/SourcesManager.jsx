import { useState, useMemo, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText, Trash2, Loader2, Search, FolderPlus,
  Grid, List, Folder, FolderOpen,
  X, Plus, Filter, SortAsc, SortDesc, ExternalLink,
  Calendar, Tag, FileType, Sparkles, RefreshCw, File
} from 'lucide-react';
import { documentsApi } from '../api/documents';
import clsx from 'clsx';

// Default folders that always exist
const DEFAULT_FOLDERS = [
  { id: 'all', name: 'All Sources', icon: 'folder', color: 'lavender' },
  { id: 'new', name: 'New', icon: 'folder', color: 'mint' },
];

// Color style mappings - explicit classes for Tailwind to detect
const colorStyles = {
  mint: {
    bg: 'bg-pastel-mint',
    bgLight: 'bg-pastel-mint/10',
    bgLighter: 'bg-pastel-mint/15',
    text: 'text-pastel-mint',
    border: 'border-pastel-mint/20',
    borderLeft: 'border-l-pastel-mint',
  },
  lavender: {
    bg: 'bg-pastel-lavender',
    bgLight: 'bg-pastel-lavender/10',
    bgLighter: 'bg-pastel-lavender/15',
    text: 'text-pastel-lavender',
    border: 'border-pastel-lavender/20',
    borderLeft: 'border-l-pastel-lavender',
  },
  sky: {
    bg: 'bg-pastel-sky',
    bgLight: 'bg-pastel-sky/10',
    bgLighter: 'bg-pastel-sky/15',
    text: 'text-pastel-sky',
    border: 'border-pastel-sky/20',
    borderLeft: 'border-l-pastel-sky',
  },
  peach: {
    bg: 'bg-pastel-peach',
    bgLight: 'bg-pastel-peach/10',
    bgLighter: 'bg-pastel-peach/15',
    text: 'text-pastel-peach',
    border: 'border-pastel-peach/20',
    borderLeft: 'border-l-pastel-peach',
  },
  coral: {
    bg: 'bg-pastel-coral',
    bgLight: 'bg-pastel-coral/10',
    bgLighter: 'bg-pastel-coral/15',
    text: 'text-pastel-coral',
    border: 'border-pastel-coral/20',
    borderLeft: 'border-l-pastel-coral',
  },
  lemon: {
    bg: 'bg-pastel-lemon',
    bgLight: 'bg-pastel-lemon/10',
    bgLighter: 'bg-pastel-lemon/15',
    text: 'text-pastel-lemon',
    border: 'border-pastel-lemon/20',
    borderLeft: 'border-l-pastel-lemon',
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
  google: 'sky',
};

const getFileColor = (fileName, sourceType) => {
  if (sourceType === 'google') return 'sky';
  const ext = fileName?.split('.').pop()?.toLowerCase();
  return FILE_COLORS[ext] || 'lavender';
};

export default function SourcesManager({ documents, clientId, isLoading }) {
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolder, setSelectedFolder] = useState('all');

  const [folders, setFolders] = useState(() => {
    const saved = localStorage.getItem(`folders-${clientId}`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const hasAll = parsed.some(f => f.id === 'all');
        const hasNew = parsed.some(f => f.id === 'new');
        if (!hasAll) parsed.unshift(DEFAULT_FOLDERS[0]);
        if (!hasNew) parsed.splice(1, 0, DEFAULT_FOLDERS[1]);
        return parsed;
      } catch {
        return DEFAULT_FOLDERS;
      }
    }
    return DEFAULT_FOLDERS;
  });

  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [filterType, setFilterType] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  const [docFolders, setDocFolders] = useState(() => {
    const saved = localStorage.getItem(`docFolders-${clientId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  const [draggedDoc, setDraggedDoc] = useState(null);
  const [dragOverFolder, setDragOverFolder] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    localStorage.setItem(`folders-${clientId}`, JSON.stringify(folders));
  }, [folders, clientId]);

  useEffect(() => {
    localStorage.setItem(`docFolders-${clientId}`, JSON.stringify(docFolders));
  }, [docFolders, clientId]);

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

  const googleSourceCount = useMemo(() => {
    return documents?.filter(d => d.source_type === 'google').length || 0;
  }, [documents]);

  const handleDelete = async (docId, e) => {
    e?.stopPropagation();
    if (window.confirm('Are you sure you want to delete this source?')) {
      await deleteMutation.mutateAsync(docId);
    }
  };

  const createFolder = () => {
    if (newFolderName.trim()) {
      const colors = ['mint', 'sky', 'lavender', 'peach', 'coral', 'lemon'];
      const newFolder = {
        id: `folder-${Date.now()}`,
        name: newFolderName.trim(),
        icon: 'folder',
        color: colors[Math.floor(Math.random() * colors.length)]
      };
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const deleteFolder = (folderId) => {
    if (folderId === 'all' || folderId === 'new') return;
    setFolders(folders.filter(f => f.id !== folderId));
    const updatedDocFolders = { ...docFolders };
    Object.keys(updatedDocFolders).forEach(docId => {
      if (updatedDocFolders[docId] === folderId) {
        delete updatedDocFolders[docId];
      }
    });
    setDocFolders(updatedDocFolders);
    if (selectedFolder === folderId) {
      setSelectedFolder('all');
    }
  };

  const moveToFolder = (docId, folderId) => {
    if (folderId === 'new') {
      const newDocFolders = { ...docFolders };
      delete newDocFolders[docId];
      setDocFolders(newDocFolders);
    } else {
      setDocFolders({ ...docFolders, [docId]: folderId });
    }
  };

  const handleDragStart = (e, doc) => {
    setDraggedDoc(doc);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedDoc(null);
    setDragOverFolder(null);
  };

  const handleFolderDragOver = (e, folderId) => {
    e.preventDefault();
    if (folderId !== 'all') {
      setDragOverFolder(folderId);
    }
  };

  const handleFolderDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleFolderDrop = (e, folderId) => {
    e.preventDefault();
    if (draggedDoc && folderId !== 'all') {
      moveToFolder(draggedDoc.id, folderId);
    }
    setDraggedDoc(null);
    setDragOverFolder(null);
  };

  const getFileExtension = (fileName) => {
    return fileName?.split('.').pop()?.toUpperCase() || 'FILE';
  };

  const filteredDocs = useMemo(() => {
    let result = [...(documents || [])];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(doc =>
        doc.title?.toLowerCase().includes(query) ||
        doc.file_name?.toLowerCase().includes(query) ||
        doc.topic?.toLowerCase().includes(query) ||
        doc.tags?.some(tag => tag.toLowerCase().includes(query)) ||
        doc.keywords?.some(kw => kw.toLowerCase().includes(query))
      );
    }

    if (selectedFolder !== 'all') {
      if (selectedFolder === 'new') {
        result = result.filter(doc => !docFolders[doc.id]);
      } else {
        result = result.filter(doc => docFolders[doc.id] === selectedFolder);
      }
    }

    if (filterType !== 'all') {
      result = result.filter(doc => {
        const type = doc.file_type?.toLowerCase() || doc.file_name?.toLowerCase() || '';
        return type.includes(filterType);
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = (a.title || a.file_name || '').localeCompare(b.title || b.file_name || '');
          break;
        case 'type':
          comparison = (a.file_type || '').localeCompare(b.file_type || '');
          break;
        case 'date':
        default:
          comparison = new Date(b.created_at) - new Date(a.created_at);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [documents, searchQuery, selectedFolder, filterType, sortBy, sortOrder, docFolders]);

  const folderCounts = useMemo(() => {
    const counts = { all: documents?.length || 0, new: 0 };
    folders.forEach(f => {
      if (f.id !== 'all' && f.id !== 'new') {
        counts[f.id] = 0;
      }
    });
    documents?.forEach(doc => {
      const folderId = docFolders[doc.id];
      if (folderId && counts[folderId] !== undefined) {
        counts[folderId]++;
      } else {
        counts.new++;
      }
    });
    return counts;
  }, [documents, folders, docFolders]);

  const fileTypes = useMemo(() => {
    const types = new Set();
    documents?.forEach(doc => {
      const ext = doc.file_name?.split('.').pop()?.toLowerCase();
      if (ext) types.add(ext);
    });
    return Array.from(types);
  }, [documents]);

  const getFolderColor = (folder) => {
    return folder.color || 'lavender';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 texture-dots">
        <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender" />
      </div>
    );
  }

  return (
    <div className="flex h-full bg-neutral-950">
      {/* Sidebar - Folders */}
      <div className="w-56 border-r border-neutral-800 flex flex-col bg-neutral-900/50 texture-dots">
        <div className="p-3 border-b border-neutral-800">
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-pastel-lavender/10 text-pastel-lavender rounded-lg hover:bg-pastel-lavender/20 transition-all text-sm font-medium border border-pastel-lavender/20"
          >
            <FolderPlus className="w-4 h-4" />
            New Folder
          </button>
        </div>

        {isCreatingFolder && (
          <div className="p-2 border-b border-neutral-800 bg-neutral-900/50">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createFolder()}
                placeholder="Folder name"
                className="flex-1 px-2 py-1.5 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:border-pastel-sky focus:outline-none"
                autoFocus
              />
              <button onClick={createFolder} className="p-1.5 text-pastel-mint hover:bg-neutral-800 rounded-lg">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setIsCreatingFolder(false)} className="p-1.5 text-neutral-400 hover:bg-neutral-800 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2 scrollbar-dark">
          {folders.map((folder) => {
            const colorName = getFolderColor(folder);
            const styles = colorStyles[colorName] || colorStyles.lavender;
            const isSelected = selectedFolder === folder.id;

            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolder(folder.id)}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
                className={clsx(
                  'group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all mb-1',
                  isSelected
                    ? `${styles.bgLighter} ${styles.text} border-l-2 ${styles.borderLeft}`
                    : 'text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200',
                  dragOverFolder === folder.id && folder.id !== 'all' && 'bg-pastel-lavender/20 border-2 border-dashed border-pastel-lavender'
                )}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className={clsx(
                    'w-2 h-2 rounded-full flex-shrink-0',
                    isSelected ? styles.bg : 'bg-neutral-600'
                  )} />
                  {isSelected ? (
                    <FolderOpen className="w-4 h-4 flex-shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 flex-shrink-0" />
                  )}
                  <span className="text-sm truncate">{folder.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs opacity-60 bg-neutral-800/50 px-1.5 py-0.5 rounded">
                    {folderCounts[folder.id] || 0}
                  </span>
                  {folder.id !== 'all' && folder.id !== 'new' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteFolder(folder.id);
                      }}
                      className="p-1 opacity-0 group-hover:opacity-100 hover:text-pastel-coral transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stats footer */}
        <div className="p-3 border-t border-neutral-800 bg-neutral-900/30">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
              <div className="text-pastel-sky font-semibold">{documents?.length || 0}</div>
              <div className="text-neutral-500">Total</div>
            </div>
            <div className="bg-neutral-800/50 rounded-lg p-2 text-center">
              <div className="text-pastel-mint font-semibold">{folderCounts.new || 0}</div>
              <div className="text-neutral-500">New</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sources list */}
        <div className={clsx(
          "flex flex-col overflow-hidden transition-all",
          selectedDoc ? "w-1/2" : "flex-1"
        )}>
          {/* Toolbar */}
          <div className="p-3 border-b border-neutral-800 space-y-2 bg-neutral-900/30">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search sources..."
                  className="w-full pl-9 pr-4 py-2 bg-neutral-800/50 border border-neutral-700 rounded-lg text-sm text-neutral-100 placeholder-neutral-500 focus:border-pastel-sky focus:outline-none transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
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
                  title={`Sync ${googleSourceCount} Google source${googleSourceCount > 1 ? 's' : ''}`}
                >
                  <RefreshCw className={`w-4 h-4 ${syncAllMutation.isPending ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">
                    {syncAllMutation.isPending ? 'Syncing...' : 'Sync'}
                  </span>
                </button>
              )}

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={clsx(
                  'p-2 rounded-lg transition-all',
                  showFilters
                    ? 'bg-pastel-lavender/15 text-pastel-lavender'
                    : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-300'
                )}
              >
                <Filter className="w-4 h-4" />
              </button>

              <div className="flex items-center bg-neutral-800/50 rounded-lg p-1 border border-neutral-700">
                <button
                  onClick={() => setViewMode('list')}
                  className={clsx(
                    'p-1.5 rounded transition-all',
                    viewMode === 'list'
                      ? 'bg-pastel-sky/20 text-pastel-sky'
                      : 'text-neutral-400 hover:text-neutral-300'
                  )}
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={clsx(
                    'p-1.5 rounded transition-all',
                    viewMode === 'grid'
                      ? 'bg-pastel-sky/20 text-pastel-sky'
                      : 'text-neutral-400 hover:text-neutral-300'
                  )}
                >
                  <Grid className="w-4 h-4" />
                </button>
              </div>
            </div>

            {syncAllResult && (
              <div className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
                syncAllResult.synced > 0
                  ? 'bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/20'
                  : 'bg-pastel-sky/15 text-pastel-sky border border-pastel-sky/20'
              )}>
                <RefreshCw className="w-4 h-4" />
                <span>
                  {syncAllResult.synced > 0
                    ? `${syncAllResult.synced} source${syncAllResult.synced > 1 ? 's' : ''} updated`
                    : 'All sources up to date'
                  }
                </span>
                <button
                  onClick={() => setSyncAllResult(null)}
                  className="ml-auto p-1 hover:bg-neutral-800 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}

            {showFilters && (
              <div className="flex items-center gap-4 text-sm p-2 bg-neutral-800/30 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Type:</span>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-300 text-sm focus:border-pastel-sky focus:outline-none"
                  >
                    <option value="all">All</option>
                    {fileTypes.map(type => (
                      <option key={type} value={type}>{type.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-500">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-neutral-800 border border-neutral-700 rounded-lg px-2 py-1 text-neutral-300 text-sm focus:border-pastel-sky focus:outline-none"
                  >
                    <option value="date">Date</option>
                    <option value="name">Name</option>
                    <option value="type">Type</option>
                  </select>
                  <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="p-1 text-neutral-400 hover:text-neutral-300 hover:bg-neutral-700 rounded"
                  >
                    {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                  </button>
                </div>
                <span className="text-neutral-500 ml-auto">
                  <span className="text-pastel-lavender font-medium">{filteredDocs.length}</span> sources
                </span>
              </div>
            )}
          </div>

          {/* Sources display */}
          <div className="flex-1 overflow-y-auto p-3 scrollbar-dark texture-grid">
            {filteredDocs.length === 0 ? (
              <div className="text-center py-12">
                <div className="p-4 bg-neutral-900/50 rounded-2xl inline-block mb-4 border border-neutral-800">
                  <FileText className="h-12 w-12 text-pastel-lavender" />
                </div>
                <h3 className="text-sm font-medium text-neutral-100">
                  {searchQuery ? 'No sources found' : 'No sources yet'}
                </h3>
                <p className="mt-1 text-sm text-neutral-500">
                  {searchQuery ? 'Try a different search term' : 'Upload sources to get started'}
                </p>
              </div>
            ) : viewMode === 'list' ? (
              <div className="space-y-2">
                {filteredDocs.map((doc) => {
                  const colorName = getFileColor(doc.file_name, doc.source_type);
                  const styles = colorStyles[colorName] || colorStyles.lavender;

                  return (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, doc)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                      className={clsx(
                        'bg-neutral-900/50 rounded-lg border p-3 cursor-pointer transition-all group',
                        selectedDoc?.id === doc.id
                          ? 'border-pastel-sky bg-pastel-sky/5'
                          : 'border-neutral-800 hover:border-neutral-700 hover:bg-neutral-900/80',
                        draggedDoc?.id === doc.id && 'opacity-50'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Colored indicator */}
                        <div className={clsx('w-1 h-10 rounded-full', styles.bg)} />

                        <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center border', styles.bgLight, styles.border)}>
                          <File className={clsx('w-5 h-5', styles.text)} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-neutral-100 truncate">
                              {doc.processed ? doc.title : doc.file_name}
                            </h3>
                            {!doc.processed && (
                              <Loader2 className="w-4 h-4 animate-spin text-pastel-sky flex-shrink-0" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={clsx('text-xs px-1.5 py-0.5 rounded', styles.bgLight, styles.text)}>
                              {getFileExtension(doc.file_name)}
                            </span>
                            <span className="text-xs text-neutral-500">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={(e) => handleDelete(doc.id, e)}
                          className="p-2 text-neutral-500 opacity-0 group-hover:opacity-100 hover:text-pastel-coral hover:bg-pastel-coral/10 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredDocs.map((doc) => {
                  const colorName = getFileColor(doc.file_name, doc.source_type);
                  const styles = colorStyles[colorName] || colorStyles.lavender;

                  return (
                    <div
                      key={doc.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, doc)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setSelectedDoc(selectedDoc?.id === doc.id ? null : doc)}
                      className={clsx(
                        'bg-neutral-900/50 rounded-xl border p-4 cursor-pointer transition-all group relative overflow-hidden',
                        selectedDoc?.id === doc.id
                          ? 'border-pastel-sky bg-pastel-sky/5'
                          : 'border-neutral-800 hover:border-neutral-700',
                        draggedDoc?.id === doc.id && 'opacity-50'
                      )}
                    >
                      {/* Top color bar */}
                      <div className={clsx('absolute top-0 left-0 right-0 h-1', styles.bg)} />

                      <div className="text-center pt-2">
                        <div className={clsx('w-14 h-14 mx-auto rounded-xl flex items-center justify-center border mb-3', styles.bgLight, styles.border)}>
                          <File className={clsx('w-7 h-7', styles.text)} />
                        </div>
                        <h3 className="text-sm font-medium text-neutral-100 truncate">
                          {doc.processed ? doc.title : doc.file_name}
                        </h3>
                        <div className="flex items-center justify-center gap-2 mt-2">
                          <span className={clsx('text-xs px-2 py-0.5 rounded-full', styles.bgLighter, styles.text)}>
                            {getFileExtension(doc.file_name)}
                          </span>
                          {!doc.processed && (
                            <Loader2 className="w-3 h-3 animate-spin text-pastel-sky" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Source details panel */}
        {selectedDoc && (() => {
          const colorName = getFileColor(selectedDoc.file_name, selectedDoc.source_type);
          const styles = colorStyles[colorName] || colorStyles.lavender;

          return (
            <div className="w-1/2 border-l border-neutral-800 flex flex-col overflow-hidden bg-neutral-900/30">
              {/* Colored top bar */}
              <div className={clsx('h-1', styles.bg)} />

              <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-100 truncate">Source Details</h2>
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-dark">
                <div className="flex items-start gap-4">
                  <div className={clsx('w-16 h-16 rounded-xl flex items-center justify-center border', styles.bgLighter, styles.border)}>
                    <File className={clsx('w-8 h-8', styles.text)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-neutral-100">
                      {selectedDoc.processed ? selectedDoc.title : selectedDoc.file_name}
                    </h3>
                    <p className="text-sm text-neutral-500 mt-1">{selectedDoc.file_name}</p>
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
                      {getFileExtension(selectedDoc.file_name)}
                    </p>
                  </div>
                  <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs">Added</span>
                    </div>
                    <p className="text-sm text-neutral-200">
                      {new Date(selectedDoc.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                    <div className="flex items-center gap-2 text-neutral-500 mb-1">
                      <Folder className="w-4 h-4" />
                      <span className="text-xs">Folder</span>
                    </div>
                    <select
                      value={docFolders[selectedDoc.id] || 'new'}
                      onChange={(e) => moveToFolder(selectedDoc.id, e.target.value)}
                      className="text-sm bg-transparent text-neutral-200 focus:outline-none cursor-pointer"
                    >
                      {folders.filter(f => f.id !== 'all').map(folder => (
                        <option key={folder.id} value={folder.id} className="bg-neutral-800">{folder.name}</option>
                      ))}
                    </select>
                  </div>
                  {selectedDoc.topic && (
                    <div className="bg-neutral-800/30 rounded-lg p-3 border border-neutral-800">
                      <div className="flex items-center gap-2 text-neutral-500 mb-1">
                        <Sparkles className="w-4 h-4" />
                        <span className="text-xs">Topic</span>
                      </div>
                      <p className="text-sm text-neutral-200">{selectedDoc.topic}</p>
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
                          <span
                            key={idx}
                            className={clsx('px-3 py-1 text-sm rounded-full border', tagStyle.bgLight, tagStyle.text, tagStyle.border)}
                          >
                            {tag}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {selectedDoc.keywords && selectedDoc.keywords.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-neutral-400 mb-2">Keywords</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDoc.keywords.map((kw, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 text-xs bg-neutral-800 text-neutral-300 rounded border border-neutral-700"
                        >
                          {kw}
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
                        <p className="text-sm text-neutral-200">
                          {new Date(selectedDoc.last_synced).toLocaleString()}
                        </p>
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
                  {selectedDoc.source_type === 'google' && (
                    <button
                      onClick={() => syncMutation.mutate(selectedDoc.id)}
                      disabled={syncMutation.isPending}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-pastel-lavender/15 text-pastel-lavender rounded-lg hover:bg-pastel-lavender/25 transition-all disabled:opacity-50 font-medium"
                    >
                      <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                      {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
                    </button>
                  )}
                  {selectedDoc.file_url && (
                    <a
                      href={selectedDoc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-pastel-sky/15 text-pastel-sky rounded-lg hover:bg-pastel-sky/25 transition-all font-medium"
                    >
                      <ExternalLink className="w-4 h-4" />
                      {selectedDoc.source_type === 'google' ? 'Open in Google Docs' : 'View Original'}
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
  );
}
