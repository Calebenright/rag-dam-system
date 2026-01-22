-- Migration: Add document_chunks table for RAG
-- This table stores chunked content with embeddings for semantic search

-- Create the document_chunks table
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  start_index INTEGER,
  end_index INTEGER,
  embedding TEXT, -- JSON stringified embedding vector
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON document_chunks(document_id, chunk_index);

-- Add chunk_count column to documents table
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS chunk_count INTEGER DEFAULT 0;

-- Add sources column to chat_messages table for storing source references
ALTER TABLE chat_messages
ADD COLUMN IF NOT EXISTS sources JSONB;

-- Comments
COMMENT ON TABLE document_chunks IS 'Stores document content in chunks with embeddings for semantic search';
COMMENT ON COLUMN document_chunks.chunk_index IS 'Sequential index of the chunk within the document';
COMMENT ON COLUMN document_chunks.content IS 'The text content of this chunk';
COMMENT ON COLUMN document_chunks.start_index IS 'Starting character index in the original document';
COMMENT ON COLUMN document_chunks.end_index IS 'Ending character index in the original document';
COMMENT ON COLUMN document_chunks.embedding IS 'JSON stringified OpenAI embedding vector for semantic search';
