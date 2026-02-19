import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { X, Copy, Check, Layout, RefreshCw, Loader2, Pencil, ChevronDown, ChevronRight, Star, Shield, Zap, ArrowRight, Quote, CheckCircle, TrendingUp, AlertTriangle, Search } from 'lucide-react';
import { chatApi } from '../api/chat';
import clsx from 'clsx';

// Clean markdown formatting, quotes, and artifacts from text
function cleanText(str) {
  if (!str) return '';
  let result = str
    // Remove markdown bold/italic
    .replace(/\*\*/g, '')
    .replace(/(?<!\w)\*(?!\s)/g, '') // remove italic * but not bullet *
    // Remove source citations like [Source: doc.pdf], [Source 1], [1], etc.
    .replace(/\[Source:?[^\]]*\]/gi, '')
    .replace(/\[\d+\]/g, '')
    // Remove markdown link syntax [text](url)
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove surrounding quotes (regular, smart, single)
    .replace(/^["""''`]+|["""''`]+$/g, '')
    // Remove surrounding brackets (but not internal ones)
    .replace(/^\[\s*/, '').replace(/\s*\]$/, '')
    // Remove any remaining unmatched quotes at start/end
    .replace(/^["'"]+|["'"]+$/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
  // Second pass for nested cleanup
  result = result
    .replace(/^["""'']+|["""'']+$/g, '')
    .replace(/^\[\s*|\s*\]$/g, '')
    .trim();
  return result;
}

// Classify a section header into a known type
function classifySection(label) {
  const l = label.toLowerCase().trim();
  if (/hero|above\s+the\s+fold/i.test(l)) return 'hero';
  if (/social\s+proof/i.test(l)) return 'socialProof';
  if (/problem|agitation|pain\s+point/i.test(l)) return 'problem';
  if (/\bsolution\b/i.test(l)) return 'solution';
  // "Introducing" only as a standalone section label, not in longer body text
  if (/^introducing\b/i.test(l) && l.split(/\s+/).length <= 4) return 'solution';
  if (/benefit|key\s+benefit|value\s+prop/i.test(l)) return 'benefits';
  if (/how\s+it\s+works|process|steps/i.test(l)) return 'howItWorks';
  if (/\bcta\b|call\s+to\s+action/i.test(l)) return 'cta';
  if (/testimonial|quote|review|customer/i.test(l)) return 'testimonials';
  if (/footer|minimal\s+footer/i.test(l)) return 'footer';
  if (/landing\s+page|ad\s+copy/i.test(l)) return 'title';
  return 'unknown';
}

// Known section label patterns and their max reasonable length
// After the section label, remaining text on the same line is body content
const SECTION_LABEL_PATTERNS = [
  /^hero\s*(?:\(.*?\))?/i,
  /^social\s+proof(?:\s+bar)?/i,
  /^problem\s*(?:[\/&]\s*agitation)?/i,
  /^solution/i,
  /^(?:key\s+)?benefits?/i,
  /^how\s+it\s+works/i,
  /^(?:cta|call\s+to\s+action)/i,
  /^testimonials?/i,
  /^(?:minimal\s+)?footer/i,
  /^introducing/i,
  /^value\s+prop/i,
];

// Extract just the section label from text that may contain label + body on same line
// Returns { label, remainder } where remainder is body content that followed the label
function extractSectionLabel(text) {
  const trimmed = text.trim();
  for (const pat of SECTION_LABEL_PATTERNS) {
    const m = trimmed.match(pat);
    if (m) {
      const label = m[0].trim();
      const remainder = trimmed.substring(m[0].length).trim();
      return { label, remainder };
    }
  }
  // No known pattern matched — try splitting at first label-like field (e.g. "Headline:")
  // This handles "Hero (Above the Fold) Headline: ..." where the full text before a field label is the section name
  const fieldSplit = trimmed.match(/^(.+?)\s+((?:Headline|Subheadline|CTA|Trust|Micro|Body|Button|Quote|Logo)\s*:)/i);
  if (fieldSplit) {
    return { label: fieldSplit[1].trim(), remainder: fieldSplit[2] + trimmed.substring(fieldSplit[0].length) };
  }
  return { label: trimmed, remainder: '' };
}

// Parse landing page copy from message content
function parseLandingPage(content) {
  const page = {
    title: '',
    hero: { headline: '', subheadline: '', cta: '', trustBar: [], microProof: '' },
    socialProof: [],
    problem: { headline: '', body: '' },
    solution: { headline: '', body: '' },
    benefits: [],
    howItWorks: [],
    ctaSection: { headline: '', body: '', cta: '' },
    testimonials: [],
    footer: '',
    rawSections: [],
  };

  if (!content) return page;

  // Strip trailing explanation/commentary
  let text = content;
  const explCut = text.search(/^#{1,4}\s*(Explanation|Why\s+this|Rationale|Notes?|Breakdown|Key\s+takeaway)/im);
  if (explCut > 0) text = text.substring(0, explCut);
  text = text.replace(/\n\n(This\s+landing\s+page|If\s+you\s+need|Feel\s+free\s+to|Let\s+me\s+know|I'?ve\s+structured|This\s+copy\s+effectively|This\s+copy\s+is\s+designed|Would\s+you\s+like|I'?ve\s+designed|I'?ve\s+created).*/si, '');

  // Also strip leading conversational intro
  text = text.replace(/^.*?(?:here'?s?\s+(?:a\s+)?(?:structured\s+)?landing\s+page\s+copy|based\s+on\s+(?:effective|best)\s+practices)[^:]*:\s*/is, '');

  const lines = text.split('\n');
  const sections = []; // { label, type, bodyLines[] }
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      // Blank lines go to current section body
      if (current) current.bodyLines.push('');
      continue;
    }

    // Detect section headers:
    // 1. "Section N: Label ..." (with or without markdown # prefix, with or without **)
    // 2. "### Label" markdown headers
    // 3. "**Label**" standalone bold lines
    let headerText = null;

    // Pattern 1: "Section N: ..."
    const sectionNMatch = line.match(/^(?:#{1,4}\s*)?(?:\*\*)?Section\s+\d+\s*[:.\-–]\s*(.+?)(?:\*\*)?$/i);
    if (sectionNMatch) {
      headerText = sectionNMatch[1].trim();
    }

    // Pattern 2: Markdown headers (## Hero, ### Key Benefits, etc.)
    if (!headerText) {
      const mdMatch = line.match(/^#{1,4}\s+(.+?)$/);
      if (mdMatch) {
        const candidate = mdMatch[1].replace(/\*\*/g, '').trim();
        // Only treat as section header if it classifies to a known type
        if (classifySection(candidate) !== 'unknown') {
          headerText = candidate;
        }
      }
    }

    // Pattern 3: Standalone bold lines like **Key Benefits**
    if (!headerText) {
      const boldMatch = line.match(/^\*\*([^*]{3,60})\*\*\s*$/);
      if (boldMatch) {
        const candidate = boldMatch[1].trim();
        if (classifySection(candidate) !== 'unknown') {
          headerText = candidate;
        }
      }
    }

    if (headerText) {
      // Check for title line ("Landing Page Copy for X")
      const titleType = classifySection(headerText);
      if (titleType === 'title') {
        const titleVal = headerText.replace(/^Landing\s+Page\s+(?:Copy\s+)?(?:for\s+)?/i, '').trim();
        if (titleVal && !page.title) page.title = cleanText(titleVal);
        continue;
      }

      // Extract just the label vs remaining body content on the same line
      const { label, remainder } = extractSectionLabel(headerText);
      const type = classifySection(label) !== 'unknown' ? classifySection(label) : classifySection(headerText);

      // Flush previous section
      if (current) sections.push(current);
      current = { label: label || headerText, type, bodyLines: [] };

      // If there's remaining content on the header line, add it as body
      if (remainder) {
        current.bodyLines.push(remainder);
      }
    } else if (current) {
      current.bodyLines.push(rawLine);
    } else {
      // Before any section header — check for title
      const cleaned = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
      if (/landing\s+page/i.test(cleaned)) {
        const t = cleaned.replace(/^Landing\s+Page\s+(?:Copy\s+)?(?:for\s+)?/i, '').trim();
        if (t && t !== cleaned && !page.title) page.title = cleanText(t);
      }
    }
  }
  if (current) sections.push(current);

  // Process each section
  for (const sec of sections) {
    const bodyText = sec.bodyLines.join('\n').trim();

    switch (sec.type) {
      case 'hero':
        parseHeroSection(bodyText, page.hero);
        break;
      case 'socialProof': {
        const bullets = extractBullets(bodyText);
        if (bullets.length > 0) {
          page.socialProof = bullets;
        } else {
          // Try quoted strings on individual lines or inline
          const allQuoted = [];
          const qRegex = /["""'']([^"""'']{10,})["""'']/g;
          let qm;
          while ((qm = qRegex.exec(bodyText)) !== null) {
            allQuoted.push({ title: cleanText(qm[1]), description: '' });
          }
          if (allQuoted.length > 0) page.socialProof = allQuoted;
          else {
            // Last resort: split by lines and use non-empty lines
            const lines = bodyText.split('\n').map(l => l.trim()).filter(l => l.length > 10);
            if (lines.length > 0) page.socialProof = lines.map(l => ({ title: cleanText(l), description: '' }));
          }
        }
        break;
      }
      case 'problem':
        parseTwoPartSection(bodyText, page.problem);
        break;
      case 'solution':
        parseTwoPartSection(bodyText, page.solution);
        break;
      case 'benefits':
        page.benefits = extractBullets(bodyText);
        break;
      case 'howItWorks':
        page.howItWorks = extractNumberedItems(bodyText);
        if (page.howItWorks.length === 0) {
          // Fallback: try bullets
          page.howItWorks = extractBullets(bodyText);
        }
        break;
      case 'cta':
        parseCtaSection(bodyText, page.ctaSection);
        break;
      case 'testimonials':
        page.testimonials = extractTestimonials(bodyText);
        break;
      case 'footer':
        page.footer = cleanText(bodyText.split('\n').filter(l => l.trim()).join(' | ').replace(/\[|\]/g, ''));
        break;
      default:
        if (bodyText) page.rawSections.push({ label: cleanText(sec.label), text: cleanText(bodyText) });
    }
  }

  // Fallback: if no sections found, try line-by-line label parsing
  if (!page.hero.headline && page.socialProof.length === 0 && page.benefits.length === 0) {
    parseFlatFormat(text, page);
  }

  return page;
}

function parseHeroSection(text, hero) {
  if (!text) return;

  // The hero content might be a single run of text with inline labels like:
  // "Headline: X Subheadline: Y CTA Button: [Z] Trust Bar: [A] [B]"
  // Or it might be multi-line with one label per line.

  // Strategy: split by known label patterns to extract fields
  const labelPattern = /(?:^|\n)\s*(?:\*\*)?(?:Headline|Subheadline|Sub-headline|Subtitle|CTA\s*(?:Button)?|Trust\s*Bar|Micro\s*(?:Social\s*)?Proof)\s*(?:\*\*)?\s*:/gi;

  // Find all label positions
  const matches = [];
  let m;
  const searchText = text;
  const regex = new RegExp(labelPattern.source, 'gi');
  while ((m = regex.exec(searchText)) !== null) {
    matches.push({ index: m.index, match: m[0].trim() });
  }

  if (matches.length === 0) {
    // No structured labels — use first line as headline, rest as subheadline
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    if (lines.length > 0) hero.headline = cleanText(lines[0]);
    if (lines.length > 1) hero.subheadline = cleanText(lines.slice(1).join(' '));
    return;
  }

  // Extract each labeled segment
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index + matches[i].match.length;
    // Remove the colon from end of match
    const labelRaw = matches[i].match.replace(/\*\*/g, '').replace(/:\s*$/, '').trim();
    const end = i + 1 < matches.length ? matches[i + 1].index : searchText.length;
    const val = searchText.substring(start, end).replace(/^:\s*/, '').trim();
    const label = labelRaw.toLowerCase();

    if (/headline|title/i.test(label) && !/sub/i.test(label)) {
      hero.headline = cleanText(val);
    } else if (/sub/i.test(label)) {
      hero.subheadline = cleanText(val);
    } else if (/cta|button/i.test(label)) {
      hero.cta = cleanText(val.replace(/^\[\s*/, '').replace(/\s*\]$/, ''));
    } else if (/trust/i.test(label)) {
      const items = val.match(/\[([^\]]+)\]/g);
      if (items) hero.trustBar = items.map(s => cleanText(s.replace(/^\[|\]$/g, '')));
      else hero.trustBar = val.split(/[|,]/).map(s => cleanText(s)).filter(Boolean);
    } else if (/micro|proof/i.test(label)) {
      hero.microProof = cleanText(val);
    }
  }
}

function parseTwoPartSection(text, section) {
  if (!text) return;

  // Check for labeled fields first (e.g. "Headline: ..." / "Body: ...")
  const headlineMatch = text.match(/(?:^|\n)\s*(?:\*\*)?(?:Headline|Title)\s*(?:\*\*)?\s*:\s*(.+?)(?:\n|$)/i);
  const bodyMatch = text.match(/(?:^|\n)\s*(?:\*\*)?(?:Body|Copy|Description|Text)\s*(?:\*\*)?\s*:\s*(.+)/is);

  if (headlineMatch) {
    section.headline = cleanText(headlineMatch[1]);
    if (bodyMatch) {
      section.body = cleanText(bodyMatch[1]);
    } else {
      // Everything after the headline line is body
      const afterHeadline = text.substring(text.indexOf(headlineMatch[0]) + headlineMatch[0].length).trim();
      if (afterHeadline) section.body = cleanText(afterHeadline);
    }
    return;
  }

  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  if (lines.length === 0) return;

  // Try to detect sentence boundary for headline/body split
  // If first line is short, it's a headline
  const first = cleanText(lines[0]);
  if (lines.length > 1 && first.length < 100 && !first.startsWith('*') && !first.startsWith('-')) {
    section.headline = first;
    section.body = lines.slice(1).map(l => cleanText(l)).filter(l => l).join(' ');
  } else if (lines.length === 1 && first.length > 80) {
    // Single long line — try to split at sentence boundary
    const sentEnd = first.match(/^(.{15,80}?[.!?])\s+/);
    if (sentEnd) {
      section.headline = sentEnd[1];
      section.body = cleanText(first.substring(sentEnd[0].length));
    } else {
      section.headline = first;
    }
  } else {
    section.headline = first;
    if (lines.length > 1) {
      section.body = lines.slice(1).map(l => cleanText(l)).filter(l => l).join(' ');
    }
  }
}

function parseCtaSection(text, cta) {
  if (!text) return;

  // Extract CTA Button with label pattern anywhere in the text
  const ctaButtonMatch = text.match(/(?:^|\n)\s*(?:\*\*)?CTA\s*(?:Button)?\s*(?:\*\*)?\s*:\s*\[?\s*(.+?)\s*\]?\s*(?:\n|$)/im);
  if (ctaButtonMatch) {
    cta.cta = cleanText(ctaButtonMatch[1].replace(/^\[\s*/, '').replace(/\s*\]$/, ''));
  }

  // Remove the CTA Button line from text to process remaining as headline/body
  const remaining = text.replace(/(?:^|\n)\s*(?:\*\*)?CTA\s*(?:Button)?\s*(?:\*\*)?\s*:.*(?:\n|$)/im, '\n').trim();

  if (remaining) {
    const lines = remaining.split('\n').map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      const cleaned = cleanText(line);
      if (!cleaned) continue;
      // Check for labeled field
      const labelMatch = cleaned.match(/^(?:Headline|Title)\s*:\s*(.+)$/i);
      if (labelMatch) {
        cta.headline = cleanText(labelMatch[1]);
        continue;
      }
      const bodyLabelMatch = cleaned.match(/^(?:Body|Copy|Text|Description)\s*:\s*(.+)$/i);
      if (bodyLabelMatch) {
        cta.body = cleanText(bodyLabelMatch[1]);
        continue;
      }
      // Unlabeled: short = headline, long = body
      if (cleaned.length < 80 && !cta.headline) {
        cta.headline = cleaned;
      } else {
        cta.body = (cta.body ? cta.body + ' ' : '') + cleaned;
      }
    }
  }
}

function extractBullets(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => /^[-*•\d]/.test(l) || /^["""]/.test(l))
    .map(l => {
      // Strip bullet/number prefix
      let cleaned = l.replace(/^[-•]\s*/, '').replace(/^\*\s+/, '').replace(/^\d+[.)]\s*/, '');
      // Strip surrounding quotes (smart quotes, regular, backticks)
      cleaned = cleaned.replace(/^["""''`\s]+/, '').replace(/["""''`\s]+$/, '');
      // Split on colon for "title: description" but not if it's a stat/number or a URL
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx > 0 && colonIdx < 40 && !/^\d/.test(cleaned) && !/https?:/.test(cleaned)) {
        return {
          title: cleanText(cleaned.substring(0, colonIdx)),
          description: cleanText(cleaned.substring(colonIdx + 1)),
        };
      }
      return { title: cleanText(cleaned), description: '' };
    })
    .filter(b => b.title);
}

function extractNumberedItems(text) {
  return text.split('\n')
    .map(l => l.trim())
    .filter(l => /^\d+[.)]\s*/.test(l) || /^[-*•]\s*/.test(l))
    .map(l => {
      const cleaned = l.replace(/^\d+[.)]\s*/, '').replace(/^[-*•]\s*/, '');
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx > 0 && colonIdx < 50) {
        return {
          title: cleanText(cleaned.substring(0, colonIdx)),
          description: cleanText(cleaned.substring(colonIdx + 1)),
        };
      }
      return { title: cleanText(cleaned), description: '' };
    })
    .filter(item => item.title);
}

function extractTestimonials(text) {
  const results = [];
  // Match quoted text with attribution — handle regular and smart quotes
  // Pattern: "quote text" — Attribution Name
  const quoteRegex = /["""]([^"""]+)["""]?\s*(?:—|--|–|-)\s*([^\n]+)/g;
  let match;
  while ((match = quoteRegex.exec(text)) !== null) {
    results.push({ quote: cleanText(match[1]), attribution: cleanText(match[2]) });
  }
  if (results.length === 0) {
    // Fallback: bullets or standalone quoted lines
    const lines = text.split('\n').map(l => l.trim()).filter(l => l);
    for (const line of lines) {
      const cleaned = line.replace(/^[-*•]\s*/, '');
      // Check for "quote" — attribution
      const singleMatch = cleaned.match(/^["""]([^"""]+)["""]?\s*(?:—|--|–|-)\s*(.+)$/);
      if (singleMatch) {
        results.push({ quote: cleanText(singleMatch[1]), attribution: cleanText(singleMatch[2]) });
      } else if (/^["""]/.test(cleaned)) {
        results.push({ quote: cleanText(cleaned.replace(/^["""]+|["""]+$/g, '')), attribution: '' });
      } else if (cleaned.length > 20) {
        results.push({ quote: cleanText(cleaned), attribution: '' });
      }
    }
  }
  return results;
}

function parseFlatFormat(text, page) {
  const lines = text.split('\n');
  for (const rawLine of lines) {
    const line = rawLine.trim();
    const labelMatch = line.match(/^(?:\*\*)?([^:*]+?)(?:\*\*)?\s*:\s*(.+)$/);
    if (!labelMatch) continue;
    const label = labelMatch[1].toLowerCase();
    const val = cleanText(labelMatch[2]);
    if (/^headline$/i.test(label.trim()) && !page.hero.headline) page.hero.headline = val;
    else if (/sub\s*headline/i.test(label)) page.hero.subheadline = val;
    else if (/cta/i.test(label) && !page.hero.cta) page.hero.cta = cleanText(val.replace(/^\[|\]$/g, ''));
  }
}

// Extract a single field value from regeneration response
function extractRegeneratedValue(content) {
  if (!content) return '';
  let text = content;
  text = text.replace(/\n\n?(This\s+|If\s+you\s+|Feel\s+free|I'?ve\s+|Here'?s?\s+|The\s+new\s+).*/si, '');
  text = text.replace(/^#{1,4}\s*(Explanation|Why|Rationale).*/smi, '');
  const labelMatch = text.match(/\*\*[^*]+\*\*\s*:?\s*["']?(.+?)["']?\s*$/m);
  if (labelMatch) return cleanText(labelMatch[1]);
  const plainMatch = text.match(/^[A-Za-z\s]+:\s*["']?(.+?)["']?\s*$/m);
  if (plainMatch) return cleanText(plainMatch[1]);
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const meaningful = lines.map(l => cleanText(l)).filter(l => l.length > 0);
  return meaningful[meaningful.length - 1] || cleanText(text);
}

// Copyable field with regeneration + direction input
function CopyableField({ label, value, isRegenerating, onRegenerate, className, multiline = false }) {
  const [copied, setCopied] = useState(false);
  const [showDirectionInput, setShowDirectionInput] = useState(false);
  const [direction, setDirection] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (showDirectionInput && inputRef.current) inputRef.current.focus();
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
    <div className={clsx('group/field relative', className)}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover/field:opacity-100 transition-opacity">
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
                title="Regenerate"
              >
                {isRegenerating ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <RefreshCw className="w-2.5 h-2.5" />}
              </button>
            </>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[10px] text-neutral-400 hover:text-pastel-mint transition-all px-1.5 py-0.5 rounded bg-neutral-800/80"
          >
            {copied ? <><Check className="w-2.5 h-2.5 text-pastel-mint" /> Copied</> : <><Copy className="w-2.5 h-2.5" /> Copy</>}
          </button>
        </div>
      </div>
      <div
        className={clsx(
          "text-sm text-neutral-200 cursor-pointer hover:bg-neutral-800/40 rounded px-2 py-1.5 -mx-2 transition-colors",
          isRegenerating && "opacity-50",
          multiline && "leading-relaxed"
        )}
        onClick={handleCopy}
        title="Click to copy"
      >
        {value}
      </div>
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
            placeholder="e.g. more urgency, shorter..."
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

// SEO scoring and analysis
function analyzeSEO(lp) {
  const checks = [];
  let score = 0;
  let maxScore = 0;

  // 1. Headline length (ideal: 30-65 chars)
  maxScore += 10;
  const hLen = (lp.hero.headline || '').length;
  if (hLen === 0) {
    checks.push({ label: 'Headline', status: 'fail', tip: 'Add a headline — it\'s the most important element for SEO and conversions.', points: 0 });
  } else if (hLen >= 30 && hLen <= 65) {
    checks.push({ label: 'Headline Length', status: 'pass', tip: `${hLen} chars — ideal length for search and readability.`, points: 10 });
    score += 10;
  } else if (hLen < 30) {
    checks.push({ label: 'Headline Length', status: 'warn', tip: `${hLen} chars — try 30-65 chars for better search visibility.`, points: 5 });
    score += 5;
  } else {
    checks.push({ label: 'Headline Length', status: 'warn', tip: `${hLen} chars — shorten to under 65 for search display.`, points: 5 });
    score += 5;
  }

  // 2. Subheadline present and length
  maxScore += 8;
  const sLen = (lp.hero.subheadline || '').length;
  if (sLen > 20) {
    checks.push({ label: 'Subheadline', status: 'pass', tip: 'Supporting copy reinforces the value proposition.', points: 8 });
    score += 8;
  } else if (sLen > 0) {
    checks.push({ label: 'Subheadline', status: 'warn', tip: 'Expand subheadline — aim for 50-150 chars for better context.', points: 4 });
    score += 4;
  } else {
    checks.push({ label: 'Subheadline', status: 'fail', tip: 'Add a subheadline to reinforce your value proposition.', points: 0 });
  }

  // 3. CTA present
  maxScore += 10;
  if (lp.hero.cta) {
    const ctaWords = lp.hero.cta.split(/\s+/).length;
    if (ctaWords >= 2 && ctaWords <= 5) {
      checks.push({ label: 'Hero CTA', status: 'pass', tip: `"${lp.hero.cta}" — action-oriented and concise.`, points: 10 });
      score += 10;
    } else {
      checks.push({ label: 'Hero CTA', status: 'warn', tip: 'CTA should be 2-5 words, starting with an action verb.', points: 6 });
      score += 6;
    }
  } else {
    checks.push({ label: 'Hero CTA', status: 'fail', tip: 'Add a CTA button — every landing page needs a clear call to action.', points: 0 });
  }

  // 4. Trust elements
  maxScore += 8;
  const trustCount = lp.hero.trustBar.length + (lp.hero.microProof ? 1 : 0);
  if (trustCount >= 3) {
    checks.push({ label: 'Trust Signals', status: 'pass', tip: `${trustCount} trust elements — builds credibility effectively.`, points: 8 });
    score += 8;
  } else if (trustCount > 0) {
    checks.push({ label: 'Trust Signals', status: 'warn', tip: `${trustCount} trust element(s) — aim for 3+ (logos, badges, stats).`, points: 4 });
    score += 4;
  } else {
    checks.push({ label: 'Trust Signals', status: 'fail', tip: 'Add trust signals (partner logos, certifications, stats) to build credibility.', points: 0 });
  }

  // 5. Social proof
  maxScore += 8;
  const proofCount = lp.socialProof.length + lp.testimonials.length;
  if (proofCount >= 3) {
    checks.push({ label: 'Social Proof', status: 'pass', tip: `${proofCount} proof points — strong social validation.`, points: 8 });
    score += 8;
  } else if (proofCount > 0) {
    checks.push({ label: 'Social Proof', status: 'warn', tip: `${proofCount} proof point(s) — add more stats, quotes, or testimonials.`, points: 4 });
    score += 4;
  } else {
    checks.push({ label: 'Social Proof', status: 'fail', tip: 'Add social proof — testimonials, stats, or customer logos.', points: 0 });
  }

  // 6. Problem/Solution present
  maxScore += 8;
  if (lp.problem.headline || lp.problem.body) {
    if (lp.solution.headline || lp.solution.body) {
      checks.push({ label: 'Problem → Solution', status: 'pass', tip: 'Clear problem/solution narrative drives conversions.', points: 8 });
      score += 8;
    } else {
      checks.push({ label: 'Problem → Solution', status: 'warn', tip: 'Add a solution section to complete the narrative arc.', points: 4 });
      score += 4;
    }
  } else {
    checks.push({ label: 'Problem → Solution', status: 'fail', tip: 'Add problem/agitation copy to create urgency before presenting the solution.', points: 0 });
  }

  // 7. Benefits
  maxScore += 8;
  if (lp.benefits.length >= 3) {
    checks.push({ label: 'Benefits', status: 'pass', tip: `${lp.benefits.length} benefits — clear value communication.`, points: 8 });
    score += 8;
  } else if (lp.benefits.length > 0) {
    checks.push({ label: 'Benefits', status: 'warn', tip: `${lp.benefits.length} benefit(s) — aim for 3-5 for stronger persuasion.`, points: 4 });
    score += 4;
  } else {
    checks.push({ label: 'Benefits', status: 'fail', tip: 'Add a benefits section with 3-5 specific value propositions.', points: 0 });
  }

  // 8. How It Works
  maxScore += 6;
  if (lp.howItWorks.length >= 3) {
    checks.push({ label: 'How It Works', status: 'pass', tip: `${lp.howItWorks.length} steps — reduces friction and uncertainty.`, points: 6 });
    score += 6;
  } else if (lp.howItWorks.length > 0) {
    checks.push({ label: 'How It Works', status: 'warn', tip: 'Add more steps — a clear process builds confidence.', points: 3 });
    score += 3;
  } else {
    checks.push({ label: 'How It Works', status: 'fail', tip: 'Add a "How It Works" section to reduce purchase anxiety.', points: 0 });
  }

  // 9. Secondary CTA
  maxScore += 6;
  if (lp.ctaSection.cta) {
    checks.push({ label: 'Secondary CTA', status: 'pass', tip: 'Reinforcement CTA captures visitors who scroll.', points: 6 });
    score += 6;
  } else {
    checks.push({ label: 'Secondary CTA', status: 'warn', tip: 'Add a secondary CTA section lower on the page for scrollers.', points: 0 });
  }

  // 10. Content density — overall word count
  maxScore += 8;
  const allText = [lp.hero.headline, lp.hero.subheadline, lp.problem.body, lp.solution.body,
    ...lp.benefits.map(b => b.title + ' ' + b.description),
    ...lp.howItWorks.map(s => s.title + ' ' + s.description),
    lp.ctaSection.body].filter(Boolean).join(' ');
  const wordCount = allText.split(/\s+/).filter(w => w).length;
  if (wordCount >= 100 && wordCount <= 500) {
    checks.push({ label: 'Content Density', status: 'pass', tip: `${wordCount} words — good balance for landing pages.`, points: 8 });
    score += 8;
  } else if (wordCount > 500) {
    checks.push({ label: 'Content Density', status: 'warn', tip: `${wordCount} words — consider trimming for scannability.`, points: 5 });
    score += 5;
  } else if (wordCount > 30) {
    checks.push({ label: 'Content Density', status: 'warn', tip: `${wordCount} words — aim for 100-500 for SEO and persuasion.`, points: 4 });
    score += 4;
  } else {
    checks.push({ label: 'Content Density', status: 'fail', tip: 'Not enough copy — add more content for search engines and visitors.', points: 0 });
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  return { score: pct, checks, passes: checks.filter(c => c.status === 'pass').length, total: checks.length };
}

function SEOScorePanel({ lp, onImprove, isImproving, pendingFixes, onAcceptFixes, onRejectFixes }) {
  const [expanded, setExpanded] = useState(false);
  const analysis = useMemo(() => analyzeSEO(lp), [lp]);

  const scoreColor = analysis.score >= 80 ? 'text-green-400' : analysis.score >= 50 ? 'text-yellow-400' : 'text-red-400';
  const failChecks = analysis.checks.filter(c => c.status === 'fail' || c.status === 'warn');
  const hasPending = pendingFixes && Object.keys(pendingFixes).length > 0;

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/50 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-neutral-800/30 transition-colors"
      >
        <div className="relative w-9 h-9 flex-shrink-0">
          <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-neutral-800" />
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3"
              className={scoreColor}
              strokeDasharray={`${analysis.score * 0.942} 100`}
              strokeLinecap="round"
            />
          </svg>
          <span className={clsx("absolute inset-0 flex items-center justify-center text-[10px] font-bold", scoreColor)}>
            {analysis.score}
          </span>
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-1.5">
            <Search className="w-3 h-3 text-neutral-500" />
            <span className="text-xs font-medium text-neutral-300">SEO Score</span>
          </div>
          <p className="text-[10px] text-neutral-500">
            {analysis.passes}/{analysis.total} checks passed
            {failChecks.length > 0 && ` · ${failChecks.length} improvement${failChecks.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onImprove && failChecks.length > 0 && !hasPending && (
            <button
              onClick={(e) => { e.stopPropagation(); onImprove(failChecks); }}
              disabled={isImproving}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-pastel-sky hover:bg-pastel-sky/10 rounded-lg transition-all disabled:opacity-50"
              title="AI-improve weak areas"
            >
              {isImproving ? <Loader2 className="w-3 h-3 animate-spin" /> : <TrendingUp className="w-3 h-3" />}
              Improve
            </button>
          )}
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-neutral-500" /> : <ChevronRight className="w-3.5 h-3.5 text-neutral-500" />}
        </div>
      </button>

      {/* Pending fixes review */}
      {hasPending && (
        <div className="border-t border-pastel-sky/20 bg-pastel-sky/5 px-3 py-2.5">
          <div className="flex items-center gap-1.5 mb-2">
            <TrendingUp className="w-3 h-3 text-pastel-sky" />
            <span className="text-[10px] font-medium text-pastel-sky">Proposed Improvements</span>
            <span className="text-[10px] text-neutral-500 ml-auto">{Object.keys(pendingFixes).length} field{Object.keys(pendingFixes).length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2 mb-2.5">
            {Object.entries(pendingFixes).map(([key, val]) => {
              const friendlyLabel = key
                .replace('hero.', 'Hero ')
                .replace('problem.', 'Problem ')
                .replace('solution.', 'Solution ')
                .replace('ctaSection.', 'CTA ')
                .replace(/^benefit-(\d+)$/, (_, n) => `Benefit ${parseInt(n) + 1}`)
                .replace(/^howItWorks-(\d+)$/, (_, n) => `Step ${parseInt(n) + 1}`)
                .replace(/^trustBar-(\d+)$/, (_, n) => `Trust Bar ${parseInt(n) + 1}`)
                .replace(/^socialProof-(\d+)$/, (_, n) => `Social Proof ${parseInt(n) + 1}`)
                .replace(/^testimonial-(\d+)$/, (_, n) => `Testimonial ${parseInt(n) + 1}`);
              return (
                <div key={key} className="rounded-md bg-neutral-800/60 px-2 py-1.5">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-medium">{friendlyLabel}</span>
                  <p className="text-[11px] text-pastel-sky/90 mt-0.5 leading-relaxed">{val}</p>
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onAcceptFixes}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-green-400 bg-green-400/10 hover:bg-green-400/20 border border-green-400/20 rounded-lg transition-all"
            >
              <Check className="w-3 h-3" />
              Accept
            </button>
            <button
              onClick={onRejectFixes}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[11px] font-medium text-neutral-400 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg transition-all"
            >
              <X className="w-3 h-3" />
              Reject
            </button>
          </div>
        </div>
      )}

      {expanded && (
        <div className="border-t border-neutral-800 px-3 py-2 space-y-1.5">
          {analysis.checks.map((check, i) => (
            <div key={i} className="flex items-start gap-2">
              {check.status === 'pass' ? (
                <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
              ) : check.status === 'warn' ? (
                <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
              ) : (
                <X className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-neutral-300">{check.label}</span>
                  {check.status !== 'pass' && onImprove && !hasPending && (
                    <button
                      onClick={() => onImprove([check])}
                      disabled={isImproving}
                      className="text-[9px] text-pastel-sky hover:text-pastel-sky/80 hover:bg-pastel-sky/10 px-1.5 py-0.5 rounded transition-all disabled:opacity-50 flex-shrink-0"
                    >
                      {isImproving ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : 'Fix'}
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-neutral-500 leading-relaxed">{check.tip}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LandingPagePanel({ message, onClose, clientId, conversationId }) {
  const [copiedAll, setCopiedAll] = useState(false);
  const [overrides, setOverrides] = useState({});
  const [regeneratingField, setRegeneratingField] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState(new Set());
  const [isImproving, setIsImproving] = useState(false);
  const [pendingFixes, setPendingFixes] = useState(null);

  const parsedLP = useMemo(() => parseLandingPage(message?.content), [message?.content]);

  // Apply overrides
  const lp = useMemo(() => {
    const r = JSON.parse(JSON.stringify(parsedLP));
    for (const [key, val] of Object.entries(overrides)) {
      if (key === 'hero.headline') r.hero.headline = val;
      else if (key === 'hero.subheadline') r.hero.subheadline = val;
      else if (key === 'hero.cta') r.hero.cta = val;
      else if (key === 'hero.microProof') r.hero.microProof = val;
      else if (key === 'problem.headline') r.problem.headline = val;
      else if (key === 'problem.body') r.problem.body = val;
      else if (key === 'solution.headline') r.solution.headline = val;
      else if (key === 'solution.body') r.solution.body = val;
      else if (key === 'ctaSection.headline') r.ctaSection.headline = val;
      else if (key === 'ctaSection.body') r.ctaSection.body = val;
      else if (key === 'ctaSection.cta') r.ctaSection.cta = val;
      else if (key.startsWith('benefit-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < r.benefits.length) r.benefits[idx] = { ...r.benefits[idx], title: val };
      } else if (key.startsWith('howItWorks-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < r.howItWorks.length) r.howItWorks[idx] = { ...r.howItWorks[idx], title: val };
      } else if (key.startsWith('socialProof-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < r.socialProof.length) r.socialProof[idx] = { ...r.socialProof[idx], title: val };
      } else if (key.startsWith('testimonial-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < r.testimonials.length) r.testimonials[idx] = { ...r.testimonials[idx], quote: val };
      } else if (key.startsWith('trustBar-')) {
        const idx = parseInt(key.split('-')[1]);
        if (idx < r.hero.trustBar.length) r.hero.trustBar[idx] = val;
      }
    }
    return r;
  }, [parsedLP, overrides]);

  const buildContext = useCallback(() => {
    const parts = [];
    if (lp.hero.headline) parts.push(`Hero Headline: ${lp.hero.headline}`);
    if (lp.hero.subheadline) parts.push(`Hero Subheadline: ${lp.hero.subheadline}`);
    if (lp.hero.cta) parts.push(`Hero CTA: ${lp.hero.cta}`);
    if (lp.problem.headline) parts.push(`Problem Headline: ${lp.problem.headline}`);
    if (lp.problem.body) parts.push(`Problem: ${lp.problem.body}`);
    if (lp.solution.headline) parts.push(`Solution Headline: ${lp.solution.headline}`);
    if (lp.solution.body) parts.push(`Solution: ${lp.solution.body}`);
    lp.benefits.forEach((b, i) => parts.push(`Benefit ${i + 1}: ${b.title}${b.description ? ' — ' + b.description : ''}`));
    if (lp.ctaSection.headline) parts.push(`CTA Headline: ${lp.ctaSection.headline}`);
    if (lp.ctaSection.cta) parts.push(`CTA Button: ${lp.ctaSection.cta}`);
    return parts.join('\n');
  }, [lp]);

  const handleRegenerate = useCallback(async (fieldKey, fieldLabel, currentValue, userDirection = null) => {
    if (!clientId || regeneratingField) return;
    setRegeneratingField(fieldKey);
    try {
      const context = buildContext();
      let prompt = `I have this landing page copy:\n\n${context}\n\nRewrite ONLY the "${fieldLabel}" field. The current value is: "${currentValue}"`;
      if (userDirection) prompt += `\n\nDirection: ${userDirection}`;
      prompt += `\n\nGive me a single new alternative. Reply with ONLY the new text for this field, nothing else. No labels, no quotes, no explanation.`;

      const response = await chatApi.sendMessage(clientId, prompt, { conversationId });
      const newValue = extractRegeneratedValue(response?.message?.content || '');
      if (newValue) setOverrides(prev => ({ ...prev, [fieldKey]: newValue }));
    } catch (err) {
      console.error('Failed to regenerate field:', err);
    } finally {
      setRegeneratingField(null);
    }
  }, [clientId, conversationId, regeneratingField, buildContext]);

  const handleCopyAll = () => {
    const parts = [];
    if (lp.hero.headline) parts.push(`Headline: ${lp.hero.headline}`);
    if (lp.hero.subheadline) parts.push(`Subheadline: ${lp.hero.subheadline}`);
    if (lp.hero.cta) parts.push(`Hero CTA: ${lp.hero.cta}`);
    if (lp.hero.trustBar.length > 0) parts.push(`Trust Bar: ${lp.hero.trustBar.join(' | ')}`);
    if (lp.hero.microProof) parts.push(`Micro Proof: ${lp.hero.microProof}`);
    lp.socialProof.forEach((sp, i) => parts.push(`Social Proof ${i + 1}: ${sp.title}${sp.description ? ' — ' + sp.description : ''}`));
    if (lp.problem.headline) parts.push(`Problem Headline: ${lp.problem.headline}`);
    if (lp.problem.body) parts.push(`Problem: ${lp.problem.body}`);
    if (lp.solution.headline) parts.push(`Solution Headline: ${lp.solution.headline}`);
    if (lp.solution.body) parts.push(`Solution: ${lp.solution.body}`);
    lp.benefits.forEach((b, i) => parts.push(`Benefit ${i + 1}: ${b.title}${b.description ? ' — ' + b.description : ''}`));
    lp.howItWorks.forEach((s, i) => parts.push(`Step ${i + 1}: ${s.title}${s.description ? ' — ' + s.description : ''}`));
    if (lp.ctaSection.headline) parts.push(`CTA Headline: ${lp.ctaSection.headline}`);
    if (lp.ctaSection.body) parts.push(`CTA Body: ${lp.ctaSection.body}`);
    if (lp.ctaSection.cta) parts.push(`CTA Button: ${lp.ctaSection.cta}`);
    lp.testimonials.forEach((t, i) => parts.push(`Testimonial ${i + 1}: "${t.quote}"${t.attribution ? ' — ' + t.attribution : ''}`));
    if (lp.footer) parts.push(`Footer: ${lp.footer}`);
    lp.rawSections.forEach(s => parts.push(`${s.label}: ${s.text}`));
    navigator.clipboard.writeText(parts.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  const handleSEOImprove = useCallback(async (failChecks) => {
    if (!clientId || isImproving) return;
    setIsImproving(true);
    setPendingFixes(null);
    try {
      const context = buildContext();
      const issues = failChecks.map(c => `- ${c.label}: ${c.tip}`).join('\n');
      const prompt = `I have this landing page copy:\n\n${context}\n\nSEO analysis found these issues:\n${issues}\n\nRewrite the landing page copy fixing ALL of these issues. Keep the same structure but improve the weak areas. Format as:\nHeadline: ...\nSubheadline: ...\nHero CTA: ...\nTrust Bar: item1 | item2 | item3\nMicro Proof: ...\nProblem Headline: ...\nProblem Body: ...\nSolution Headline: ...\nSolution Body: ...\nBenefit 1: title: description\nBenefit 2: title: description\nBenefit 3: title: description\nStep 1: title: description\nStep 2: title: description\nStep 3: title: description\nCTA Headline: ...\nCTA Body: ...\nCTA Button: ...\n\nOnly include fields that need improvement. No explanation, just the improved copy.`;

      const response = await chatApi.sendMessage(clientId, prompt, { conversationId });
      const text = response?.message?.content || '';

      // Parse the response into proposed fixes (don't apply yet)
      const proposed = {};
      const lines = text.split('\n');
      for (const line of lines) {
        const m = line.match(/^([^:]+):\s*(.+)$/);
        if (!m) continue;
        const label = m[1].trim().toLowerCase();
        const val = cleanText(m[2]);
        if (!val) continue;

        if (/^headline$/i.test(label)) proposed['hero.headline'] = val;
        else if (/^sub\s*headline$/i.test(label)) proposed['hero.subheadline'] = val;
        else if (/^hero\s*cta$/i.test(label)) proposed['hero.cta'] = val;
        else if (/^trust\s*bar$/i.test(label)) {
          const items = val.split('|').map(s => cleanText(s)).filter(Boolean);
          items.forEach((item, i) => { proposed[`trustBar-${i}`] = item; });
        }
        else if (/^micro/i.test(label)) proposed['hero.microProof'] = val;
        else if (/^problem\s*headline$/i.test(label)) proposed['problem.headline'] = val;
        else if (/^problem\s*(?:body)?$/i.test(label)) proposed['problem.body'] = val;
        else if (/^solution\s*headline$/i.test(label)) proposed['solution.headline'] = val;
        else if (/^solution\s*(?:body)?$/i.test(label)) proposed['solution.body'] = val;
        else if (/^benefit\s*(\d+)$/i.test(label)) {
          const idx = parseInt(label.match(/\d+/)[0]) - 1;
          const parts = val.split(':');
          proposed[`benefit-${idx}`] = parts.length > 1 ? cleanText(parts[0]) : val;
        }
        else if (/^step\s*(\d+)$/i.test(label)) {
          const idx = parseInt(label.match(/\d+/)[0]) - 1;
          const parts = val.split(':');
          proposed[`howItWorks-${idx}`] = parts.length > 1 ? cleanText(parts[0]) : val;
        }
        else if (/^cta\s*headline$/i.test(label)) proposed['ctaSection.headline'] = val;
        else if (/^cta\s*body$/i.test(label)) proposed['ctaSection.body'] = val;
        else if (/^cta\s*button$/i.test(label)) proposed['ctaSection.cta'] = val;
      }

      if (Object.keys(proposed).length > 0) {
        setPendingFixes(proposed);
      }
    } catch (err) {
      console.error('Failed to improve SEO:', err);
    } finally {
      setIsImproving(false);
    }
  }, [clientId, conversationId, isImproving, buildContext]);

  const handleAcceptFixes = useCallback(() => {
    if (!pendingFixes) return;
    setOverrides(prev => ({ ...prev, ...pendingFixes }));
    setPendingFixes(null);
  }, [pendingFixes]);

  const handleRejectFixes = useCallback(() => {
    setPendingFixes(null);
  }, []);

  const toggleSection = (name) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  if (!message) return null;

  const SectionHeader = ({ name, label, icon: Icon, color = 'text-neutral-400' }) => (
    <button
      onClick={() => toggleSection(name)}
      className="flex items-center gap-2 w-full py-1.5 text-left group/sec"
    >
      {collapsedSections.has(name) ? (
        <ChevronRight className="w-3 h-3 text-neutral-600" />
      ) : (
        <ChevronDown className="w-3 h-3 text-neutral-600" />
      )}
      <Icon className={clsx('w-3.5 h-3.5', color)} />
      <span className="text-[10px] uppercase tracking-wider text-neutral-500 font-medium">{label}</span>
    </button>
  );

  return (
    <div className="w-[440px] flex-shrink-0 border-l border-neutral-800 bg-neutral-900/80 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-pastel-sky/15 border border-pastel-sky/25 flex items-center justify-center">
            <Layout className="w-4 h-4 text-pastel-sky" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-100">Landing Page</h3>
            <p className="text-[10px] text-neutral-500">{lp.title || 'Click any field to copy'}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-neutral-400 hover:text-pastel-mint hover:bg-neutral-800 rounded-lg transition-all"
          >
            {copiedAll ? <><Check className="w-3 h-3 text-pastel-mint" /> Copied All</> : <><Copy className="w-3 h-3" /> Copy All</>}
          </button>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scrollbar-dark">
        {/* SEO Score */}
        <SEOScorePanel lp={lp} onImprove={handleSEOImprove} isImproving={isImproving} pendingFixes={pendingFixes} onAcceptFixes={handleAcceptFixes} onRejectFixes={handleRejectFixes} />

        {/* Copy Fields */}
        <div className="space-y-4">

          {/* Hero Section */}
          {(lp.hero.headline || lp.hero.subheadline || lp.hero.cta) && (
            <div>
              <SectionHeader name="hero" label="Hero / Above the Fold" icon={Zap} color="text-pastel-peach" />
              {!collapsedSections.has('hero') && (
                <div className="pl-5 space-y-2 mt-1">
                  <CopyableField label="Headline" value={lp.hero.headline} isRegenerating={regeneratingField === 'hero.headline'} onRegenerate={(dir) => handleRegenerate('hero.headline', 'Headline', lp.hero.headline, dir)} />
                  <CopyableField label="Subheadline" value={lp.hero.subheadline} isRegenerating={regeneratingField === 'hero.subheadline'} onRegenerate={(dir) => handleRegenerate('hero.subheadline', 'Subheadline', lp.hero.subheadline, dir)} multiline />
                  <CopyableField label="CTA Button" value={lp.hero.cta} isRegenerating={regeneratingField === 'hero.cta'} onRegenerate={(dir) => handleRegenerate('hero.cta', 'Hero CTA Button', lp.hero.cta, dir)} />
                  {lp.hero.trustBar.map((t, i) => (
                    <CopyableField key={`trust-${i}`} label={`Trust Bar ${i + 1}`} value={t} isRegenerating={regeneratingField === `trustBar-${i}`} onRegenerate={(dir) => handleRegenerate(`trustBar-${i}`, `Trust Bar Item ${i + 1}`, t, dir)} />
                  ))}
                  <CopyableField label="Micro Social Proof" value={lp.hero.microProof} isRegenerating={regeneratingField === 'hero.microProof'} onRegenerate={(dir) => handleRegenerate('hero.microProof', 'Micro Social Proof', lp.hero.microProof, dir)} />
                </div>
              )}
            </div>
          )}

          {/* Social Proof */}
          {lp.socialProof.length > 0 && (
            <div>
              <SectionHeader name="socialProof" label="Social Proof" icon={Star} color="text-pastel-lemon" />
              {!collapsedSections.has('socialProof') && (
                <div className="pl-5 space-y-2 mt-1">
                  {lp.socialProof.map((sp, i) => {
                    const key = `socialProof-${i}`;
                    const val = sp.title + (sp.description ? `: ${sp.description}` : '');
                    return <CopyableField key={key} label={`Proof Point ${i + 1}`} value={val} isRegenerating={regeneratingField === key} onRegenerate={(dir) => handleRegenerate(key, `Social Proof ${i + 1}`, val, dir)} />;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Problem */}
          {(lp.problem.headline || lp.problem.body) && (
            <div>
              <SectionHeader name="problem" label="Problem / Agitation" icon={Shield} color="text-pastel-coral" />
              {!collapsedSections.has('problem') && (
                <div className="pl-5 space-y-2 mt-1">
                  <CopyableField label="Problem Headline" value={lp.problem.headline} isRegenerating={regeneratingField === 'problem.headline'} onRegenerate={(dir) => handleRegenerate('problem.headline', 'Problem Headline', lp.problem.headline, dir)} />
                  <CopyableField label="Problem Body" value={lp.problem.body} isRegenerating={regeneratingField === 'problem.body'} onRegenerate={(dir) => handleRegenerate('problem.body', 'Problem Body Copy', lp.problem.body, dir)} multiline />
                </div>
              )}
            </div>
          )}

          {/* Solution */}
          {(lp.solution.headline || lp.solution.body) && (
            <div>
              <SectionHeader name="solution" label="Solution" icon={Zap} color="text-pastel-mint" />
              {!collapsedSections.has('solution') && (
                <div className="pl-5 space-y-2 mt-1">
                  <CopyableField label="Solution Headline" value={lp.solution.headline} isRegenerating={regeneratingField === 'solution.headline'} onRegenerate={(dir) => handleRegenerate('solution.headline', 'Solution Headline', lp.solution.headline, dir)} />
                  <CopyableField label="Solution Body" value={lp.solution.body} isRegenerating={regeneratingField === 'solution.body'} onRegenerate={(dir) => handleRegenerate('solution.body', 'Solution Body Copy', lp.solution.body, dir)} multiline />
                </div>
              )}
            </div>
          )}

          {/* Benefits */}
          {lp.benefits.length > 0 && (
            <div>
              <SectionHeader name="benefits" label="Key Benefits" icon={CheckCircle} color="text-pastel-mint" />
              {!collapsedSections.has('benefits') && (
                <div className="pl-5 space-y-2 mt-1">
                  {lp.benefits.map((b, i) => {
                    const key = `benefit-${i}`;
                    const val = b.title + (b.description ? `: ${b.description}` : '');
                    return <CopyableField key={key} label={`Benefit ${i + 1}`} value={val} isRegenerating={regeneratingField === key} onRegenerate={(dir) => handleRegenerate(key, `Benefit ${i + 1}`, val, dir)} />;
                  })}
                </div>
              )}
            </div>
          )}

          {/* How It Works */}
          {lp.howItWorks.length > 0 && (
            <div>
              <SectionHeader name="howItWorks" label="How It Works" icon={ArrowRight} color="text-pastel-sky" />
              {!collapsedSections.has('howItWorks') && (
                <div className="pl-5 space-y-2 mt-1">
                  {lp.howItWorks.map((step, i) => {
                    const key = `howItWorks-${i}`;
                    const val = step.title + (step.description ? `: ${step.description}` : '');
                    return <CopyableField key={key} label={`Step ${i + 1}`} value={val} isRegenerating={regeneratingField === key} onRegenerate={(dir) => handleRegenerate(key, `Step ${i + 1}`, val, dir)} />;
                  })}
                </div>
              )}
            </div>
          )}

          {/* CTA Section */}
          {(lp.ctaSection.headline || lp.ctaSection.cta) && (
            <div>
              <SectionHeader name="cta" label="Call to Action" icon={ArrowRight} color="text-pastel-lavender" />
              {!collapsedSections.has('cta') && (
                <div className="pl-5 space-y-2 mt-1">
                  <CopyableField label="CTA Headline" value={lp.ctaSection.headline} isRegenerating={regeneratingField === 'ctaSection.headline'} onRegenerate={(dir) => handleRegenerate('ctaSection.headline', 'CTA Headline', lp.ctaSection.headline, dir)} />
                  <CopyableField label="CTA Body" value={lp.ctaSection.body} isRegenerating={regeneratingField === 'ctaSection.body'} onRegenerate={(dir) => handleRegenerate('ctaSection.body', 'CTA Body', lp.ctaSection.body, dir)} multiline />
                  <CopyableField label="CTA Button" value={lp.ctaSection.cta} isRegenerating={regeneratingField === 'ctaSection.cta'} onRegenerate={(dir) => handleRegenerate('ctaSection.cta', 'CTA Button Text', lp.ctaSection.cta, dir)} />
                </div>
              )}
            </div>
          )}

          {/* Testimonials */}
          {lp.testimonials.length > 0 && (
            <div>
              <SectionHeader name="testimonials" label="Testimonials" icon={Quote} color="text-pastel-peach" />
              {!collapsedSections.has('testimonials') && (
                <div className="pl-5 space-y-2 mt-1">
                  {lp.testimonials.map((t, i) => {
                    const key = `testimonial-${i}`;
                    const val = `"${t.quote}"${t.attribution ? ` — ${t.attribution}` : ''}`;
                    return <CopyableField key={key} label={`Testimonial ${i + 1}`} value={val} isRegenerating={regeneratingField === key} onRegenerate={(dir) => handleRegenerate(key, `Testimonial ${i + 1}`, t.quote, dir)} multiline />;
                  })}
                </div>
              )}
            </div>
          )}

          {/* Raw/unknown sections */}
          {lp.rawSections.map((s, i) => (
            <CopyableField key={`raw-${i}`} label={s.label} value={s.text} isRegenerating={regeneratingField === `raw-${i}`} onRegenerate={(dir) => handleRegenerate(`raw-${i}`, s.label, s.text, dir)} multiline />
          ))}
        </div>
      </div>
    </div>
  );
}
