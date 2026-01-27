import express from 'express';
import { supabase } from '../config/supabase.js';
import * as sheetsService from '../services/googleSheets.js';
import * as leadsService from '../services/leadsVerification.js';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

// Track running processes
let phoneServerProcess = null;

// Helper function to write to sheets with retry on quota exceeded
async function writeWithRetry(spreadsheetId, range, values, sendEvent, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await sheetsService.writeSheetRange(spreadsheetId, range, values);
      return true;
    } catch (error) {
      const isQuotaError = error.message?.includes('Quota exceeded') ||
                           error.message?.includes('quota') ||
                           error.code === 429;

      if (isQuotaError && attempt < maxRetries - 1) {
        const waitTime = 60000; // Wait 60 seconds for quota to reset
        if (sendEvent) {
          sendEvent('quota_wait', {
            message: `Sheets API quota exceeded. Waiting 60 seconds before retrying...`,
            attempt: attempt + 1,
            maxRetries
          });
        }
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        throw error;
      }
    }
  }
  return false;
}

/**
 * POST /api/leads/sheets/connect
 * Connect a Google Sheet specifically for leads (separate from regular sheets)
 */
router.post('/sheets/connect', async (req, res) => {
  try {
    const { sheetUrl, name } = req.body;

    if (!sheetUrl) {
      return res.status(400).json({
        success: false,
        error: 'Sheet URL is required',
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

    // Store in leads_sheets table (separate from connected_sheets)
    const { data, error } = await supabase
      .from('leads_sheets')
      .upsert({
        spreadsheet_id: spreadsheetId,
        sheet_url: sheetUrl,
        name: name || sheetInfo.title,
        sheet_tabs: sheetInfo.sheets,
        last_synced: new Date().toISOString(),
      }, {
        onConflict: 'spreadsheet_id',
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
    console.error('Error connecting leads sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/leads/sheets
 * Get all connected leads sheets
 */
router.get('/sheets', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('leads_sheets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('Error fetching leads sheets:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/leads/sheets/:spreadsheetId/info
 * Get spreadsheet info and refresh tabs list
 */
router.get('/sheets/:spreadsheetId/info', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;

    const sheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);

    // Update tabs info in database
    await supabase
      .from('leads_sheets')
      .update({
        sheet_tabs: sheetInfo.sheets,
        last_synced: new Date().toISOString(),
      })
      .eq('spreadsheet_id', spreadsheetId);

    res.json({
      success: true,
      data: sheetInfo,
    });
  } catch (error) {
    console.error('Error getting leads sheet info:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/leads/sheets/:spreadsheetId
 * Disconnect a leads sheet
 */
router.delete('/sheets/:spreadsheetId', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;

    const { error } = await supabase
      .from('leads_sheets')
      .delete()
      .eq('spreadsheet_id', spreadsheetId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Leads sheet disconnected',
    });
  } catch (error) {
    console.error('Error disconnecting leads sheet:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/leads/status
 * Check if verification backends are available
 */
router.get('/status', async (req, res) => {
  try {
    const [emailStatus, phoneStatus] = await Promise.all([
      leadsService.checkEmailBackend(),
      leadsService.checkPhoneBackend(),
    ]);

    res.json({
      success: true,
      data: {
        email: emailStatus,
        phone: phoneStatus,
      },
    });
  } catch (error) {
    console.error('Error checking backend status:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/backends/email/start
 * Start the Reacher email verification backend (Docker)
 */
router.post('/backends/email/start', async (req, res) => {
  try {
    // Check if already running
    const status = await leadsService.checkEmailBackend();
    if (status.available) {
      return res.json({
        success: true,
        message: 'Email backend already running',
        data: status,
      });
    }

    // Start Docker container - try starting existing container first, then run new one
    try {
      await execAsync('docker start stoic_lalande 2>/dev/null');
    } catch (startError) {
      // Container doesn't exist, try running a new one
      try {
        await execAsync('docker run -d -p 8080:8080 --name stoic_lalande reacherhq/backend:latest');
      } catch (runError) {
        console.log('Docker run error:', runError.message);
      }
    }

    // Wait a bit for container to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    const newStatus = await leadsService.checkEmailBackend();
    res.json({
      success: newStatus.available,
      message: newStatus.available ? 'Email backend started' : 'Failed to start email backend',
      data: newStatus,
    });
  } catch (error) {
    console.error('Error starting email backend:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/backends/email/stop
 * Stop the Reacher email verification backend (Docker)
 */
router.post('/backends/email/stop', async (req, res) => {
  try {
    try {
      await execAsync('docker stop stoic_lalande 2>/dev/null');
    } catch (stopError) {
      // Container might already be stopped
      console.log('Docker stop attempt:', stopError.message);
    }

    // Wait a bit for container to stop
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({
      success: true,
      message: 'Email backend stopped',
    });
  } catch (error) {
    console.error('Error stopping email backend:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/backends/phone/start
 * Start the phone validation backend (Node.js server)
 */
router.post('/backends/phone/start', async (req, res) => {
  try {
    // Check if already running
    const status = await leadsService.checkPhoneBackend();
    if (status.available) {
      return res.json({
        success: true,
        message: 'Phone backend already running',
        data: status,
      });
    }

    // Start the phone server
    const phoneServerPath = '/Users/cj/Documents/Dodeka/Leads';
    phoneServerProcess = spawn('node', ['phone-server.js'], {
      cwd: phoneServerPath,
      detached: true,
      stdio: 'ignore',
    });
    phoneServerProcess.unref();

    // Wait a bit for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    const newStatus = await leadsService.checkPhoneBackend();
    res.json({
      success: newStatus.available,
      message: newStatus.available ? 'Phone backend started' : 'Failed to start phone backend',
      data: newStatus,
    });
  } catch (error) {
    console.error('Error starting phone backend:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/backends/phone/stop
 * Stop the phone validation backend
 */
router.post('/backends/phone/stop', async (req, res) => {
  try {
    // Kill process on port 8081 - use shell to handle errors gracefully
    try {
      await execAsync('kill -9 $(lsof -ti:8081) 2>/dev/null', { shell: '/bin/bash' });
    } catch (killError) {
      // Ignore errors - process might already be stopped
      console.log('Phone server kill attempt:', killError.message);
    }
    phoneServerProcess = null;

    // Wait a bit for process to stop
    await new Promise(resolve => setTimeout(resolve, 500));

    res.json({
      success: true,
      message: 'Phone backend stopped',
    });
  } catch (error) {
    console.error('Error stopping phone backend:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/verify-email
 * Verify a single email address
 */
router.post('/verify-email', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const result = await leadsService.verifyEmail(email);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/verify-phone
 * Verify a single phone number
 */
router.post('/verify-phone', async (req, res) => {
  try {
    const { phone, useNumVerify } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    const result = useNumVerify
      ? await leadsService.verifyPhoneNumVerify(phone)
      : await leadsService.verifyPhone(phone);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error verifying phone:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/leads/:spreadsheetId/verify
 * Run verification on a Google Sheet column and write results to a new column
 */
router.post('/:spreadsheetId/verify', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { sheetName, emailColumn, phoneColumn, useNumVerify } = req.body;

    if (!emailColumn && !phoneColumn) {
      return res.status(400).json({
        success: false,
        error: 'At least one of emailColumn or phoneColumn is required',
      });
    }

    // Check backends
    if (emailColumn) {
      const emailStatus = await leadsService.checkEmailBackend();
      if (!emailStatus.available) {
        return res.status(503).json({
          success: false,
          error: emailStatus.error,
        });
      }
    }

    if (phoneColumn && !useNumVerify) {
      const phoneStatus = await leadsService.checkPhoneBackend();
      if (!phoneStatus.available) {
        return res.status(503).json({
          success: false,
          error: phoneStatus.error,
        });
      }
    }

    // Get spreadsheet info to find the sheet
    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);
    const targetSheet = sheetName || spreadsheetInfo.sheets[0]?.title || 'Sheet1';

    // Find the sheet ID for column insertion
    const sheetMeta = spreadsheetInfo.sheets.find(s => s.title === targetSheet);
    if (!sheetMeta) {
      return res.status(404).json({
        success: false,
        error: `Sheet "${targetSheet}" not found`,
      });
    }
    const sheetId = sheetMeta.sheetId;

    const results = {
      emailResults: null,
      phoneResults: null,
    };

    // Track inserted columns to adjust phone column index if needed
    let insertedColumnsBeforePhone = 0;

    // Process emails if column specified
    if (emailColumn) {
      const emailIdx = leadsService.colLetterToIndex(emailColumn);
      const resultColIdx = emailIdx + 1;
      const resultCol = leadsService.indexToColLetter(resultColIdx);

      // Read email column
      const emailData = await sheetsService.readSheetRange(
        spreadsheetId,
        `'${targetSheet}'!${emailColumn}:${emailColumn}`
      );
      const values = emailData.values || [];

      if (values.length > 0) {
        // Insert a new column for results
        await sheetsService.insertColumn(spreadsheetId, sheetId, resultColIdx, 1);

        // Track that we inserted a column (affects phone column position)
        if (phoneColumn) {
          const phoneIdx = leadsService.colLetterToIndex(phoneColumn);
          if (phoneIdx >= resultColIdx) {
            insertedColumnsBeforePhone++;
          }
        }

        // Add header
        await sheetsService.writeSheetRange(
          spreadsheetId,
          `'${targetSheet}'!${resultCol}1`,
          [['Email Status']]
        );

        // Process each email (skip header)
        const emailResults = [];
        for (let i = 1; i < values.length; i++) {
          const email = values[i]?.[0] || '';
          const result = await leadsService.verifyEmail(email);
          emailResults.push([result.status]);

          // Small delay to avoid rate limits
          if (email) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
        }

        // Write results
        if (emailResults.length > 0) {
          await sheetsService.writeSheetRange(
            spreadsheetId,
            `'${targetSheet}'!${resultCol}2:${resultCol}${emailResults.length + 1}`,
            emailResults
          );
        }

        results.emailResults = {
          column: emailColumn,
          resultColumn: resultCol,
          processed: emailResults.length,
        };
      }
    }

    // Process phones if column specified
    if (phoneColumn) {
      // Adjust phone column index if we inserted columns before it during email verification
      const originalPhoneIdx = leadsService.colLetterToIndex(phoneColumn);
      const adjustedPhoneIdx = originalPhoneIdx + insertedColumnsBeforePhone;
      const adjustedPhoneCol = leadsService.indexToColLetter(adjustedPhoneIdx);
      const resultColIdx = adjustedPhoneIdx + 1;
      const resultCol = leadsService.indexToColLetter(resultColIdx);

      // Read phone column (using adjusted position)
      const phoneData = await sheetsService.readSheetRange(
        spreadsheetId,
        `'${targetSheet}'!${adjustedPhoneCol}:${adjustedPhoneCol}`
      );
      const values = phoneData.values || [];

      if (values.length > 0) {
        // Insert a new column for results
        await sheetsService.insertColumn(spreadsheetId, sheetId, resultColIdx, 1);

        // Add header
        await sheetsService.writeSheetRange(
          spreadsheetId,
          `'${targetSheet}'!${resultCol}1`,
          [['Phone Status']]
        );

        // Process each phone (skip header)
        const phoneResults = [];
        for (let i = 1; i < values.length; i++) {
          const phone = values[i]?.[0] || '';
          const result = useNumVerify
            ? await leadsService.verifyPhoneNumVerify(phone)
            : await leadsService.verifyPhone(phone);
          phoneResults.push([result.status]);

          // Small delay to avoid rate limits (longer for NumVerify due to API limits)
          if (phone) {
            await new Promise(resolve => setTimeout(resolve, useNumVerify ? 2000 : 100));
          }
        }

        // Write results
        if (phoneResults.length > 0) {
          await sheetsService.writeSheetRange(
            spreadsheetId,
            `'${targetSheet}'!${resultCol}2:${resultCol}${phoneResults.length + 1}`,
            phoneResults
          );
        }

        results.phoneResults = {
          column: phoneColumn,
          resultColumn: resultCol,
          processed: phoneResults.length,
          usedNumVerify: useNumVerify,
        };
      }
    }

    // Log the operation
    await supabase.from('sheet_operations_log').insert({
      spreadsheet_id: spreadsheetId,
      operation_type: 'leads_verification',
      range: targetSheet,
      cells_affected: (results.emailResults?.processed || 0) + (results.phoneResults?.processed || 0),
      performed_by: 'user',
    });

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('Error running verification:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/leads/:spreadsheetId/verify-stream
 * Run verification with real-time progress updates via Server-Sent Events
 */
router.get('/:spreadsheetId/verify-stream', async (req, res) => {
  const { spreadsheetId } = req.params;
  const { sheetName, emailColumn, phoneColumn, useNumVerify } = req.query;

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    if (!emailColumn && !phoneColumn) {
      sendEvent('error', { message: 'At least one of emailColumn or phoneColumn is required' });
      res.end();
      return;
    }

    // Check backends
    if (emailColumn) {
      const emailStatus = await leadsService.checkEmailBackend();
      if (!emailStatus.available) {
        sendEvent('error', { message: emailStatus.error });
        res.end();
        return;
      }
    }

    if (phoneColumn && useNumVerify !== 'true') {
      const phoneStatus = await leadsService.checkPhoneBackend();
      if (!phoneStatus.available) {
        sendEvent('error', { message: phoneStatus.error });
        res.end();
        return;
      }
    }

    // Get spreadsheet info
    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);
    const targetSheet = sheetName || spreadsheetInfo.sheets[0]?.title || 'Sheet1';

    // Find the sheet ID for column insertion
    const sheetMeta = spreadsheetInfo.sheets.find(s => s.title === targetSheet);
    if (!sheetMeta) {
      sendEvent('error', { message: `Sheet "${targetSheet}" not found` });
      res.end();
      return;
    }
    const sheetId = sheetMeta.sheetId;

    sendEvent('start', { sheet: targetSheet });

    const results = {
      emailResults: null,
      phoneResults: null,
    };

    // Track inserted columns to adjust phone column index if needed
    let insertedColumnsBeforePhone = 0;

    // Process emails if column specified
    if (emailColumn) {
      const emailIdx = leadsService.colLetterToIndex(emailColumn);
      const nextColIdx = emailIdx + 1;
      const nextCol = leadsService.indexToColLetter(nextColIdx);

      // Read email column and the column next to it to check for existing results
      const emailData = await sheetsService.readSheetRange(
        spreadsheetId,
        `'${targetSheet}'!${emailColumn}:${nextCol}`
      );
      const values = emailData.values || [];

      if (values.length > 1) {
        // Check if the next column is already an "Email Status" column
        const nextColHeader = values[0]?.[1] || '';
        const hasExistingStatusCol = nextColHeader.toLowerCase().includes('email status');

        let resultCol;
        let existingStatuses = [];

        if (hasExistingStatusCol) {
          // Use the existing column, don't insert a new one
          resultCol = nextCol;
          existingStatuses = values.map(row => row[1] || '');
          sendEvent('info', { message: `Found existing Email Status column at ${resultCol}, skipping already verified rows...` });
        } else {
          // Insert a new column for results
          resultCol = nextCol;
          sendEvent('info', { message: `Inserting new column ${resultCol} for email results...` });
          await sheetsService.insertColumn(spreadsheetId, sheetId, nextColIdx, 1);

          // Track that we inserted a column (affects phone column position)
          if (phoneColumn) {
            const phoneIdx = leadsService.colLetterToIndex(phoneColumn);
            if (phoneIdx >= nextColIdx) {
              insertedColumnsBeforePhone++;
            }
          }

          // Add header with retry
          await writeWithRetry(
            spreadsheetId,
            `'${targetSheet}'!${resultCol}1`,
            [['Email Status']],
            sendEvent
          );
        }

        // Count how many need to be verified (skip empty emails and already verified)
        let toVerify = 0;
        for (let i = 1; i < values.length; i++) {
          const email = values[i]?.[0] || '';
          const existingStatus = hasExistingStatusCol ? (existingStatuses[i] || '') : '';
          if (email && !existingStatus) toVerify++;
        }

        sendEvent('email_start', { total: toVerify, resultColumn: resultCol });

        const emailResults = [];
        let verified = 0;
        for (let i = 1; i < values.length; i++) {
          const email = values[i]?.[0] || '';
          const existingStatus = hasExistingStatusCol ? (existingStatuses[i] || '') : '';

          // Skip if already verified or empty
          if (existingStatus) {
            sendEvent('email_progress', {
              current: verified,
              total: toVerify,
              email,
              status: existingStatus,
              statusCode: 'skipped',
              skipped: true,
            });
            continue;
          }

          if (!email) {
            continue;
          }

          const result = await leadsService.verifyEmail(email);
          emailResults.push([result.status]);
          verified++;

          sendEvent('email_progress', {
            current: verified,
            total: toVerify,
            email,
            status: result.status,
            statusCode: result.statusCode,
          });

          // Write result immediately with retry on quota exceeded
          await writeWithRetry(
            spreadsheetId,
            `'${targetSheet}'!${resultCol}${i + 1}`,
            [[result.status]],
            sendEvent
          );

          await new Promise(resolve => setTimeout(resolve, 300));
        }

        results.emailResults = {
          column: emailColumn,
          resultColumn: resultCol,
          processed: emailResults.length,
          skipped: hasExistingStatusCol ? (values.length - 1 - toVerify) : 0,
        };

        sendEvent('email_complete', results.emailResults);
      }
    }

    // Process phones if column specified
    if (phoneColumn) {
      // Adjust phone column index if we inserted columns before it during email verification
      const originalPhoneIdx = leadsService.colLetterToIndex(phoneColumn);
      const adjustedPhoneIdx = originalPhoneIdx + insertedColumnsBeforePhone;
      const adjustedPhoneCol = leadsService.indexToColLetter(adjustedPhoneIdx);
      const nextColIdx = adjustedPhoneIdx + 1;
      const nextCol = leadsService.indexToColLetter(nextColIdx);

      // Read phone column and the column next to it to check for existing results
      const phoneData = await sheetsService.readSheetRange(
        spreadsheetId,
        `'${targetSheet}'!${adjustedPhoneCol}:${nextCol}`
      );
      const values = phoneData.values || [];

      if (values.length > 1) {
        // Check if the next column is already a "Phone Status" column
        const nextColHeader = values[0]?.[1] || '';
        const hasExistingStatusCol = nextColHeader.toLowerCase().includes('phone status');

        let resultCol;
        let existingStatuses = [];

        if (hasExistingStatusCol) {
          // Use the existing column, don't insert a new one
          resultCol = nextCol;
          existingStatuses = values.map(row => row[1] || '');
          sendEvent('info', { message: `Found existing Phone Status column at ${resultCol}, skipping already verified rows...` });
        } else {
          // Insert a new column for results
          resultCol = nextCol;
          sendEvent('info', { message: `Inserting new column ${resultCol} for phone results...` });
          await sheetsService.insertColumn(spreadsheetId, sheetId, nextColIdx, 1);

          // Add header with retry
          await writeWithRetry(
            spreadsheetId,
            `'${targetSheet}'!${resultCol}1`,
            [['Phone Status']],
            sendEvent
          );
        }

        // Count how many need to be verified (skip empty phones and already verified)
        let toVerify = 0;
        for (let i = 1; i < values.length; i++) {
          const phone = values[i]?.[0] || '';
          const existingStatus = hasExistingStatusCol ? (existingStatuses[i] || '') : '';
          if (phone && !existingStatus) toVerify++;
        }

        sendEvent('phone_start', { total: toVerify, resultColumn: resultCol });

        const phoneResults = [];
        let verified = 0;
        for (let i = 1; i < values.length; i++) {
          const phone = values[i]?.[0] || '';
          const existingStatus = hasExistingStatusCol ? (existingStatuses[i] || '') : '';

          // Skip if already verified or empty
          if (existingStatus) {
            sendEvent('phone_progress', {
              current: verified,
              total: toVerify,
              phone,
              status: existingStatus,
              statusCode: 'skipped',
              skipped: true,
            });
            continue;
          }

          if (!phone) {
            continue;
          }

          const result = useNumVerify === 'true'
            ? await leadsService.verifyPhoneNumVerify(phone)
            : await leadsService.verifyPhone(phone);
          phoneResults.push([result.status]);
          verified++;

          sendEvent('phone_progress', {
            current: verified,
            total: toVerify,
            phone,
            status: result.status,
            statusCode: result.statusCode,
          });

          // Write result with retry on quota exceeded
          await writeWithRetry(
            spreadsheetId,
            `'${targetSheet}'!${resultCol}${i + 1}`,
            [[result.status]],
            sendEvent
          );

          await new Promise(resolve => setTimeout(resolve, useNumVerify === 'true' ? 2000 : 100));
        }

        results.phoneResults = {
          column: phoneColumn,
          resultColumn: resultCol,
          processed: phoneResults.length,
          skipped: hasExistingStatusCol ? (values.length - 1 - toVerify) : 0,
          usedNumVerify: useNumVerify === 'true',
        };

        sendEvent('phone_complete', results.phoneResults);
      }
    }

    // Log the operation
    try {
      await supabase.from('sheet_operations_log').insert({
        spreadsheet_id: spreadsheetId,
        operation_type: 'leads_verification',
        range: targetSheet,
        cells_affected: (results.emailResults?.processed || 0) + (results.phoneResults?.processed || 0),
        performed_by: 'user',
      });
    } catch (logError) {
      console.error('Error logging operation:', logError);
    }

    sendEvent('complete', results);
    res.end();
  } catch (error) {
    console.error('Error in verification stream:', error);
    sendEvent('error', { message: error.message });
    res.end();
  }
});

/**
 * GET /api/leads/:spreadsheetId/preview
 * Preview sheet data with column headers for selection
 */
router.get('/:spreadsheetId/preview', async (req, res) => {
  try {
    const { spreadsheetId } = req.params;
    const { sheetName } = req.query;

    const spreadsheetInfo = await sheetsService.getSpreadsheetInfo(spreadsheetId);
    const targetSheet = sheetName || spreadsheetInfo.sheets[0]?.title || 'Sheet1';

    // Read first row to get headers and a few data rows for preview
    const data = await sheetsService.readSheetRange(
      spreadsheetId,
      `'${targetSheet}'!1:10`
    );

    const values = data.values || [];
    const headers = values[0] || [];
    const preview = values.slice(1, 6); // First 5 data rows

    // Generate column information
    const columns = headers.map((header, idx) => ({
      letter: leadsService.indexToColLetter(idx),
      index: idx,
      header: header || `Column ${leadsService.indexToColLetter(idx)}`,
      preview: preview.map(row => row[idx] || ''),
    }));

    res.json({
      success: true,
      data: {
        spreadsheetInfo,
        sheetName: targetSheet,
        columns,
        totalRows: values.length - 1,
      },
    });
  } catch (error) {
    console.error('Error getting sheet preview:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
