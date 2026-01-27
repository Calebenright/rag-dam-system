import express from 'express';
import { supabase } from '../config/supabase.js';
import { analyzeImage, enhancedChat, generateEmbedding, cosineSimilarity, extractFromImage, analyzeMultipleImages, chatWithSheets as chatWithSheetsOpenAI } from '../services/openaiService.js';
import { enhancedChatWithContext as claudeChatWithSheets } from '../services/claudeService.js';
import * as sheetsService from '../services/googleSheets.js';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

// Configure multer for image uploads in chat (multiple images)
const chatUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 20971520 }, // 20MB total
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Helper to check if a file is an image based on mime type
function isImageFile(fileType) {
  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
  return imageTypes.includes(fileType?.toLowerCase());
}

// Helper to fetch image as base64 from URL
async function fetchImageAsBase64(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${base64}`;
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

/**
 * GET /api/chat/:clientId
 * Get chat history for a client
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { limit = 50 } = req.query;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: true })
      .limit(parseInt(limit));

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Perform semantic search to find relevant documents and chunks
 */
async function semanticSearch(clientId, query, limit = 5) {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  // Get all processed documents for this client
  const { data: documents, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('client_id', clientId)
    .eq('processed', true);

  if (docError) throw docError;

  if (!documents || documents.length === 0) {
    return { documents: [], chunks: [] };
  }

  // Score documents by similarity
  const scoredDocs = documents.map(doc => {
    let embedding;
    try {
      embedding = JSON.parse(doc.embedding || '[]');
    } catch {
      embedding = [];
    }

    const similarity = cosineSimilarity(queryEmbedding, embedding);

    return {
      ...doc,
      similarity_score: similarity
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
        documentTitle: parentDoc?.title || 'Unknown',
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

/**
 * POST /api/chat/:clientId
 * Send a message and get AI response (with optional images)
 * Supports: uploaded images AND images from stored DAM sources
 */
router.post('/:clientId', chatUpload.array('images', 5), async (req, res) => {
  const tempFilePaths = [];
  try {
    const { clientId } = req.params;
    const { message, includeSourceImages, sourceDocumentIds } = req.body;
    const imageFiles = req.files || [];

    // Track temp files for cleanup
    imageFiles.forEach(f => tempFilePaths.push(f.path));

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
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

    // Get recent conversation history (last 10 messages)
    const { data: history, error: historyError } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (historyError) throw historyError;

    // Reverse to get chronological order
    const conversationHistory = (history || []).reverse();

    // Perform semantic search to find relevant documents and chunks
    const { documents: relevantDocs, chunks: relevantChunks } = await semanticSearch(clientId, message, 5);

    // Fetch connected sheets for this client
    const { data: connectedSheets } = await supabase
      .from('connected_sheets')
      .select('*')
      .eq('client_id', clientId);

    // Add client context if available
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

    // Format chunks for the AI
    const formattedChunks = relevantChunks.map(chunk => ({
      documentTitle: chunk.documentTitle,
      documentId: chunk.documentId,
      text: chunk.content,
      similarity: chunk.similarity_score
    }));

    // Process uploaded images
    const uploadedImages = [];
    let imageAnalysis = null;

    if (imageFiles.length > 0) {
      for (const file of imageFiles) {
        try {
          const imageBuffer = await fs.readFile(file.path);
          const base64Image = imageBuffer.toString('base64');
          const mimeType = file.mimetype || 'image/jpeg';
          uploadedImages.push({
            url: `data:${mimeType};base64,${base64Image}`,
            fileName: file.originalname
          });
        } catch (error) {
          console.error('Error processing uploaded image:', error);
        }
      }

      // Generate analysis for uploaded images
      if (uploadedImages.length === 1) {
        try {
          imageAnalysis = await analyzeImage(uploadedImages[0].url, message);
        } catch (error) {
          console.error('Image analysis error:', error);
        }
      } else if (uploadedImages.length > 1) {
        try {
          imageAnalysis = await analyzeMultipleImages(
            uploadedImages.map(img => img.url),
            message
          );
        } catch (error) {
          console.error('Multi-image analysis error:', error);
        }
      }
    }

    // Fetch and process images from DAM sources if requested
    const sourceImages = [];
    const shouldIncludeSourceImages = includeSourceImages === 'true' || includeSourceImages === true;

    if (shouldIncludeSourceImages) {
      // Get image documents from relevant docs or specific IDs
      let imageDocIds = [];

      if (sourceDocumentIds) {
        // Use specific document IDs provided
        imageDocIds = Array.isArray(sourceDocumentIds)
          ? sourceDocumentIds
          : JSON.parse(sourceDocumentIds);
      } else {
        // Find image files from relevant documents
        imageDocIds = relevantDocs
          .filter(d => isImageFile(d.file_type))
          .map(d => d.id);
      }

      // Fetch image documents
      if (imageDocIds.length > 0) {
        const { data: imageDocs, error: imgError } = await supabase
          .from('documents')
          .select('id, file_name, file_url, file_type')
          .in('id', imageDocIds)
          .limit(5);

        if (!imgError && imageDocs) {
          for (const doc of imageDocs) {
            if (doc.file_url && isImageFile(doc.file_type)) {
              const base64Url = await fetchImageAsBase64(doc.file_url);
              if (base64Url) {
                sourceImages.push({
                  id: doc.id,
                  fileName: doc.file_name,
                  url: base64Url,
                  analysis: null // Will be analyzed inline by the model
                });
              }
            }
          }
        }
      }
    }

    // Detect if this is a sheet-related query
    const sheetKeywords = [
      'sheet', 'spreadsheet', 'tab', 'tabs', 'cell', 'row', 'column', 'excel',
      'google sheet', 'data in', 'table', 'values in', 'what\'s in the'
    ];
    const lowerMessage = message.toLowerCase();
    const hasConnectedSheets = connectedSheets && connectedSheets.length > 0;
    const isSheetQuery = hasConnectedSheets && sheetKeywords.some(keyword => lowerMessage.includes(keyword));
    const mentionsSheet = hasConnectedSheets && connectedSheets.some(sheet =>
      lowerMessage.includes(sheet.name.toLowerCase()) ||
      (sheet.sheet_tabs || []).some(tab => lowerMessage.includes(tab.title?.toLowerCase() || ''))
    );

    let aiResponse;
    let sheetOperations = [];

    if ((isSheetQuery || mentionsSheet) && !imageFiles.length) {
      // Use Claude with sheet tools for sheet-related queries
      console.log('Using Claude with sheet tools for query:', message);
      const claudeResult = await claudeChatWithSheets(
        message,
        contextDocs,
        connectedSheets,
        conversationHistory,
        formattedChunks
      );
      aiResponse = claudeResult.response;
      sheetOperations = claudeResult.operations || [];
    } else {
      // Use OpenAI for regular queries or queries with images
      aiResponse = await enhancedChat(
        message,
        contextDocs,
        conversationHistory,
        imageAnalysis,
        formattedChunks,
        uploadedImages,
        sourceImages
      );
    }

    // Prepare source references for storage
    const sourceRefs = relevantDocs
      .filter(d => d.similarity_score > 0.3)
      .map(d => ({
        id: d.id,
        title: d.title,
        similarity: d.similarity_score,
        isImage: isImageFile(d.file_type)
      }));

    // Save user message (with image indicator if applicable)
    const userMessageContent = imageFiles.length > 0
      ? `${message}\n[Attached ${imageFiles.length} image(s)]`
      : message;

    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert([{
        client_id: clientId,
        role: 'user',
        content: userMessageContent,
        context_docs: relevantDocs.map(d => d.id)
      }]);

    if (userMsgError) throw userMsgError;

    // Save AI response with source references
    const { data: assistantMsg, error: assistantMsgError } = await supabase
      .from('chat_messages')
      .insert([{
        client_id: clientId,
        role: 'assistant',
        content: aiResponse,
        context_docs: relevantDocs.map(d => d.id),
        sources: sourceRefs
      }])
      .select()
      .single();

    if (assistantMsgError) throw assistantMsgError;

    res.json({
      success: true,
      data: {
        message: assistantMsg,
        contextDocuments: sourceRefs,
        imagesProcessed: {
          uploaded: uploadedImages.length,
          fromSources: sourceImages.length
        },
        sheetOperations: sheetOperations.length > 0 ? sheetOperations : undefined
      }
    });
  } catch (error) {
    console.error('Error in chat:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    // Cleanup temp files
    for (const filePath of tempFilePaths) {
      try {
        await fs.unlink(filePath);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    }
  }
});

/**
 * POST /api/chat/:clientId/analyze-image
 * Analyze a specific image from DAM sources
 */
router.post('/:clientId/analyze-image', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { documentId, question } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: 'Document ID is required'
      });
    }

    // Fetch the document
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .eq('client_id', clientId)
      .single();

    if (docError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    // Check if it's an image
    if (!isImageFile(document.file_type)) {
      return res.status(400).json({
        success: false,
        error: 'Document is not an image file'
      });
    }

    // Fetch the image
    const base64Url = await fetchImageAsBase64(document.file_url);
    if (!base64Url) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch image'
      });
    }

    // Analyze the image
    const analysis = await analyzeImage(
      base64Url,
      question || "Describe this image in detail. What does it show?"
    );

    res.json({
      success: true,
      data: {
        documentId: document.id,
        fileName: document.file_name,
        analysis
      }
    });
  } catch (error) {
    console.error('Error analyzing source image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/chat/:clientId/extract-image
 * Extract text and data from an image (OCR + understanding)
 */
router.post('/:clientId/extract-image', chatUpload.single('image'), async (req, res) => {
  let tempFilePath = null;
  try {
    const { clientId } = req.params;
    const { documentId } = req.body;
    const imageFile = req.file;

    if (imageFile) {
      tempFilePath = imageFile.path;
    }

    let imageSource;

    if (documentId) {
      // Extract from stored document
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('client_id', clientId)
        .single();

      if (docError || !document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      if (!isImageFile(document.file_type)) {
        return res.status(400).json({
          success: false,
          error: 'Document is not an image file'
        });
      }

      imageSource = await fetchImageAsBase64(document.file_url);
    } else if (tempFilePath) {
      // Extract from uploaded file
      imageSource = tempFilePath;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Either documentId or image file is required'
      });
    }

    if (!imageSource) {
      return res.status(500).json({
        success: false,
        error: 'Failed to load image'
      });
    }

    // Extract data from image
    const extraction = await extractFromImage(imageSource);

    res.json({
      success: true,
      data: extraction
    });
  } catch (error) {
    console.error('Error extracting from image:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    }
  }
});

/**
 * GET /api/chat/:clientId/images
 * Get all image documents for a client (for selecting in chat)
 */
router.get('/:clientId/images', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data: images, error } = await supabase
      .from('documents')
      .select('id, file_name, file_url, file_type, created_at, title, summary')
      .eq('client_id', clientId)
      .in('file_type', ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'])
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: images || []
    });
  } catch (error) {
    console.error('Error fetching images:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/chat/:clientId
 * Clear chat history for a client
 */
router.delete('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { error } = await supabase
      .from('chat_messages')
      .delete()
      .eq('client_id', clientId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Chat history cleared'
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/chat/:clientId/sheets
 * Chat with Google Sheets editing capabilities
 */
router.post('/:clientId/sheets', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { message, spreadsheetId } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Spreadsheet ID is required'
      });
    }

    // Verify the sheet is connected to this client
    const { data: connectedSheet, error: sheetError } = await supabase
      .from('connected_sheets')
      .select('*')
      .eq('client_id', clientId)
      .eq('spreadsheet_id', spreadsheetId)
      .single();

    if (sheetError || !connectedSheet) {
      return res.status(404).json({
        success: false,
        error: 'Sheet not connected to this client'
      });
    }

    // Get fresh sheet info
    const sheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);

    // Get recent conversation history
    const { data: history } = await supabase
      .from('chat_messages')
      .select('role, content')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (history || []).reverse();

    // Get relevant documents for context (optional)
    const { documents } = await semanticSearch(clientId, message, 3);

    // Execute the sheet-aware chat
    const result = await chatWithSheets(
      message,
      spreadsheetId,
      sheetInfo,
      conversationHistory,
      documents
    );

    // Save user message
    await supabase
      .from('chat_messages')
      .insert([{
        client_id: clientId,
        role: 'user',
        content: `[Sheet: ${sheetInfo.title}] ${message}`,
      }]);

    // Save assistant response
    const { data: assistantMsg, error: assistantError } = await supabase
      .from('chat_messages')
      .insert([{
        client_id: clientId,
        role: 'assistant',
        content: result.response,
        sources: result.operations.length > 0 ? [{
          title: sheetInfo.title,
          type: 'google_sheet',
          operations: result.operations
        }] : null
      }])
      .select()
      .single();

    if (assistantError) throw assistantError;

    // Log operations if any were performed
    if (result.operations.length > 0) {
      for (const op of result.operations) {
        await supabase.from('sheet_operations_log').insert({
          spreadsheet_id: spreadsheetId,
          operation_type: op.type,
          range: op.range || op.cell || null,
          cells_affected: op.cells || op.rows || 1,
          performed_by: 'ai'
        });
      }
    }

    res.json({
      success: true,
      data: {
        message: assistantMsg,
        operations: result.operations,
        toolCalls: result.toolCalls
      }
    });

  } catch (error) {
    console.error('Error in sheets chat:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
