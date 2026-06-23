import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODEL } from '../config/models.js';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import * as sheetsService from './googleSheets.js';

dotenv.config({ override: true });

// OpenAI kept only for embeddings (Anthropic doesn't offer an embedding model)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Build a current-date context string for system prompts.
 * Gives the agent awareness of today's date and relative time anchors.
 */
function getDateContext() {
  const now = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const formatted = now.toLocaleDateString('en-US', options);
  const iso = now.toISOString();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `## Current Date & Time
- **Today**: ${formatted}
- **ISO**: ${iso}
- **Quarter**: Q${quarter} ${year}
Use this to understand relative time references like "this week", "last month", "recently", etc.
When documents have a "Source Date", that is the date the content is actually from (e.g., when a meeting took place), NOT when it was uploaded. Use source dates to answer time-based questions like "what did we discuss last month" or "the January meeting".`;
}

// Define tools for Google Sheets operations (Anthropic tool format)
const sheetTools = [
  {
    name: "read_sheet",
    description: "Read data from a Google Sheet. Use this to see current contents before making changes.",
    input_schema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          description: "The A1 notation range to read (e.g., 'Sheet1!A1:D10' or just 'A1:D10')"
        },
        sheet_name: {
          type: "string",
          description: "The name of the sheet/tab (default: Sheet1)"
        }
      },
      required: []
    }
  },
  {
    name: "write_cells",
    description: "Write data to specific cells in a Google Sheet. Overwrites existing data in the specified range.",
    input_schema: {
      type: "object",
      properties: {
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
      required: ["range", "values"]
    }
  },
  {
    name: "append_rows",
    description: "Append new rows to the end of data in a Google Sheet. Great for adding new entries.",
    input_schema: {
      type: "object",
      properties: {
        sheet_name: {
          type: "string",
          description: "The name of the sheet/tab"
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
      required: ["values"]
    }
  },
  {
    name: "update_cell",
    description: "Update a single cell in a Google Sheet.",
    input_schema: {
      type: "object",
      properties: {
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
      required: ["cell", "value"]
    }
  },
  {
    name: "clear_range",
    description: "Clear all values in a range of cells.",
    input_schema: {
      type: "object",
      properties: {
        range: {
          type: "string",
          description: "The A1 notation range to clear (e.g., 'Sheet1!A1:D10')"
        }
      },
      required: ["range"]
    }
  }
];

/**
 * Generate embeddings using OpenAI's embedding model
 * Returns a 1536-dimensional vector for semantic search
 */
export async function generateEmbedding(text) {
  try {
    // Truncate text to fit within token limits (roughly 8000 tokens ~ 32000 chars)
    const truncatedText = text.substring(0, 30000);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: truncatedText,
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Embedding generation failed: ${error.message}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Detect if text looks like a meeting transcript (has speaker labels).
 */
function isTranscriptFormat(text) {
  // Common patterns: "Speaker Name:", "John:", "[00:12:34] Speaker:", "Speaker (00:12):"
  const speakerPattern = /^[A-Z][a-zA-Z\s]{1,30}[:(]/m;
  const timestampPattern = /\[\d{1,2}:\d{2}(:\d{2})?\]/;
  const matches = (text.match(speakerPattern) || []).length;
  return matches >= 3 || timestampPattern.test(text);
}

/**
 * Chunk a transcript by speaker turns, merging small turns into groups.
 */
function chunkTranscript(text, targetSize = 1000) {
  // Split on speaker labels (e.g., "Speaker Name:" at start of line)
  const turns = text.split(/(?=^[A-Z][a-zA-Z\s]{1,30}[:]\s)/m).filter(t => t.trim());

  const chunks = [];
  let current = '';
  let startIndex = 0;

  for (const turn of turns) {
    if (current.length + turn.length > targetSize && current.length > 200) {
      chunks.push({
        text: current.trim(),
        startIndex,
        endIndex: startIndex + current.length
      });
      startIndex += current.length;
      current = turn;
    } else {
      current += turn;
    }
  }

  if (current.trim()) {
    chunks.push({
      text: current.trim(),
      startIndex,
      endIndex: startIndex + current.length
    });
  }

  return chunks;
}

/**
 * Chunk text into smaller pieces for better retrieval.
 * Uses transcript-aware splitting for meeting notes, fixed-size with
 * sentence-boundary overlap for everything else.
 */
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  // Use transcript-aware chunking if the text looks like a meeting transcript
  if (isTranscriptFormat(text)) {
    return chunkTranscript(text, chunkSize);
  }

  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at a paragraph or sentence boundary
    if (end < text.length) {
      // Prefer paragraph breaks (double newline), then single newline, then period
      const lastParagraph = text.lastIndexOf('\n\n', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const lastPeriod = text.lastIndexOf('.', end);

      let breakPoint = -1;
      if (lastParagraph > start + chunkSize / 2) {
        breakPoint = lastParagraph + 2; // after the double newline
      } else if (lastNewline > start + chunkSize / 2) {
        breakPoint = lastNewline + 1;
      } else if (lastPeriod > start + chunkSize / 2) {
        breakPoint = lastPeriod + 1;
      }

      if (breakPoint > start) {
        end = breakPoint;
      }
    }

    chunks.push({
      text: text.substring(start, end).trim(),
      startIndex: start,
      endIndex: end
    });

    start = end - overlap;
    if (start < 0) start = 0;
    if (end >= text.length) break;
  }

  return chunks;
}

/**
 * Parse a data URL or file path into { mediaType, base64Data } for Anthropic's image format.
 */
async function resolveImageSource(imageSource) {
  if (imageSource.startsWith('data:')) {
    const match = imageSource.match(/^data:(image\/[^;]+);base64,(.+)$/s);
    if (match) return { mediaType: match[1], base64Data: match[2] };
    throw new Error('Invalid data URL format');
  }

  if (imageSource.startsWith('http')) {
    const response = await fetch(imageSource);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return { mediaType: contentType, base64Data: buffer.toString('base64') };
  }

  // Local file path
  const imageBuffer = await fs.readFile(imageSource);
  const ext = imageSource.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
    'gif': 'image/gif', 'webp': 'image/webp'
  };
  return { mediaType: mimeTypes[ext] || 'image/jpeg', base64Data: imageBuffer.toString('base64') };
}

/**
 * Analyze an image using Claude's vision capabilities
 * Supports local file paths, URLs, or base64 data
 */
export async function analyzeImage(imageSource, question = "What's in this image?") {
  try {
    const { mediaType, base64Data } = await resolveImageSource(imageSource);

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 1500,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data }
          },
          { type: "text", text: question }
        ]
      }]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error analyzing image with Claude:', error);
    throw new Error(`Image analysis failed: ${error.message}`);
  }
}

/**
 * Analyze multiple images at once (useful for comparing or batch analysis)
 */
export async function analyzeMultipleImages(imageSources, question = "Describe these images and their relationship.") {
  try {
    const imageContents = await Promise.all(
      imageSources.map(async (source) => {
        const { mediaType, base64Data } = await resolveImageSource(source);
        return {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: base64Data }
        };
      })
    );

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          ...imageContents,
          { type: "text", text: question }
        ]
      }]
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error analyzing multiple images with Claude:', error);
    throw new Error(`Multi-image analysis failed: ${error.message}`);
  }
}

/**
 * Extract text and structured data from an image (OCR + understanding)
 */
export async function extractFromImage(imageSource) {
  const prompt = `Analyze this image thoroughly and extract:
1. Any visible text (OCR)
2. A description of what the image shows
3. Key elements, objects, or data points
4. If it's a chart/graph/table, extract the data in a structured format

Respond with a JSON object containing:
{
  "text": "any text found in the image",
  "description": "what the image shows",
  "elements": ["list of key elements"],
  "structured_data": null or {extracted data if applicable},
  "image_type": "photo/chart/diagram/document/screenshot/other"
}`;

  try {
    const response = await analyzeImage(imageSource, prompt);

    // Try to parse as JSON, fall back to raw response
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // Return raw response wrapped in object
    }

    return {
      text: '',
      description: response,
      elements: [],
      structured_data: null,
      image_type: 'unknown'
    };
  } catch (error) {
    console.error('Error extracting from image:', error);
    throw new Error(`Image extraction failed: ${error.message}`);
  }
}

/**
 * Chat with document context, optional images, and source images
 * Supports multimodal conversations with Claude
 */
export async function enhancedChat(userMessage, contextDocuments, conversationHistory = [], imageAnalysis = null, documentChunks = [], uploadedImages = [], sourceImages = []) {
  try {
    // Build context from document summaries
    let contextText = '';

    // Add relevant document chunks first (most important for RAG)
    if (documentChunks && documentChunks.length > 0) {
      contextText += "## Relevant Document Excerpts:\n\n";
      documentChunks.forEach((chunk, idx) => {
        contextText += `### [Source ${idx + 1}: ${chunk.documentTitle}]`;
        if (chunk.sourceDate) contextText += ` (Date: ${chunk.sourceDate})`;
        if (chunk.position) contextText += ` [from ${chunk.position} of document]`;
        contextText += `\n${chunk.text}\n\n`;
      });
      contextText += "---\n\n";
    }

    // Add document summaries for broader context
    if (contextDocuments && contextDocuments.length > 0) {
      contextText += "## Document Summaries:\n\n";
      contextDocuments.forEach((doc, idx) => {
        contextText += `**${doc.title}**`;
        if (doc.source_date) contextText += ` — Source Date: ${doc.source_date}`;
        contextText += `\n`;
        contextText += `Summary: ${doc.summary}\n`;
        if (doc.keywords && doc.keywords.length > 0) {
          contextText += `Keywords: ${doc.keywords.join(', ')}\n`;
        }
        contextText += '\n';
      });
    }

    // Add image analysis if present (from uploaded images)
    if (imageAnalysis) {
      contextText = `## Uploaded Image Analysis:\n${imageAnalysis}\n\n---\n\n${contextText}`;
    }

    // Add source image descriptions if present
    if (sourceImages && sourceImages.length > 0) {
      contextText += "\n## Images from Document Sources:\n";
      sourceImages.forEach((img, idx) => {
        contextText += `\n### Image ${idx + 1}: ${img.fileName}\n`;
        if (img.analysis) {
          contextText += `Analysis: ${img.analysis}\n`;
        }
      });
      contextText += "\n---\n";
    }

    const hasImages = uploadedImages.length > 0 || sourceImages.length > 0 || imageAnalysis;

    const systemPrompt = `You are a knowledgeable AI assistant with access to the user's document library${hasImages ? ' and image analysis capabilities' : ''}.

Your task is to answer questions using the provided document context. Always cite your sources.

${getDateContext()}

${contextText}

## Response Guidelines:
1. **Always cite sources** - When referencing information from documents, cite them like this: [Source: Document Title]
2. **Be accurate** - Only state information that is directly supported by the provided documents
3. **Acknowledge limitations** - If the documents don't contain relevant information, clearly state that
4. **Format well** - Use markdown for code blocks, tables, lists, and emphasis
5. **Be comprehensive** - Provide thorough answers while staying relevant to the question
${hasImages ? '6. **Reference images** - When discussing images, reference them by their file names or position' : ''}

If you cannot find relevant information in the provided documents, say: "I couldn't find specific information about this in your documents. However, based on general knowledge..." and then provide helpful context.`;

    // Build the user message content (text + any inline images)
    let userContent = [];

    // Add uploaded images inline for multimodal understanding
    if (uploadedImages && uploadedImages.length > 0) {
      for (const img of uploadedImages) {
        try {
          const { mediaType, base64Data } = await resolveImageSource(img.url);
          userContent.push({
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64Data }
          });
        } catch (e) {
          console.error('Error resolving uploaded image:', e);
        }
      }
    }

    // Add source images inline
    if (sourceImages && sourceImages.length > 0) {
      for (const img of sourceImages) {
        if (img.url) {
          try {
            const { mediaType, base64Data } = await resolveImageSource(img.url);
            userContent.push({
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64Data }
            });
          } catch (e) {
            console.error('Error resolving source image:', e);
          }
        }
      }
    }

    // Add text message last (after images, per Anthropic best practice)
    userContent.push({ type: "text", text: userMessage });

    // Build conversation history (Anthropic uses system as top-level param, not in messages)
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: "user",
        content: userContent.length === 1 ? userMessage : userContent
      }
    ];

    const response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      system: systemPrompt,
      messages: messages,
      max_tokens: 2000,
    });

    return response.content[0].text;
  } catch (error) {
    console.error('Error in enhanced chat:', error);
    throw new Error(`Chat failed: ${error.message}`);
  }
}

/**
 * Chat with Google Sheets editing capabilities
 * Uses function calling to let AI read/write to sheets
 */
export async function chatWithSheets(userMessage, spreadsheetId, sheetInfo, conversationHistory = [], contextDocuments = []) {
  try {
    // Build context about the connected sheet
    let sheetContext = `## Connected Google Sheet: "${sheetInfo.title}"\n`;
    sheetContext += `Spreadsheet ID: ${spreadsheetId}\n`;
    sheetContext += `Available tabs: ${sheetInfo.sheets.map(s => s.title).join(', ')}\n\n`;

    // Add document context if available
    let docContext = '';
    if (contextDocuments && contextDocuments.length > 0) {
      docContext = "## Relevant Documents:\n";
      contextDocuments.forEach((doc) => {
        docContext += `- ${doc.title}: ${doc.summary || 'No summary'}\n`;
      });
      docContext += '\n';
    }

    const systemPrompt = `You are an AI assistant that can read and edit Google Sheets.

${getDateContext()}

${sheetContext}
${docContext}

## Your Capabilities:
1. **read_sheet** - Read data from the spreadsheet to understand its current state
2. **write_cells** - Write data to specific cells (overwrites existing)
3. **append_rows** - Add new rows at the end of the data
4. **update_cell** - Update a single cell
5. **clear_range** - Clear values from a range

## Guidelines:
- ALWAYS read the sheet first before making changes, so you understand the current structure
- When writing formulas, start with = (e.g., "=SUM(A1:A10)")
- Confirm what changes you're about to make before executing them
- After making changes, summarize what was done
- Use the correct sheet tab name in ranges (e.g., "Sheet1!A1:B5")
- Be careful not to overwrite important data without user confirmation

When the user asks you to modify the sheet, use the appropriate tool functions.`;

    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: userMessage }
    ];

    // First call - may include tool calls
    let response = await anthropic.messages.create({
      model: CLAUDE_MODEL,
      system: systemPrompt,
      messages: messages,
      tools: sheetTools,
      max_tokens: 2000,
    });

    // Handle tool use in a loop (up to 5 iterations)
    const executedOperations = [];
    const allToolCalls = [];
    let iterations = 0;
    const maxIterations = 5;

    while (response.stop_reason === 'tool_use' && iterations < maxIterations) {
      iterations++;

      // Extract tool use blocks from the response
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        const args = toolUse.input;
        let result;

        allToolCalls.push({ function: toolUse.name, arguments: args });

        try {
          switch (toolUse.name) {
            case 'read_sheet':
              if (args.range) {
                result = await sheetsService.readSheetRange(spreadsheetId, args.range);
              } else {
                result = await sheetsService.readEntireSheet(spreadsheetId, args.sheet_name || 'Sheet1');
              }
              break;

            case 'write_cells':
              result = await sheetsService.writeSheetRange(spreadsheetId, args.range, args.values);
              executedOperations.push({ type: 'write', range: args.range, cells: result.updatedCells });
              break;

            case 'append_rows': {
              const appendRange = args.sheet_name ? `${args.sheet_name}!A:Z` : 'Sheet1!A:Z';
              result = await sheetsService.appendToSheet(spreadsheetId, appendRange, args.values);
              executedOperations.push({ type: 'append', rows: args.values.length });
              break;
            }

            case 'update_cell':
              result = await sheetsService.updateCell(
                spreadsheetId,
                args.sheet_name || 'Sheet1',
                args.cell,
                args.value
              );
              executedOperations.push({ type: 'update', cell: args.cell });
              break;

            case 'clear_range':
              result = await sheetsService.clearRange(spreadsheetId, args.range);
              executedOperations.push({ type: 'clear', range: args.range });
              break;

            default:
              result = { error: `Unknown function: ${toolUse.name}` };
          }
        } catch (error) {
          result = { error: error.message };
        }

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result)
        });
      }

      // Continue conversation with tool results
      response = await anthropic.messages.create({
        model: CLAUDE_MODEL,
        system: systemPrompt,
        messages: [
          ...messages,
          { role: "assistant", content: response.content },
          { role: "user", content: toolResults }
        ],
        tools: sheetTools,
        max_tokens: 2000,
      });
    }

    // Extract final text response
    const textBlock = response.content.find(b => b.type === 'text');

    return {
      response: textBlock?.text || '',
      operations: executedOperations,
      toolCalls: allToolCalls
    };

  } catch (error) {
    console.error('Error in chat with sheets:', error);
    throw new Error(`Sheet chat failed: ${error.message}`);
  }
}
