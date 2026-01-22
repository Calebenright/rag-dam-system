import express from 'express';
import { supabase } from '../config/supabase.js';
import * as sheetsService from '../services/googleSheets.js';

const router = express.Router();

/**
 * POST /api/sheets/connect
 * Connect a Google Sheet to a client
 */
router.post('/connect', async (req, res) => {
  try {
    const { clientId, sheetUrl, name } = req.body;

    if (!clientId || !sheetUrl) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and sheet URL are required',
      });
    }

    const spreadsheetId = sheetsService.extractSheetId(sheetUrl);
    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Sheets URL',
      });
    }

    // Get sheet info to verify access
    const sheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);

    // Store the connection in database
    const { data, error } = await supabase
      .from('connected_sheets')
      .upsert({
        client_id: clientId,
        spreadsheet_id: spreadsheetId,
        sheet_url: sheetUrl,
        name: name || sheetInfo.title,
        sheet_tabs: sheetInfo.sheets,
        last_synced: new Date().toISOString(),
      }, {
        onConflict: 'client_id,spreadsheet_id',
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        ...data,
        sheetInfo,
      },
    });
  } catch (error) {
    console.error('Error connecting sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sheets/:clientId
 * Get all connected sheets for a client
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data, error } = await supabase
      .from('connected_sheets')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching connected sheets:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sheets/:clientId/:spreadsheetId/info
 * Get spreadsheet info and refresh tabs list
 */
router.get('/:clientId/:spreadsheetId/info', async (req, res) => {
  try {
    const { clientId, spreadsheetId } = req.params;

    const sheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);

    // Update tabs info in database
    await supabase
      .from('connected_sheets')
      .update({
        sheet_tabs: sheetInfo.sheets,
        last_synced: new Date().toISOString(),
      })
      .eq('client_id', clientId)
      .eq('spreadsheet_id', spreadsheetId);

    res.json({
      success: true,
      data: sheetInfo,
    });
  } catch (error) {
    console.error('Error getting sheet info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/sheets/:clientId/:spreadsheetId/read
 * Read data from a sheet
 */
router.get('/:clientId/:spreadsheetId/read', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { range, sheet } = req.query;

    let data;
    if (range) {
      data = await sheetsService.readSheetRange(spreadsheetId, range);
    } else {
      data = await sheetsService.readEntireSheet(spreadsheetId, sheet || 'Sheet1');
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error reading sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/write
 * Write data to a sheet range
 */
router.post('/:clientId/:spreadsheetId/write', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { range, values } = req.body;

    if (!range || !values) {
      return res.status(400).json({
        success: false,
        error: 'Range and values are required',
      });
    }

    const result = await sheetsService.writeSheetRange(spreadsheetId, range, values);

    // Log the operation
    await supabase.from('sheet_operations_log').insert({
      spreadsheet_id: spreadsheetId,
      operation_type: 'write',
      range,
      cells_affected: result.updatedCells,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error writing to sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/append
 * Append rows to a sheet
 */
router.post('/:clientId/:spreadsheetId/append', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { range, values } = req.body;

    if (!values || !Array.isArray(values)) {
      return res.status(400).json({
        success: false,
        error: 'Values array is required',
      });
    }

    const result = await sheetsService.appendToSheet(
      spreadsheetId,
      range || 'Sheet1!A:Z',
      values
    );

    // Log the operation
    await supabase.from('sheet_operations_log').insert({
      spreadsheet_id: spreadsheetId,
      operation_type: 'append',
      range: result.updatedRange,
      cells_affected: result.updatedCells,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error appending to sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/update-cell
 * Update a single cell
 */
router.post('/:clientId/:spreadsheetId/update-cell', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { sheet, cell, value } = req.body;

    if (!cell || value === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Cell and value are required',
      });
    }

    const result = await sheetsService.updateCell(
      spreadsheetId,
      sheet || 'Sheet1',
      cell,
      value
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error updating cell:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/clear
 * Clear a range
 */
router.post('/:clientId/:spreadsheetId/clear', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { range } = req.body;

    if (!range) {
      return res.status(400).json({
        success: false,
        error: 'Range is required',
      });
    }

    const result = await sheetsService.clearRange(spreadsheetId, range);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error clearing range:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/batch
 * Batch update multiple ranges
 */
router.post('/:clientId/:spreadsheetId/batch', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { updates } = req.body;

    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        error: 'Updates array is required',
      });
    }

    const result = await sheetsService.batchUpdate(spreadsheetId, updates);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in batch update:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/add-tab
 * Add a new sheet tab
 */
router.post('/:clientId/:spreadsheetId/add-tab', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    const result = await sheetsService.addSheet(spreadsheetId, title);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error adding tab:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/sheets/:clientId/:spreadsheetId
 * Disconnect a sheet from a client
 */
router.delete('/:clientId/:spreadsheetId', async (req, res) => {
  try {
    const { clientId, spreadsheetId } = req.params;

    const { error } = await supabase
      .from('connected_sheets')
      .delete()
      .eq('client_id', clientId)
      .eq('spreadsheet_id', spreadsheetId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Sheet disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/sheets/:clientId/:spreadsheetId/ai-edit
 * Execute AI-generated sheet operations
 */
router.post('/:clientId/:spreadsheetId/ai-edit', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { operations } = req.body;

    if (!operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'Operations array is required',
      });
    }

    const results = [];
    for (const op of operations) {
      try {
        const result = await sheetsService.executeSheetOperation(spreadsheetId, op);
        results.push({ success: true, operation: op.type, result });
      } catch (opError) {
        results.push({ success: false, operation: op.type, error: opError.message });
      }
    }

    res.json({
      success: true,
      data: {
        totalOperations: operations.length,
        successful: results.filter(r => r.success).length,
        results,
      },
    });
  } catch (error) {
    console.error('Error executing AI edit:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
