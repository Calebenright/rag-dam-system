-- Add columns for Google Docs integration
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS google_doc_id TEXT,
ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'file',
ADD COLUMN IF NOT EXISTS last_synced TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_documents_google_doc_id ON documents(google_doc_id);
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
