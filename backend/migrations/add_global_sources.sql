-- Add global sources support
-- Global sources have client_id = NULL and is_global = true

-- 1. Add is_global column
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;

-- 2. Make client_id nullable (drop FK, alter, re-add FK)
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_client_id_fkey;
ALTER TABLE documents ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE documents ADD CONSTRAINT documents_client_id_fkey
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;

-- 3. Create index for fast global source lookups
CREATE INDEX IF NOT EXISTS idx_documents_is_global ON documents(is_global) WHERE is_global = true;
