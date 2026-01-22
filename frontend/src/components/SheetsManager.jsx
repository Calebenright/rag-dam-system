import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sheet, Plus, Trash2, RefreshCw, ExternalLink, Table2,
  Loader2, X, Check, AlertCircle, FileSpreadsheet
} from 'lucide-react';
import { sheetsApi } from '../api/sheets';
import clsx from 'clsx';

// Color styles
const colorStyles = {
  mint: {
    bg: 'bg-pastel-mint',
    bgLight: 'bg-pastel-mint/10',
    text: 'text-pastel-mint',
    border: 'border-pastel-mint/30',
  },
  sky: {
    bg: 'bg-pastel-sky',
    bgLight: 'bg-pastel-sky/10',
    text: 'text-pastel-sky',
    border: 'border-pastel-sky/30',
  },
  lavender: {
    bg: 'bg-pastel-lavender',
    bgLight: 'bg-pastel-lavender/10',
    text: 'text-pastel-lavender',
    border: 'border-pastel-lavender/30',
  },
};

export default function SheetsManager({ clientId, onSelectSheet, selectedSheetId }) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const queryClient = useQueryClient();

  // Fetch connected sheets
  const { data: sheets = [], isLoading } = useQuery({
    queryKey: ['sheets', clientId],
    queryFn: () => sheetsApi.getConnectedSheets(clientId),
    enabled: !!clientId,
  });

  // Connect sheet mutation
  const connectMutation = useMutation({
    mutationFn: () => sheetsApi.connect(clientId, sheetUrl, sheetName || null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets', clientId] });
      setShowAddModal(false);
      setSheetUrl('');
      setSheetName('');
    },
  });

  // Disconnect sheet mutation
  const disconnectMutation = useMutation({
    mutationFn: (spreadsheetId) => sheetsApi.disconnect(clientId, spreadsheetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets', clientId] });
      if (selectedSheetId) {
        onSelectSheet(null);
      }
    },
  });

  // Refresh sheet info mutation
  const refreshMutation = useMutation({
    mutationFn: (spreadsheetId) => sheetsApi.getSheetInfo(clientId, spreadsheetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sheets', clientId] });
    },
  });

  const handleConnect = (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    // Validate URL
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      alert('Please enter a valid Google Sheets URL');
      return;
    }

    connectMutation.mutate();
  };

  const handleDisconnect = (spreadsheetId, e) => {
    e.stopPropagation();
    if (window.confirm('Disconnect this sheet? You can reconnect it later.')) {
      disconnectMutation.mutate(spreadsheetId);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-pastel-mint" />
            <h3 className="font-semibold text-neutral-200">Google Sheets</h3>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="p-1.5 bg-pastel-mint/10 text-pastel-mint rounded-lg hover:bg-pastel-mint/20 transition-all border border-pastel-mint/20"
            title="Connect a sheet"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-1">
          Connect sheets for AI editing
        </p>
      </div>

      {/* Sheets List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-pastel-lavender" />
          </div>
        ) : sheets.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-neutral-800 flex items-center justify-center">
              <Sheet className="w-6 h-6 text-neutral-600" />
            </div>
            <p className="text-sm text-neutral-500">No sheets connected</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 text-xs text-pastel-mint hover:text-pastel-mint/80"
            >
              + Connect your first sheet
            </button>
          </div>
        ) : (
          sheets.map((sheet, idx) => {
            const colors = ['mint', 'sky', 'lavender'];
            const colorName = colors[idx % colors.length];
            const styles = colorStyles[colorName];
            const isSelected = selectedSheetId === sheet.spreadsheet_id;

            return (
              <div
                key={sheet.id}
                onClick={() => onSelectSheet(isSelected ? null : sheet.spreadsheet_id)}
                className={clsx(
                  'p-3 rounded-lg border cursor-pointer transition-all',
                  isSelected
                    ? `${styles.bgLight} ${styles.border}`
                    : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', styles.bgLight)}>
                      <Table2 className={clsx('w-4 h-4', styles.text)} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-200 truncate">
                        {sheet.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {sheet.sheet_tabs?.length || 0} tabs
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        refreshMutation.mutate(sheet.spreadsheet_id);
                      }}
                      className="p-1 text-neutral-500 hover:text-pastel-sky rounded transition-all"
                      title="Refresh"
                    >
                      <RefreshCw className={clsx(
                        'w-3.5 h-3.5',
                        refreshMutation.isPending && 'animate-spin'
                      )} />
                    </button>
                    <a
                      href={sheet.sheet_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1 text-neutral-500 hover:text-pastel-mint rounded transition-all"
                      title="Open in Google Sheets"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={(e) => handleDisconnect(sheet.spreadsheet_id, e)}
                      className="p-1 text-neutral-500 hover:text-pastel-coral rounded transition-all"
                      title="Disconnect"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tabs preview */}
                {isSelected && sheet.sheet_tabs && sheet.sheet_tabs.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-neutral-700/50">
                    <div className="flex flex-wrap gap-1">
                      {sheet.sheet_tabs.slice(0, 5).map((tab, tabIdx) => (
                        <span
                          key={tabIdx}
                          className="px-2 py-0.5 text-[10px] bg-neutral-800 text-neutral-400 rounded"
                        >
                          {tab.title}
                        </span>
                      ))}
                      {sheet.sheet_tabs.length > 5 && (
                        <span className="px-2 py-0.5 text-[10px] bg-neutral-800 text-neutral-500 rounded">
                          +{sheet.sheet_tabs.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Sheet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 w-full max-w-md m-4">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="font-semibold text-neutral-200">Connect Google Sheet</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-neutral-500 hover:text-neutral-300 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConnect} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Google Sheets URL
                </label>
                <input
                  type="url"
                  value={sheetUrl}
                  onChange={(e) => setSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-mint/50 focus:border-pastel-mint text-sm"
                  required
                />
                <p className="text-xs text-neutral-500 mt-1">
                  The sheet must be shared with edit access to our service account
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-1.5">
                  Display Name (optional)
                </label>
                <input
                  type="text"
                  value={sheetName}
                  onChange={(e) => setSheetName(e.target.value)}
                  placeholder="My Sales Data"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-mint/50 focus:border-pastel-mint text-sm"
                />
              </div>

              {connectMutation.isError && (
                <div className="flex items-center gap-2 p-3 bg-pastel-coral/10 border border-pastel-coral/20 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-pastel-coral flex-shrink-0" />
                  <p className="text-sm text-pastel-coral">
                    {connectMutation.error?.response?.data?.error || 'Failed to connect sheet'}
                  </p>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending || !sheetUrl.trim()}
                  className="px-4 py-2 bg-pastel-mint/15 text-pastel-mint rounded-lg hover:bg-pastel-mint/25 transition-all disabled:opacity-50 text-sm font-medium flex items-center gap-2 border border-pastel-mint/25"
                >
                  {connectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Connect Sheet
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
