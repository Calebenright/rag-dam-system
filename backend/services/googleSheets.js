import { google } from 'googleapis';

// Extract sheet ID from Google Sheets URL
export function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Create an authenticated Google Sheets client
function getAuthClient() {
  // Check for service account key file
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  // Check for base64-encoded credentials (for Render.com deployment)
  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_SHEETS_CREDENTIALS, 'base64').toString('utf-8');
      const credentials = JSON.parse(decoded);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    } catch (e) {
      // If not base64, try parsing as raw JSON
      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
    }
  }

  // Check for inline credentials JSON
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
  }

  throw new Error('Google credentials not configured. Set GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_SHEETS_CREDENTIALS (base64), or GOOGLE_CREDENTIALS_JSON');
}

// Get sheets client
function getSheetsClient() {
  const auth = getAuthClient();
  return google.sheets({ version: 'v4', auth });
}

/**
 * Get spreadsheet metadata (title, sheets list)
 */
export async function getSpreadsheetInfo(spreadsheetId) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'properties.title,sheets.properties',
    });

    return {
      title: response.data.properties.title,
      sheets: response.data.sheets.map(s => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        index: s.properties.index,
        rowCount: s.properties.gridProperties?.rowCount,
        columnCount: s.properties.gridProperties?.columnCount,
      })),
    };
  } catch (error) {
    console.error('Error getting spreadsheet info:', error.message);
    throw error;
  }
}

/**
 * Read data from a sheet range
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} range - The A1 notation range (e.g., 'Sheet1!A1:D10')
 */
export async function readSheetRange(spreadsheetId, range) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return {
      range: response.data.range,
      values: response.data.values || [],
    };
  } catch (error) {
    console.error('Error reading sheet range:', error.message);
    throw error;
  }
}

/**
 * Read entire sheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} sheetName - The sheet name (tab name)
 */
export async function readEntireSheet(spreadsheetId, sheetName = 'Sheet1') {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: sheetName,
    });

    return {
      range: response.data.range,
      values: response.data.values || [],
    };
  } catch (error) {
    console.error('Error reading entire sheet:', error.message);
    throw error;
  }
}

/**
 * Write data to a sheet range
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} range - The A1 notation range (e.g., 'Sheet1!A1')
 * @param {Array<Array<any>>} values - 2D array of values to write
 */
export async function writeSheetRange(spreadsheetId, range, values) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED', // Allows formulas and auto-formatting
      requestBody: {
        values,
      },
    });

    return {
      updatedRange: response.data.updatedRange,
      updatedRows: response.data.updatedRows,
      updatedColumns: response.data.updatedColumns,
      updatedCells: response.data.updatedCells,
    };
  } catch (error) {
    console.error('Error writing to sheet:', error.message);
    throw error;
  }
}

/**
 * Append rows to a sheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} range - The A1 notation range (e.g., 'Sheet1!A:Z')
 * @param {Array<Array<any>>} values - 2D array of rows to append
 */
export async function appendToSheet(spreadsheetId, range, values) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values,
      },
    });

    return {
      updatedRange: response.data.updates.updatedRange,
      updatedRows: response.data.updates.updatedRows,
      updatedCells: response.data.updates.updatedCells,
    };
  } catch (error) {
    console.error('Error appending to sheet:', error.message);
    throw error;
  }
}

/**
 * Update a single cell
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} sheetName - Sheet name
 * @param {string} cell - Cell reference (e.g., 'A1', 'B5')
 * @param {any} value - Value to set
 */
export async function updateCell(spreadsheetId, sheetName, cell, value) {
  const range = `${sheetName}!${cell}`;
  return writeSheetRange(spreadsheetId, range, [[value]]);
}

/**
 * Clear a range
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} range - The A1 notation range
 */
export async function clearRange(spreadsheetId, range) {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range,
    });

    return { cleared: true, range };
  } catch (error) {
    console.error('Error clearing range:', error.message);
    throw error;
  }
}

/**
 * Batch update multiple ranges at once
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {Array<{range: string, values: Array<Array<any>>}>} data - Array of range/values pairs
 */
export async function batchUpdate(spreadsheetId, data) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: data.map(d => ({
          range: d.range,
          values: d.values,
        })),
      },
    });

    return {
      totalUpdatedCells: response.data.totalUpdatedCells,
      totalUpdatedRows: response.data.totalUpdatedRows,
      totalUpdatedColumns: response.data.totalUpdatedColumns,
      responses: response.data.responses,
    };
  } catch (error) {
    console.error('Error in batch update:', error.message);
    throw error;
  }
}

/**
 * Add a new sheet (tab) to a spreadsheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {string} title - Title for the new sheet
 */
export async function addSheet(spreadsheetId, title) {
  try {
    const sheets = getSheetsClient();
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          addSheet: {
            properties: { title },
          },
        }],
      },
    });

    const newSheet = response.data.replies[0].addSheet.properties;
    return {
      sheetId: newSheet.sheetId,
      title: newSheet.title,
      index: newSheet.index,
    };
  } catch (error) {
    console.error('Error adding sheet:', error.message);
    throw error;
  }
}

/**
 * Delete a sheet (tab) from a spreadsheet
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {number} sheetId - The sheet ID (not the name)
 */
export async function deleteSheet(spreadsheetId, sheetId) {
  try {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          deleteSheet: { sheetId },
        }],
      },
    });

    return { deleted: true, sheetId };
  } catch (error) {
    console.error('Error deleting sheet:', error.message);
    throw error;
  }
}

/**
 * Format cells (bold, colors, etc.)
 * @param {string} spreadsheetId - The spreadsheet ID
 * @param {number} sheetId - The sheet ID
 * @param {object} formatting - Formatting options
 */
export async function formatCells(spreadsheetId, sheetId, startRow, startCol, endRow, endCol, formatting) {
  try {
    const sheets = getSheetsClient();

    const cellFormat = {};
    if (formatting.bold !== undefined) {
      cellFormat.textFormat = { ...cellFormat.textFormat, bold: formatting.bold };
    }
    if (formatting.italic !== undefined) {
      cellFormat.textFormat = { ...cellFormat.textFormat, italic: formatting.italic };
    }
    if (formatting.fontSize !== undefined) {
      cellFormat.textFormat = { ...cellFormat.textFormat, fontSize: formatting.fontSize };
    }
    if (formatting.backgroundColor) {
      cellFormat.backgroundColor = formatting.backgroundColor;
    }
    if (formatting.textColor) {
      cellFormat.textFormat = { ...cellFormat.textFormat, foregroundColor: formatting.textColor };
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: startRow,
              endRowIndex: endRow,
              startColumnIndex: startCol,
              endColumnIndex: endCol,
            },
            cell: { userEnteredFormat: cellFormat },
            fields: 'userEnteredFormat',
          },
        }],
      },
    });

    return { formatted: true };
  } catch (error) {
    console.error('Error formatting cells:', error.message);
    throw error;
  }
}

/**
 * Parse AI response to extract sheet operations
 * Returns structured operations the AI wants to perform
 */
export function parseSheetOperations(aiResponse) {
  const operations = [];

  // Look for structured commands in the AI response
  // Format: [SHEET_OP:operation_type:params_json]
  const opRegex = /\[SHEET_OP:(\w+):(\{[^}]+\})\]/g;
  let match;

  while ((match = opRegex.exec(aiResponse)) !== null) {
    try {
      const opType = match[1];
      const params = JSON.parse(match[2]);
      operations.push({ type: opType, params });
    } catch (e) {
      console.error('Failed to parse sheet operation:', e);
    }
  }

  return operations;
}

/**
 * Execute a sheet operation from AI
 */
export async function executeSheetOperation(spreadsheetId, operation) {
  switch (operation.type) {
    case 'WRITE':
      return writeSheetRange(spreadsheetId, operation.params.range, operation.params.values);

    case 'APPEND':
      return appendToSheet(spreadsheetId, operation.params.range, operation.params.values);

    case 'UPDATE_CELL':
      return updateCell(
        spreadsheetId,
        operation.params.sheet || 'Sheet1',
        operation.params.cell,
        operation.params.value
      );

    case 'CLEAR':
      return clearRange(spreadsheetId, operation.params.range);

    case 'ADD_SHEET':
      return addSheet(spreadsheetId, operation.params.title);

    default:
      throw new Error(`Unknown operation type: ${operation.type}`);
  }
}

export default {
  extractSheetId,
  getSpreadsheetInfo,
  readSheetRange,
  readEntireSheet,
  writeSheetRange,
  appendToSheet,
  updateCell,
  clearRange,
  batchUpdate,
  addSheet,
  deleteSheet,
  formatCells,
  parseSheetOperations,
  executeSheetOperation,
};
