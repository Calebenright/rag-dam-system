-- RAG + DAM System Database Schema
-- Run this SQL in your Supabase SQL Editor

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Documents Table
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  title TEXT,
  summary TEXT,
  tags TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  topic TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral')),
  sentiment_score REAL CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  embedding VECTOR(1536), -- For semantic search (OpenAI ada-002 dimension)
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  context_docs UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_documents_client_id ON documents(client_id);
CREATE INDEX IF NOT EXISTS idx_documents_processed ON documents(processed);
CREATE INDEX IF NOT EXISTS idx_documents_topic ON documents(topic);
CREATE INDEX IF NOT EXISTS idx_documents_sentiment ON documents(sentiment);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_client_id ON chat_messages(client_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Vector similarity search index (HNSW for fast approximate search)
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for clients table
CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) Policies
-- Note: Adjust these based on your authentication setup

-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Public access for development (CHANGE THIS FOR PRODUCTION!)
-- Replace with proper user-based policies when you add authentication

CREATE POLICY "Allow all operations on clients for development"
  ON clients FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on documents for development"
  ON documents FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow all operations on chat_messages for development"
  ON chat_messages FOR ALL
  USING (true)
  WITH CHECK (true);

-- Production RLS Policy Examples (uncomment when ready):
/*
-- Clients: Users can only see their own clients
CREATE POLICY "Users can view own clients"
  ON clients FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own clients"
  ON clients FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Documents: Users can only access documents for their clients
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (
    client_id IN (
      SELECT id FROM clients WHERE user_id = auth.uid()
    )
  );
*/

-- Storage Bucket Setup (Run in Supabase Dashboard > Storage)
-- Create bucket: client-assets
-- Make it public or add appropriate policies

-- Sample data for testing (optional)
INSERT INTO clients (name, description) VALUES
  ('Sample Client', 'This is a sample client for testing purposes');

-- Useful queries for monitoring

-- Get client with document count
CREATE OR REPLACE VIEW clients_with_stats AS
SELECT
  c.*,
  COUNT(d.id) as document_count,
  COUNT(CASE WHEN d.processed = true THEN 1 END) as processed_count,
  COUNT(cm.id) as message_count
FROM clients c
LEFT JOIN documents d ON c.id = d.client_id
LEFT JOIN chat_messages cm ON c.id = cm.client_id
GROUP BY c.id;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_documents(
  query_embedding VECTOR(1536),
  match_client_id UUID,
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  client_id UUID,
  title TEXT,
  summary TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.client_id,
    d.title,
    d.summary,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  WHERE d.client_id = match_client_id
    AND d.processed = true
    AND d.embedding IS NOT NULL
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Function to get document statistics by topic
CREATE OR REPLACE FUNCTION get_topic_stats(for_client_id UUID)
RETURNS TABLE (
  topic TEXT,
  doc_count BIGINT,
  avg_sentiment_score FLOAT
)
LANGUAGE SQL
AS $$
  SELECT
    topic,
    COUNT(*) as doc_count,
    AVG(sentiment_score) as avg_sentiment_score
  FROM documents
  WHERE client_id = for_client_id
    AND processed = true
  GROUP BY topic
  ORDER BY doc_count DESC;
$$;

COMMENT ON TABLE clients IS 'Stores client information and metadata';
COMMENT ON TABLE documents IS 'Stores document metadata and AI-generated analysis';
COMMENT ON TABLE chat_messages IS 'Stores conversation history with AI assistant';
COMMENT ON COLUMN documents.embedding IS 'Vector embedding for semantic search (1536 dimensions)';
COMMENT ON COLUMN documents.sentiment_score IS 'Sentiment score from -1 (negative) to 1 (positive)';
