-- Migration: Add connected_sheets table for Google Sheets integration
-- Run this in your Supabase SQL editor

-- Table to store connected Google Sheets
CREATE TABLE IF NOT EXISTS connected_sheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  spreadsheet_id VARCHAR(255) NOT NULL,
  sheet_url TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sheet_tabs JSONB DEFAULT '[]',
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one spreadsheet per client
  UNIQUE(client_id, spreadsheet_id)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_connected_sheets_client ON connected_sheets(client_id);
CREATE INDEX IF NOT EXISTS idx_connected_sheets_spreadsheet ON connected_sheets(spreadsheet_id);

-- Table to log sheet operations (for audit trail)
CREATE TABLE IF NOT EXISTS sheet_operations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  spreadsheet_id VARCHAR(255) NOT NULL,
  operation_type VARCHAR(50) NOT NULL, -- 'write', 'append', 'clear', 'format'
  range VARCHAR(255),
  cells_affected INTEGER,
  performed_by VARCHAR(50) DEFAULT 'ai', -- 'ai' or 'user'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for log queries
CREATE INDEX IF NOT EXISTS idx_sheet_ops_spreadsheet ON sheet_operations_log(spreadsheet_id);
CREATE INDEX IF NOT EXISTS idx_sheet_ops_created ON sheet_operations_log(created_at DESC);

-- Enable RLS
ALTER TABLE connected_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_operations_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth setup)
CREATE POLICY "Allow all operations on connected_sheets" ON connected_sheets
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on sheet_operations_log" ON sheet_operations_log
  FOR ALL USING (true) WITH CHECK (true);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_connected_sheets_updated_at
  BEFORE UPDATE ON connected_sheets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
