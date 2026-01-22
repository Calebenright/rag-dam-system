import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Analyze document content using Claude AI
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

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });

    const responseText = message.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Could not extract JSON from Claude response');
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
    console.error('Error analyzing document with Claude:', error);
    throw new Error(`Document analysis failed: ${error.message}`);
  }
}

/**
 * Generate embedding for text using Claude (for vector search)
 * Note: Claude doesn't have native embeddings, so we'll use a simple approach
 * For production, consider using OpenAI embeddings or a dedicated embedding model
 */
export async function generateEmbedding(text) {
  try {
    // For now, we'll create a simple hash-based embedding
    // In production, replace this with a proper embedding model (OpenAI, Cohere, etc.)
    const words = text.toLowerCase().split(/\s+/).slice(0, 500);
    const embedding = new Array(1536).fill(0);

    // Simple word-position based embedding (placeholder)
    words.forEach((word, idx) => {
      const hash = hashString(word);
      const position = hash % 1536;
      embedding[position] += 1 / (idx + 1);
    });

    // Normalize
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
    // Build context from documents
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

    // Build conversation history
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: 'user',
        content: userMessage
      }
    ];

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages
    });

    return response.content[0].text;
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
