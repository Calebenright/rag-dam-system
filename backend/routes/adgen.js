import express from 'express';
import multer from 'multer';
import os from 'os';
import fs from 'fs/promises';
import { analyzeMultipleImages, analyzeImage } from '../services/openaiService.js';
import { semanticSearch } from '../services/semanticSearch.js';
import { scrapeUrl } from '../services/urlScraper.js';
import { AD_FORMATS } from '../constants/adFormats.js';
import { getDefaultStyleConfig } from '../constants/adStyleConfig.js';
import { readEntireSheet, writeSheetRange } from '../services/googleSheets.js';
import OpenAI from 'openai';

const AD_COPY_SHEET_ID = '1pWA99dxzx-8FyhulLBg00Or5tlwUJMLDlUknSaQUk4c';

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const adUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20971520 }, // 20MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

/**
 * Process uploaded images - read to base64 and analyze with vision model.
 */
async function processImages(imageFiles) {
  if (!imageFiles || imageFiles.length === 0) return null;

  try {
    if (imageFiles.length === 1) {
      const filePath = imageFiles[0].path;
      const result = await analyzeImage(filePath, 'Describe this image in detail for ad copywriting purposes. What product, service, or brand is shown? What are the key visual elements, colors, mood, and messaging?');
      return result;
    }

    const sources = imageFiles.map(f => f.path);
    const result = await analyzeMultipleImages(sources, 'Describe these images in detail for ad copywriting purposes. What product, service, or brand is shown? What are the key visual elements, colors, mood, and messaging across these images?');
    return result;
  } catch (error) {
    console.warn('Image analysis failed:', error.message);
    return null;
  }
}

/**
 * Build a search query from user inputs for semantic search.
 */
function buildSearchQuery(text, url, platform) {
  const parts = [];
  if (text) parts.push(text);
  if (url) {
    // Extract domain name as a keyword hint
    try {
      const domain = new URL(url.startsWith('http') ? url : 'https://' + url).hostname.replace('www.', '');
      parts.push(domain);
    } catch {}
  }
  parts.push(`${platform} advertising copy`);
  return parts.join(' ').substring(0, 500);
}

/**
 * Build source attribution from search results.
 */
function buildSourceRefs(searchResults) {
  if (!searchResults?.documents) return [];
  return searchResults.documents
    .filter(d => d.similarity_score > 0.3)
    .map(d => ({
      id: d.id,
      title: d.title || d.file_name || 'Untitled',
      similarity: Math.round(d.similarity_score * 100),
      isGlobal: d.is_global || false,
      group: d.custom_group || null,
    }));
}

/**
 * Full option maps for style instructions (used by both fixed and random modes).
 */
const STRUCTURE_MAP = {
  'hook-body-closer': `Use a 3-part paragraph structure separated by \\n\\n (double newline):
1. **Hook** - A bold, attention-grabbing opening line that calls out the audience or a pain point.
2. **Body** - The value proposition with concrete details, numbers, or benefits.
3. **Closer** - A short, punchy line about who it's for or a soft CTA.
Each part is 1-2 sentences. Always use \\n\\n between parts in the JSON string.`,
  'hook-body': `Use a 2-part paragraph structure separated by \\n\\n (double newline):
1. **Hook** - A bold, attention-grabbing opening that calls out the audience or pain point.
2. **Body** - The value proposition with details and a soft CTA woven in.
Each part is 1-3 sentences. Use \\n\\n between parts in the JSON string.`,
  'single': `Write as a single continuous paragraph - no line breaks or bullet points. Keep it punchy and direct. One cohesive block of text.`,
  'listicle': `Use a listicle / bullet-point format:
- Open with a bold hook line
- Follow with 3-5 short bullet points highlighting key benefits (use . or - as bullets)
- End with a punchy closer or CTA line
Separate the hook, bullets section, and closer with \\n\\n in the JSON string.`,
};

const TONE_MAP = {
  'conversational': 'Write in a casual, conversational tone - like a smart friend giving advice. Use contractions, direct address ("you"), and natural language. Avoid corporate jargon.',
  'professional': 'Write in a polished, professional tone - credible and buttoned-up. Clear, precise language. Suitable for B2B and enterprise audiences. Avoid slang or overly casual phrasing.',
  'bold': 'Write in a bold, aggressive tone - confident and unapologetic. Short punchy sentences. Strong claims. Create urgency. Challenge the reader. Be direct and provocative.',
  'friendly': 'Write in a warm, friendly tone - approachable and supportive. Use inclusive language ("we", "together"), positive framing, and an encouraging voice. Feel like a helpful neighbor.',
  'authoritative': 'Write in an authoritative, expert tone - backed by data and certainty. Use definitive language ("the best", "proven", "industry-leading"). Position the brand as the clear authority.',
};

const HOOK_MAP = {
  'pain-point': 'Open with a **pain-point question** - call out a frustration or challenge the audience faces. Example openers: "Tired of...", "Still struggling with...", "Why do most X fail at...?"',
  'bold-statement': 'Open with a **bold, provocative statement** - a strong claim or surprising declaration that demands attention. Example: "Most marketing agencies are wasting your budget.", "Your landing page is losing 73% of visitors."',
  'stat': 'Open with a **compelling statistic or number** - lead with data that shocks or validates. Example: "87% of B2B buyers say...", "Companies that do X see 3x more...", "$2.4M - that\'s how much the average..."',
  'story': 'Open with a **mini story or anecdote** - a brief narrative hook that pulls the reader in. Example: "Last quarter, one of our clients...", "We kept hearing the same thing from founders...", "Three months ago, we noticed a pattern..."',
  'direct-address': 'Open with a **direct address to the audience** - speak directly to a specific role or identity. Example: "Hey marketing leaders,", "If you\'re a SaaS founder doing $1M+ ARR...", "This is for teams that..."',
};

const LENGTH_MAP = {
  'short': { label: 'Short', longForm: '80-120 characters' },
  'medium': { label: 'Medium', longForm: '150-250 characters' },
  'long': { label: 'Long', longForm: '300-450 characters' },
};

/**
 * Map styleConfig dropdown values into rich prompt instructions.
 * When a field is set to "random", the prompt tells the AI to use a DIFFERENT
 * option for each variation so every variation is unique for that axis.
 */
function buildStyleInstructions(styleConfig, variationCount = 2) {
  const sc = { ...getDefaultStyleConfig(), ...styleConfig };
  const sections = [];

  // --- Structure ---
  if (sc.structure === 'random') {
    const optionList = Object.entries(STRUCTURE_MAP)
      .map(([key, desc], i) => `  ${i + 1}. **${key}**: ${desc}`)
      .join('\n');
    sections.push(`## Writing Structure (RANDOMIZE PER VARIATION):
Each variation MUST use a DIFFERENT structure. Pick a unique structure for each variation from the options below - no two variations should share the same structure:
${optionList}`);
  } else {
    sections.push(`## Writing Structure:\n${STRUCTURE_MAP[sc.structure] || STRUCTURE_MAP['hook-body-closer']}`);
  }

  // --- Tone ---
  if (sc.tone === 'random') {
    const optionList = Object.entries(TONE_MAP)
      .map(([key, desc], i) => `  ${i + 1}. **${key}**: ${desc}`)
      .join('\n');
    sections.push(`## Tone of Voice (RANDOMIZE PER VARIATION):
Each variation MUST use a DIFFERENT tone. Pick a unique tone for each variation from the options below - no two variations should share the same tone:
${optionList}`);
  } else {
    sections.push(`## Tone of Voice:\n${TONE_MAP[sc.tone] || TONE_MAP['conversational']}`);
  }

  // --- Hook Style ---
  if (sc.hookStyle === 'random') {
    const optionList = Object.entries(HOOK_MAP)
      .map(([key, desc], i) => `  ${i + 1}. **${key}**: ${desc}`)
      .join('\n');
    sections.push(`## Hook Approach (RANDOMIZE PER VARIATION):
Each variation MUST use a DIFFERENT hook approach. Pick a unique hook style for each variation from the options below - no two variations should share the same hook:
${optionList}`);
  } else {
    sections.push(`## Hook Approach:\n${HOOK_MAP[sc.hookStyle] || HOOK_MAP['pain-point']}`);
  }

  // --- Length ---
  const len = LENGTH_MAP[sc.length] || LENGTH_MAP['medium'];
  sections.push(`## Target Length:\nFor long-form text fields (intro text, primary text, captions), write approximately **${len.longForm}**. For shorter fields (headlines, descriptions), write close to their character limit. The length target is a guideline for the body text - always respect the field's maxChars as a hard ceiling.`);

  // --- Emoji ---
  if (sc.emoji) {
    sections.push(`## Emoji Usage:\nUse emoji sparingly - at most 1-2 emoji per field, placed at the start of a line or to accent a key point. Keep it tasteful and professional.`);
  }

  // --- General formatting rules ---
  const emojiRule = sc.emoji
    ? '- Use emoji sparingly as specified in the Emoji Usage section above'
    : '- No emojis in ad body text';
  sections.push(`## Formatting Rules:
- No bullet points, no hashtags in ad body text (unless the field is specifically for hashtags)
${emojiRule}
- Each paragraph/section is 1-2 sentences max
- If the structure calls for \\n\\n separators, you MUST use them in the JSON string values
- For hashtag fields: combine ALL hashtags into a single string separated by spaces (e.g. "#marketing #growth #saas #digitalads"). Do NOT use arrays, commas, or newlines - just one string with space-separated hashtags.`);

  return sections.join('\n\n');
}

/**
 * Build the structured prompt for ad generation.
 */
function buildAdPrompt({ text, urlContent, imageAnalysis, searchResults, formatSpec, platform, variationCount, styleConfig, positiveWords, negativeWords, customPrompt }) {
  // Build source context from top chunks
  let sourceContext = '';
  if (searchResults?.chunks?.length > 0) {
    sourceContext = searchResults.chunks
      .map(c => `[Source: ${c.documentTitle}]\n${c.content}`)
      .join('\n\n');
  } else if (searchResults?.documents?.length > 0) {
    sourceContext = searchResults.documents
      .filter(d => d.summary)
      .slice(0, 5)
      .map(d => `[Source: ${d.title || d.file_name}]\n${d.summary}`)
      .join('\n\n');
  }

  // Build format spec description (pure field specs, no rule overlays)
  const longFormKeys = ['primaryText', 'introText'];
  const formatDesc = Object.entries(formatSpec.fields)
    .map(([key, spec]) => {
      let desc = `- ${key} (${spec.label}): `;
      if (spec.count > 1) desc += `${spec.count} items, `;
      if (spec.maxChars) desc += `max ${spec.maxChars} chars each`;
      if (!spec.maxChars && !spec.enum && longFormKeys.includes(key)) {
        desc += `LONG-FORM field - MUST apply Writing Structure, Tone, Hook Approach, and Target Length`;
      }
      if (spec.enum) desc += `choose from: ${spec.enum.join(', ')}`;
      if (spec.hint) desc += ` (${spec.hint})`;
      if (spec.required) desc += ' [REQUIRED]';
      return desc;
    })
    .join('\n');

  // Build style instructions from dropdown config
  const styleInstructions = buildStyleInstructions(styleConfig, variationCount);

  // Build word guidelines
  let wordGuidelines = '';
  if (positiveWords || negativeWords) {
    wordGuidelines = '\n## Word Guidelines:\n';
    if (positiveWords) wordGuidelines += `MUST USE these words/phrases where natural: ${positiveWords}\n`;
    if (negativeWords) wordGuidelines += `MUST AVOID these words/phrases: ${negativeWords}\n`;
  }

  const system = `You are an expert advertising copywriter specializing in ${formatSpec.name}. Generate compelling ad copy that converts.

## Source Documents (PRIORITIZE these for messaging, tone, and strategy):
${sourceContext || 'No source documents available - use your expertise and the provided context.'}

## Ad Format Requirements for ${formatSpec.name}:
${formatDesc}

${styleInstructions}
${wordGuidelines}${customPrompt ? `\n## Creative Direction (USER'S CUSTOM INSTRUCTIONS - FOLLOW CLOSELY):\n${customPrompt}\n` : ''}
## Instructions:
1. Generate exactly ${variationCount} complete ad variations as JSON
2. Each variation must fill ALL required fields
3. Respect character limits - do NOT exceed maxChars for any field
4. For fields with count > 1, provide an array with that many items
5. For fields with count = 1, provide a single string value
6. For CTA fields with enum options, choose the most appropriate option from the list
7. Cite which source document influenced each variation in sourcesCited (use document titles from [Source: ...] tags)
8. If source documents are available, prioritize their messaging frameworks, tone, and key talking points
9. Each variation should take a different angle or approach
10. Write a brief rationale explaining the strategy for each variation
11. Follow the Writing Structure, Tone, Hook Approach, and Target Length instructions EXACTLY - they are the user's explicit creative direction
12. CRITICAL: For long-form text fields (primaryText, introText, captions), you MUST apply the Writing Structure format. For example, if "Hook -> Body -> Closer" is selected, the primaryText MUST have 3 distinct paragraphs separated by \\n\\n. If "Single Paragraph" is selected, write one continuous block. For short fields (headlines, descriptions), write naturally within their char limits

Return valid JSON matching this exact schema:
{
  "variations": [
    {
      "id": 1,
      "fields": {
        "fieldName": "value" or ["value1", "value2"] for multi-item fields
      },
      "sourcesCited": ["Document Title 1"],
      "rationale": "Brief explanation of approach"
    }
  ]
}`;

  // Build user message with all context
  const userParts = [];

  if (text) {
    userParts.push(`## Brief / Talking Points:\n${text}`);
  }

  if (urlContent) {
    userParts.push(`## Page Context (from ${urlContent.url}):\nTitle: ${urlContent.title || 'N/A'}\nDescription: ${urlContent.description || 'N/A'}\nContent: ${urlContent.bodyText?.substring(0, 3000) || 'N/A'}`);
  }

  if (imageAnalysis) {
    userParts.push(`## Image Analysis:\n${imageAnalysis}`);
  }

  userParts.push(`\nGenerate ${variationCount} ad copy variations for ${formatSpec.name}.`);

  return { system, user: userParts.join('\n\n') };
}

/**
 * POST /api/adgen/:clientId
 * Generate ad copy with source attribution
 */
router.post('/:clientId', adUpload.array('images', 5), async (req, res) => {
  const tempFilePaths = [];
  try {
    const { clientId } = req.params;
    const { text, url, platform = 'google', variationCount = 2, positiveWords, negativeWords, customPrompt } = req.body;
    let styleConfig = null;
    try { styleConfig = req.body.styleConfig ? JSON.parse(req.body.styleConfig) : null; } catch {}
    const imageFiles = req.files || [];
    imageFiles.forEach(f => tempFilePaths.push(f.path));

    // Validate: at least one input required
    if (!text && !url && imageFiles.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one input (text, URL, or images) is required' });
    }

    // Validate platform
    const formatSpec = AD_FORMATS[platform];
    if (!formatSpec) {
      return res.status(400).json({ success: false, error: `Invalid platform: ${platform}` });
    }

    // Gather context from all input sources in parallel
    const [urlContent, imageAnalysis, searchResults] = await Promise.all([
      url ? scrapeUrl(url) : null,
      processImages(imageFiles),
      semanticSearch(clientId, buildSearchQuery(text, url, platform), 8, { boostGlobal: true }),
    ]);

    // Build the structured prompt
    const prompt = buildAdPrompt({
      text,
      urlContent,
      imageAnalysis,
      searchResults,
      formatSpec,
      platform,
      variationCount: Math.min(parseInt(variationCount) || 2, 4),
      styleConfig: styleConfig || getDefaultStyleConfig(),
      positiveWords: positiveWords || null,
      negativeWords: negativeWords || null,
      customPrompt: customPrompt?.trim() || null,
    });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    });

    let generated;
    try {
      generated = JSON.parse(response.choices[0].message.content);
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to parse AI response' });
    }

    const sourceRefs = buildSourceRefs(searchResults);

    res.json({
      success: true,
      data: {
        variations: generated.variations || [],
        sources: sourceRefs,
        platform,
        formatSpec: AD_FORMATS[platform],
        inputSummary: {
          hadText: !!text,
          hadUrl: !!url,
          hadImages: imageFiles.length > 0,
          urlTitle: urlContent?.title || null,
        },
      },
    });
  } catch (error) {
    console.error('Error generating ad copy:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    for (const filePath of tempFilePaths) {
      try { await fs.unlink(filePath); } catch {}
    }
  }
});

/**
 * POST /api/adgen/:clientId/regenerate
 * Regenerate a single field of ad copy
 */
router.post('/:clientId/regenerate', async (req, res) => {
  try {
    const { field, currentValue, allFields, platform, direction, styleConfig, positiveWords, negativeWords, customPrompt } = req.body;

    if (!field || !platform) {
      return res.status(400).json({ success: false, error: 'field and platform are required' });
    }

    const formatSpec = AD_FORMATS[platform];
    if (!formatSpec) {
      return res.status(400).json({ success: false, error: `Invalid platform: ${platform}` });
    }

    const fieldSpec = Object.values(formatSpec.fields).find(f => f.label === field);
    const charLimit = fieldSpec?.maxChars ? ` (max ${fieldSpec.maxChars} characters)` : '';

    let prompt = `Rewrite ONLY the "${field}" field for a ${formatSpec.name} ad${charLimit}.\n\nCurrent value: "${currentValue}"\n\nFull ad context:\n${JSON.stringify(allFields, null, 2)}`;

    if (direction) {
      prompt += `\n\nDirection: ${direction}`;
    }
    if (positiveWords) {
      prompt += `\n\nMUST USE these words where natural: ${positiveWords}`;
    }
    if (negativeWords) {
      prompt += `\n\nMUST AVOID these words: ${negativeWords}`;
    }
    if (customPrompt?.trim()) {
      prompt += `\n\nCreative direction from the user (follow closely): ${customPrompt.trim()}`;
    }

    prompt += '\n\nReturn ONLY the new value as a JSON object: { "newValue": "..." }';

    // Build style-aware system prompt for regeneration
    // For single-field regen, resolve any "random" to a concrete pick
    const sc = { ...getDefaultStyleConfig(), ...(styleConfig || {}) };
    if (sc.structure === 'random') {
      const keys = Object.keys(STRUCTURE_MAP);
      sc.structure = keys[Math.floor(Math.random() * keys.length)];
    }
    if (sc.tone === 'random') {
      const keys = Object.keys(TONE_MAP);
      sc.tone = keys[Math.floor(Math.random() * keys.length)];
    }
    if (sc.hookStyle === 'random') {
      const keys = Object.keys(HOOK_MAP);
      sc.hookStyle = keys[Math.floor(Math.random() * keys.length)];
    }
    const isLongFormField = /intro text|primary text|caption/i.test(field);
    let styleGuide = `You are an expert advertising copywriter. Rewrite the requested field while keeping the overall ad coherent. Respect the character limit.`;
    if (isLongFormField) {
      styleGuide += `\n\n${buildStyleInstructions(sc, 1)}`;
    } else {
      // For short fields, still apply tone and hook style
      const shortToneMap = {
        'conversational': 'casual, conversational',
        'professional': 'polished, professional',
        'bold': 'bold, aggressive',
        'friendly': 'warm, friendly',
        'authoritative': 'authoritative, expert',
      };
      styleGuide += `\nTone: ${shortToneMap[sc.tone] || 'conversational'}. Write close to the character limit.`;
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: styleGuide },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content);

    res.json({
      success: true,
      data: { newValue: result.newValue || result.value || currentValue },
    });
  } catch (error) {
    console.error('Error regenerating field:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Derive a short PascalCase concept name.
 * Priority: image context > URL/page title > ad copy content > hook style
 */
function deriveConceptName({ hookStyle, introText, headline, cta, urlTitle, hadImages, url }) {
  // Keyword patterns - checked against whichever text source we use
  const patterns = [
    { re: /roi|return on|revenue|savings?|cost/i, label: 'ROI' },
    { re: /testimonial|review|said|loved|rated/i, label: 'Testimonial' },
    { re: /case study|results|success stor/i, label: 'CaseStudy' },
    { re: /demo|preview|see how|watch/i, label: 'Demo' },
    { re: /free trial|try free|get started/i, label: 'FreeTrial' },
    { re: /calculator|tool|template/i, label: 'ToolPreview' },
    { re: /dashboard|analytics|report/i, label: 'Dashboard' },
    { re: /social proof|trust|companies use|brands use/i, label: 'SocialProof' },
    { re: /compare|vs\b|alternative/i, label: 'Comparison' },
    { re: /how to|guide|steps|tips/i, label: 'HowTo' },
    { re: /launch|announcing|introducing/i, label: 'Launch' },
    { re: /offer|discount|deal|limited|save \d/i, label: 'Offer' },
    { re: /webinar|event|register|attend/i, label: 'Event' },
    { re: /pricing|plan|tier|package/i, label: 'Pricing' },
    { re: /problem|struggle|frustrated|tired|pain/i, label: 'PainPoint' },
    { re: /data|insights?|numbers?|metric/i, label: 'DataDriven' },
    { re: /growth|scale|grow your/i, label: 'Growth' },
    { re: /automat|workflow|efficien/i, label: 'Automation' },
    { re: /integrat|connect|sync/i, label: 'Integration' },
    { re: /security|protect|safe|complian/i, label: 'Security' },
    { re: /onboard|setup|getting started/i, label: 'Onboarding' },
    { re: /feature|capability|powerful/i, label: 'Feature' },
    { re: /brand|awareness|reach/i, label: 'BrandAware' },
    { re: /retarget|remarket|come back/i, label: 'Retarget' },
    { re: /lead gen|leads|capture/i, label: 'LeadGen' },
    { re: /conversion|convert|sign.?up/i, label: 'Conversion' },
  ];

  function matchPatterns(text) {
    if (!text) return null;
    for (const { re, label } of patterns) {
      if (re.test(text)) return label;
    }
    return null;
  }

  // 1. Image-based ads - if images were the input, tag as visual concept
  if (hadImages && !url && !introText) {
    return 'Visual';
  }

  // 2. URL / page title - scan the page title and URL path for signals
  const urlText = `${urlTitle || ''} ${url || ''}`.replace(/[-_/]/g, ' ');
  const urlMatch = matchPatterns(urlText);
  if (urlMatch) return urlMatch;

  // 3. Ad copy content - scan intro text and headline
  const copyText = `${introText} ${headline}`;
  const copyMatch = matchPatterns(copyText);
  if (copyMatch) return copyMatch;

  // 4. Fall back to hook style
  const hookMap = {
    'pain-point': 'PainPoint',
    'bold-statement': 'BoldClaim',
    'stat': 'StatHook',
    'story': 'Story',
    'direct-address': 'DirectCTA',
  };
  return hookMap[hookStyle] || 'AdCopy';
}

/**
 * POST /api/adgen/:clientId/push-to-sheet
 * Push ad copy variation to the master Google Sheet
 * Columns: Campaign | Name/Concept | Status | (ct) | Intro Text | (ct) | Headline | (ct) | Ad Graphic Copy | (ct) | CTA | Image | More inspo | Notes | FINAL URL | Sizes Needed
 */
router.post('/:clientId/push-to-sheet', async (req, res) => {
  try {
    const { fields, platform, funnel, url, hookStyle, urlTitle, hadImages } = req.body;

    if (!fields || !platform) {
      return res.status(400).json({ success: false, error: 'fields and platform are required' });
    }

    // Map fields to the correct columns based on platform
    // Google: headlines (arr of 3), descriptions (arr of 2), displayUrl, sitelinks (pipe-separated)
    // Meta/LinkedIn/Reddit: primaryText/introText, headlines (single), cta, etc.
    let introText = '';
    let headline = '';
    let cta = fields.cta || '';
    let adGraphicCopy = '';

    if (platform === 'google') {
      // Google: descriptions go to intro text column, headlines pipe-separated to headline column
      const headlines = Array.isArray(fields.headlines) ? fields.headlines : [fields.headlines].filter(Boolean);
      const descriptions = Array.isArray(fields.descriptions) ? fields.descriptions : [fields.descriptions].filter(Boolean);
      headline = headlines.join(' | ');
      introText = descriptions.join(' | ');
      const sitelinks = fields.sitelinks;
      adGraphicCopy = Array.isArray(sitelinks) ? sitelinks.join(' | ') : (sitelinks || '');
    } else {
      introText = fields.primaryText || fields.introText || '';
      headline = fields.postTitle || (Array.isArray(fields.headlines) ? fields.headlines[0] : fields.headlines) || '';
    }

    const campaign = `DD_${funnel || 'TOF'}`;

    // Auto-generate a short PascalCase concept name (priority: image > URL > copy > hook)
    const conceptName = deriveConceptName({ hookStyle, introText, headline, cta, urlTitle, hadImages, url });

    // Ensure every cell value is a string (Sheets API rejects arrays)
    const str = (v) => Array.isArray(v) ? v.join(' | ') : String(v ?? '');

    // Build the row: 16 columns (A-P) - str() ensures no arrays leak through
    const row = [
      str(campaign),                                      // A: Campaign
      str(conceptName),                                   // B: Name / Concept
      'Planned',                                          // C: Status
      introText ? String(introText.length) : '',          // D: char count
      str(introText),                                     // E: Intro Text / Descriptions
      headline ? String(headline.length) : '',            // F: char count
      str(headline),                                      // G: Headline(s)
      adGraphicCopy ? String(adGraphicCopy.length) : '',  // H: char count (ad graphic copy / sitelinks)
      str(adGraphicCopy),                                 // I: Ad Graphic Copy / Sitelinks
      '',                                                 // J: blank
      str(cta),                                           // K: CTA
      '',                                                 // L: Image
      '',                                                 // M: More image inspo
      '',                                                 // N: Notes
      str(url || ''),                                     // O: FINAL URL
      'Square (1080x1080px)',                             // P: Sizes Needed
    ];

    // Find the first row where columns A, B, E, and G are all empty
    const sheet = await readEntireSheet(AD_COPY_SHEET_ID, 'Generations');
    const rows = sheet.values || [];
    let targetRow = rows.length + 1; // default: after last row

    for (let i = 1; i < rows.length; i++) { // skip header row (0)
      const r = rows[i] || [];
      const colA = (r[0] || '').trim();  // Campaign
      const colB = (r[1] || '').trim();  // Name/Concept
      const colE = (r[4] || '').trim();  // Intro Text
      const colG = (r[6] || '').trim();  // Headline
      if (!colA && !colB && !colE && !colG) {
        targetRow = i + 1; // 1-indexed for Sheets API
        break;
      }
    }

    const result = await writeSheetRange(AD_COPY_SHEET_ID, `Generations!A${targetRow}:P${targetRow}`, [row]);

    res.json({
      success: true,
      data: {
        updatedRange: result.updatedRange,
        updatedRows: result.updatedRows,
        row: targetRow,
      },
    });
  } catch (error) {
    console.error('Error pushing ad to sheet:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
