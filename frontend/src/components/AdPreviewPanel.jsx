import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, Copy, Check, Megaphone, Monitor, Facebook, RefreshCw, Loader2, Pencil } from 'lucide-react';
import { chatApi } from '../api/chat';
import clsx from 'clsx';

// Clean quotes and markdown from a value string
function cleanValue(str) {
  return str
    .replace(/^["'"]+|["'"]+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[Source:.*?\]/gi, '')
    .trim();
}

// Determine if a label relates to an ad field category
function classifyLabel(label) {
  const l = label.toLowerCase();
  if (/headline|title/i.test(l) && !/sub/i.test(l)) return 'headline';
  if (/description|body|primary\s*text|intro\s*copy|ad\s*copy/i.test(l)) return 'description';
  if (/hook\s*line/i.test(l)) return 'hook';
  if (/support\s*line/i.test(l)) return 'support';
  if (/cta|call\s*to\s*action|button\s*text/i.test(l)) return 'cta';
  if (/display\s*url|url|link/i.test(l)) return 'url';
  if (/sitelink/i.test(l)) return 'sitelink';
  if (/image\s*copy|image\s*text|visual/i.test(l)) return 'image_copy';
  if (/explanation|why|rationale|note|breakdown/i.test(l)) return 'skip';
  return 'other';
}

// Parse ad copy from message content - extracts structured ad parts
function parseAdCopy(content) {
  const ad = {
    headlines: [],
    descriptions: [],
    hookLine: '',
    supportLine: '',
    cta: '',
    displayUrl: '',
    sitelinks: [],
    imageCopy: [],
    rawSections: [],
  };

  if (!content) return ad;

  // Step 1: Strip everything after ### Explanation or similar non-ad sections
  let adContent = content;
  const explanationCut = adContent.search(/^#{1,4}\s*(Explanation|Why|Rationale|Breakdown|Notes?)\b/im);
  if (explanationCut > 0) {
    adContent = adContent.substring(0, explanationCut);
  }
  adContent = adContent.replace(/\n\n(This\s+(ad\s+)?copy\s+|If\s+you\s+need\s+|Feel\s+free\s+to\s+).*/s, '');

  // Step 2: Extract labeled fields
  const lines = adContent.split('\n');
  let currentLabel = null;
  let currentCategory = null;
  let currentLines = [];
  let inExplanation = false;

  const flushSection = () => {
    if (!currentLabel) { currentLines = []; return; }
    let text = currentLines.join('\n').trim();
    text = cleanValue(text);
    if (!text) { currentLabel = null; currentLines = []; currentCategory = null; return; }

    const cat = currentCategory || classifyLabel(currentLabel);

    switch (cat) {
      case 'headline':
        text.split(/\n/).forEach(line => {
          const cleaned = cleanValue(line.replace(/^\d+[\.\)]\s*/, ''));
          if (cleaned) ad.headlines.push(cleaned);
        });
        break;
      case 'description':
        ad.descriptions.push(text);
        break;
      case 'hook':
        ad.hookLine = text;
        break;
      case 'support':
        ad.supportLine = text;
        break;
      case 'cta':
        ad.cta = text;
        break;
      case 'url':
        ad.displayUrl = text;
        break;
      case 'sitelink':
        text.split(/\n/).forEach(line => {
          const cleaned = cleanValue(line.replace(/^\d+[\.\)]\s*/, '').replace(/^[-•]\s*/, ''));
          if (cleaned) ad.sitelinks.push(cleaned);
        });
        break;
      case 'image_copy':
        ad.imageCopy.push(text);
        break;
      case 'skip':
        break;
      default:
        ad.rawSections.push({ label: currentLabel, text });
    }

    currentLabel = null;
    currentCategory = null;
    currentLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (/^#{1,4}\s*(Explanation|Why|Rationale|Breakdown)/i.test(line)) {
      flushSection();
      inExplanation = true;
      continue;
    }
    if (inExplanation) continue;
    if (/^\d+\.\s+[A-Z].*\s+-\s+/i.test(line)) continue;

    const boldLabelMatch = line.match(/^\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    const dashLabelMatch = line.match(/^-\s+(.+?):\s*(.*)$/);
    const headerMatch = line.match(/^#{1,4}\s+(.+)$/);
    const plainLabelMatch = line.match(/^([A-Za-z][A-Za-z\s]{1,30}):\s+(.+)$/);

    if (boldLabelMatch) {
      flushSection();
      const label = boldLabelMatch[1].trim();
      const cat = classifyLabel(label);
      if (cat === 'skip') { inExplanation = true; continue; }
      currentLabel = label;
      currentCategory = cat;
      const val = boldLabelMatch[2].trim();
      if (val) currentLines.push(val);
    } else if (dashLabelMatch && currentLabel) {
      const subLabel = dashLabelMatch[1].trim();
      const subVal = cleanValue(dashLabelMatch[2]);
      const subCat = classifyLabel(subLabel);

      if (subCat === 'hook') ad.hookLine = subVal;
      else if (subCat === 'support') ad.supportLine = subVal;
      else if (subCat === 'cta') ad.cta = subVal;
      else if (subCat === 'headline') ad.headlines.push(subVal);
      else if (subVal) currentLines.push(subVal);
    } else if (headerMatch) {
      flushSection();
      const label = headerMatch[1].replace(/\*\*/g, '').trim();
      const cat = classifyLabel(label);
      if (cat === 'skip') { inExplanation = true; continue; }
      if (/ad\s*copy|social\s*media|linkedin|facebook|google|meta/i.test(label)) {
        continue;
      }
      currentLabel = label;
      currentCategory = cat;
    } else if (plainLabelMatch && !currentLabel) {
      const label = plainLabelMatch[1].trim();
      const cat = classifyLabel(label);
      if (cat !== 'other' && cat !== 'skip') {
        flushSection();
        currentLabel = label;
        currentCategory = cat;
        currentLines.push(plainLabelMatch[2].trim());
      } else if (currentLabel) {
        currentLines.push(line);
      }
    } else if (line) {
      if (currentLabel) {
        currentLines.push(line);
      } else if (!line.startsWith('#') && !line.startsWith('---') && line.length > 20) {
        if (ad.headlines.length === 0 && ad.descriptions.length === 0) {
          if (!/^(Here'?s?|Below|I'?ve|Let me|Sure)/i.test(line)) {
            ad.descriptions.push(cleanValue(line));
          }
        }
      }
    }
  }
  flushSection();

  if (!ad.cta && (ad.headlines.length > 0 || ad.descriptions.length > 0)) {
    ad.cta = 'Learn More';
  }

  return ad;
}

// Extract a single field value from a regeneration response
function extractRegeneratedValue(content) {
  if (!content) return '';
  // Strip markdown, quotes, labels, explanation
  let text = content;
  // Remove everything after "Explanation" or commentary
  text = text.replace(/\n\n?(This\s+|If\s+you\s+|Feel\s+free|I'?ve\s+|Here'?s?\s+|The\s+new\s+).*/si, '');
  text = text.replace(/^#{1,4}\s*(Explanation|Why|Rationale).*/smi, '');
  // Try to extract from **Label:** value pattern
  const labelMatch = text.match(/\*\*[^*]+\*\*\s*:?\s*["']?(.+?)["']?\s*$/m);
  if (labelMatch) return cleanValue(labelMatch[1]);
  // Try plain Label: value
  const plainMatch = text.match(/^[A-Za-z\s]+:\s*["']?(.+?)["']?\s*$/m);
  if (plainMatch) return cleanValue(plainMatch[1]);
  // Otherwise clean and use the whole thing (take last meaningful line)
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const meaningful = lines.map(l => cleanValue(l)).filter(l => l.length > 0);
  return meaningful[meaningful.length - 1] || cleanValue(text);
}

// Copyable field component with regenerate + optional direction input
function CopyableField({ label, value, isRegenerating, onRegenerate, className }) {
  const [copied, setCopied] = useState(false);
  const [showDirectionInput, setShowDirectionInput] = useState(false);
  const [direction, setDirection] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showDirectionInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showDirectionInput]);

  if (!value) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleRegenerateWithDirection = () => {
    if (onRegenerate) {
      onRegenerate(direction.trim() || null);
      setDirection('');
      setShowDirectionInput(false);
    }
  };

  return (
    <div className={clsx('group relative', className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRegenerate && (
            <>
              <button
                onClick={() => setShowDirectionInput(!showDirectionInput)}
                disabled={isRegenerating}
                className={clsx(
                  "flex items-center gap-1 text-[10px] transition-all px-1.5 py-0.5 rounded bg-neutral-800/80 disabled:opacity-50",
                  showDirectionInput ? "text-pastel-sky" : "text-neutral-400 hover:text-pastel-sky"
                )}
                title="Regenerate with direction"
              >
                <Pencil className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={() => onRegenerate(null)}
                disabled={isRegenerating}
                className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-pastel-lavender transition-all px-1.5 py-0.5 rounded bg-neutral-800/80 disabled:opacity-50"
                title="Regenerate this field"
              >
                {isRegenerating ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <RefreshCw className="w-2.5 h-2.5" />
                )}
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-pastel-mint transition-all px-1.5 py-0.5 rounded bg-neutral-800/80"
          >
            {copied ? (
              <><Check className="w-2.5 h-2.5 text-pastel-mint" /> Copied</>
            ) : (
              <><Copy className="w-2.5 h-2.5" /> Copy</>
            )}
          </button>
        </div>
      </div>
      <div
        className={clsx(
          "text-sm text-neutral-200 cursor-pointer hover:bg-neutral-800/40 rounded px-2 py-1.5 -mx-2 transition-colors",
          isRegenerating && "opacity-50"
        )}
        onClick={handleCopy}
        title="Click to copy"
      >
        {value}
      </div>
      {/* Direction input for guided regeneration */}
      {showDirectionInput && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            ref={inputRef}
            type="text"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isRegenerating) handleRegenerateWithDirection();
              if (e.key === 'Escape') { setShowDirectionInput(false); setDirection(''); }
            }}
            placeholder="e.g. make it shorter, more urgent..."
            className="flex-1 px-2 py-1 text-xs bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 focus:border-pastel-sky/50 focus:outline-none focus:ring-1 focus:ring-pastel-sky/20"
          />
          <button
            onClick={handleRegenerateWithDirection}
            disabled={isRegenerating}
            className="px-2 py-1 text-xs font-medium text-pastel-sky hover:bg-pastel-sky/10 rounded-lg transition-all disabled:opacity-50 flex-shrink-0"
          >
            {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
          </button>
        </div>
      )}
    </div>
  );
}

// Google Search Ad Preview
function GoogleAdPreview({ ad }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 max-w-md">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-medium text-neutral-600">Sponsored</span>
      </div>
      <div className="flex items-center gap-1 mb-0.5">
        <div className="w-5 h-5 rounded-full bg-blue-50 flex items-center justify-center">
          <Monitor className="w-3 h-3 text-blue-600" />
        </div>
        <span className="text-xs text-green-700 truncate">
          {ad.displayUrl || 'example.com'}
        </span>
      </div>
      <h3 className="text-lg text-blue-800 hover:underline cursor-pointer leading-snug font-normal">
        {ad.headlines.slice(0, 3).join(' | ') || 'Your Headline Here'}
      </h3>
      <p className="text-[13px] text-neutral-600 mt-1 leading-relaxed line-clamp-3">
        {ad.descriptions[0] || 'Your description will appear here.'}
      </p>
      {ad.sitelinks.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {ad.sitelinks.slice(0, 4).map((s, i) => (
            <span key={i} className="text-xs text-blue-700 hover:underline cursor-pointer">{s}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Meta/Facebook Ad Preview
function MetaAdPreview({ ad }) {
  const primaryText = ad.descriptions[0] || ad.hookLine || 'Your primary text will appear here.';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 max-w-sm overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">B</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-neutral-900 leading-tight">Brand Name</div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
            Sponsored · <span className="text-[10px]">🌐</span>
          </div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[13px] text-neutral-800 leading-relaxed line-clamp-3">
          {primaryText}
        </p>
      </div>
      <div className="w-full aspect-[1.91/1] bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
        <div className="text-center text-neutral-400">
          <Megaphone className="w-8 h-8 mx-auto mb-1 opacity-40" />
          <span className="text-xs">Ad Creative</span>
        </div>
      </div>
      <div className="px-3 py-2.5 border-t border-neutral-100 flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-[11px] text-neutral-500 uppercase tracking-wide truncate">
            {ad.displayUrl || 'example.com'}
          </div>
          <div className="text-[13px] font-semibold text-neutral-900 truncate leading-tight">
            {ad.headlines[0] || 'Your Headline'}
          </div>
        </div>
        <button className="flex-shrink-0 ml-3 px-3 py-1.5 bg-neutral-100 text-[13px] font-semibold text-neutral-800 rounded-md">
          {ad.cta || 'Learn More'}
        </button>
      </div>
    </div>
  );
}

// LinkedIn Ad Preview
function LinkedInAdPreview({ ad }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 max-w-sm overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-10 h-10 rounded bg-blue-700 flex items-center justify-center">
          <span className="text-white text-sm font-bold">in</span>
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-neutral-900 leading-tight">Company Name</div>
          <div className="text-[11px] text-neutral-500">Promoted</div>
        </div>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[13px] text-neutral-800 leading-relaxed line-clamp-3">
          {ad.descriptions[0] || 'Your ad copy will appear here.'}
        </p>
      </div>
      <div className="w-full aspect-[1.91/1] bg-gradient-to-br from-blue-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center text-neutral-400">
          <Megaphone className="w-8 h-8 mx-auto mb-1 opacity-40" />
          <span className="text-xs">Ad Creative</span>
        </div>
      </div>
      <div className="px-3 py-2.5 border-t border-neutral-100">
        <div className="text-[13px] font-semibold text-neutral-900 truncate">
          {ad.headlines[0] || 'Your Headline'}
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[11px] text-neutral-500 truncate">{ad.displayUrl || 'example.com'}</span>
          <button className="flex-shrink-0 ml-3 px-4 py-1 border border-blue-600 text-blue-600 text-[13px] font-semibold rounded-full">
            {ad.cta || 'Learn More'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AD_FORMATS = [
  { id: 'google', label: 'Google Search', icon: Monitor },
  { id: 'meta', label: 'Meta / Facebook', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', icon: Megaphone },
];

export default function AdPreviewPanel({ message, onClose, clientId, conversationId }) {
  const [activeFormat, setActiveFormat] = useState('google');
  const [copiedAll, setCopiedAll] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [regeneratingField, setRegeneratingField] = useState(null);

  const parsedAd = useMemo(() => parseAdCopy(message?.content), [message?.content]);

  // Apply overrides on top of parsed values
  const ad = useMemo(() => {
    const result = { ...parsedAd, headlines: [...parsedAd.headlines], descriptions: [...parsedAd.descriptions], sitelinks: [...parsedAd.sitelinks], imageCopy: [...parsedAd.imageCopy], rawSections: [...parsedAd.rawSections] };
    for (const [key, val] of Object.entries(overrides)) {
      if (key.startsWith('headline-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < result.headlines.length) result.headlines[idx] = val;
      } else if (key.startsWith('description-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < result.descriptions.length) result.descriptions[idx] = val;
      } else if (key === 'hookLine') result.hookLine = val;
      else if (key === 'supportLine') result.supportLine = val;
      else if (key === 'cta') result.cta = val;
      else if (key === 'displayUrl') result.displayUrl = val;
      else if (key.startsWith('sitelink-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < result.sitelinks.length) result.sitelinks[idx] = val;
      } else if (key.startsWith('imageCopy-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < result.imageCopy.length) result.imageCopy[idx] = val;
      } else if (key.startsWith('raw-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < result.rawSections.length) result.rawSections[idx] = { ...result.rawSections[idx], text: val };
      }
    }
    return result;
  }, [parsedAd, overrides]);

  // Build context summary for regeneration prompts
  const buildAdContext = useCallback(() => {
    const parts = [];
    ad.headlines.forEach((h, i) => parts.push(`Headline ${i + 1}: ${h}`));
    ad.descriptions.forEach((d, i) => parts.push(`Description ${i + 1}: ${d}`));
    if (ad.hookLine) parts.push(`Hook Line: ${ad.hookLine}`);
    if (ad.supportLine) parts.push(`Support Line: ${ad.supportLine}`);
    if (ad.cta) parts.push(`CTA: ${ad.cta}`);
    return parts.join('\n');
  }, [ad]);

  const handleRegenerate = useCallback(async (fieldKey, fieldLabel, currentValue, userDirection = null) => {
    if (!clientId || regeneratingField) return;

    setRegeneratingField(fieldKey);
    try {
      const context = buildAdContext();
      let prompt = `I have this ad copy:\n\n${context}\n\nRewrite ONLY the "${fieldLabel}" field. The current value is: "${currentValue}"`;
      if (userDirection) {
        prompt += `\n\nDirection: ${userDirection}`;
      }
      prompt += `\n\nGive me a single new alternative. Reply with ONLY the new text for this field, nothing else. No labels, no quotes, no explanation.`;

      const response = await chatApi.sendMessage(clientId, prompt, { conversationId });
      const newValue = extractRegeneratedValue(response?.message?.content || '');
      if (newValue) {
        setOverrides(prev => ({ ...prev, [fieldKey]: newValue }));
      }
    } catch (err) {
      console.error('Failed to regenerate field:', err);
    } finally {
      setRegeneratingField(null);
    }
  }, [clientId, conversationId, regeneratingField, buildAdContext]);

  const handleCopyAll = () => {
    const parts = [];
    ad.headlines.forEach((h, i) => parts.push(`Headline ${i + 1}: ${h}`));
    ad.descriptions.forEach((d, i) => parts.push(`Description ${i + 1}: ${d}`));
    if (ad.hookLine) parts.push(`Hook Line: ${ad.hookLine}`);
    if (ad.supportLine) parts.push(`Support Line: ${ad.supportLine}`);
    if (ad.cta) parts.push(`CTA: ${ad.cta}`);
    if (ad.displayUrl) parts.push(`Display URL: ${ad.displayUrl}`);
    ad.imageCopy.forEach((c, i) => parts.push(`Image Copy ${i + 1}: ${c}`));
    ad.sitelinks.forEach((s, i) => parts.push(`Sitelink ${i + 1}: ${s}`));
    ad.rawSections.forEach(s => parts.push(`${s.label}: ${s.text}`));
    navigator.clipboard.writeText(parts.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  if (!message) return null;

  return (
    <div className="w-[420px] flex-shrink-0 border-l border-neutral-800 bg-neutral-900/80 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pastel-peach/15 border border-pastel-peach/25 flex items-center justify-center">
            <Megaphone className="w-4 h-4 text-pastel-peach" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Ad Preview</h3>
            <p className="text-[10px] text-neutral-500">Click any field to copy</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-pastel-mint hover:bg-neutral-800 rounded-lg transition-all"
          >
            {copiedAll ? (
              <><Check className="w-3 h-3 text-pastel-mint" /> Copied All</>
            ) : (
              <><Copy className="w-3 h-3" /> Copy All</>
            )}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Format tabs */}
      <div className="flex px-4 pt-3 pb-2 gap-1">
        {AD_FORMATS.map(f => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setActiveFormat(f.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                activeFormat === f.id
                  ? 'bg-pastel-peach/15 text-pastel-peach border border-pastel-peach/25'
                  : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/60'
              )}
            >
              <Icon className="w-3 h-3" />
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Content - scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5 scrollbar-dark">
        {/* Mock Preview */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Preview</div>
          <div className="flex justify-center">
            {activeFormat === 'google' && <GoogleAdPreview ad={ad} />}
            {activeFormat === 'meta' && <MetaAdPreview ad={ad} />}
            {activeFormat === 'linkedin' && <LinkedInAdPreview ad={ad} />}
          </div>
        </div>

        {/* Copyable Fields */}
        <div className="border-t border-neutral-800 pt-4 space-y-3">
          <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium mb-2">Ad Copy Fields</div>

          {ad.headlines.map((h, i) => {
            const key = `headline-${i}`;
            const label = `Headline ${ad.headlines.length > 1 ? i + 1 : ''}`;
            return (
              <CopyableField
                key={key}
                label={label}
                value={h}
                isRegenerating={regeneratingField === key}
                onRegenerate={(dir) => handleRegenerate(key, label.trim(), h, dir)}
              />
            );
          })}

          {ad.descriptions.map((d, i) => {
            const key = `description-${i}`;
            const label = `Description ${ad.descriptions.length > 1 ? i + 1 : ''}`;
            return (
              <CopyableField
                key={key}
                label={label}
                value={d}
                isRegenerating={regeneratingField === key}
                onRegenerate={(dir) => handleRegenerate(key, label.trim(), d, dir)}
              />
            );
          })}

          {ad.hookLine && (
            <CopyableField
              label="Hook Line"
              value={ad.hookLine}
              isRegenerating={regeneratingField === 'hookLine'}
              onRegenerate={(dir) => handleRegenerate('hookLine', 'Hook Line', ad.hookLine, dir)}
            />
          )}

          {ad.supportLine && (
            <CopyableField
              label="Support Line"
              value={ad.supportLine}
              isRegenerating={regeneratingField === 'supportLine'}
              onRegenerate={(dir) => handleRegenerate('supportLine', 'Support Line', ad.supportLine, dir)}
            />
          )}

          {ad.cta && (
            <CopyableField
              label="Call to Action"
              value={ad.cta}
              isRegenerating={regeneratingField === 'cta'}
              onRegenerate={(dir) => handleRegenerate('cta', 'Call to Action', ad.cta, dir)}
            />
          )}

          {ad.displayUrl && (
            <CopyableField label="Display URL" value={ad.displayUrl} />
          )}

          {ad.imageCopy.map((c, i) => {
            const key = `imageCopy-${i}`;
            const label = `Image Copy ${ad.imageCopy.length > 1 ? i + 1 : ''}`;
            return (
              <CopyableField
                key={key}
                label={label}
                value={c}
                isRegenerating={regeneratingField === key}
                onRegenerate={(dir) => handleRegenerate(key, label.trim(), c, dir)}
              />
            );
          })}

          {ad.sitelinks.map((s, i) => {
            const key = `sitelink-${i}`;
            return (
              <CopyableField
                key={key}
                label={`Sitelink ${i + 1}`}
                value={s}
                isRegenerating={regeneratingField === key}
                onRegenerate={(dir) => handleRegenerate(key, `Sitelink ${i + 1}`, s, dir)}
              />
            );
          })}

          {ad.rawSections.map((s, i) => {
            const key = `raw-${i}`;
            return (
              <CopyableField
                key={key}
                label={s.label}
                value={s.text}
                isRegenerating={regeneratingField === key}
                onRegenerate={(dir) => handleRegenerate(key, s.label, s.text, dir)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
