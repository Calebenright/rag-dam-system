import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Bug, Send, CheckCircle, AlertTriangle, Plus, ChevronDown, Clock, Circle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/axios';

const CATEGORIES = [
  { value: 'bug', label: 'Bug' },
  { value: 'ui', label: 'UI / Visual' },
  { value: 'performance', label: 'Performance' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'other', label: 'Other' },
];

const SEVERITIES = [
  { value: 'low', label: 'Low', desc: 'Minor issue, workaround exists' },
  { value: 'medium', label: 'Medium', desc: 'Impacts workflow but not blocking' },
  { value: 'high', label: 'High', desc: 'Blocking or causes data issues' },
];

const STATUSES = [
  { value: 'open', label: 'Open', icon: Circle, color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
  { value: 'in_progress', label: 'In Progress', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/20' },
  { value: 'closed', label: 'Closed', icon: XCircle, color: 'text-neutral-500', bg: 'bg-neutral-500/10', border: 'border-neutral-500/20' },
];

const SEVERITY_STYLES = {
  high: { color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' },
  medium: { color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
  low: { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
};

const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label]));

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function StatusDropdown({ bug, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  const current = STATUSES.find((s) => s.value === bug.status) || STATUSES[0];
  const Icon = current.icon;

  const handleSelect = async (status) => {
    setOpen(false);
    if (status === bug.status) return;
    setUpdating(true);
    try {
      await api.patch(`/api/bugs/${bug.id}`, { status });
      onUpdate(bug.id, { status });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${current.bg} ${current.border} ${current.color} hover:brightness-125`}
      >
        {updating ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <Icon className="w-3 h-3" />
        )}
        {current.label}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 w-40 bg-neutral-900 border border-neutral-700 rounded-lg shadow-xl overflow-hidden">
            {STATUSES.map((s) => {
              const SIcon = s.icon;
              return (
                <button
                  key={s.value}
                  onClick={(e) => { e.stopPropagation(); handleSelect(s.value); }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors hover:bg-neutral-800 ${
                    s.value === bug.status ? 'bg-neutral-800/50' : ''
                  }`}
                >
                  <SIcon className={`w-3.5 h-3.5 ${s.color}`} />
                  <span className="text-neutral-200">{s.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function BugRow({ bug, onUpdate, isExpanded, onToggle }) {
  const sevStyle = SEVERITY_STYLES[bug.severity] || SEVERITY_STYLES.medium;

  return (
    <div className="border border-neutral-800 rounded-lg overflow-hidden transition-colors hover:border-neutral-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${sevStyle.bg} ${sevStyle.border} ${sevStyle.color}`}>
              {bug.severity}
            </span>
            <span className="text-[10px] text-neutral-600 font-medium uppercase">
              {CATEGORY_LABELS[bug.category] || bug.category}
            </span>
          </div>
          <h3 className="text-sm font-medium text-neutral-200 truncate">{bug.title}</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            {bug.reporter_email?.split('@')[0] || 'Unknown'} &middot; {timeAgo(bug.created_at)}
          </p>
        </div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusDropdown bug={bug} onUpdate={onUpdate} />
        </div>
      </button>
      {isExpanded && (
        <div className="px-4 pb-4 pt-1 border-t border-neutral-800/50 space-y-3">
          <div>
            <p className="text-xs font-medium text-neutral-400 mb-1">Description</p>
            <p className="text-sm text-neutral-300 whitespace-pre-wrap">{bug.description}</p>
          </div>
          {bug.steps_to_reproduce && (
            <div>
              <p className="text-xs font-medium text-neutral-400 mb-1">Steps to Reproduce</p>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">{bug.steps_to_reproduce}</p>
            </div>
          )}
          {bug.expected_behavior && (
            <div>
              <p className="text-xs font-medium text-neutral-400 mb-1">Expected Behavior</p>
              <p className="text-sm text-neutral-300 whitespace-pre-wrap">{bug.expected_behavior}</p>
            </div>
          )}
          {bug.current_url && (
            <p className="text-[11px] text-neutral-600">URL: {bug.current_url}</p>
          )}
        </div>
      )}
    </div>
  );
}

function BugList() {
  const [bugs, setBugs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [expandedId, setExpandedId] = useState(null);

  const fetchBugs = useCallback(async () => {
    try {
      const { data } = await api.get('/api/bugs');
      setBugs(data.data || []);
    } catch (err) {
      console.error('Failed to fetch bugs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBugs(); }, [fetchBugs]);

  const handleUpdate = (id, updates) => {
    setBugs((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const filtered = filterStatus === 'all' ? bugs : bugs.filter((b) => b.status === filterStatus);

  const counts = {
    all: bugs.length,
    open: bugs.filter((b) => b.status === 'open').length,
    in_progress: bugs.filter((b) => b.status === 'in_progress').length,
    resolved: bugs.filter((b) => b.status === 'resolved').length,
    closed: bugs.filter((b) => b.status === 'closed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-500" />
      </div>
    );
  }

  if (bugs.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-neutral-800/50 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-neutral-600" />
        </div>
        <p className="text-sm text-neutral-500">No bug reports yet</p>
      </div>
    );
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {[{ value: 'all', label: 'All' }, ...STATUSES].map((s) => (
          <button
            key={s.value}
            onClick={() => setFilterStatus(s.value)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
              filterStatus === s.value
                ? 'bg-neutral-800 text-neutral-200'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }`}
          >
            {s.label}
            <span className={`text-[10px] ${filterStatus === s.value ? 'text-neutral-400' : 'text-neutral-600'}`}>
              {counts[s.value] || 0}
            </span>
          </button>
        ))}
      </div>

      {/* Bug list */}
      <div className="space-y-2">
        {filtered.map((bug) => (
          <BugRow
            key={bug.id}
            bug={bug}
            onUpdate={handleUpdate}
            isExpanded={expandedId === bug.id}
            onToggle={() => setExpandedId(expandedId === bug.id ? null : bug.id)}
          />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-neutral-600 text-center py-8">
            No {filterStatus.replace('_', ' ')} reports
          </p>
        )}
      </div>
    </div>
  );
}

function SubmitForm({ onSuccess }) {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    category: 'bug',
    severity: 'medium',
    description: '',
    steps_to_reproduce: '',
    expected_behavior: '',
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await api.post('/api/bugs', {
        ...form,
        reporter_email: user?.email || 'unknown',
        current_url: window.location.href,
        user_agent: navigator.userAgent,
      });
      setForm({ title: '', category: 'bug', severity: 'medium', description: '', steps_to_reproduce: '', expected_behavior: '' });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Title <span className="text-red-400">*</span>
        </label>
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          required
          placeholder="Brief summary of the issue"
          className="w-full px-3.5 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
        />
      </div>

      {/* Category + Severity row */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Category</label>
          <select
            name="category"
            value={form.category}
            onChange={handleChange}
            className="w-full px-3.5 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-200 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-300 mb-1.5">Severity</label>
          <div className="flex gap-1.5">
            {SEVERITIES.map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, severity: s.value }))}
                title={s.desc}
                className={`flex-1 px-2 py-2.5 rounded-lg text-xs font-medium transition-all border ${
                  form.severity === s.value
                    ? s.value === 'high'
                      ? 'bg-red-500/15 border-red-500/30 text-red-400'
                      : s.value === 'medium'
                      ? 'bg-orange-500/15 border-orange-500/30 text-orange-400'
                      : 'bg-blue-500/15 border-blue-500/30 text-blue-400'
                    : 'bg-neutral-900/50 border-neutral-800 text-neutral-500 hover:text-neutral-300 hover:border-neutral-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          What happened? <span className="text-red-400">*</span>
        </label>
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          required
          rows={4}
          placeholder="Describe the issue in detail..."
          className="w-full px-3.5 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none"
        />
      </div>

      {/* Steps to reproduce */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          Steps to reproduce
          <span className="text-neutral-600 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          name="steps_to_reproduce"
          value={form.steps_to_reproduce}
          onChange={handleChange}
          rows={3}
          placeholder={"1. Go to...\n2. Click on...\n3. See error..."}
          className="w-full px-3.5 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none"
        />
      </div>

      {/* Expected behavior */}
      <div>
        <label className="block text-sm font-medium text-neutral-300 mb-1.5">
          What did you expect?
          <span className="text-neutral-600 font-normal ml-1">(optional)</span>
        </label>
        <textarea
          name="expected_behavior"
          value={form.expected_behavior}
          onChange={handleChange}
          rows={2}
          placeholder="What should have happened instead..."
          className="w-full px-3.5 py-2.5 bg-neutral-900/50 border border-neutral-800 rounded-lg text-sm text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors resize-none"
        />
      </div>

      {/* Error message */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {/* Submit */}
      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting || !form.title || !form.description}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {submitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Submit Report
            </>
          )}
        </button>
      </div>
    </form>
  );
}

export default function BugReport() {
  const [view, setView] = useState('list'); // 'list' or 'submit'
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmitSuccess = () => {
    setView('list');
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-200">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-neutral-300 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Bug className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-50">Bug Reports</h1>
              <p className="text-sm text-neutral-500">Track and manage reported issues</p>
            </div>
          </div>
          <button
            onClick={() => setView(view === 'list' ? 'submit' : 'list')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === 'submit'
                ? 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {view === 'submit' ? (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                View Reports
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                New Report
              </>
            )}
          </button>
        </div>

        {/* Content */}
        {view === 'submit' ? (
          <SubmitForm onSuccess={handleSubmitSuccess} />
        ) : (
          <BugList key={refreshKey} />
        )}
      </div>
    </div>
  );
}
