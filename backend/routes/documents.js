import express from 'express';
import { supabase } from '../config/supabase.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { extractTextFromFile, isValidFileType, isValidFileSize } from '../services/fileProcessor.js';
import { analyzeDocument } from '../services/claudeService.js';
import { generateEmbedding, chunkText, cosineSimilarity } from '../services/openaiService.js';
import {
  extractDocId,
  extractSheetId,
  getGoogleSourceType,
  fetchPublicGoogleDoc,
  fetchPublicGoogleSheet,
  hashContent,
  checkAndFetchIfModified
} from '../services/googleDocs.js';

const router = express.Router();

// Configure multer for document uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 }, // 10MB default
  fileFilter: (req, file, cb) => {
    if (isValidFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV'));
    }
  }
});

/**
 * GET /api/documents/:clientId
 * Get all documents for a client
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/detail/:documentId
 * Get single document by ID
 */
router.get('/detail/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/documents/:clientId/chunks/:documentId
 * Get chunks for a specific document
 */
router.get('/:clientId/chunks/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    const { data, error } = await supabase
      .from('document_chunks')
      .select('*')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching document chunks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:clientId/upload
 * Upload and process document
 */
router.post('/:clientId/upload', upload.single('file'), async (req, res) => {
  let tempFilePath = null;

  try {
    const { clientId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    tempFilePath = req.file.path;
    const fileName = req.file.originalname;
    const fileType = req.file.mimetype;
    const fileSize = req.file.size;

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    // Upload file to Supabase Storage
    const fileExt = path.extname(fileName);
    const storagePath = `documents/${clientId}/${uuidv4()}${fileExt}`;

    const fileBuffer = await fs.readFile(tempFilePath);

    const { error: uploadError } = await supabase.storage
      .from('client-assets')
      .upload(storagePath, fileBuffer, {
        contentType: fileType,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('client-assets')
      .getPublicUrl(storagePath);

    // Create initial document record (processing = false)
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert([{
        client_id: clientId,
        file_name: fileName,
        file_type: fileType,
        file_url: publicUrl,
        file_size: fileSize,
        processed: false
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Process document asynchronously
    processDocumentAsync(document.id, tempFilePath, fileName, fileType);

    res.status(201).json({
      success: true,
      data: document,
      message: 'Document uploaded. Processing in background...'
    });

  } catch (error) {
    console.error('Error uploading document:', error);

    // Cleanup temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process document in background - now with chunking and embeddings
 */
async function processDocumentAsync(documentId, filePath, fileName, fileType) {
  try {
    console.log(`Processing document ${documentId}...`);

    // Extract text
    const textContent = await extractTextFromFile(filePath, fileType);

    if (!textContent || textContent.length < 10) {
      throw new Error('Insufficient text content extracted from file');
    }

    // Analyze with Claude
    const analysis = await analyzeDocument(textContent, fileName, fileType);

    // Generate document-level embedding for the summary
    const docEmbedding = await generateEmbedding(
      `${analysis.title} ${analysis.summary} ${analysis.keywords.join(' ')}`
    );

    // Chunk the full text content
    const chunks = chunkText(textContent, 1000, 200);
    console.log(`Created ${chunks.length} chunks for document ${documentId}`);

    // Generate embeddings for each chunk and store them
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      try {
        const chunkEmbedding = await generateEmbedding(chunk.text);

        await supabase
          .from('document_chunks')
          .insert([{
            document_id: documentId,
            chunk_index: i,
            content: chunk.text,
            start_index: chunk.startIndex,
            end_index: chunk.endIndex,
            embedding: JSON.stringify(chunkEmbedding)
          }]);
      } catch (chunkError) {
        console.error(`Error processing chunk ${i} of document ${documentId}:`, chunkError);
      }
    }

    // Update document record - keep original filename as title
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        title: fileName, // Use original filename, not AI-generated title
        summary: analysis.summary,
        tags: analysis.tags,
        keywords: analysis.keywords,
        topic: analysis.topic,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        embedding: JSON.stringify(docEmbedding),
        chunk_count: chunks.length,
        processed: true
      })
      .eq('id', documentId);

    if (updateError) throw updateError;

    console.log(`Document ${documentId} processed successfully with ${chunks.length} chunks`);

  } catch (error) {
    console.error(`Error processing document ${documentId}:`, error);

    // Mark as failed - keep original filename
    await supabase
      .from('documents')
      .update({
        processed: false,
        summary: `Error: ${error.message}`
      })
      .eq('id', documentId);
  } finally {
    // Cleanup temp file
    try {
      await fs.unlink(filePath);
    } catch (e) {
      console.error('Error deleting temp file:', e);
    }
  }
}

/**
 * POST /api/documents/:clientId/google
 * Add a Google Doc/Sheet as a source
 */
router.post('/:clientId/google', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Google Docs/Sheets URL is required'
      });
    }

    // Determine source type
    const sourceType = getGoogleSourceType(url);
    if (!sourceType) {
      return res.status(400).json({
        success: false,
        error: 'Invalid URL. Please provide a Google Docs or Google Sheets URL.'
      });
    }

    // Verify client exists
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientError || !client) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    let content, title, docId, sheetTabs = [];

    if (sourceType === 'google_doc') {
      docId = extractDocId(url);
      if (!docId) {
        return res.status(400).json({
          success: false,
          error: 'Could not extract document ID from URL'
        });
      }

      const docData = await fetchPublicGoogleDoc(docId);
      content = docData.content;
      title = docData.title;
    } else if (sourceType === 'google_sheet') {
      docId = extractSheetId(url);
      if (!docId) {
        return res.status(400).json({
          success: false,
          error: 'Could not extract spreadsheet ID from URL'
        });
      }

      const sheetData = await fetchPublicGoogleSheet(docId);
      content = sheetData.content;
      title = sheetData.title;
      sheetTabs = sheetData.tabs || [];

      // Also add to connected_sheets for the chat agent to use
      try {
        await supabase
          .from('connected_sheets')
          .upsert({
            client_id: clientId,
            spreadsheet_id: docId,
            sheet_url: url,
            name: title,
            sheet_tabs: sheetTabs,
            last_synced: new Date().toISOString(),
          }, {
            onConflict: 'client_id,spreadsheet_id',
          });
      } catch (sheetConnectError) {
        console.error('Error adding to connected_sheets:', sheetConnectError);
        // Continue even if this fails - the document will still be added
      }
    } else {
      return res.status(400).json({
        success: false,
        error: 'Google Slides not yet supported'
      });
    }

    // Generate content hash for change detection
    const contentHash = hashContent(content);

    // Create document record
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert([{
        client_id: clientId,
        file_name: title,
        file_type: sourceType,
        file_url: url,
        file_size: content ? content.length : 0,
        google_doc_id: docId,
        source_type: 'google',
        last_synced: new Date().toISOString(),
        content_hash: contentHash,
        processed: false,
        sheet_tabs: sheetTabs.length > 0 ? sheetTabs : null
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Process document asynchronously
    processGoogleDocAsync(document.id, content, title, sourceType);

    res.status(201).json({
      success: true,
      data: {
        ...document,
        tabs: sheetTabs
      },
      message: sourceType === 'google_sheet'
        ? `Google Sheet added with ${sheetTabs.length} tab(s). Processing in background...`
        : 'Google Doc added. Processing in background...'
    });

  } catch (error) {
    console.error('Error adding Google Doc:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:documentId/sync
 * Sync/refresh a Google Doc source
 */
router.post('/:documentId/sync', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Get document
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    if (document.source_type !== 'google' || !document.google_doc_id) {
      return res.status(400).json({
        success: false,
        error: 'This document is not a Google source'
      });
    }

    let content, title, sheetTabs = [];
    const sourceType = document.file_type;

    if (sourceType === 'google_doc') {
      const docData = await fetchPublicGoogleDoc(document.google_doc_id);
      content = docData.content;
      title = docData.title;
    } else if (sourceType === 'google_sheet') {
      const sheetData = await fetchPublicGoogleSheet(document.google_doc_id);
      content = sheetData.content;
      title = sheetData.title;
      sheetTabs = sheetData.tabs || [];

      // Update connected_sheets with latest tabs
      try {
        await supabase
          .from('connected_sheets')
          .upsert({
            client_id: document.client_id,
            spreadsheet_id: document.google_doc_id,
            sheet_url: document.file_url,
            name: title,
            sheet_tabs: sheetTabs,
            last_synced: new Date().toISOString(),
          }, {
            onConflict: 'client_id,spreadsheet_id',
          });
      } catch (sheetConnectError) {
        console.error('Error updating connected_sheets:', sheetConnectError);
      }
    }

    // Delete old chunks
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    // Update last_synced and tabs
    await supabase
      .from('documents')
      .update({
        file_name: title,
        last_synced: new Date().toISOString(),
        processed: false,
        sheet_tabs: sheetTabs.length > 0 ? sheetTabs : null
      })
      .eq('id', documentId);

    // Re-process document
    processGoogleDocAsync(documentId, content, title, sourceType);

    res.json({
      success: true,
      message: sourceType === 'google_sheet'
        ? `Sync started. Refreshing ${sheetTabs.length} tab(s)...`
        : 'Sync started. Document is being re-processed...'
    });

  } catch (error) {
    console.error('Error syncing Google Doc:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/:clientId/sync-all
 * Check all Google sources for updates and sync only changed ones
 */
router.post('/:clientId/sync-all', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Get all Google sources for this client
    const { data: googleDocs, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .eq('source_type', 'google');

    if (fetchError) throw fetchError;

    if (!googleDocs || googleDocs.length === 0) {
      return res.json({
        success: true,
        message: 'No Google sources to sync',
        synced: 0,
        checked: 0
      });
    }

    const results = {
      checked: googleDocs.length,
      synced: 0,
      unchanged: 0,
      errors: []
    };

    // Check each doc for changes
    for (const doc of googleDocs) {
      try {
        const checkResult = await checkAndFetchIfModified(
          doc.google_doc_id,
          doc.file_type,
          doc.content_hash
        );

        if (checkResult.modified) {
          // Delete old chunks
          await supabase
            .from('document_chunks')
            .delete()
            .eq('document_id', doc.id);

          // Update the document with new tabs if it's a sheet
          const updateData = {
            file_name: checkResult.title,
            last_synced: new Date().toISOString(),
            content_hash: checkResult.contentHash,
            processed: false
          };

          if (doc.file_type === 'google_sheet' && checkResult.tabs) {
            updateData.sheet_tabs = checkResult.tabs;

            // Also update connected_sheets
            try {
              await supabase
                .from('connected_sheets')
                .upsert({
                  client_id: doc.client_id,
                  spreadsheet_id: doc.google_doc_id,
                  sheet_url: doc.file_url,
                  name: checkResult.title,
                  sheet_tabs: checkResult.tabs,
                  last_synced: new Date().toISOString(),
                }, {
                  onConflict: 'client_id,spreadsheet_id',
                });
            } catch (sheetError) {
              console.error('Error updating connected_sheets:', sheetError);
            }
          }

          await supabase
            .from('documents')
            .update(updateData)
            .eq('id', doc.id);

          // Re-process in background
          processGoogleDocAsync(doc.id, checkResult.content, checkResult.title, doc.file_type);
          results.synced++;
        } else {
          results.unchanged++;
        }
      } catch (error) {
        results.errors.push({ docId: doc.id, error: error.message });
      }
    }

    res.json({
      success: true,
      message: `Sync complete. ${results.synced} updated, ${results.unchanged} unchanged.`,
      ...results
    });

  } catch (error) {
    console.error('Error in batch sync:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Process Google Doc in background - now with chunking
 */
async function processGoogleDocAsync(documentId, content, title, sourceType) {
  try {
    console.log(`Processing Google Doc ${documentId}...`);
    console.log(`Content length: ${content?.length || 0} characters`);

    if (!content || content.length < 10) {
      throw new Error('Insufficient content extracted from Google Doc');
    }

    // Analyze with Claude
    console.log(`Starting Claude analysis for ${documentId}...`);
    const analysis = await analyzeDocument(content, title, sourceType);
    console.log(`Claude analysis complete for ${documentId}:`, analysis.title);

    // Generate document-level embedding
    const docEmbedding = await generateEmbedding(
      `${analysis.title} ${analysis.summary} ${analysis.keywords.join(' ')}`
    );

    // Chunk the content
    const chunks = chunkText(content, 1000, 200);
    console.log(`Chunking complete: ${chunks.length} chunks for Google Doc ${documentId}`);

    // Generate embeddings for chunks in batches (much faster)
    console.log(`Inserting ${chunks.length} chunks into database...`);
    const BATCH_SIZE = 50;
    let insertedCount = 0;

    for (let batchStart = 0; batchStart < chunks.length; batchStart += BATCH_SIZE) {
      const batch = chunks.slice(batchStart, batchStart + BATCH_SIZE);
      const chunkRecords = [];

      for (let i = 0; i < batch.length; i++) {
        const chunk = batch[i];
        const chunkIndex = batchStart + i;
        try {
          const chunkEmbedding = await generateEmbedding(chunk.text);
          chunkRecords.push({
            document_id: documentId,
            chunk_index: chunkIndex,
            content: chunk.text,
            start_index: chunk.startIndex,
            end_index: chunk.endIndex,
            embedding: JSON.stringify(chunkEmbedding)
          });
        } catch (chunkError) {
          console.error(`Error generating embedding for chunk ${chunkIndex}:`, chunkError.message);
        }
      }

      // Insert batch
      if (chunkRecords.length > 0) {
        const { error: batchError } = await supabase
          .from('document_chunks')
          .insert(chunkRecords);

        if (batchError) {
          console.error(`Error inserting batch at ${batchStart}:`, batchError.message);
        } else {
          insertedCount += chunkRecords.length;
        }
      }

      // Log progress every 200 chunks
      if ((batchStart + BATCH_SIZE) % 200 === 0 || batchStart + BATCH_SIZE >= chunks.length) {
        console.log(`Progress: ${Math.min(batchStart + BATCH_SIZE, chunks.length)}/${chunks.length} chunks processed`);
      }
    }

    console.log(`Finished inserting ${insertedCount} chunks for ${documentId}`);

    // Update document record - keep original Google title, don't overwrite with AI title
    console.log(`Updating document ${documentId} with processed=true, ${chunks.length} chunks...`);
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        // Keep the original Google Doc/Sheet title (passed as 'title' param), don't use analysis.title
        summary: analysis.summary,
        tags: analysis.tags,
        keywords: analysis.keywords,
        topic: analysis.topic,
        sentiment: analysis.sentiment,
        sentiment_score: analysis.sentiment_score,
        embedding: JSON.stringify(docEmbedding),
        chunk_count: chunks.length,
        processed: true
      })
      .eq('id', documentId);

    if (updateError) {
      console.error(`Error updating document ${documentId}:`, updateError);
      throw updateError;
    }

    console.log(`Google Doc ${documentId} processed successfully with ${chunks.length} chunks`);

  } catch (error) {
    console.error(`Error processing Google Doc ${documentId}:`, error.message || error);

    // Mark as failed - keep original title, only update summary with error
    await supabase
      .from('documents')
      .update({
        processed: false,
        summary: `Error: ${error.message}`
      })
      .eq('id', documentId);
  }
}

/**
 * POST /api/documents/search/:clientId
 * Semantic search for documents using vector similarity
 */
router.post('/search/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { query, limit = 5, includeChunks = true } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Generate embedding for query
    const queryEmbedding = await generateEmbedding(query);

    // Get all documents for this client
    const { data: documents, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('client_id', clientId)
      .eq('processed', true);

    if (docError) throw docError;

    // Calculate document-level similarity scores
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

    // Sort by similarity and get top results
    const topDocs = scoredDocs
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    // If requested, also search chunks for more precise retrieval
    let relevantChunks = [];
    if (includeChunks && topDocs.length > 0) {
      const docIds = topDocs.map(d => d.id);

      const { data: chunks, error: chunkError } = await supabase
        .from('document_chunks')
        .select('*')
        .in('document_id', docIds);

      if (!chunkError && chunks) {
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
            documentTitle: parentDoc?.title || 'Unknown'
          };
        });

        // Get top chunks
        relevantChunks = scoredChunks
          .sort((a, b) => b.similarity_score - a.similarity_score)
          .slice(0, 10);
      }
    }

    res.json({
      success: true,
      data: {
        documents: topDocs,
        chunks: relevantChunks
      }
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/api-upload
 * Upload a source via API (global API key with client identifier in body)
 *
 * Headers:
 * - X-API-Key: Global API key (set via DODEKA_API_KEY env variable)
 *
 * Request body:
 * - { url: 'https://docs.google.com/...', client: 'Client Name or ID' }
 */
router.post('/api-upload', async (req, res) => {
  let tempFilePath = null;

  try {
    const { url, client: clientIdentifier } = req.body;
    const apiKey = req.headers['x-api-key'];

    // Validate API key against global key
    const globalApiKey = process.env.DODEKA_API_KEY;
    if (!globalApiKey) {
      return res.status(500).json({
        success: false,
        error: 'API not configured. Set DODEKA_API_KEY environment variable.'
      });
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key. Include X-API-Key header.'
      });
    }

    if (apiKey !== globalApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Validate request
    if (!url) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: url'
      });
    }

    if (!clientIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: client (name or ID)'
      });
    }

    // Find client by name or ID
    let client;

    // First try to find by ID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(clientIdentifier)) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', clientIdentifier)
        .single();

      if (!error && data) {
        client = data;
      }
    }

    // If not found by ID, try by name (case-insensitive)
    if (!client) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', clientIdentifier)
        .single();

      if (!error && data) {
        client = data;
      }
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        error: `Client not found: ${clientIdentifier}`
      });
    }

    const clientId = client.id;

    // Check if it's a Google Docs/Sheets URL
    const sourceType = getGoogleSourceType(url);

    if (sourceType) {
      // Handle Google Docs/Sheets
      let content, title, docId, sheetTabs = [];

      if (sourceType === 'google_doc') {
        docId = extractDocId(url);
        if (!docId) {
          return res.status(400).json({
            success: false,
            error: 'Could not extract document ID from URL'
          });
        }

        const docData = await fetchPublicGoogleDoc(docId);
        content = docData.content;
        title = docData.title;
      } else if (sourceType === 'google_sheet') {
        docId = extractSheetId(url);
        if (!docId) {
          return res.status(400).json({
            success: false,
            error: 'Could not extract spreadsheet ID from URL'
          });
        }

        const sheetData = await fetchPublicGoogleSheet(docId);
        content = sheetData.content;
        title = sheetData.title;
        sheetTabs = sheetData.tabs || [];

        // Also add to connected_sheets for the chat agent to use
        try {
          await supabase
            .from('connected_sheets')
            .upsert({
              client_id: clientId,
              spreadsheet_id: docId,
              sheet_url: url,
              name: title,
              sheet_tabs: sheetTabs,
              last_synced: new Date().toISOString(),
            }, {
              onConflict: 'client_id,spreadsheet_id',
            });
        } catch (sheetConnectError) {
          console.error('Error adding to connected_sheets:', sheetConnectError);
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Google Slides not yet supported'
        });
      }

      // Generate content hash for change detection
      const contentHash = hashContent(content);

      // Create document record
      const { data: document, error: insertError } = await supabase
        .from('documents')
        .insert([{
          client_id: clientId,
          file_name: title,
          file_type: sourceType,
          file_url: url,
          file_size: content ? content.length : 0,
          google_doc_id: docId,
          source_type: 'google',
          last_synced: new Date().toISOString(),
          content_hash: contentHash,
          processed: false,
          sheet_tabs: sheetTabs.length > 0 ? sheetTabs : null
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      // Process document asynchronously
      processGoogleDocAsync(document.id, content, title, sourceType);

      return res.status(201).json({
        success: true,
        data: {
          ...document,
          tabs: sheetTabs
        },
        message: sourceType === 'google_sheet'
          ? `Google Sheet added with ${sheetTabs.length} tab(s). Processing in background...`
          : 'Google Doc added. Processing in background...'
      });
    }

    // Handle regular web URLs
    let fileBuffer;
    let fileName;
    let fileType;
    let fileSize;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileSize = fileBuffer.length;

      // Extract filename from URL or content-disposition header
      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) {
          fileName = match[1].replace(/['"]/g, '');
        }
      }
      if (!fileName) {
        const urlPath = new URL(url).pathname;
        fileName = path.basename(urlPath) || 'downloaded-file';
      }

      fileType = contentType.split(';')[0].trim();
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: `Failed to fetch URL: ${e.message}`
      });
    }

    // Validate file type
    if (!isValidFileType(fileType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file type: ${fileType}. Allowed types: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV`
      });
    }

    // Validate file size
    if (!isValidFileSize(fileSize)) {
      const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760;
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }

    // Write to temp file for processing
    tempFilePath = path.join(os.tmpdir(), `${uuidv4()}${path.extname(fileName)}`);
    await fs.writeFile(tempFilePath, fileBuffer);

    // Upload file to Supabase Storage
    const fileExt = path.extname(fileName);
    const storagePath = `documents/${clientId}/${uuidv4()}${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('client-assets')
      .upload(storagePath, fileBuffer, {
        contentType: fileType,
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('client-assets')
      .getPublicUrl(storagePath);

    // Create initial document record
    const { data: document, error: insertError } = await supabase
      .from('documents')
      .insert([{
        client_id: clientId,
        file_name: fileName,
        file_type: fileType,
        file_url: publicUrl,
        file_size: fileSize,
        source_type: 'url',
        processed: false
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    // Process document asynchronously
    processDocumentAsync(document.id, tempFilePath, fileName, fileType);

    res.status(201).json({
      success: true,
      data: document,
      message: 'Source uploaded via API. Processing in background...'
    });

  } catch (error) {
    console.error('Error in API upload:', error);

    // Cleanup temp file
    if (tempFilePath) {
      try {
        await fs.unlink(tempFilePath);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/documents/:documentId
 * Delete document and its chunks
 */
router.delete('/:documentId', async (req, res) => {
  try {
    const { documentId } = req.params;

    // Get document to find file path
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('file_url')
      .eq('id', documentId)
      .single();

    if (fetchError) throw fetchError;

    // Delete chunks first
    await supabase
      .from('document_chunks')
      .delete()
      .eq('document_id', documentId);

    // Delete from storage (extract path from URL)
    if (document?.file_url && !document.file_url.includes('docs.google.com')) {
      const urlParts = document.file_url.split('/');
      const bucketPath = urlParts.slice(urlParts.indexOf('documents')).join('/');

      await supabase.storage
        .from('client-assets')
        .remove([bucketPath]);
    }

    // Delete document record
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/documents/api-create-client
 * Create a new client via API
 *
 * Headers:
 * - X-API-Key: Global API key (set via DODEKA_API_KEY env variable)
 *
 * Request body:
 * - { name: 'Client Name', description: 'Optional description' }
 *
 * Optional fields:
 * - pod_number: 1-4 (default: 1)
 * - is_superclient: boolean (default: false)
 */
router.post('/api-create-client', async (req, res) => {
  try {
    const { name, description, pod_number, is_superclient } = req.body;
    const apiKey = req.headers['x-api-key'];

    // Validate API key against global key
    const globalApiKey = process.env.DODEKA_API_KEY;
    if (!globalApiKey) {
      return res.status(500).json({
        success: false,
        error: 'API not configured. Set DODEKA_API_KEY environment variable.'
      });
    }

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        error: 'Missing API key. Include X-API-Key header.'
      });
    }

    if (apiKey !== globalApiKey) {
      return res.status(403).json({
        success: false,
        error: 'Invalid API key'
      });
    }

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: name'
      });
    }

    // Check if client with this name already exists
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, name')
      .ilike('name', name.trim())
      .single();

    if (existingClient) {
      return res.status(409).json({
        success: false,
        error: `Client with name "${name}" already exists`,
        data: { existing_client_id: existingClient.id }
      });
    }

    // Check superclient constraint
    if (is_superclient === true || is_superclient === 'true') {
      const { data: existingSuper } = await supabase
        .from('clients')
        .select('id')
        .eq('is_superclient', true)
        .single();

      if (existingSuper) {
        return res.status(400).json({
          success: false,
          error: 'A superclient already exists. Only one superclient is allowed.'
        });
      }
    }

    // Parse pod_number (1-4, default to 1)
    let parsedPodNumber = 1;
    if (pod_number !== undefined) {
      const podNum = parseInt(pod_number);
      if (podNum >= 1 && podNum <= 4) {
        parsedPodNumber = podNum;
      }
    }

    // Create the client
    const { data: client, error: insertError } = await supabase
      .from('clients')
      .insert([{
        name: name.trim(),
        description: description?.trim() || '',
        pod_number: parsedPodNumber,
        is_superclient: is_superclient === true || is_superclient === 'true',
        thumbnail_bg_color: '#000000'
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    res.status(201).json({
      success: true,
      data: client,
      message: `Client "${client.name}" created successfully`
    });

  } catch (error) {
    console.error('Error creating client via API:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
