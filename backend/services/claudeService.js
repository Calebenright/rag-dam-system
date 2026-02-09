import OpenAI from 'openai';
import * as sheetsService from './googleSheets.js';

// Lazy initialization to ensure env vars are loaded
let openai = null;

function getClient() {
  if (!openai) {
    openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openai;
}

// Define tools for Google Sheets operations (OpenAI tool format)
const sheetTools = [
  {
    type: "function",
    function: {
      name: "read_sheet",
      description: "Read data from a Google Sheet tab. Use this to see current contents, answer questions about data, or understand structure before making changes. Returns the actual cell values.",
      parameters: {
        type: "object",
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The Google Spreadsheet ID"
          },
          range: {
            type: "string",
            description: "The A1 notation range to read (e.g., 'Sheet1!A1:D10' or just 'A1:D10'). If omitted, reads the entire sheet."
          },
          sheet_name: {
            type: "string",
            description: "The name of the sheet/tab to read from (default: first available tab)"
          }
        },
        required: ["spreadsheet_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_sheet_tabs",
      description: "List all tabs/sheets in a Google Spreadsheet with their names and row/column counts. Use this to understand the structure of a spreadsheet.",
      parameters: {
        type: "object",
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The Google Spreadsheet ID"
          }
        },
        required: ["spreadsheet_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "write_cells",
      description: "Write data to specific cells in a Google Sheet. Overwrites existing data in the specified range.",
      parameters: {
        type: "object",
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The Google Spreadsheet ID"
          },
          range: {
            type: "string",
            description: "The A1 notation range to write to (e.g., 'Sheet1!A1:C3')"
          },
          values: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "2D array of values to write, row by row"
          }
        },
        required: ["spreadsheet_id", "range", "values"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "append_rows",
      description: "Append new rows to the end of data in a Google Sheet. Great for adding new entries.",
      parameters: {
        type: "object",
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The Google Spreadsheet ID"
          },
          sheet_name: {
            type: "string",
            description: "The name of the sheet/tab (default: Sheet1)"
          },
          values: {
            type: "array",
            items: {
              type: "array",
              items: { type: "string" }
            },
            description: "2D array of rows to append"
          }
        },
        required: ["spreadsheet_id", "values"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_cell",
      description: "Update a single cell in a Google Sheet.",
      parameters: {
        type: "object",
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The Google Spreadsheet ID"
          },
          cell: {
            type: "string",
            description: "The cell reference (e.g., 'A1', 'B5')"
          },
          value: {
            type: "string",
            description: "The value to set (can be text, number, or formula starting with =)"
          },
          sheet_name: {
            type: "string",
            description: "The name of the sheet/tab (default: Sheet1)"
          }
        },
        required: ["spreadsheet_id", "cell", "value"]
      }
    }
  }
];

/**
 * Execute a sheet tool call
 */
async function executeSheetTool(toolName, toolInput) {
  const { spreadsheet_id, range, sheet_name, values, cell, value } = toolInput;

  switch (toolName) {
    case 'read_sheet':
      if (range) {
        return await sheetsService.readSheetRange(spreadsheet_id, range);
      } else {
        return await sheetsService.readEntireSheet(spreadsheet_id, sheet_name || 'Sheet1');
      }

    case 'list_sheet_tabs':
      return await sheetsService.getSpreadsheetInfo(spreadsheet_id);

    case 'write_cells':
      return await sheetsService.writeSheetRange(spreadsheet_id, range, values);

    case 'append_rows':
      const appendRange = sheet_name ? `${sheet_name}!A:Z` : 'Sheet1!A:Z';
      return await sheetsService.appendToSheet(spreadsheet_id, appendRange, values);

    case 'update_cell':
      return await sheetsService.updateCell(spreadsheet_id, sheet_name || 'Sheet1', cell, value);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

/**
 * Analyze document content using OpenAI
 * Generates: title, summary, tags, keywords, topic, sentiment
 */
export async function analyzeDocument(content, fileName, fileType) {
  try {
    const prompt = `You are a document analysis expert. Analyze the following document and provide structured metadata.

Document Name: ${fileName}
Document Type: ${fileType}
Document Content:
${content.substring(0, 50000)}

Please analyze this document and respond with a JSON object containing:
1. "title": A descriptive title for this document (5-10 words)
2. "summary": A comprehensive summary (200-500 words)
3. "tags": An array of 5-10 relevant tags
4. "keywords": An array of 10-15 important keywords
5. "topic": The main topic/category (e.g., "Legal", "Marketing", "Finance", "Technical", "HR", etc.)
6. "sentiment": Overall sentiment (must be exactly one of: "positive", "negative", or "neutral")
7. "sentiment_score": A numerical score from -1 (very negative) to 1 (very positive)

Respond ONLY with valid JSON, no additional text.`;

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = response.choices[0].message.content;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from OpenAI response');
    }

    const analysis = JSON.parse(jsonMatch[0]);

    // Validate required fields
    const requiredFields = ['title', 'summary', 'tags', 'keywords', 'topic', 'sentiment', 'sentiment_score'];
    for (const field of requiredFields) {
      if (!(field in analysis)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate sentiment values
    const validSentiments = ['positive', 'negative', 'neutral'];
    if (!validSentiments.includes(analysis.sentiment)) {
      analysis.sentiment = 'neutral';
    }

    // Ensure sentiment_score is a number between -1 and 1
    analysis.sentiment_score = Math.max(-1, Math.min(1, parseFloat(analysis.sentiment_score) || 0));

    return analysis;
  } catch (error) {
    console.error('Error analyzing document with OpenAI:', error);
    throw new Error(`Document analysis failed: ${error.message}`);
  }
}

/**
 * Generate embedding for text (placeholder - use openaiService.js for real embeddings)
 */
export async function generateEmbedding(text) {
  try {
    const words = text.toLowerCase().split(/\s+/).slice(0, 500);
    const embedding = new Array(1536).fill(0);

    words.forEach((word, idx) => {
      const hash = hashString(word);
      const position = hash % 1536;
      embedding[position] += 1 / (idx + 1);
    });

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    return embedding.map(val => val / (magnitude || 1));
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Chat with RAG context
 */
export async function chatWithContext(userMessage, contextDocuments, conversationHistory = []) {
  try {
    const contextText = contextDocuments.map((doc, idx) =>
      `[Document ${idx + 1}: ${doc.title}]\n${doc.summary}\n\nKey points: ${doc.keywords.join(', ')}`
    ).join('\n\n---\n\n');

    const systemPrompt = `You are a helpful AI assistant with access to the user's document library. Use the provided document context to answer questions accurately. Always cite which documents you're referencing.

Available Documents:
${contextText}

Guidelines:
- Answer based on the provided documents when relevant
- If the documents don't contain relevant information, say so
- Cite documents by their titles when referencing them
- Be concise but comprehensive`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: messages
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error in chat:', error);
    throw new Error(`Chat failed: ${error.message}`);
  }
}

// Simple string hash function
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

/**
 * Chat with Google Sheets access using OpenAI tool use
 * Automatically fetches and analyzes sheet data when asked about spreadsheets
 */
export async function chatWithSheets(userMessage, connectedSheets, contextDocuments = [], conversationHistory = []) {
  try {
    let sheetContext = '';
    if (connectedSheets && connectedSheets.length > 0) {
      sheetContext = '\n\n## Connected Google Sheets:\n';
      for (const sheet of connectedSheets) {
        sheetContext += `\n### "${sheet.name}" (ID: ${sheet.spreadsheet_id})\n`;
        if (sheet.sheet_tabs && sheet.sheet_tabs.length > 0) {
          sheetContext += `Tabs: ${sheet.sheet_tabs.map(t => `"${t.title}" (${t.rowCount} rows × ${t.columnCount} cols)`).join(', ')}\n`;
        }
        sheetContext += `URL: ${sheet.sheet_url}\n`;
      }
      sheetContext += '\nYou can use the sheet tools to read data from these spreadsheets and answer questions about their contents.\n';
    }

    let docContext = '';
    if (contextDocuments && contextDocuments.length > 0) {
      docContext = '\n\n## Relevant Documents:\n';
      contextDocuments.forEach((doc, idx) => {
        docContext += `[${idx + 1}] ${doc.title}: ${doc.summary || 'No summary'}\n`;
      });
    }

    const systemPrompt = `You are a helpful AI assistant with access to the user's document library and connected Google Sheets.

${docContext}
${sheetContext}

## Your Sheet Capabilities:
When the user asks about spreadsheet data, tabs, or specific cell contents, use the appropriate tools:
1. **list_sheet_tabs** - Get all tabs in a spreadsheet with their sizes
2. **read_sheet** - Read actual data from a sheet tab. You MUST use this to answer questions about data.

## Guidelines:
- When asked about sheet contents, ALWAYS use read_sheet to fetch the actual data first
- When asked about tabs or structure, use list_sheet_tabs
- Reference the spreadsheet by its name when responding
- Format data clearly using tables when appropriate
- Cite documents by their titles when referencing them
- If asked to modify sheets, ask for confirmation first before using write tools

Be helpful, accurate, and always fetch real data rather than guessing about sheet contents.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    // First call with tools
    let response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 4000,
      messages: messages,
      tools: sheetTools,
      tool_choice: 'auto'
    });

    // Handle tool use in a loop (up to 5 iterations to prevent infinite loops)
    const executedOperations = [];
    let iterations = 0;
    const maxIterations = 5;
    let assistantMessage = response.choices[0].message;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0 && iterations < maxIterations) {
      iterations++;

      // Execute all tool calls
      const toolResults = [];
      for (const toolCall of assistantMessage.tool_calls) {
        const toolInput = JSON.parse(toolCall.function.arguments);
        try {
          const result = await executeSheetTool(toolCall.function.name, toolInput);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify(result, null, 2)
          });
          executedOperations.push({
            tool: toolCall.function.name,
            input: toolInput,
            success: true
          });
        } catch (error) {
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ error: error.message })
          });
          executedOperations.push({
            tool: toolCall.function.name,
            input: toolInput,
            success: false,
            error: error.message
          });
        }
      }

      // Continue conversation with tool results
      response = await getClient().chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 4000,
        messages: [
          ...messages,
          assistantMessage,
          ...toolResults
        ],
        tools: sheetTools,
        tool_choice: 'auto'
      });

      assistantMessage = response.choices[0].message;
    }

    // Extract final text response
    const finalResponse = assistantMessage.content || '';

    return {
      response: finalResponse,
      operations: executedOperations,
      toolsUsed: executedOperations.length > 0
    };
  } catch (error) {
    console.error('Error in chat with sheets:', error);
    throw new Error(`Sheet chat failed: ${error.message}`);
  }
}

/**
 * Enhanced chat that automatically includes sheet context when relevant
 * Detects if the user is asking about sheets and switches to sheet-aware mode
 */
export async function enhancedChatWithContext(userMessage, contextDocuments, connectedSheets = [], conversationHistory = [], documentChunks = []) {
  // Detect if this is a sheet-related query
  const sheetKeywords = [
    'sheet', 'spreadsheet', 'tab', 'tabs', 'cell', 'row', 'column', 'excel',
    'google sheet', 'data in', 'table', 'csv', 'values in', 'what\'s in the'
  ];
  const lowerMessage = userMessage.toLowerCase();
  const isSheetQuery = connectedSheets.length > 0 && sheetKeywords.some(keyword => lowerMessage.includes(keyword));

  const mentionsSheet = connectedSheets.some(sheet =>
    lowerMessage.includes(sheet.name.toLowerCase()) ||
    (sheet.sheet_tabs || []).some(tab => lowerMessage.includes(tab.title.toLowerCase()))
  );

  if (isSheetQuery || mentionsSheet) {
    return await chatWithSheets(userMessage, connectedSheets, contextDocuments, conversationHistory);
  }

  // Regular document-based chat
  try {
    let contextText = '';

    if (documentChunks && documentChunks.length > 0) {
      contextText += "## Relevant Document Excerpts:\n\n";
      documentChunks.forEach((chunk, idx) => {
        contextText += `### [Source ${idx + 1}: ${chunk.documentTitle}]\n`;
        contextText += `${chunk.text}\n\n`;
      });
      contextText += "---\n\n";
    }

    if (contextDocuments && contextDocuments.length > 0) {
      contextText += "## Document Summaries:\n\n";
      contextDocuments.forEach((doc) => {
        contextText += `**${doc.title}**\n`;
        contextText += `Summary: ${doc.summary}\n`;
        if (doc.keywords && doc.keywords.length > 0) {
          contextText += `Keywords: ${doc.keywords.join(', ')}\n`;
        }
        contextText += '\n';
      });
    }

    let sheetContext = '';
    if (connectedSheets && connectedSheets.length > 0) {
      sheetContext = '\n## Connected Sheets (available for querying):\n';
      connectedSheets.forEach(sheet => {
        sheetContext += `- "${sheet.name}": ${sheet.sheet_tabs?.map(t => t.title).join(', ') || 'No tabs info'}\n`;
      });
      sheetContext += '\nIf you want to ask about sheet data, mention the sheet or ask about specific data.\n';
    }

    const systemPrompt = `You are a helpful AI assistant with access to the user's document library.

${contextText}
${sheetContext}

## Guidelines:
- Answer based on the provided documents when relevant
- Cite documents by their titles: [Source: Document Title]
- If documents don't have relevant info, say so clearly
- Be concise but comprehensive
- Format responses with markdown when helpful`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await getClient().chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 2000,
      messages: messages
    });

    return {
      response: response.choices[0].message.content,
      operations: [],
      toolsUsed: false
    };
  } catch (error) {
    console.error('Error in enhanced chat:', error);
    throw new Error(`Chat failed: ${error.message}`);
  }
}
