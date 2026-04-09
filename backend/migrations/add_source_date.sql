-- Add source_date column to documents table
-- This stores the actual date the source content is from (e.g. meeting date),
-- NOT the upload date. Extracted from filename patterns and document content.
ALTER TABLE documents ADD COLUMN IF NOT EXISTS source_date DATE;

-- Index for date-range queries in semantic search
CREATE INDEX IF NOT EXISTS idx_documents_source_date ON documents (source_date);
