import { google } from 'googleapis';

// Extract document ID from Google Docs URL
export function extractDocId(url) {
  // Supports formats:
  // https://docs.google.com/document/d/DOCUMENT_ID/edit
  // https://docs.google.com/document/d/DOCUMENT_ID/
  const match = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Extract sheet ID from Google Sheets URL
export function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Determine Google source type from URL
export function getGoogleSourceType(url) {
  if (url.includes('docs.google.com/document')) return 'google_doc';
  if (url.includes('docs.google.com/spreadsheets')) return 'google_sheet';
  if (url.includes('docs.google.com/presentation')) return 'google_slides';
  return null;
}

// Fetch Google Doc content using API key (for public docs) or service account
export async function fetchGoogleDocContent(docId, accessToken = null) {
  try {
    const auth = accessToken
      ? new google.auth.OAuth2().setCredentials({ access_token: accessToken })
      : new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          scopes: ['https://www.googleapis.com/auth/documents.readonly'],
        });

    const docs = google.docs({ version: 'v1', auth });

    const response = await docs.documents.get({
      documentId: docId,
    });

    const doc = response.data;

    // Extract text content from the document
    let textContent = '';
    if (doc.body && doc.body.content) {
      textContent = extractTextFromContent(doc.body.content);
    }

    return {
      title: doc.title,
      content: textContent,
      lastModified: doc.revisionId,
    };
  } catch (error) {
    console.error('Error fetching Google Doc:', error.message);
    throw error;
  }
}

// Fetch Google Doc content using public export (no auth needed for public docs)
export async function fetchPublicGoogleDoc(docId) {
  try {
    // Export as plain text (works for public docs)
    const exportUrl = `https://docs.google.com/document/d/${docId}/export?format=txt`;

    const response = await fetch(exportUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Document not found. Make sure the document exists and is publicly accessible.');
      }
      if (response.status === 403) {
        throw new Error('Access denied. Make sure the document is set to "Anyone with the link can view".');
      }
      throw new Error(`Failed to fetch document: ${response.statusText}`);
    }

    const content = await response.text();

    // Try to get title from HTML export
    let title = 'Untitled Google Doc';
    try {
      const htmlUrl = `https://docs.google.com/document/d/${docId}/export?format=html`;
      const htmlResponse = await fetch(htmlUrl);
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - Google Docs', '').trim();
        }
      }
    } catch (e) {
      // Ignore title fetch errors
    }

    return {
      title,
      content,
      docId,
    };
  } catch (error) {
    console.error('Error fetching public Google Doc:', error.message);
    throw error;
  }
}

// Get Google Sheets auth client
function getSheetsAuthClient() {
  // Check for service account key file
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return new google.auth.GoogleAuth({
      keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  // Check for base64-encoded credentials (for Render.com deployment)
  if (process.env.GOOGLE_SHEETS_CREDENTIALS) {
    try {
      const decoded = Buffer.from(process.env.GOOGLE_SHEETS_CREDENTIALS, 'base64').toString('utf-8');
      const credentials = JSON.parse(decoded);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    } catch (e) {
      // If not base64, try parsing as raw JSON
      const credentials = JSON.parse(process.env.GOOGLE_SHEETS_CREDENTIALS);
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
      });
    }
  }

  // Check for inline credentials JSON
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  return null;
}

// Fetch Google Sheet content using Sheets API (gets ALL tabs and proper title)
export async function fetchPublicGoogleSheet(sheetId) {
  console.log(`[fetchPublicGoogleSheet] Fetching sheet ID: ${sheetId}`);
  try {
    const auth = getSheetsAuthClient();
    console.log(`[fetchPublicGoogleSheet] Auth client available: ${!!auth}`);

    if (auth) {
      // Use Google Sheets API for full access to all tabs
      const sheets = google.sheets({ version: 'v4', auth });

      // Get spreadsheet metadata (title and all sheet tabs)
      const metadataResponse = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
        fields: 'properties.title,sheets.properties',
      });

      const title = metadataResponse.data.properties.title;
      const sheetTabs = metadataResponse.data.sheets.map(s => ({
        sheetId: s.properties.sheetId,
        title: s.properties.title,
        index: s.properties.index,
        rowCount: s.properties.gridProperties?.rowCount,
        columnCount: s.properties.gridProperties?.columnCount,
      }));

      console.log(`[fetchPublicGoogleSheet] Got title: "${title}", tabs: ${sheetTabs.map(t => t.title).join(', ')}`);

      // Fetch content from ALL tabs
      let allContent = [];

      for (const tab of sheetTabs) {
        try {
          const dataResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: tab.title,
          });

          const values = dataResponse.data.values || [];

          // Convert each tab to formatted text
          let tabContent = `\n=== TAB: ${tab.title} ===\n`;

          if (values.length > 0) {
            // Format as readable text with column alignment
            values.forEach((row, rowIndex) => {
              tabContent += row.join('\t') + '\n';
            });
          } else {
            tabContent += '(empty)\n';
          }

          allContent.push({
            tabName: tab.title,
            tabIndex: tab.index,
            content: tabContent,
            rowCount: values.length,
            data: values,
          });
        } catch (tabError) {
          console.error(`Error fetching tab "${tab.title}":`, tabError.message);
          allContent.push({
            tabName: tab.title,
            tabIndex: tab.index,
            content: `\n=== TAB: ${tab.title} ===\n(Error fetching content)\n`,
            rowCount: 0,
            data: [],
          });
        }
      }

      // Combine all tab content into single string
      const combinedContent = allContent.map(t => t.content).join('\n');

      return {
        title,
        content: combinedContent,
        sheetId,
        tabs: sheetTabs,
        tabData: allContent,
      };
    }

    // Fallback to CSV export if no credentials (only gets first tab)
    console.warn('No Google Sheets credentials configured, falling back to CSV export (first tab only)');

    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
    const response = await fetch(exportUrl);

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Spreadsheet not found. Make sure it exists and is publicly accessible.');
      }
      if (response.status === 403) {
        throw new Error('Access denied. Make sure the spreadsheet is set to "Anyone with the link can view".');
      }
      throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
    }

    const content = await response.text();

    // Try to get title from HTML
    let title = 'Untitled Google Sheet';
    try {
      const htmlUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
      const htmlResponse = await fetch(htmlUrl);
      if (htmlResponse.ok) {
        const html = await htmlResponse.text();
        const titleMatch = html.match(/<title>([^<]+)<\/title>/);
        if (titleMatch) {
          title = titleMatch[1].replace(' - Google Sheets', '').trim();
        }
      }
    } catch (e) {
      // Ignore title fetch errors
    }

    return {
      title,
      content,
      sheetId,
      tabs: [{ title: 'Sheet1', index: 0 }],
      tabData: [{ tabName: 'Sheet1', content, rowCount: content.split('\n').length }],
    };
  } catch (error) {
    console.error('Error fetching Google Sheet:', error.message);
    throw error;
  }
}

// Helper function to extract text from Google Docs content structure
function extractTextFromContent(content) {
  let text = '';

  for (const element of content) {
    if (element.paragraph) {
      for (const el of element.paragraph.elements || []) {
        if (el.textRun) {
          text += el.textRun.content;
        }
      }
    } else if (element.table) {
      for (const row of element.table.tableRows || []) {
        for (const cell of row.tableCells || []) {
          if (cell.content) {
            text += extractTextFromContent(cell.content);
          }
        }
        text += '\n';
      }
    } else if (element.sectionBreak) {
      text += '\n\n';
    }
  }

  return text;
}

// Generate a hash of content for comparison
export function hashContent(content) {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

// Check if a Google Doc has been modified and return new content if changed
export async function checkAndFetchIfModified(docId, sourceType, lastContentHash) {
  try {
    let data;
    if (sourceType === 'google_doc') {
      data = await fetchPublicGoogleDoc(docId);
    } else if (sourceType === 'google_sheet') {
      data = await fetchPublicGoogleSheet(docId);
    } else {
      return { modified: false };
    }

    const newHash = hashContent(data.content);

    if (newHash !== lastContentHash) {
      return {
        modified: true,
        content: data.content,
        title: data.title,
        contentHash: newHash,
        tabs: data.tabs || [],
      };
    }

    return { modified: false };
  } catch (error) {
    console.error('Error checking doc modification:', error);
    return { modified: false, error: error.message };
  }
}
