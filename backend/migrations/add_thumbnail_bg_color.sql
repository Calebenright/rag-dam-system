-- Add thumbnail_bg_color column to clients table for custom thumbnail background colors
-- This allows users to set a specific background color for their client thumbnails
ALTER TABLE clients ADD COLUMN IF NOT EXISTS thumbnail_bg_color VARCHAR(7) DEFAULT '#000000';

-- Comment
COMMENT ON COLUMN clients.thumbnail_bg_color IS 'Custom background color for client thumbnail (hex format like #FFFFFF)';
