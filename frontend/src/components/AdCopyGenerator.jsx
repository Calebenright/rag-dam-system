import { useState, useCallback, useMemo, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  Megaphone, Monitor, Linkedin, Globe, Upload, Link2, Image, Sparkles,
  Loader2, ArrowLeft, Copy, Check, X, FileText, ThumbsUp, ThumbsDown, SlidersHorizontal, History, Trash2, MessageCircle, Sheet, ExternalLink
} from 'lucide-react';
import { adgenApi } from '../api/adgen';
import { AD_FORMATS } from '../constants/adFormats';
import { AD_STYLE_OPTIONS, getDefaultStyleConfig } from '../constants/adStyleConfig';
import {
  CopyableField, GoogleAdPreview, MetaAdPreview, LinkedInAdPreview, RedditAdPreview
} from './shared/AdPreviewComponents';
import clsx from 'clsx';

const PLATFORMS = [
  { id: 'google', label: 'Google', icon: Monitor },
  { id: 'meta', label: 'Meta', icon: Globe },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'reddit', label: 'Reddit', icon: MessageCircle },
];

const STORAGE_KEY = (id) => `adgen-inputs-${id}`;
const HISTORY_KEY = (id) => `adgen-history-${id}`;
const MAX_HISTORY = 20;

function loadSaved(clientId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY(clientId));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadHistory(clientId) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY(clientId));
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveToHistory(clientId, entry) {
  const history = loadHistory(clientId);
  history.unshift(entry);
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
  localStorage.setItem(HISTORY_KEY(clientId), JSON.stringify(history));
  return history;
}

export default function AdCopyGenerator({ clientId }) {
  const saved = useMemo(() => loadSaved(clientId), [clientId]);

  const [mode, setMode] = useState('input');
  const [platform, setPlatform] = useState(saved?.platform || 'google');
  const [url, setUrl] = useState(saved?.url || '');
  const [images, setImages] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);
  const [variationCount, setVariationCount] = useState(saved?.variationCount || 2);
  const [styleConfig, setStyleConfig] = useState(() => {
    return saved?.styleConfig || getDefaultStyleConfig();
  });
  const [positiveWords, setPositiveWords] = useState(saved?.positiveWords || '');
  const [negativeWords, setNegativeWords] = useState(saved?.negativeWords || '');
  const [customPrompt, setCustomPrompt] = useState(saved?.customPrompt || '');
  const [results, setResults] = useState(null);
  const [activeVariation, setActiveVariation] = useState(0);
  const [overrides, setOverrides] = useState({});
  const [regeneratingField, setRegeneratingField] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [error, setError] = useState(null);
  const [history, setHistory] = useState(() => loadHistory(clientId));
  const [showHistory, setShowHistory] = useState(false);
  const [pushingToSheet, setPushingToSheet] = useState(false);
  const [pushedToSheet, setPushedToSheet] = useState(false);

  // Persist inputs to localStorage (debounced via effect)
  useEffect(() => {
    const data = { platform, url, variationCount, styleConfig, positiveWords, negativeWords, customPrompt };
    localStorage.setItem(STORAGE_KEY(clientId), JSON.stringify(data));
  }, [clientId, platform, url, variationCount, styleConfig, positiveWords, negativeWords, customPrompt]);

  // Current platform's format spec
  const formatSpec = AD_FORMATS[platform];

  const onDrop = useCallback((acceptedFiles) => {
    const newImages = [...images, ...acceptedFiles].slice(0, 5);
    setImages(newImages);
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    setImagePreviews(prev => {
      prev.forEach(u => URL.revokeObjectURL(u));
      return newPreviews;
    });
  }, [images]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'] },
    maxFiles: 5,
    maxSize: 20971520,
  });

  const removeImage = (index) => {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const hasInput = url.trim() || images.length > 0;

  // Count non-default style selections for badge
  const defaults = getDefaultStyleConfig();
  const customStyleCount = Object.entries(styleConfig).filter(([k, v]) => v !== defaults[k]).length;

  const handleGenerate = async () => {
    if (!hasInput) return;
    setError(null);
    setMode('generating');
    try {
      const result = await adgenApi.generate(clientId, {
        url: url.trim() || undefined,
        platform,
        images: images.length > 0 ? images : undefined,
        variationCount,
        styleConfig,
        positiveWords: positiveWords.trim() || undefined,
        negativeWords: negativeWords.trim() || undefined,
        customPrompt: customPrompt.trim() || undefined,
      });
      setResults(result);
      setMode('results');
      setActiveVariation(0);
      setOverrides({});
      // Save to history
      let brief = 'Image-based';
      if (url.trim()) {
        try { brief = new URL(url.trim().startsWith('http') ? url.trim() : 'https://' + url.trim()).hostname.replace('www.', ''); } catch { brief = url.trim().substring(0, 60); }
      }
      const entry = {
        id: Date.now(),
        date: new Date().toISOString(),
        platform,
        brief,
        results: result,
      };
      setHistory(saveToHistory(clientId, entry));
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Generation failed');
      setMode('input');
    }
  };

  const handleStartOver = () => {
    setMode('input');
    setResults(null);
    setOverrides({});
    setActiveVariation(0);
    setError(null);
    setPushedToSheet(false);
  };

  const loadFromHistory = (entry) => {
    setResults(entry.results);
    setPlatform(entry.platform);
    setMode('results');
    setActiveVariation(0);
    setOverrides({});
    setShowHistory(false);
  };

  const deleteFromHistory = (entryId) => {
    const updated = history.filter(h => h.id !== entryId);
    setHistory(updated);
    localStorage.setItem(HISTORY_KEY(clientId), JSON.stringify(updated));
  };

  const currentFields = useMemo(() => {
    if (!results?.variations?.[activeVariation]) return null;
    const fields = { ...results.variations[activeVariation].fields };
    for (const [key, val] of Object.entries(overrides)) {
      if (key.startsWith(`${activeVariation}-`)) {
        const fieldKey = key.substring(`${activeVariation}-`.length);
        fields[fieldKey] = val;
      }
    }
    return fields;
  }, [results, activeVariation, overrides]);

  const previewAd = useMemo(() => {
    if (!currentFields) return null;
    return {
      headlines: Array.isArray(currentFields.headlines) ? currentFields.headlines : [currentFields.headlines].filter(Boolean),
      descriptions: Array.isArray(currentFields.descriptions) ? currentFields.descriptions : [currentFields.descriptions].filter(Boolean),
      primaryText: currentFields.primaryText || '',
      postTitle: currentFields.postTitle || '',
      introText: currentFields.introText || '',
      supportLine: currentFields.supportLine || '',
      cta: currentFields.cta || '',
      displayUrl: currentFields.displayUrl || '',
      sitelinks: Array.isArray(currentFields.sitelinks) ? currentFields.sitelinks : [],
      hashtags: currentFields.hashtags || '',
    };
  }, [currentFields]);

  const handleRegenerate = useCallback(async (fieldKey, fieldLabel, currentValue, direction = null) => {
    if (regeneratingField) return;
    setRegeneratingField(fieldKey);
    try {
      const result = await adgenApi.regenerate(clientId, {
        field: fieldLabel,
        currentValue,
        allFields: currentFields,
        platform: results?.platform || platform,
        direction,
        styleConfig,
        positiveWords: positiveWords.trim() || undefined,
        negativeWords: negativeWords.trim() || undefined,
        customPrompt: customPrompt.trim() || undefined,
      });
      if (result.newValue) {
        setOverrides(prev => ({ ...prev, [`${activeVariation}-${fieldKey}`]: result.newValue }));
      }
    } catch (err) {
      console.error('Regeneration failed:', err);
    } finally {
      setRegeneratingField(null);
    }
  }, [clientId, currentFields, results, platform, activeVariation, regeneratingField, styleConfig, positiveWords, negativeWords, customPrompt]);

  const handleCopyAll = () => {
    if (!currentFields) return;
    const fmt = AD_FORMATS[results?.platform || platform];
    const parts = [];
    for (const [key, spec] of Object.entries(fmt.fields)) {
      const val = currentFields[key];
      if (!val) continue;
      if (Array.isArray(val)) {
        val.forEach((v, i) => parts.push(`${spec.label} ${val.length > 1 ? i + 1 : ''}: ${v}`.trim()));
      } else {
        parts.push(`${spec.label}: ${val}`);
      }
    }
    navigator.clipboard.writeText(parts.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const handlePushToSheet = async () => {
    if (!currentFields || pushingToSheet) return;
    setPushingToSheet(true);
    setPushedToSheet(false);
    try {
      await adgenApi.pushToSheet(clientId, {
        fields: currentFields,
        platform: results?.platform || platform,
        funnel: styleConfig.funnel || 'TOF',
        hookStyle: styleConfig.hookStyle || '',
        url: url.trim() || undefined,
        urlTitle: results?.inputSummary?.urlTitle || '',
        hadImages: results?.inputSummary?.hadImages || false,
      });
      setPushedToSheet(true);
      setTimeout(() => setPushedToSheet(false), 3000);
    } catch (err) {
      console.error('Push to sheet failed:', err);
      setError(err.response?.data?.error || 'Failed to push to spreadsheet');
    } finally {
      setPushingToSheet(false);
    }
  };

  // --- Generating state ---
  if (mode === 'generating') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-pastel-peach/15 border border-pastel-peach/25 flex items-center justify-center mx-auto mb-3">
            <Sparkles className="w-7 h-7 text-pastel-peach animate-pulse" />
          </div>
          <h3 className="text-base font-semibold text-white mb-1">Generating Ad Copy</h3>
          <p className="text-xs text-neutral-400 mb-3">
            Analyzing sources and crafting {AD_FORMATS[platform]?.name || platform} variations...
          </p>
          <Loader2 className="w-4 h-4 animate-spin text-pastel-peach mx-auto" />
        </div>
      </div>
    );
  }

  // --- Results mode: two-column layout ---
  if (mode === 'results' && results && previewAd) {
    const resultFormatSpec = AD_FORMATS[results.platform];
    const variation = results.variations[activeVariation];

    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Compact header bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleStartOver}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              New
            </button>
            <div className="w-px h-4 bg-neutral-800" />
            <span className="text-xs font-medium text-neutral-200">{resultFormatSpec?.name || results.platform}</span>
            {results.variations.length > 1 && (
              <>
                <div className="w-px h-4 bg-neutral-800" />
                <div className="flex items-center gap-0.5">
                  {results.variations.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveVariation(i)}
                      className={clsx(
                        'px-2.5 py-1 rounded text-[11px] font-medium transition-all',
                        activeVariation === i
                          ? 'bg-pastel-peach/15 text-pastel-peach'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                      )}
                    >
                      V{i + 1}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handlePushToSheet}
              disabled={pushingToSheet}
              className={clsx(
                "flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-lg transition-all",
                pushedToSheet
                  ? "text-pastel-mint bg-pastel-mint/10"
                  : "text-neutral-400 hover:text-pastel-sky hover:bg-neutral-800"
              )}
            >
              {pushingToSheet ? (
                <><Loader2 className="w-3 h-3 animate-spin" /> Pushing...</>
              ) : pushedToSheet ? (
                <><Check className="w-3 h-3 text-pastel-mint" /> Pushed</>
              ) : (
                <><Sheet className="w-3 h-3" /> Push To Spreadsheet</>
              )}
            </button>
            {pushedToSheet && (
              <a
                href="https://docs.google.com/spreadsheets/d/1pWA99dxzx-8FyhulLBg00Or5tlwUJMLDlUknSaQUk4c/edit"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 px-2 py-1 text-[11px] text-pastel-sky hover:text-pastel-sky/80 transition-all"
              >
                View <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
            <div className="w-px h-3.5 bg-neutral-800" />
            <button
              onClick={handleCopyAll}
              className="flex items-center gap-1 px-2.5 py-1 text-[11px] text-neutral-400 hover:text-pastel-mint hover:bg-neutral-800 rounded-lg transition-all"
            >
              {copiedAll ? (
                <><Check className="w-3 h-3 text-pastel-mint" /> Copied</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy All</>
              )}
            </button>
          </div>
        </div>

        {/* Two-column content: fields left, preview right */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left column: copyable fields */}
          <div className="flex-1 overflow-y-auto p-5 scrollbar-dark">
            <div className="max-w-xl mx-auto space-y-3.5">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-0.5">Ad Copy Fields</div>
            {resultFormatSpec && Object.entries(resultFormatSpec.fields).map(([fieldKey, spec]) => {
              const value = currentFields?.[fieldKey];
              if (!value) return null;

              if (Array.isArray(value)) {
                return value.map((v, i) => {
                  const key = `${fieldKey}-${i}`;
                  const label = `${spec.label} ${value.length > 1 ? i + 1 : ''}`.trim();
                  return (
                    <CopyableField
                      key={key}
                      label={label}
                      value={v}
                      charLimit={spec.maxChars}
                      isRegenerating={regeneratingField === key}
                      onRegenerate={(dir) => handleRegenerate(key, label, v, dir)}
                    />
                  );
                });
              }

              if (spec.enum) {
                return (
                  <div key={fieldKey} className="rounded-xl border border-neutral-800 bg-neutral-800/20">
                    <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800/50">
                      <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold">{spec.label}</span>
                    </div>
                    <div className="px-3.5 py-3">
                      <select
                        value={value}
                        onChange={(e) => setOverrides(prev => ({ ...prev, [`${activeVariation}-${fieldKey}`]: e.target.value }))}
                        className="w-full px-3 py-2 text-[13px] bg-neutral-900/60 border border-neutral-700 rounded-lg text-neutral-200 focus:border-pastel-peach/50 focus:outline-none focus:ring-1 focus:ring-pastel-peach/20 cursor-pointer appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
                      >
                        {spec.enum.map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              }

              return (
                <CopyableField
                  key={fieldKey}
                  label={spec.label}
                  value={value}
                  charLimit={spec.maxChars}
                  isRegenerating={regeneratingField === fieldKey}
                  onRegenerate={(dir) => handleRegenerate(fieldKey, spec.label, value, dir)}
                />
              );
            })}
            </div>
          </div>

          {/* Right column: preview + rationale + sources */}
          <div className="w-[340px] flex-shrink-0 border-l border-neutral-800 overflow-y-auto p-4 space-y-4 scrollbar-dark">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-2">Preview</div>
              <div className="flex justify-center [&>div]:w-full [&>div]:max-w-none">
                {results.platform === 'google' && <GoogleAdPreview ad={previewAd} />}
                {results.platform === 'meta' && <MetaAdPreview ad={previewAd} />}
                {results.platform === 'linkedin' && <LinkedInAdPreview ad={previewAd} />}
                {results.platform === 'reddit' && <RedditAdPreview ad={previewAd} />}
              </div>
            </div>

            {variation?.rationale && (
              <div className="px-3 py-2 rounded-lg bg-neutral-800/40 border border-neutral-800">
                <p className="text-[11px] text-neutral-400 italic leading-relaxed">{variation.rationale}</p>
              </div>
            )}

            {results.sources && results.sources.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-2">Sources</div>
                <div className="space-y-1">
                  {results.sources.map((source, i) => (
                    <div
                      key={source.id || i}
                      className={clsx(
                        "flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors",
                        variation?.sourcesCited?.includes(source.title)
                          ? "bg-pastel-peach/5 border-pastel-peach/20"
                          : "bg-neutral-800/30 border-neutral-800"
                      )}
                    >
                      <FileText className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                      <span className="text-[11px] text-neutral-300 truncate flex-1">{source.title}</span>
                      <span className={clsx(
                        "text-[9px] font-medium px-1 py-0.5 rounded",
                        source.similarity >= 70 ? "text-pastel-mint bg-pastel-mint/10" :
                        source.similarity >= 50 ? "text-pastel-sky bg-pastel-sky/10" :
                        "text-neutral-500 bg-neutral-800"
                      )}>
                        {source.similarity}%
                      </span>
                      {source.isGlobal && <Globe className="w-2.5 h-2.5 text-pastel-sky flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- Input form ---
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Compact header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-800 bg-neutral-900/50 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-pastel-peach/15 border border-pastel-peach/25 flex items-center justify-center">
            <Megaphone className="w-3.5 h-3.5 text-pastel-peach" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">Ad Copy Generator</h2>
            <p className="text-[10px] text-neutral-400">Pulls from your sources with emphasis on playbooks</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {PLATFORMS.map(p => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                onClick={() => setPlatform(p.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                  platform === p.id
                    ? 'bg-pastel-peach/15 text-pastel-peach'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">{p.label}</span>
              </button>
            );
          })}
          {history.length > 0 && (
            <>
              <div className="w-px h-4 bg-neutral-800 mx-0.5" />
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={clsx(
                  'flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all',
                  showHistory ? 'bg-pastel-sky/15 text-pastel-sky' : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50'
                )}
                title="Past generations"
              >
                <History className="w-3.5 h-3.5" />
                <span className="text-[10px]">{history.length}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* History panel */}
      {showHistory && history.length > 0 && (
        <div className="border-b border-neutral-800 bg-neutral-900/80 max-h-[240px] overflow-y-auto scrollbar-dark">
          <div className="px-4 py-2">
            <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-2">Past Generations</div>
            <div className="space-y-1">
              {history.map((entry) => {
                const platformInfo = PLATFORMS.find(p => p.id === entry.platform);
                const PlatformIcon = platformInfo?.icon || Monitor;
                const date = new Date(entry.date);
                const timeStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' + date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
                const varCount = entry.results?.variations?.length || 0;
                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-neutral-800/60 group transition-colors cursor-pointer"
                    onClick={() => loadFromHistory(entry)}
                  >
                    <PlatformIcon className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-neutral-200 truncate">{entry.brief}</p>
                      <p className="text-[9px] text-neutral-600">{timeStr} &middot; {varCount} variation{varCount !== 1 ? 's' : ''}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteFromHistory(entry.id); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-neutral-600 hover:text-pastel-coral transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Main input area - single panel, full-width */}
      <div className="flex-1 overflow-y-auto scrollbar-dark">
        <div className="max-w-3xl mx-auto px-6 py-5 space-y-5">

          {/* Row 1: URL + Images side by side */}
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5 flex items-center gap-1.5">
                <Link2 className="w-3 h-3" />
                Page URL
              </label>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com/product"
                className="w-full px-3 py-2 text-sm bg-neutral-800/60 border border-neutral-700 rounded-xl text-neutral-100 placeholder-neutral-500 focus:border-pastel-peach/40 focus:outline-none focus:ring-1 focus:ring-pastel-peach/20"
              />
            </div>
            <div className="w-[160px] flex-shrink-0">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5 flex items-center gap-1.5">
                <Image className="w-3 h-3" />
                Images
                <span className="text-neutral-600 font-normal normal-case tracking-normal text-[10px]">({images.length}/5)</span>
              </label>
              {imagePreviews.length > 0 ? (
                <div className="flex gap-1.5 flex-wrap">
                  {imagePreviews.map((preview, i) => (
                    <div key={i} className="relative w-9 h-9 rounded-lg overflow-hidden border border-neutral-700 group">
                      <img src={preview} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={() => removeImage(i)}
                        className="absolute top-0 right-0 w-3.5 h-3.5 bg-neutral-900/80 rounded-bl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2 h-2 text-neutral-400" />
                      </button>
                    </div>
                  ))}
                  {images.length < 5 && (
                    <div
                      {...getRootProps()}
                      className="w-9 h-9 border border-dashed border-neutral-700 rounded-lg flex items-center justify-center cursor-pointer hover:border-neutral-600 hover:bg-neutral-800/30 transition-all"
                    >
                      <input {...getInputProps()} />
                      <Upload className="w-3 h-3 text-neutral-600" />
                    </div>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps()}
                  className={clsx(
                    "border border-dashed rounded-xl py-2 text-center cursor-pointer transition-all",
                    isDragActive
                      ? "border-pastel-peach/50 bg-pastel-peach/5"
                      : "border-neutral-700 hover:border-neutral-600 hover:bg-neutral-800/30"
                  )}
                >
                  <input {...getInputProps()} />
                  <Upload className="w-3.5 h-3.5 mx-auto mb-0.5 text-neutral-500" />
                  <p className="text-[10px] text-neutral-500">{isDragActive ? 'Drop here' : 'Drop or click'}</p>
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Ad Style - 4-column grid */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <SlidersHorizontal className="w-3 h-3 text-neutral-400" />
              <span className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">Ad Style</span>
              {customStyleCount > 0 && (
                <span className="text-[9px] bg-pastel-peach/15 text-pastel-peach px-1.5 py-0.5 rounded-full font-semibold">
                  {customStyleCount} custom
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              {Object.entries(AD_STYLE_OPTIONS).map(([key, config]) => (
                <div key={key}>
                  <label className="text-[10px] text-neutral-300 mb-1 block">{config.label}</label>
                  <select
                    value={styleConfig[key] || ''}
                    onChange={(e) => setStyleConfig(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-2.5 py-2 text-[12px] bg-neutral-800/60 border border-neutral-700 rounded-lg text-neutral-100 focus:border-pastel-peach/40 focus:outline-none focus:ring-1 focus:ring-pastel-peach/20 cursor-pointer appearance-none"
                    style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%23737373' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center' }}
                  >
                    {config.options.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => setStyleConfig(prev => ({ ...prev, emoji: !prev.emoji }))}
                className={clsx(
                  'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                  styleConfig.emoji
                    ? 'bg-pastel-peach/10 border-pastel-peach/30 text-pastel-peach'
                    : 'bg-neutral-800/40 border-neutral-700 text-neutral-400 hover:text-neutral-300 hover:border-neutral-600'
                )}
              >
                <span className="text-sm">{styleConfig.emoji ? '😊' : '😶'}</span>
                Use Emoji
              </button>
              <div className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/40 p-0.5">
                {['TOF', 'MOF', 'BOF'].map(stage => (
                  <button
                    key={stage}
                    type="button"
                    onClick={() => setStyleConfig(prev => ({ ...prev, funnel: stage }))}
                    className={clsx(
                      'px-2.5 py-1 rounded-md text-[11px] font-medium transition-all',
                      styleConfig.funnel === stage
                        ? 'bg-pastel-sky/15 text-pastel-sky'
                        : 'text-neutral-500 hover:text-neutral-300'
                    )}
                  >
                    {stage}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Row 3: Variations + Use/Avoid words */}
          <div className="flex gap-4 items-end">
            <div className="w-[140px] flex-shrink-0">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5 block">
                Variations
              </label>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setVariationCount(n)}
                    className={clsx(
                      'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                      variationCount === n
                        ? 'bg-pastel-peach/15 text-pastel-peach border border-pastel-peach/30'
                        : 'text-neutral-400 hover:text-neutral-200 bg-neutral-800/40 border border-neutral-800 hover:bg-neutral-800/60'
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5 flex items-center gap-1">
                <ThumbsUp className="w-2.5 h-2.5 text-pastel-mint" />
                Use Words
              </label>
              <input
                type="text"
                value={positiveWords}
                onChange={(e) => setPositiveWords(e.target.value)}
                placeholder="free, premium, proven..."
                className="w-full px-2.5 py-2 text-[12px] bg-neutral-800/60 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:border-pastel-mint/40 focus:outline-none focus:ring-1 focus:ring-pastel-mint/20"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5 flex items-center gap-1">
                <ThumbsDown className="w-2.5 h-2.5 text-pastel-coral" />
                Avoid Words
              </label>
              <input
                type="text"
                value={negativeWords}
                onChange={(e) => setNegativeWords(e.target.value)}
                placeholder="cheap, basic, simple..."
                className="w-full px-2.5 py-2 text-[12px] bg-neutral-800/60 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:border-pastel-coral/40 focus:outline-none focus:ring-1 focus:ring-pastel-coral/20"
              />
            </div>
          </div>

          {/* Creative direction prompt */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium mb-1.5 flex items-center gap-1">
              <FileText className="w-2.5 h-2.5 text-pastel-lavender" />
              Creative Direction
              <span className="text-neutral-600 normal-case tracking-normal">(optional)</span>
            </label>
            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Focus on the free trial offer, use a question as the hook, mention 30-day money back guarantee..."
              rows={2}
              className="w-full px-2.5 py-1.5 text-[12px] bg-neutral-800/60 border border-neutral-700 rounded-lg text-neutral-100 placeholder-neutral-500 focus:border-pastel-lavender/40 focus:outline-none focus:ring-1 focus:ring-pastel-lavender/20 resize-none leading-relaxed"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2 rounded-lg bg-pastel-coral/10 border border-pastel-coral/20">
              <p className="text-xs text-pastel-coral">{error}</p>
            </div>
          )}

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!hasInput}
            className={clsx(
              "w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold transition-all",
              hasInput
                ? "bg-pastel-peach text-neutral-950 hover:bg-pastel-peach/90 shadow-lg shadow-pastel-peach/20"
                : "bg-neutral-800 text-neutral-600 cursor-not-allowed"
            )}
          >
            <Sparkles className="w-4 h-4" />
            Generate Ad Copy
          </button>
        </div>
      </div>
    </div>
  );
}
