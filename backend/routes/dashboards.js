import express from 'express';
import { supabase } from '../config/supabase.js';
import { google } from 'googleapis';
import { fetchPublicGoogleSheet, extractSheetId } from '../services/googleDocs.js';

const router = express.Router();

// ==================== HELPER FUNCTIONS ====================

// Get Google Sheets auth client (same as in googleDocs.js)
function getSheetsAuthClient() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_SHEETS_CREDENTIALS, 'base64').toString('utf-8');
      const credentials = JSON.parse(decoded);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } catch (e) {
      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }
  }

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  return null;
}

// Helper to fetch public sheet info with all tabs using the Google Sheets API
async function getPublicSheetInfo(spreadsheetId) {
  try {
    console.log(`[getPublicSheetInfo] Fetching info for spreadsheet: ${spreadsheetId}`);

    // Use the googleDocs service which has proper Google API authentication
    const sheetData = await fetchPublicGoogleSheet(spreadsheetId);

    console.log(`[getPublicSheetInfo] Got title: "${sheetData.title}"`);
    console.log(`[getPublicSheetInfo] Tabs found: ${sheetData.tabs?.length || 0}`);
    if (sheetData.tabs) {
      console.log(`[getPublicSheetInfo] Tab names: ${sheetData.tabs.map(t => t.title).join(', ')}`);
    }

    return {
      title: sheetData.title,
      sheets: sheetData.tabs || [{ title: 'Sheet1', sheetId: 0, index: 0 }],
    };
  } catch (error) {
    console.error('Error fetching sheet info:', error.message);
    throw new Error('Could not access sheet. Make sure it is shared with the service account or publicly accessible.');
  }
}

// Helper to read sheet data for a specific tab using Google Sheets API
async function readPublicSheetData(spreadsheetId, sheetName = 'Sheet1') {
  try {
    const auth = getSheetsAuthClient();

    if (auth) {
      // Use Google Sheets API for reliable access to any tab
      const sheets = google.sheets({ version: 'v4', auth });

      const dataResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: sheetName,
      });

      const values = dataResponse.data.values || [];
      if (values.length === 0) return { headers: [], rows: [] };

      // First row is headers
      const headers = values[0].map(h => String(h || '').trim());

      // Rest are data rows
      const rows = values.slice(1).map(row => {
        const rowObj = {};
        headers.forEach((header, idx) => {
          let val = row[idx] ?? '';
          // Try to parse numbers
          if (typeof val === 'string') {
            const num = parseFloat(val);
            if (!isNaN(num) && val.trim() !== '') {
              rowObj[header] = num;
            } else {
              rowObj[header] = val;
            }
          } else {
            rowObj[header] = val;
          }
        });
        return rowObj;
      });

      return { headers, rows };
    }

    // Fallback to CSV export if no credentials
    console.warn('No Google Sheets credentials, falling back to CSV export');
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error('Could not read sheet data. Make sure the sheet is publicly accessible.');
    }

    const csvText = await response.text();
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(line => {
      const values = parseCSVLine(line);
      const row = {};
      headers.forEach((header, idx) => {
        let val = values[idx] || '';
        const num = parseFloat(val);
        if (!isNaN(num) && val.trim() !== '') {
          row[header] = num;
        } else {
          row[header] = val;
        }
      });
      return row;
    });

    return { headers, rows };
  } catch (error) {
    console.error('Error reading sheet data:', error);
    throw error;
  }
}

// Simple CSV line parser (fallback)
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());

  return result;
}

// ==================== DASHBOARD SOURCES ====================

/**
 * GET /api/dashboards/sources/:clientId
 * Get all data sources for a client
 */
router.get('/sources/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data, error } = await supabase
      .from('dashboard_sources')
      .select('*')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching dashboard sources:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dashboards/sources
 * Create a new data source
 */
router.post('/sources', async (req, res) => {
  try {
    const { clientId, name, sheetUrl, columnMappings } = req.body;

    if (!clientId || !sheetUrl) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and sheet URL are required',
      });
    }

    const spreadsheetId = extractSheetId(sheetUrl);
    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Google Sheets URL',
      });
    }

    // Get sheet info (using public access method)
    const sheetInfo = await getPublicSheetInfo(spreadsheetId);

    console.log(`[POST /sources] Sheet info received:`, {
      title: sheetInfo.title,
      sheetsCount: sheetInfo.sheets?.length,
      sheets: sheetInfo.sheets?.map(s => s.title),
    });

    const { data, error } = await supabase
      .from('dashboard_sources')
      .insert({
        client_id: clientId,
        name: name || sheetInfo.title,
        source_type: 'google_sheets',
        spreadsheet_id: spreadsheetId,
        sheet_url: sheetUrl,
        sheet_tabs: sheetInfo.sheets,
        column_mappings: columnMappings || {},
        last_synced: new Date().toISOString(),
      })
      .select()
      .single();

    console.log(`[POST /sources] Saved to database, sheet_tabs:`, data?.sheet_tabs?.length || 0);

    if (error) throw error;

    res.json({
      success: true,
      data: {
        ...data,
        sheetInfo,
      },
    });
  } catch (error) {
    console.error('Error creating dashboard source:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/dashboards/sources/:sourceId
 * Update a data source
 */
router.put('/sources/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { name, columnMappings, refreshInterval } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (columnMappings) updateData.column_mappings = columnMappings;
    if (refreshInterval) updateData.refresh_interval = refreshInterval;

    const { data, error } = await supabase
      .from('dashboard_sources')
      .update(updateData)
      .eq('id', sourceId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error updating dashboard source:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/dashboards/sources/:sourceId
 * Delete a data source
 */
router.delete('/sources/:sourceId', async (req, res) => {
  try {
    const { sourceId } = req.params;

    const { error } = await supabase
      .from('dashboard_sources')
      .delete()
      .eq('id', sourceId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Source deleted',
    });
  } catch (error) {
    console.error('Error deleting dashboard source:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dashboards/sources/:sourceId/refresh
 * Refresh data from a source
 */
router.post('/sources/:sourceId/refresh', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { tabName } = req.body;

    // Get source info
    const { data: source, error: sourceError } = await supabase
      .from('dashboard_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (sourceError) throw sourceError;

    // Fetch fresh data from the sheet (using public access method)
    const sheetData = await readPublicSheetData(
      source.spreadsheet_id,
      tabName || 'Sheet1'
    );

    // Update the cached data
    const { data, error } = await supabase
      .from('dashboard_sources')
      .update({
        cached_data: sheetData,
        last_synced: new Date().toISOString(),
      })
      .eq('id', sourceId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: {
        source: data,
        sheetData,
      },
    });
  } catch (error) {
    console.error('Error refreshing source:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dashboards/sources/:sourceId/data
 * Get data from a source (with optional tab)
 */
router.get('/sources/:sourceId/data', async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { tab, useCache } = req.query;

    // Get source info
    const { data: source, error: sourceError } = await supabase
      .from('dashboard_sources')
      .select('*')
      .eq('id', sourceId)
      .single();

    if (sourceError) throw sourceError;

    // Check if we should use cached data
    const cacheAge = source.last_synced
      ? (Date.now() - new Date(source.last_synced).getTime()) / 1000
      : Infinity;

    if (useCache === 'true' && source.cached_data && cacheAge < source.refresh_interval) {
      return res.json({
        success: true,
        data: source.cached_data,
        cached: true,
        cacheAge: Math.round(cacheAge),
      });
    }

    // Fetch fresh data (using public access method)
    const sheetData = await readPublicSheetData(
      source.spreadsheet_id,
      tab || 'Sheet1'
    );

    // Update cache
    await supabase
      .from('dashboard_sources')
      .update({
        cached_data: sheetData,
        last_synced: new Date().toISOString(),
      })
      .eq('id', sourceId);

    res.json({
      success: true,
      data: sheetData,
      cached: false,
    });
  } catch (error) {
    console.error('Error fetching source data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== DASHBOARDS ====================

/**
 * GET /api/dashboards/:clientId
 * Get all dashboards for a client
 */
router.get('/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const { data, error } = await supabase
      .from('dashboards')
      .select(`
        *,
        widgets:dashboard_widgets(*)
      `)
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching dashboards:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dashboards/detail/:dashboardId
 * Get a single dashboard with all widgets
 */
router.get('/detail/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;

    const { data, error } = await supabase
      .from('dashboards')
      .select(`
        *,
        widgets:dashboard_widgets(
          *,
          source:dashboard_sources(*)
        )
      `)
      .eq('id', dashboardId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dashboards
 * Create a new dashboard
 */
router.post('/', async (req, res) => {
  try {
    const { clientId, name, description, layout, settings } = req.body;

    if (!clientId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Client ID and name are required',
      });
    }

    const { data, error } = await supabase
      .from('dashboards')
      .insert({
        client_id: clientId,
        name,
        description,
        layout: layout || 'grid',
        settings: settings || {},
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error creating dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/dashboards/:dashboardId
 * Update a dashboard
 */
router.put('/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const { name, description, layout, settings, isDefault } = req.body;

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (layout !== undefined) updateData.layout = layout;
    if (settings !== undefined) updateData.settings = settings;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    const { data, error } = await supabase
      .from('dashboards')
      .update(updateData)
      .eq('id', dashboardId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error updating dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/dashboards/:dashboardId
 * Delete a dashboard
 */
router.delete('/:dashboardId', async (req, res) => {
  try {
    const { dashboardId } = req.params;

    const { error } = await supabase
      .from('dashboards')
      .delete()
      .eq('id', dashboardId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Dashboard deleted',
    });
  } catch (error) {
    console.error('Error deleting dashboard:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// ==================== WIDGETS ====================

/**
 * POST /api/dashboards/:dashboardId/widgets
 * Add a widget to a dashboard
 */
router.post('/:dashboardId/widgets', async (req, res) => {
  try {
    const { dashboardId } = req.params;
    const {
      sourceId,
      widgetType,
      title,
      description,
      gridX,
      gridY,
      gridW,
      gridH,
      config,
    } = req.body;

    if (!widgetType || !title) {
      return res.status(400).json({
        success: false,
        error: 'Widget type and title are required',
      });
    }

    const { data, error } = await supabase
      .from('dashboard_widgets')
      .insert({
        dashboard_id: dashboardId,
        source_id: sourceId,
        widget_type: widgetType,
        title,
        description,
        grid_x: gridX || 0,
        grid_y: gridY || 0,
        grid_w: gridW || 6,
        grid_h: gridH || 4,
        config: config || {},
      })
      .select(`
        *,
        source:dashboard_sources(*)
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error adding widget:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/dashboards/widgets/:widgetId
 * Update a widget
 */
router.put('/widgets/:widgetId', async (req, res) => {
  try {
    const { widgetId } = req.params;
    const {
      sourceId,
      widgetType,
      title,
      description,
      gridX,
      gridY,
      gridW,
      gridH,
      config,
    } = req.body;

    const updateData = {};
    if (sourceId !== undefined) updateData.source_id = sourceId;
    if (widgetType !== undefined) updateData.widget_type = widgetType;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (gridX !== undefined) updateData.grid_x = gridX;
    if (gridY !== undefined) updateData.grid_y = gridY;
    if (gridW !== undefined) updateData.grid_w = gridW;
    if (gridH !== undefined) updateData.grid_h = gridH;
    if (config !== undefined) updateData.config = config;

    const { data, error } = await supabase
      .from('dashboard_widgets')
      .update(updateData)
      .eq('id', widgetId)
      .select(`
        *,
        source:dashboard_sources(*)
      `)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error updating widget:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/dashboards/widgets/:widgetId
 * Delete a widget
 */
router.delete('/widgets/:widgetId', async (req, res) => {
  try {
    const { widgetId } = req.params;

    const { error } = await supabase
      .from('dashboard_widgets')
      .delete()
      .eq('id', widgetId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Widget deleted',
    });
  } catch (error) {
    console.error('Error deleting widget:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/dashboards/:dashboardId/widgets/positions
 * Batch update widget positions
 */
router.put('/:dashboardId/widgets/positions', async (req, res) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({
        success: false,
        error: 'Positions array is required',
      });
    }

    // Update each widget position
    const updates = positions.map(pos =>
      supabase
        .from('dashboard_widgets')
        .update({
          grid_x: pos.gridX,
          grid_y: pos.gridY,
          grid_w: pos.gridW,
          grid_h: pos.gridH,
        })
        .eq('id', pos.id)
    );

    await Promise.all(updates);

    res.json({
      success: true,
      message: `Updated ${positions.length} widget positions`,
    });
  } catch (error) {
    console.error('Error updating widget positions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
