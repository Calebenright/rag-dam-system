import { useState, useRef, useEffect } from 'react';
import { Copy, Check, Monitor, Megaphone, RefreshCw, Loader2, Pencil, Instagram, MessageCircle, ArrowBigUp, MessageSquare, Share2 } from 'lucide-react';
import clsx from 'clsx';

// Clean quotes and markdown from a value string
export function cleanValue(str) {
  return str
    .replace(/^["'"]+|["'"]+$/g, '')
    .replace(/\*\*/g, '')
    .replace(/\*/g, '')
    .replace(/\[Source:.*?\]/gi, '')
    .trim();
}

// Determine if a label relates to an ad field category
export function classifyLabel(label) {
  const l = label.toLowerCase();
  if (/headline|title/i.test(l) && !/sub/i.test(l)) return 'headline';
  if (/description|body|primary\s*text|intro\s*copy|ad\s*copy|intro\s*text|caption/i.test(l)) return 'description';
  if (/hook\s*line/i.test(l)) return 'hook';
  if (/support\s*line/i.test(l)) return 'support';
  if (/cta|call\s*to\s*action|button\s*text/i.test(l)) return 'cta';
  if (/display\s*url|url|link/i.test(l)) return 'url';
  if (/sitelink/i.test(l)) return 'sitelink';
  if (/image\s*copy|image\s*text|visual/i.test(l)) return 'image_copy';
  if (/hashtag/i.test(l)) return 'hashtag';
  if (/explanation|why|rationale|note|breakdown/i.test(l)) return 'skip';
  return 'other';
}

// Copyable field component with regenerate + optional direction input
export function CopyableField({ label, value, isRegenerating, onRegenerate, className, charLimit }) {
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

  const charCount = value?.length || 0;
  const isOverLimit = charLimit && charCount > charLimit;
  const isNearLimit = charLimit && !isOverLimit && charLimit - charCount < 10;

  return (
    <div className={clsx('group relative rounded-xl border transition-colors', isOverLimit ? 'border-pastel-coral/30 bg-pastel-coral/5' : 'border-neutral-800 bg-neutral-800/20 hover:border-neutral-700', className)}>
      {/* Header bar */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-neutral-800/50">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] uppercase tracking-wider text-neutral-300 font-semibold">{label}</span>
          {charLimit && charLimit <= 200 && (
            <span className={clsx(
              'text-[10px] tabular-nums',
              isOverLimit ? 'text-pastel-coral font-medium' : isNearLimit ? 'text-pastel-lemon' : 'text-neutral-600'
            )}>
              {charCount}/{charLimit}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onRegenerate && (
            <>
              <button
                onClick={() => setShowDirectionInput(!showDirectionInput)}
                disabled={isRegenerating}
                className={clsx(
                  "p-1.5 rounded-md transition-all disabled:opacity-50",
                  showDirectionInput ? "text-pastel-sky bg-pastel-sky/10" : "text-neutral-500 hover:text-pastel-sky hover:bg-neutral-800"
                )}
                title="Regenerate with direction"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={() => onRegenerate(null)}
                disabled={isRegenerating}
                className="p-1.5 rounded-md text-neutral-500 hover:text-pastel-lavender hover:bg-neutral-800 transition-all disabled:opacity-50"
                title="Regenerate this field"
              >
                {isRegenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin text-pastel-lavender" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className={clsx("p-1.5 rounded-md transition-all", copied ? "text-pastel-mint bg-pastel-mint/10" : "text-neutral-500 hover:text-pastel-mint hover:bg-neutral-800")}
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          </button>
        </div>
      </div>
      {/* Value */}
      <div
        className={clsx(
          "px-3.5 py-3 text-[13px] leading-[1.7] text-neutral-100 cursor-pointer transition-colors whitespace-pre-wrap",
          isRegenerating && "opacity-40"
        )}
        onClick={handleCopy}
        title="Click to copy"
      >
        {value}
      </div>
      {/* Direction input for guided regeneration */}
      {showDirectionInput && (
        <div className="px-3.5 pb-3 flex items-center gap-2">
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
            className="flex-1 px-3 py-2 text-xs bg-neutral-900/60 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-600 focus:border-pastel-sky/50 focus:outline-none focus:ring-1 focus:ring-pastel-sky/20"
          />
          <button
            onClick={handleRegenerateWithDirection}
            disabled={isRegenerating}
            className="px-3 py-2 text-xs font-medium text-pastel-sky hover:bg-pastel-sky/10 rounded-lg transition-all disabled:opacity-50 flex-shrink-0 border border-pastel-sky/20"
          >
            {isRegenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Go'}
          </button>
        </div>
      )}
    </div>
  );
}

// Google Search Ad Preview
export function GoogleAdPreview({ ad }) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-neutral-200 max-w-md w-full">
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
        {(ad.headlines || []).slice(0, 3).join(' | ') || 'Your Headline Here'}
      </h3>
      <p className="text-[13px] text-neutral-600 mt-1 leading-relaxed line-clamp-3">
        {(ad.descriptions || [])[0] || 'Your description will appear here.'}
      </p>
      {ad.sitelinks && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {(typeof ad.sitelinks === 'string' ? ad.sitelinks.split('|') : ad.sitelinks).map((s, i) => (
            <span key={i} className="text-xs text-blue-700 hover:underline cursor-pointer">{String(s).trim()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// Meta / Instagram Ad Preview
export function MetaAdPreview({ ad }) {
  const primaryText = ad.primaryText || (ad.descriptions || [])[0] || 'Your primary text will appear here.';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 max-w-sm w-full overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <span className="text-white text-xs font-bold">B</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-neutral-900 leading-tight">Brand Name</div>
          <div className="text-[11px] text-neutral-500 flex items-center gap-1">
            Sponsored
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
      <div className="px-3 py-2.5 border-t border-neutral-100">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] text-neutral-500 uppercase tracking-wide truncate">
              {ad.displayUrl || 'example.com'}
            </div>
            <div className="text-[13px] font-semibold text-neutral-900 truncate leading-tight">
              {(ad.headlines || [])[0] || 'Your Headline'}
            </div>
          </div>
          <button className="flex-shrink-0 ml-3 px-3 py-1.5 bg-neutral-100 text-[13px] font-semibold text-neutral-800 rounded-md">
            {ad.cta || 'Learn More'}
          </button>
        </div>
        {ad.hashtags && (
          <p className="text-[12px] text-blue-600 mt-1.5">{ad.hashtags}</p>
        )}
      </div>
    </div>
  );
}

// LinkedIn Ad Preview
export function LinkedInAdPreview({ ad }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 max-w-sm w-full overflow-hidden">
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
          {ad.introText || (ad.descriptions || [])[0] || 'Your ad copy will appear here.'}
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
          {(ad.headlines || [])[0] || 'Your Headline'}
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

// Reddit Promoted Post Preview
export function RedditAdPreview({ ad }) {
  const title = ad.postTitle || 'Your Post Title Here';
  const body = ad.primaryText || (ad.descriptions || [])[0] || 'Your post body will appear here.';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 max-w-sm w-full overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center">
          <MessageCircle className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-neutral-900 leading-tight">r/subreddit</span>
            <span className="text-[10px] text-neutral-400">-</span>
            <span className="text-[10px] text-blue-500 font-medium">Promoted</span>
          </div>
          <div className="text-[11px] text-neutral-500">u/brand_name</div>
        </div>
      </div>
      <div className="px-3 pb-1.5">
        <h3 className="text-[15px] font-semibold text-neutral-900 leading-snug">{title}</h3>
      </div>
      <div className="px-3 pb-2">
        <p className="text-[13px] text-neutral-700 leading-relaxed line-clamp-4">{body}</p>
      </div>
      <div className="w-full aspect-[1.91/1] bg-gradient-to-br from-orange-50 to-neutral-100 flex items-center justify-center">
        <div className="text-center text-neutral-400">
          <Megaphone className="w-8 h-8 mx-auto mb-1 opacity-40" />
          <span className="text-xs">Ad Creative</span>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-neutral-100 flex items-center justify-between">
        <div className="flex items-center gap-4 text-neutral-500">
          <div className="flex items-center gap-1">
            <ArrowBigUp className="w-4 h-4" />
            <span className="text-[11px] font-medium">Vote</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[11px]">Comments</span>
          </div>
          <div className="flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5" />
            <span className="text-[11px]">Share</span>
          </div>
        </div>
        <button className="flex-shrink-0 px-3 py-1 bg-blue-600 text-white text-[11px] font-semibold rounded-full">
          {ad.cta || 'Learn More'}
        </button>
      </div>
    </div>
  );
}

// Instagram Ad Preview
export function InstagramAdPreview({ ad }) {
  const caption = ad.primaryText || (ad.descriptions || [])[0] || 'Your caption will appear here.';
  return (
    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 max-w-sm w-full overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
          <span className="text-white text-xs font-bold">B</span>
        </div>
        <div>
          <div className="text-[13px] font-semibold text-neutral-900 leading-tight">brand_name</div>
          <div className="text-[11px] text-neutral-500">Sponsored</div>
        </div>
      </div>
      <div className="w-full aspect-square bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
        <div className="text-center text-neutral-400">
          <Instagram className="w-8 h-8 mx-auto mb-1 opacity-40" />
          <span className="text-xs">Ad Creative</span>
        </div>
      </div>
      <div className="px-3 py-2.5 border-t border-neutral-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[13px] font-semibold text-neutral-900 truncate">
            {(ad.headlines || [])[0] || 'Your Headline'}
          </div>
          <button className="flex-shrink-0 ml-3 px-3 py-1 bg-blue-500 text-white text-[12px] font-semibold rounded-md">
            {ad.cta || 'Learn More'}
          </button>
        </div>
        <p className="text-[13px] text-neutral-800 leading-relaxed line-clamp-3">
          {caption}
        </p>
        {ad.hashtags && (
          <p className="text-[13px] text-blue-600 mt-1">{ad.hashtags}</p>
        )}
      </div>
    </div>
  );
}
