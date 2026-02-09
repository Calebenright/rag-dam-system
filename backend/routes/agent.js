import express from 'express';
import { supabase } from '../config/supabase.js';
import { enhancedChatWithContext } from '../services/claudeService.js';
import { generateEmbedding, cosineSimilarity } from '../services/openaiService.js';

const router = express.Router();

/**
 * Perform semantic search to find relevant documents and chunks
 */
async function semanticSearch(clientId, query, limit = 5) {
  const queryEmbedding = await generateEmbedding(query);

  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('processed', true);

  if (docError) throw docError;

  if (!documents || documents.length === 0) {
    return { documents: [], chunks: [] };
  }

  const scoredDocs = documents.map(doc => {
    let embedding;
    try {
      embedding = JSON.parse(doc.embedding || '[]');
    } catch {
      embedding = [];
    }
    const similarity = cosineSimilarity(queryEmbedding, embedding);
    return { ...doc, similarity_score: similarity };
  });

  const topDocs = scoredDocs
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);

  const docIds = topDocs.map(d => d.id);
  const { data: chunks, error: chunkError } = await supabase
    .from('document_chunks')
    .select('*')
    .in('document_id', docIds);

  let relevantChunks = [];
  if (!chunkError && chunks && chunks.length > 0) {
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

    relevantChunks = scoredChunks
      .filter(c => c.similarity_score > 0.3)
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 8);
  }

  return { documents: topDocs, chunks: relevantChunks };
}

/**
 * POST /api/agent/query
 * Send a prompt to the AI agent with client context
 *
 * Body:
 *   - prompt: string (required) - The question/prompt for the AI
 *   - clientId: string (required) - The client ID for context
 *   - saveHistory: boolean (optional, default: false) - Whether to save to chat history
 *   - conversationId: string (optional) - For maintaining conversation context
 */
router.post('/query', async (req, res) => {
  try {
    const { prompt, clientId, saveHistory = false, conversationId } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({
        success: false,
        error: 'prompt is required'
      });
    }

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'clientId is required'
      });
    }

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Get conversation history if conversationId provided
    let conversationHistory = [];
    if (conversationId) {
      const { data: history } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('client_id', clientId)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .limit(20);

      conversationHistory = history || [];
    }

    // Perform semantic search for relevant documents
    const { documents: relevantDocs, chunks: relevantChunks } = await semanticSearch(clientId, prompt, 5);

    // Fetch connected sheets
    const { data: connectedSheets } = await supabase
      .from('connected_sheets')
      .select('*')
      .eq('client_id', clientId);

    // Build context documents
    let contextDocs = relevantDocs;
    if (client.description) {
      contextDocs = [
        {
          id: 'client-context',
          title: 'Client Context',
          summary: client.description,
          keywords: []
        },
        ...relevantDocs
      ];
    }

    // Format chunks for AI
    const formattedChunks = relevantChunks.map(chunk => ({
      documentTitle: chunk.documentTitle,
      documentId: chunk.documentId,
      text: chunk.content,
      similarity: chunk.similarity_score
    }));

    // Call the AI agent
    const result = await enhancedChatWithContext(
      prompt,
      contextDocs,
      connectedSheets || [],
      conversationHistory,
      formattedChunks
    );

    // Optionally save to chat history
    if (saveHistory) {
      const newConversationId = conversationId || crypto.randomUUID();

      await supabase.from('chat_messages').insert([
        {
          client_id: clientId,
          role: 'user',
          content: prompt,
          conversation_id: newConversationId,
          context_docs: relevantDocs.map(d => d.id)
        }
      ]);

      await supabase.from('chat_messages').insert([
        {
          client_id: clientId,
          role: 'assistant',
          content: result.response,
          conversation_id: newConversationId,
          context_docs: relevantDocs.map(d => d.id),
          sources: relevantDocs
            .filter(d => d.similarity_score > 0.3)
            .map(d => ({ id: d.id, title: d.title || d.file_name || 'Untitled', similarity: d.similarity_score }))
        }
      ]);
    }

    // Return the response
    res.json({
      success: true,
      data: {
        response: result.response,
        client: {
          id: client.id,
          name: client.name
        },
        context: {
          documentsUsed: relevantDocs.length,
          chunksUsed: relevantChunks.length,
          sheetsAvailable: connectedSheets?.length || 0,
          toolsUsed: result.toolsUsed || false
        },
        operations: result.operations || []
      }
    });

  } catch (error) {
    console.error('Error in agent query:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agent/clients
 * List available clients for the agent
 */
router.get('/clients', async (req, res) => {
  try {
    const { data: clients, error } = await supabase
      .from('clients')
      .select('id, name, description, created_at')
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: clients || []
    });
  } catch (error) {
    console.error('Error fetching clients for agent:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/agent/clients/:clientId/context
 * Get context summary for a client (documents, sheets, etc.)
 */
router.get('/clients/:clientId/context', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Get client
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Get documents count and summary
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, title, file_type, processed')
      .eq('client_id', clientId);

    // Get connected sheets
    const { data: sheets } = await supabase
      .from('connected_sheets')
      .select('id, name, spreadsheet_id, sheet_tabs')
      .eq('client_id', clientId);

    res.json({
      success: true,
      data: {
        client: {
          id: client.id,
          name: client.name,
          description: client.description
        },
        documents: {
          total: documents?.length || 0,
          processed: documents?.filter(d => d.processed).length || 0,
          types: [...new Set(documents?.map(d => d.file_type) || [])]
        },
        sheets: {
          total: sheets?.length || 0,
          names: sheets?.map(s => s.name) || []
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
