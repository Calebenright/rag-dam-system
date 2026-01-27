-- Add sheet_tabs column to documents table for storing Google Sheets tab information
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS sheet_tabs JSONB DEFAULT NULL;

-- Add comment
COMMENT ON COLUMN documents.sheet_tabs IS 'JSON array of sheet tab metadata for Google Sheets documents';
