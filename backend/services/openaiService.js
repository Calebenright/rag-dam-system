import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs/promises';
import * as sheetsService from './googleSheets.js';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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
Use this to understand relative time references like "this week", "last month", "recently", etc.`;
}

// Define tools for Google Sheets operations
const sheetTools = [
  {
    type: "function",
    function: {
      name: "read_sheet",
      description: "Read data from a Google Sheet. Use this to see current contents before making changes.",
      parameters: {
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
    }
  },
  {
    type: "function",
    function: {
      name: "clear_range",
      description: "Clear all values in a range of cells.",
      parameters: {
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
 * Chunk text into smaller pieces for better retrieval
 * Uses overlapping chunks for context preservation
 */
export function chunkText(text, chunkSize = 1000, overlap = 200) {
  const chunks = [];
  let start = 0;

  while (start < text.length) {
    let end = start + chunkSize;

    // Try to break at sentence boundary
    if (end < text.length) {
      const lastPeriod = text.lastIndexOf('.', end);
      const lastNewline = text.lastIndexOf('\n', end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + chunkSize / 2) {
        end = breakPoint + 1;
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
 * Analyze an image using OpenAI Vision API (gpt-4o-mini)
 * Supports local file paths or base64 data
 */
export async function analyzeImage(imageSource, question = "What's in this image?") {
  try {
    let imageUrl;

    // Check if imageSource is a base64 string or a file path
    if (imageSource.startsWith('data:')) {
      // Already a data URL
      imageUrl = imageSource;
    } else if (imageSource.startsWith('http')) {
      // Remote URL - use directly
      imageUrl = imageSource;
    } else {
      // Local file path - read and convert to base64
      const imageBuffer = await fs.readFile(imageSource);
      const base64Image = imageBuffer.toString('base64');

      // Detect mime type from file extension
      const ext = imageSource.split('.').pop().toLowerCase();
      const mimeTypes = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp'
      };
      const mimeType = mimeTypes[ext] || 'image/jpeg';

      imageUrl = `data:${mimeType};base64,${base64Image}`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: question },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
                detail: "auto"
              },
            },
          ],
        },
      ],
      max_tokens: 1500,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing image with OpenAI:', error);
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
        let imageUrl;

        if (source.startsWith('data:') || source.startsWith('http')) {
          imageUrl = source;
        } else {
          const imageBuffer = await fs.readFile(source);
          const base64Image = imageBuffer.toString('base64');
          const ext = source.split('.').pop().toLowerCase();
          const mimeTypes = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp'
          };
          const mimeType = mimeTypes[ext] || 'image/jpeg';
          imageUrl = `data:${mimeType};base64,${base64Image}`;
        }

        return {
          type: "image_url",
          image_url: {
            url: imageUrl,
            detail: "auto"
          }
        };
      })
    );

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: question },
            ...imageContents
          ],
        },
      ],
      max_tokens: 2000,
    });

    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error analyzing multiple images with OpenAI:', error);
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
 * Supports multimodal conversations with gpt-4o-mini
 */
export async function enhancedChat(userMessage, contextDocuments, conversationHistory = [], imageAnalysis = null, documentChunks = [], uploadedImages = [], sourceImages = []) {
  try {
    // Build context from document summaries
    let contextText = '';

    // Add relevant document chunks first (most important for RAG)
    if (documentChunks && documentChunks.length > 0) {
      contextText += "## Relevant Document Excerpts:\n\n";
      documentChunks.forEach((chunk, idx) => {
        contextText += `### [Source ${idx + 1}: ${chunk.documentTitle}]\n`;
        contextText += `${chunk.text}\n\n`;
      });
      contextText += "---\n\n";
    }

    // Add document summaries for broader context
    if (contextDocuments && contextDocuments.length > 0) {
      contextText += "## Document Summaries:\n\n";
      contextDocuments.forEach((doc, idx) => {
        contextText += `**${doc.title}** (ID: ${doc.id})\n`;
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

    // Add text message
    userContent.push({ type: "text", text: userMessage });

    // Add uploaded images inline for multimodal understanding
    if (uploadedImages && uploadedImages.length > 0) {
      for (const img of uploadedImages) {
        userContent.push({
          type: "image_url",
          image_url: {
            url: img.url,
            detail: "auto"
          }
        });
      }
    }

    // Add source images inline
    if (sourceImages && sourceImages.length > 0) {
      for (const img of sourceImages) {
        if (img.url) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: img.url,
              detail: "auto"
            }
          });
        }
      }
    }

    // Build conversation history
    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: "user",
        content: userContent.length === 1 ? userMessage : userContent
      }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      temperature: 0.7,
      max_tokens: 2000,
    });

    return response.choices[0].message.content;
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
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      { role: "user", content: userMessage }
    ];

    // First call - may include tool calls
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      tools: sheetTools,
      tool_choice: "auto",
      temperature: 0.7,
      max_tokens: 2000,
    });

    const assistantMessage = response.choices[0].message;

    // Check if the model wants to call tools
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      // Execute each tool call
      const toolResults = [];
      const executedOperations = [];

      for (const toolCall of assistantMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const args = JSON.parse(toolCall.function.arguments);
        let result;

        try {
          switch (functionName) {
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

            case 'append_rows':
              const appendRange = args.sheet_name ? `${args.sheet_name}!A:Z` : 'Sheet1!A:Z';
              result = await sheetsService.appendToSheet(spreadsheetId, appendRange, args.values);
              executedOperations.push({ type: 'append', rows: args.values.length });
              break;

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
              result = { error: `Unknown function: ${functionName}` };
          }
        } catch (error) {
          result = { error: error.message };
        }

        toolResults.push({
          tool_call_id: toolCall.id,
          role: "tool",
          content: JSON.stringify(result)
        });
      }

      // Second call with tool results
      const messagesWithTools = [
        ...messages,
        assistantMessage,
        ...toolResults
      ];

      const finalResponse = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messagesWithTools,
        temperature: 0.7,
        max_tokens: 2000,
      });

      return {
        response: finalResponse.choices[0].message.content,
        operations: executedOperations,
        toolCalls: assistantMessage.tool_calls.map(tc => ({
          function: tc.function.name,
          arguments: JSON.parse(tc.function.arguments)
        }))
      };
    }

    // No tool calls, just return the response
    return {
      response: assistantMessage.content,
      operations: [],
      toolCalls: []
    };

  } catch (error) {
    console.error('Error in chat with sheets:', error);
    throw new Error(`Sheet chat failed: ${error.message}`);
  }
}
