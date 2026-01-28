import express from 'express';
import { supabase } from '../config/supabase.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
import path from 'path';

const router = express.Router();

// Configure multer for thumbnail uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for thumbnails
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG and JPEG images are allowed for thumbnails'));
    }
  }
});

/**
 * GET /api/clients
 * Get all clients
 */
router.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || []
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/clients/:id
 * Get single client by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/clients
 * Create new client
 */
router.post('/', upload.single('thumbnail'), async (req, res) => {
  try {
    const { name, description, is_superclient } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Client name is required'
      });
    }

    // Check if trying to create superclient and one already exists
    if (is_superclient === 'true' || is_superclient === true) {
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

    let thumbnailUrl = null;

    // Upload thumbnail if provided
    if (req.file) {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExt}`;
      const filePath = `thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(filePath);

      thumbnailUrl = publicUrl;
    }

    // Create client record
    const { data, error } = await supabase
      .from('clients')
      .insert([{
        name,
        description: description || '',
        thumbnail_url: thumbnailUrl,
        is_superclient: is_superclient === 'true' || is_superclient === true
      }])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data
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
 * PUT /api/clients/:id
 * Update client
 */
router.put('/:id', upload.single('thumbnail'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, is_superclient, pod_number } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (description !== undefined) updates.description = description;

    // Handle pod_number (1-4)
    if (pod_number !== undefined) {
      const podNum = parseInt(pod_number);
      if (podNum >= 1 && podNum <= 4) {
        updates.pod_number = podNum;
      }
    }

    // Handle superclient flag
    if (is_superclient !== undefined) {
      const makeSuper = is_superclient === 'true' || is_superclient === true;

      if (makeSuper) {
        // Check if another superclient exists
        const { data: existingSuper } = await supabase
          .from('clients')
          .select('id')
          .eq('is_superclient', true)
          .neq('id', id)
          .single();

        if (existingSuper) {
          return res.status(400).json({
            success: false,
            error: 'A superclient already exists. Only one superclient is allowed.'
          });
        }
      }

      updates.is_superclient = makeSuper;
    }

    // Upload new thumbnail if provided
    if (req.file) {
      const fileExt = path.extname(req.file.originalname);
      const fileName = `${uuidv4()}${fileExt}`;
      const filePath = `thumbnails/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client-assets')
        .upload(filePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('client-assets')
        .getPublicUrl(filePath);

      updates.thumbnail_url = publicUrl;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No updates provided'
      });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/clients/:id/api-key
 * Generate or regenerate API key for a client
 */
router.post('/:id/api-key', async (req, res) => {
  try {
    const { id } = req.params;

    // Generate a secure API key
    const apiKey = `dk_${crypto.randomBytes(32).toString('hex')}`;

    const { data, error } = await supabase
      .from('clients')
      .update({
        api_key: apiKey,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error generating API key:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * DELETE /api/clients/:id
 * Delete client and all associated documents
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Delete all documents for this client first
    const { error: docsError } = await supabase
      .from('documents')
      .delete()
      .eq('client_id', id);

    if (docsError) throw docsError;

    // Delete all chat messages
    const { error: chatError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('client_id', id);

    if (chatError) throw chatError;

    // Delete client
    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
