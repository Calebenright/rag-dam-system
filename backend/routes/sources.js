import express from 'express';
import { supabase } from '../config/supabase.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { extractTextFromFile, isValidFileType, isValidFileSize } from '../services/fileProcessor.js';
import { analyzeDocument } from '../services/claudeService.js';
import { generateEmbedding, chunkText } from '../services/openaiService.js';
import {
  extractDocId,
  extractSheetId,
  getGoogleSourceType,
  fetchPublicGoogleDoc,
  fetchPublicGoogleSheet,
  hashContent,
} from '../services/googleDocs.js';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 },
  fileFilter: (req, file, cb) => {
    if (isValidFileType(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed types: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV'));
    }
  }
});

/**
 * Process document in background
 */
async function processDocumentAsync(documentId, filePath, fileName, fileType) {
  try {
    console.log(`Processing source ${documentId}...`);
    const textContent = await extractTextFromFile(filePath, fileType);

    if (!textContent || textContent.length < 10) {
      throw new Error('Insufficient text content extracted from file');
    }

    const analysis = await analyzeDocument(textContent, fileName, fileType);
    const docEmbedding = await generateEmbedding(
      `${analysis.title} ${analysis.summary} ${analysis.keywords.join(' ')}`
    );

    const chunks = chunkText(textContent, 1000, 200);

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
        console.error(`Error processing chunk ${i}:`, chunkError);
      }
    }

    await supabase
      .from('documents')
      .update({
        title: fileName,
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

    console.log(`Source ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing source ${documentId}:`, error);
    await supabase
      .from('documents')
      .update({ processed: false, summary: `Error: ${error.message}` })
      .eq('id', documentId);
  } finally {
    try {
      await fs.unlink(filePath);
    } catch (e) {}
  }
}

/**
 * Process Google Doc in background
 */
async function processGoogleDocAsync(documentId, content, title, sourceType) {
  try {
    console.log(`Processing Google source ${documentId}...`);

    if (!content || content.length < 10) {
      throw new Error('Insufficient content extracted from Google source');
    }

    const analysis = await analyzeDocument(content, title, sourceType);
    const docEmbedding = await generateEmbedding(
      `${analysis.title} ${analysis.summary} ${analysis.keywords.join(' ')}`
    );

    const chunks = chunkText(content, 1000, 200);
    const BATCH_SIZE = 50;

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

      if (chunkRecords.length > 0) {
        await supabase.from('document_chunks').insert(chunkRecords);
      }
    }

    await supabase
      .from('documents')
      .update({
        title: title || analysis.title,
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

    console.log(`Google source ${documentId} processed successfully`);
  } catch (error) {
    console.error(`Error processing Google source ${documentId}:`, error.message);
    await supabase
      .from('documents')
      .update({ processed: false, summary: `Error: ${error.message}` })
      .eq('id', documentId);
  }
}

/**
 * POST /api/sources/upload
 * Upload a source via API (cleaner endpoint name)
 */
router.post('/upload', async (req, res) => {
  let tempFilePath = null;

  try {
    const { url, client: clientIdentifier } = req.body;

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
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    if (uuidRegex.test(clientIdentifier)) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', clientIdentifier)
        .single();
      if (!error && data) client = data;
    }

    if (!client) {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .ilike('name', clientIdentifier)
        .single();
      if (!error && data) client = data;
    }

    if (!client) {
      return res.status(404).json({
        success: false,
        error: `Client not found: ${clientIdentifier}`
      });
    }

    const clientId = client.id;
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

        // Add to connected_sheets
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
            }, { onConflict: 'client_id,spreadsheet_id' });
        } catch (e) {
          console.error('Error adding to connected_sheets:', e);
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Google Slides not yet supported'
        });
      }

      const contentHash = hashContent(content);

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

      processGoogleDocAsync(document.id, content, title, sourceType);

      return res.status(201).json({
        success: true,
        data: { ...document, tabs: sheetTabs },
        message: sourceType === 'google_sheet'
          ? `Google Sheet "${title}" added with ${sheetTabs.length} tab(s). Processing in background...`
          : `Google Doc "${title}" added. Processing in background...`
      });
    }

    // Handle regular web URLs
    let fileBuffer, fileName, fileType, fileSize;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileSize = fileBuffer.length;

      const contentDisposition = response.headers.get('content-disposition');
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match) fileName = match[1].replace(/['"]/g, '');
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

    if (!isValidFileType(fileType)) {
      return res.status(400).json({
        success: false,
        error: `Invalid file type: ${fileType}. Allowed: PDF, DOCX, TXT, PNG, JPG, XLSX, CSV`
      });
    }

    if (!isValidFileSize(fileSize)) {
      const maxSize = parseInt(process.env.MAX_FILE_SIZE) || 10485760;
      return res.status(400).json({
        success: false,
        error: `File too large. Maximum size: ${Math.round(maxSize / 1024 / 1024)}MB`
      });
    }

    tempFilePath = path.join(os.tmpdir(), `${uuidv4()}${path.extname(fileName)}`);
    await fs.writeFile(tempFilePath, fileBuffer);

    const fileExt = path.extname(fileName);
    const storagePath = `documents/${clientId}/${uuidv4()}${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('client-assets')
      .upload(storagePath, fileBuffer, { contentType: fileType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('client-assets')
      .getPublicUrl(storagePath);

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

    processDocumentAsync(document.id, tempFilePath, fileName, fileType);

    res.status(201).json({
      success: true,
      data: document,
      message: `Source "${fileName}" uploaded. Processing in background...`
    });

  } catch (error) {
    console.error('Error in source upload:', error);
    if (tempFilePath) {
      try { await fs.unlink(tempFilePath); } catch (e) {}
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/sources/create-client
 * Create a new client via API
 */
router.post('/create-client', async (req, res) => {
  try {
    const { name, description, pod_number, is_superclient } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: name'
      });
    }

    // Check if client exists
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

    let parsedPodNumber = 1;
    if (pod_number !== undefined) {
      const podNum = parseInt(pod_number);
      if (podNum >= 1 && podNum <= 4) parsedPodNumber = podNum;
    }

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
    console.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sources/clients
 * List all clients
 */
router.get('/clients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, description, pod_number, is_superclient, created_at')
      .order('name');

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error listing clients:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/sources/:clientId
 * Get all sources for a client
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data, error } = await supabase
      .from('documents')
      .select('id, file_name, file_type, file_url, source_type, processed, created_at, last_synced')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching sources:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
