import express from 'express';
import { supabase } from '../config/supabase.js';

const router = express.Router();

/**
 * POST /api/bugs
 * Submit a bug report
 */
router.post('/', async (req, res) => {
  try {
    const {
      reporter_email,
      category = 'bug',
      severity = 'medium',
      title,
      description,
      steps_to_reproduce,
      expected_behavior,
      current_url,
      user_agent,
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({
        success: false,
        error: 'Title and description are required',
      });
    }

    const { data, error } = await supabase
      .from('bug_reports')
      .insert({
        reporter_email,
        category,
        severity,
        title,
        description,
        steps_to_reproduce,
        expected_behavior,
        current_url,
        user_agent,
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error submitting bug report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/bugs
 * List all bug reports (for internal review)
 */
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;

    let query = supabase
      .from('bug_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching bug reports:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PATCH /api/bugs/:id
 * Update a bug report (status, severity, etc.)
 */
router.patch('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Only allow updating specific fields
    const allowed = ['status', 'severity', 'category'];
    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    if (Object.keys(filtered).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
      });
    }

    const { data, error } = await supabase
      .from('bug_reports')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error updating bug report:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
