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

// Fetch Google Sheet content
export async function fetchPublicGoogleSheet(sheetId) {
  try {
    // Export as CSV (works for public sheets)
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

    // Try to get title
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
    };
  } catch (error) {
    console.error('Error fetching public Google Sheet:', error.message);
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
        contentHash: newHash
      };
    }

    return { modified: false };
  } catch (error) {
    console.error('Error checking doc modification:', error);
    return { modified: false, error: error.message };
  }
}
