import { supabase } from '../config/supabase.js';
import { generateEmbedding, cosineSimilarity } from './openaiService.js';
import { resolveTimeReference } from './dateParser.js';

/**
 * Calculate rough text overlap ratio between two strings.
 * Used to detect near-duplicate adjacent chunks.
 */
function textOverlap(textA, textB) {
  if (!textA || !textB) return 0;
  const shorter = textA.length < textB.length ? textA : textB;
  const longer = textA.length < textB.length ? textB : textA;
  // Check if the end of one matches the start of the other (overlap region)
  const checkLen = Math.min(300, Math.floor(shorter.length * 0.4));
  const endOfShorter = shorter.substring(shorter.length - checkLen);
  const startOfLonger = longer.substring(0, checkLen);
  if (longer.includes(endOfShorter) || shorter.includes(startOfLonger)) return 0.5;
  // Fallback: word-level Jaccard similarity
  const wordsA = new Set(textA.toLowerCase().split(/\s+/));
  const wordsB = new Set(textB.toLowerCase().split(/\s+/));
  let intersection = 0;
  for (const w of wordsA) { if (wordsB.has(w)) intersection++; }
  const union = wordsA.size + wordsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Build a richer search query from the current message + recent conversation.
 * Handles follow-ups like "tell me more about that" by pulling key terms from context.
 */
function buildConversationAwareQuery(message, conversationHistory = []) {
  // If the message is already long/specific enough, use it as-is
  if (message.split(/\s+/).length >= 8) return message;

  // Detect vague follow-ups that need context
  const vaguePatterns = /\b(that|this|it|those|these|more|again|same|previous|above|earlier|last one)\b/i;
  if (!vaguePatterns.test(message) && message.split(/\s+/).length >= 4) return message;

  // Pull the last few user messages to enrich the query
  const recentUserMessages = conversationHistory
    .filter(m => m.role === 'user')
    .slice(-3)
    .map(m => m.content);

  if (recentUserMessages.length === 0) return message;

  // Combine: current message + last user message (most relevant context)
  const contextMessage = recentUserMessages[recentUserMessages.length - 1];
  return `${message} ${contextMessage}`.substring(0, 500);
}

/**
 * Perform semantic search to find relevant documents and chunks.
 *
 * @param {string} clientId - Client ID to search within
 * @param {string} query - Search query text
 * @param {number} limit - Max documents to return (default 5)
 * @param {object} options
 * @param {boolean} options.boostGlobal - Boost global/playbook sources in ranking (default false)
 * @param {Array} options.conversationHistory - Recent messages for context-aware retrieval
 * @returns {{ documents: Array, chunks: Array }}
 */
export async function semanticSearch(clientId, query, limit = 5, { boostGlobal = false, conversationHistory = [] } = {}) {
  // Build a context-aware search query for follow-up messages
  const enrichedQuery = buildConversationAwareQuery(query, conversationHistory);

  // Generate embedding for the enriched query
  const queryEmbedding = await generateEmbedding(enrichedQuery);

  // Get all processed documents for this client (including global sources)
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .or(`client_id.eq.${clientId},is_global.eq.true`)
    .eq('processed', true);

  if (docError) throw docError;

  if (!documents || documents.length === 0) {
    return { documents: [], chunks: [] };
  }

  // Resolve any time references in the query to a date range for boosting
  const timeRange = resolveTimeReference(query);

  // Extract meaningful keywords from the query for title/keyword matching.
  // Remove common stop words so we match on substantive terms.
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
    'it', 'its', 'my', 'your', 'our', 'their', 'what', 'which', 'who',
    'how', 'when', 'where', 'why', 'about', 'using', 'use', 'write',
    'create', 'make', 'get', 'me', 'i', 'we', 'you', 'they', 'some',
    'all', 'any', 'each', 'just', 'also', 'so', 'if', 'up', 'out',
  ]);
  const queryWords = enrichedQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

  // Score documents by combining embedding similarity with title/keyword matching
  const scoredDocs = documents.map(doc => {
    let embedding;
    try {
      embedding = JSON.parse(doc.embedding || '[]');
    } catch {
      embedding = [];
    }

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    // Title/filename match boost: if query words appear in the document title or filename,
    // boost the score significantly. This ensures "messaging framework" finds a doc named that.
    const titleLower = (doc.title || '').toLowerCase();
    const fileNameLower = (doc.file_name || '').toLowerCase();
    const keywordsLower = (doc.keywords || []).map(k => k.toLowerCase());
    const topicLower = (doc.topic || '').toLowerCase();

    let titleBoost = 0;
    let matchedWords = 0;
    for (const word of queryWords) {
      const inTitle = titleLower.includes(word);
      const inFileName = fileNameLower.includes(word);
      const inKeywords = keywordsLower.some(k => k.includes(word));
      const inTopic = topicLower.includes(word);
      if (inTitle || inFileName) {
        titleBoost += 0.15; // Strong boost for title/filename match
        matchedWords++;
      } else if (inKeywords || inTopic) {
        titleBoost += 0.08; // Moderate boost for keyword/topic match
        matchedWords++;
      }
    }

    // Multi-word phrase bonus: if multiple query words match, it's likely a specific document reference
    if (matchedWords >= 2) {
      titleBoost *= 1.5;
    }

    // Check for exact phrase matches in title (e.g., "messaging framework" as a phrase)
    // Build 2-word and 3-word phrases from query
    for (let n = 2; n <= Math.min(4, queryWords.length); n++) {
      for (let i = 0; i <= queryWords.length - n; i++) {
        const phrase = queryWords.slice(i, i + n).join(' ');
        if (titleLower.includes(phrase) || fileNameLower.includes(phrase)) {
          titleBoost += 0.25 * n; // Longer phrase matches get bigger boosts
        }
      }
    }

    // Date-aware boost: if the user's query contains a time reference and
    // this document has a source_date within that range, boost it significantly.
    let dateBoost = 0;
    if (timeRange && doc.source_date) {
      const docDate = doc.source_date.split('T')[0]; // normalize to YYYY-MM-DD
      if (docDate >= timeRange.start && docDate <= timeRange.end) {
        dateBoost = 0.30; // Strong boost — the user is asking for this time period
      }
    }

    // Global/playbook source boost for ad generation
    let globalBoost = 0;
    if (boostGlobal) {
      if (doc.is_global) {
        globalBoost = 0.20;
      }
      const group = (doc.custom_group || '').toLowerCase();
      if (group.includes('playbook') || group.includes('master') || group.includes('framework') || group.includes('messaging') || group.includes('sop')) {
        globalBoost = Math.max(globalBoost, 0.25);
      }
    }

    return {
      ...doc,
      similarity_score: Math.min(similarity + titleBoost + dateBoost + globalBoost, 1.0) // Cap at 1.0
    };
  });

  // Get top documents
  const topDocs = scoredDocs
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);

  // Get chunks from top documents for more precise context
  const docIds = topDocs.map(d => d.id);

  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('*')
    .in('document_id', docIds);

  let relevantChunks = [];

  if (!chunkError && chunks && chunks.length > 0) {
    // Score chunks
    const scoredChunks = chunks.map(chunk => {
      let embedding;
      try {
        embedding = JSON.parse(chunk.embedding || '[]');
      } catch {
        embedding = [];
      }

      const similarity = cosineSimilarity(queryEmbedding, embedding);
      const parentDoc = topDocs.find(d => d.id === chunk.document_id);

      // Tag chunk with its position in the document
      const totalChunksInDoc = chunks.filter(c => c.document_id === chunk.document_id).length;
      let position = 'middle';
      if (chunk.chunk_index === 0) position = 'beginning';
      else if (totalChunksInDoc > 0 && chunk.chunk_index >= totalChunksInDoc - 1) position = 'end';

      return {
        ...chunk,
        similarity_score: similarity,
        documentTitle: parentDoc?.title || parentDoc?.file_name || 'Unknown',
        documentId: chunk.document_id,
        position
      };
    });

    // Filter to relevant chunks (raised threshold from 0.3 to 0.4)
    const filtered = scoredChunks
      .filter(c => c.similarity_score > 0.4)
      .sort((a, b) => b.similarity_score - a.similarity_score);

    // Deduplicate overlapping chunks from the same document.
    // Adjacent chunks share ~200 chars of overlap — keep the higher-scoring one.
    const deduped = [];
    for (const chunk of filtered) {
      const isDuplicate = deduped.some(existing =>
        existing.document_id === chunk.document_id &&
        Math.abs(existing.chunk_index - chunk.chunk_index) === 1 &&
        textOverlap(existing.content, chunk.content) > 0.3
      );
      if (!isDuplicate) {
        deduped.push(chunk);
      }
    }

    relevantChunks = deduped.slice(0, 6);
  }

  return {
    documents: topDocs,
    chunks: relevantChunks
  };
}
