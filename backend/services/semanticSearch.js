import { supabase } from '../config/supabase.js';
import { generateEmbedding, cosineSimilarity } from './openaiService.js';

/**
 * Perform semantic search to find relevant documents and chunks.
 *
 * @param {string} clientId - Client ID to search within
 * @param {string} query - Search query text
 * @param {number} limit - Max documents to return (default 5)
 * @param {object} options
 * @param {boolean} options.boostGlobal - Boost global/playbook sources in ranking (default false)
 * @returns {{ documents: Array, chunks: Array }}
 */
export async function semanticSearch(clientId, query, limit = 5, { boostGlobal = false } = {}) {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

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
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));

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
      similarity_score: Math.min(similarity + titleBoost + globalBoost, 1.0) // Cap at 1.0
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

      return {
        ...chunk,
        similarity_score: similarity,
        documentTitle: parentDoc?.title || parentDoc?.file_name || 'Unknown',
        documentId: chunk.document_id
      };
    });

    // Get top chunks (most relevant excerpts)
    relevantChunks = scoredChunks
      .filter(c => c.similarity_score > 0.3) // Only include reasonably relevant chunks
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 8);
  }

  return {
    documents: topDocs,
    chunks: relevantChunks
  };
}
