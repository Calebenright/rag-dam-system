-- Add API key column to clients table for API access
ALTER TABLE clients ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE;

-- Create index for faster API key lookups
CREATE INDEX IF NOT EXISTS idx_clients_api_key ON clients(api_key);

-- Comment
COMMENT ON COLUMN clients.api_key IS 'API key for programmatic access to client resources';
