import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Users, Mail, Phone, Play, Loader2, CheckCircle2, XCircle,
  AlertCircle, RefreshCw, ChevronDown, Table2, FileSpreadsheet,
  Plus, ExternalLink, Zap, Shield, X, Trash2, Power, Square
} from 'lucide-react';
import { leadsApi } from '../api/leads';
import clsx from 'clsx';

// Color styles matching the app theme
const colorStyles = {
  coral: {
    bg: 'bg-pastel-coral',
    bgLight: 'bg-pastel-coral/10',
    text: 'text-pastel-coral',
    border: 'border-pastel-coral/30',
  },
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
  peach: {
    bg: 'bg-pastel-peach',
    bgLight: 'bg-pastel-peach/10',
    text: 'text-pastel-peach',
    border: 'border-pastel-peach/30',
  },
};

// Status badge component with toggle control
function StatusBadge({ available, label, onStart, onStop, isLoading }) {
  return (
    <div className={clsx(
      'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all',
      available
        ? 'bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/20'
        : 'bg-pastel-coral/15 text-pastel-coral border border-pastel-coral/20'
    )}>
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : available ? (
        <CheckCircle2 className="w-3 h-3" />
      ) : (
        <XCircle className="w-3 h-3" />
      )}
      {label}
      <button
        onClick={available ? onStop : onStart}
        disabled={isLoading}
        className={clsx(
          'ml-1 p-0.5 rounded transition-all',
          available
            ? 'hover:bg-pastel-coral/20 text-pastel-mint hover:text-pastel-coral'
            : 'hover:bg-pastel-mint/20 text-pastel-coral hover:text-pastel-mint',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        title={available ? `Stop ${label}` : `Start ${label}`}
      >
        {available ? (
          <Square className="w-3 h-3" />
        ) : (
          <Power className="w-3 h-3" />
        )}
      </button>
    </div>
  );
}

// Column selector component
function ColumnSelector({ columns, selected, onChange, label, icon: Icon }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <label className="block text-xs font-medium text-neutral-400 mb-1.5">
        {label}
      </label>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'w-full flex items-center justify-between px-3 py-2 bg-neutral-800 border rounded-lg text-sm transition-all',
          selected
            ? 'border-pastel-lavender/50 text-neutral-200'
            : 'border-neutral-700 text-neutral-500'
        )}
      >
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4" />
          {selected ? (
            <span>
              Column {selected.letter}: {selected.header}
            </span>
          ) : (
            <span>Select column...</span>
          )}
        </div>
        <ChevronDown className={clsx('w-4 h-4 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl max-h-64 overflow-y-auto">
          <button
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className="w-full px-3 py-2 text-left text-sm text-neutral-400 hover:bg-neutral-700/50 transition-colors"
          >
            None (skip)
          </button>
          {columns.map((col) => (
            <button
              key={col.letter}
              onClick={() => {
                onChange(col);
                setIsOpen(false);
              }}
              className={clsx(
                'w-full px-3 py-2 text-left hover:bg-neutral-700/50 transition-colors',
                selected?.letter === col.letter && 'bg-pastel-lavender/10'
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-neutral-200">
                    {col.letter}: {col.header}
                  </span>
                  <div className="text-xs text-neutral-500 mt-0.5">
                    {col.preview.slice(0, 2).filter(Boolean).join(', ') || 'No data'}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Progress bar component
function ProgressBar({ current, total, label, color = 'lavender' }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
  const styles = colorStyles[color];

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className={styles.text}>{current} / {total}</span>
      </div>
      <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
        <div
          className={clsx('h-full transition-all duration-300', styles.bg)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Verification log item
function LogItem({ type, value, status, statusCode }) {
  const getStatusColor = () => {
    if (statusCode === 'safe' || statusCode === 'valid' || statusCode === 'mobile') return 'text-pastel-mint';
    if (statusCode === 'risky' || statusCode === 'catch_all' || statusCode === 'voip') return 'text-pastel-peach';
    if (statusCode === 'invalid' || statusCode === 'error' || statusCode === 'not_in_service') return 'text-pastel-coral';
    return 'text-neutral-400';
  };

  return (
    <div className="flex items-center justify-between py-1.5 px-2 text-xs border-b border-neutral-800/50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {type === 'email' ? (
          <Mail className="w-3 h-3 text-pastel-sky flex-shrink-0" />
        ) : (
          <Phone className="w-3 h-3 text-pastel-mint flex-shrink-0" />
        )}
        <span className="text-neutral-300 truncate">{value || '(empty)'}</span>
      </div>
      <span className={clsx('flex-shrink-0 ml-2', getStatusColor())}>{status}</span>
    </div>
  );
}

export default function LeadsManager() {
  const queryClient = useQueryClient();
  const [selectedSheet, setSelectedSheet] = useState(null);
  const [selectedTab, setSelectedTab] = useState(null);
  const [emailColumn, setEmailColumn] = useState(null);
  const [phoneColumn, setPhoneColumn] = useState(null);
  const [useNumVerify, setUseNumVerify] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationLog, setVerificationLog] = useState([]);
  const [progress, setProgress] = useState({ email: null, phone: null });
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const logContainerRef = useRef(null);

  // Fetch backend status
  const { data: backendStatus, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['leads-backend-status'],
    queryFn: leadsApi.getStatus,
    refetchInterval: 30000,
  });

  // Backend control mutations
  const startEmailMutation = useMutation({
    mutationFn: leadsApi.startEmailBackend,
    onSuccess: () => refetchStatus(),
  });

  const stopEmailMutation = useMutation({
    mutationFn: leadsApi.stopEmailBackend,
    onSuccess: () => refetchStatus(),
  });

  const startPhoneMutation = useMutation({
    mutationFn: leadsApi.startPhoneBackend,
    onSuccess: () => refetchStatus(),
  });

  const stopPhoneMutation = useMutation({
    mutationFn: leadsApi.stopPhoneBackend,
    onSuccess: () => refetchStatus(),
  });

  // Fetch leads sheets (separate from regular connected sheets)
  const { data: sheets = [], isLoading: isLoadingSheets } = useQuery({
    queryKey: ['leads-sheets'],
    queryFn: leadsApi.getSheets,
  });

  // Fetch sheet preview when sheet is selected
  const { data: preview, isLoading: isLoadingPreview } = useQuery({
    queryKey: ['leads-preview', selectedSheet, selectedTab],
    queryFn: () => leadsApi.getSheetPreview(selectedSheet, selectedTab),
    enabled: !!selectedSheet,
  });

  // Connect sheet mutation
  const connectMutation = useMutation({
    mutationFn: () => leadsApi.connectSheet(sheetUrl, sheetName || null),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads-sheets'] });
      setShowConnectModal(false);
      setSheetUrl('');
      setSheetName('');
      setSelectedSheet(data.spreadsheet_id);
    },
  });

  // Disconnect sheet mutation
  const disconnectMutation = useMutation({
    mutationFn: (spreadsheetId) => leadsApi.disconnectSheet(spreadsheetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-sheets'] });
      if (selectedSheet) {
        setSelectedSheet(null);
      }
    },
  });

  // Refresh sheet mutation
  const refreshMutation = useMutation({
    mutationFn: (spreadsheetId) => leadsApi.getSheetInfo(spreadsheetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads-sheets'] });
    },
  });

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [verificationLog]);

  // Reset column selections when sheet changes
  useEffect(() => {
    setEmailColumn(null);
    setPhoneColumn(null);
  }, [selectedSheet, selectedTab]);

  const handleStartVerification = async () => {
    if (!selectedSheet || (!emailColumn && !phoneColumn)) return;

    setIsVerifying(true);
    setVerificationLog([]);
    setProgress({ email: null, phone: null });

    try {
      const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const params = new URLSearchParams();
      if (selectedTab) params.append('sheetName', selectedTab);
      if (emailColumn) params.append('emailColumn', emailColumn.letter);
      if (phoneColumn) params.append('phoneColumn', phoneColumn.letter);
      if (useNumVerify) params.append('useNumVerify', 'true');

      const eventSource = new EventSource(
        `${baseUrl}/api/leads/${selectedSheet}/verify-stream?${params.toString()}`
      );

      eventSource.addEventListener('start', (e) => {
        const data = JSON.parse(e.data);
        setVerificationLog(prev => [...prev, { type: 'info', message: `Starting verification on ${data.sheet}...` }]);
      });

      eventSource.addEventListener('info', (e) => {
        const data = JSON.parse(e.data);
        setVerificationLog(prev => [...prev, { type: 'info', message: data.message }]);
      });

      eventSource.addEventListener('quota_wait', (e) => {
        const data = JSON.parse(e.data);
        setVerificationLog(prev => [...prev, { type: 'warning', message: data.message }]);
      });

      eventSource.addEventListener('email_start', (e) => {
        const data = JSON.parse(e.data);
        setProgress(prev => ({ ...prev, email: { current: 0, total: data.total } }));
        setVerificationLog(prev => [...prev, { type: 'info', message: `Verifying ${data.total} emails...` }]);
      });

      eventSource.addEventListener('email_progress', (e) => {
        const data = JSON.parse(e.data);
        // Don't update progress for skipped items
        if (!data.skipped) {
          setProgress(prev => ({ ...prev, email: { current: data.current, total: data.total } }));
        }
        // Don't log skipped items to keep the log clean
        if (!data.skipped) {
          setVerificationLog(prev => [...prev, {
            type: 'email',
            value: data.email,
            status: data.status,
            statusCode: data.statusCode,
          }]);
        }
      });

      eventSource.addEventListener('email_complete', (e) => {
        const data = JSON.parse(e.data);
        const skippedMsg = data.skipped > 0 ? ` (${data.skipped} already verified)` : '';
        setVerificationLog(prev => [...prev, {
          type: 'success',
          message: `Email verification complete! ${data.processed} processed${skippedMsg}, results in column ${data.resultColumn}`,
        }]);
      });

      eventSource.addEventListener('phone_start', (e) => {
        const data = JSON.parse(e.data);
        setProgress(prev => ({ ...prev, phone: { current: 0, total: data.total } }));
        setVerificationLog(prev => [...prev, { type: 'info', message: `Verifying ${data.total} phone numbers...` }]);
      });

      eventSource.addEventListener('phone_progress', (e) => {
        const data = JSON.parse(e.data);
        // Don't update progress for skipped items
        if (!data.skipped) {
          setProgress(prev => ({ ...prev, phone: { current: data.current, total: data.total } }));
        }
        // Don't log skipped items to keep the log clean
        if (!data.skipped) {
          setVerificationLog(prev => [...prev, {
            type: 'phone',
            value: data.phone,
            status: data.status,
            statusCode: data.statusCode,
          }]);
        }
      });

      eventSource.addEventListener('phone_complete', (e) => {
        const data = JSON.parse(e.data);
        const skippedMsg = data.skipped > 0 ? ` (${data.skipped} already verified)` : '';
        setVerificationLog(prev => [...prev, {
          type: 'success',
          message: `Phone verification complete! ${data.processed} processed${skippedMsg}, results in column ${data.resultColumn}`,
        }]);
      });

      eventSource.addEventListener('complete', () => {
        setIsVerifying(false);
        eventSource.close();
        queryClient.invalidateQueries({ queryKey: ['leads-preview', selectedSheet, selectedTab] });
      });

      eventSource.addEventListener('error', (e) => {
        if (e.data) {
          const data = JSON.parse(e.data);
          setVerificationLog(prev => [...prev, { type: 'error', message: data.message }]);
        }
        setIsVerifying(false);
        eventSource.close();
      });

      eventSource.onerror = () => {
        setIsVerifying(false);
        eventSource.close();
      };
    } catch (error) {
      setVerificationLog(prev => [...prev, { type: 'error', message: error.message }]);
      setIsVerifying(false);
    }
  };

  const handleConnect = (e) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;
    if (!sheetUrl.includes('docs.google.com/spreadsheets')) {
      alert('Please enter a valid Google Sheets URL');
      return;
    }
    connectMutation.mutate();
  };

  const handleDisconnect = (spreadsheetId, e) => {
    e.stopPropagation();
    if (window.confirm('Disconnect this leads sheet?')) {
      disconnectMutation.mutate(spreadsheetId);
    }
  };

  const selectedSheetData = sheets.find(s => s.spreadsheet_id === selectedSheet);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pastel-coral/15 flex items-center justify-center border border-pastel-coral/20">
              <Users className="w-5 h-5 text-pastel-coral" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-neutral-100">Leads Verification</h2>
              <p className="text-xs text-neutral-500">Verify emails and phone numbers in Google Sheets</p>
            </div>
          </div>

          {/* Backend Status */}
          <div className="flex items-center gap-2">
            {isLoadingStatus ? (
              <Loader2 className="w-4 h-4 animate-spin text-neutral-500" />
            ) : (
              <>
                <StatusBadge
                  available={backendStatus?.email?.available}
                  label="Email"
                  onStart={() => startEmailMutation.mutate()}
                  onStop={() => stopEmailMutation.mutate()}
                  isLoading={startEmailMutation.isPending || stopEmailMutation.isPending}
                />
                <StatusBadge
                  available={backendStatus?.phone?.available}
                  label="Phone"
                  onStart={() => startPhoneMutation.mutate()}
                  onStop={() => stopPhoneMutation.mutate()}
                  isLoading={startPhoneMutation.isPending || stopPhoneMutation.isPending}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Sheet Selection & Configuration */}
        <div className="w-80 border-r border-neutral-800 flex flex-col bg-neutral-900/20">
          {/* Sheet Selector */}
          <div className="p-4 border-b border-neutral-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-neutral-300">Leads Sheets</h3>
              <button
                onClick={() => setShowConnectModal(true)}
                className="p-1.5 bg-pastel-mint/10 text-pastel-mint rounded-lg hover:bg-pastel-mint/20 transition-all border border-pastel-mint/20"
                title="Connect a sheet"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLoadingSheets ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-pastel-lavender" />
              </div>
            ) : sheets.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-neutral-800 flex items-center justify-center">
                  <FileSpreadsheet className="w-6 h-6 text-neutral-600" />
                </div>
                <p className="text-sm text-neutral-500 mb-2">No leads sheets connected</p>
                <button
                  onClick={() => setShowConnectModal(true)}
                  className="text-xs text-pastel-mint hover:text-pastel-mint/80"
                >
                  + Connect a Google Sheet
                </button>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {sheets.map((sheet, idx) => {
                  const colors = ['coral', 'mint', 'sky', 'lavender'];
                  const colorName = colors[idx % colors.length];
                  const styles = colorStyles[colorName];
                  const isSelected = selectedSheet === sheet.spreadsheet_id;

                  return (
                    <div
                      key={sheet.id}
                      onClick={() => {
                        setSelectedSheet(sheet.spreadsheet_id);
                        setSelectedTab(sheet.sheet_tabs?.[0]?.title || null);
                      }}
                      className={clsx(
                        'p-2.5 rounded-lg border cursor-pointer transition-all',
                        isSelected
                          ? `${styles.bgLight} ${styles.border}`
                          : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-700'
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <Table2 className={clsx('w-4 h-4 flex-shrink-0', isSelected ? styles.text : 'text-neutral-500')} />
                          <span className={clsx('text-sm truncate', isSelected ? 'text-neutral-200' : 'text-neutral-400')}>
                            {sheet.name}
                          </span>
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
                              'w-3 h-3',
                              refreshMutation.isPending && 'animate-spin'
                            )} />
                          </button>
                          <button
                            onClick={(e) => handleDisconnect(sheet.spreadsheet_id, e)}
                            className="p-1 text-neutral-500 hover:text-pastel-coral rounded transition-all"
                            title="Disconnect"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab selector for selected sheet */}
            {selectedSheetData?.sheet_tabs?.length > 1 && (
              <div className="mt-3 pt-3 border-t border-neutral-800">
                <label className="block text-xs font-medium text-neutral-400 mb-1.5">Sheet Tab</label>
                <div className="flex flex-wrap gap-1">
                  {selectedSheetData.sheet_tabs.map((tab) => (
                    <button
                      key={tab.sheetId}
                      onClick={() => setSelectedTab(tab.title)}
                      className={clsx(
                        'px-2 py-1 text-xs rounded-md transition-all',
                        selectedTab === tab.title
                          ? 'bg-pastel-lavender/20 text-pastel-lavender border border-pastel-lavender/30'
                          : 'bg-neutral-800 text-neutral-400 hover:text-neutral-300'
                      )}
                    >
                      {tab.title}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Column Selection */}
          {selectedSheet && (
            <div className="p-4 flex-1 overflow-y-auto">
              <h3 className="text-sm font-medium text-neutral-300 mb-3">Configure Columns</h3>

              {isLoadingPreview ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-pastel-lavender" />
                </div>
              ) : preview?.columns ? (
                <div className="space-y-4">
                  <ColumnSelector
                    columns={preview.columns}
                    selected={emailColumn}
                    onChange={setEmailColumn}
                    label="Email Column"
                    icon={Mail}
                  />

                  <ColumnSelector
                    columns={preview.columns}
                    selected={phoneColumn}
                    onChange={setPhoneColumn}
                    label="Phone Column"
                    icon={Phone}
                  />

                  {phoneColumn && (
                    <div className="flex items-center gap-2 p-2 bg-neutral-800/50 rounded-lg border border-neutral-700">
                      <input
                        type="checkbox"
                        id="useNumVerify"
                        checked={useNumVerify}
                        onChange={(e) => setUseNumVerify(e.target.checked)}
                        className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-pastel-lavender focus:ring-pastel-lavender/50"
                      />
                      <label htmlFor="useNumVerify" className="flex-1">
                        <span className="text-sm text-neutral-300">Use NumVerify API</span>
                        <p className="text-xs text-neutral-500">Get carrier & line type info (slower)</p>
                      </label>
                      <Zap className="w-4 h-4 text-pastel-peach" />
                    </div>
                  )}

                  <div className="pt-2 text-xs text-neutral-500">
                    {preview.totalRows} rows to process
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Action Button */}
          {selectedSheet && (
            <div className="p-4 border-t border-neutral-800">
              <button
                onClick={handleStartVerification}
                disabled={isVerifying || (!emailColumn && !phoneColumn) ||
                  (emailColumn && !backendStatus?.email?.available) ||
                  (phoneColumn && !useNumVerify && !backendStatus?.phone?.available)}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
                  isVerifying
                    ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                    : 'bg-pastel-coral/15 text-pastel-coral hover:bg-pastel-coral/25 border border-pastel-coral/25'
                )}
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Verification
                  </>
                )}
              </button>

              {(!backendStatus?.email?.available || !backendStatus?.phone?.available) && (
                <p className="mt-2 text-xs text-pastel-coral/80 text-center">
                  Some backends are offline
                </p>
              )}
            </div>
          )}
        </div>

        {/* Right Panel - Progress & Log */}
        <div className="flex-1 flex flex-col bg-neutral-950">
          {/* Progress Section */}
          {(progress.email || progress.phone) && (
            <div className="p-4 border-b border-neutral-800 space-y-3">
              {progress.email && (
                <ProgressBar
                  current={progress.email.current}
                  total={progress.email.total}
                  label="Email Verification"
                  color="sky"
                />
              )}
              {progress.phone && (
                <ProgressBar
                  current={progress.phone.current}
                  total={progress.phone.total}
                  label="Phone Verification"
                  color="mint"
                />
              )}
            </div>
          )}

          {/* Verification Log */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
              <h3 className="text-sm font-medium text-neutral-400">Verification Log</h3>
              {verificationLog.length > 0 && (
                <button
                  onClick={() => setVerificationLog([])}
                  className="text-xs text-neutral-500 hover:text-neutral-300"
                >
                  Clear
                </button>
              )}
            </div>

            <div
              ref={logContainerRef}
              className="flex-1 overflow-y-auto p-2"
            >
              {verificationLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-neutral-500">
                  <Shield className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm">Select columns and start verification</p>
                  <p className="text-xs mt-1">Results will appear here</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {verificationLog.map((log, idx) => {
                    if (log.type === 'info') {
                      return (
                        <div key={idx} className="py-1.5 px-2 text-xs text-pastel-sky">
                          {log.message}
                        </div>
                      );
                    }
                    if (log.type === 'success') {
                      return (
                        <div key={idx} className="py-1.5 px-2 text-xs text-pastel-mint flex items-center gap-1.5">
                          <CheckCircle2 className="w-3 h-3" />
                          {log.message}
                        </div>
                      );
                    }
                    if (log.type === 'error') {
                      return (
                        <div key={idx} className="py-1.5 px-2 text-xs text-pastel-coral flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          {log.message}
                        </div>
                      );
                    }
                    if (log.type === 'warning') {
                      return (
                        <div key={idx} className="py-1.5 px-2 text-xs text-pastel-peach flex items-center gap-1.5">
                          <AlertCircle className="w-3 h-3" />
                          {log.message}
                        </div>
                      );
                    }
                    return (
                      <LogItem
                        key={idx}
                        type={log.type}
                        value={log.value}
                        status={log.status}
                        statusCode={log.statusCode}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Open in Sheets button */}
          {selectedSheetData && (
            <div className="p-3 border-t border-neutral-800">
              <a
                href={selectedSheetData.sheet_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-sm transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                Open in Google Sheets
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Connect Sheet Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-neutral-900 rounded-xl border border-neutral-800 w-full max-w-md m-4">
            <div className="flex items-center justify-between p-4 border-b border-neutral-800">
              <h3 className="font-semibold text-neutral-200">Connect Leads Sheet</h3>
              <button
                onClick={() => setShowConnectModal(false)}
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
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-coral/50 focus:border-pastel-coral text-sm"
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
                  placeholder="My Leads Sheet"
                  className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-coral/50 focus:border-pastel-coral text-sm"
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
                  onClick={() => setShowConnectModal(false)}
                  className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending || !sheetUrl.trim()}
                  className="px-4 py-2 bg-pastel-coral/15 text-pastel-coral rounded-lg hover:bg-pastel-coral/25 transition-all disabled:opacity-50 text-sm font-medium flex items-center gap-2 border border-pastel-coral/25"
                >
                  {connectMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
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
