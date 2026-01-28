-- Add pod_number column to clients table for color theming
-- Pod 1 = mint (green), Pod 2 = sky (blue), Pod 3 = lemon (yellow), Pod 4 = lavender (purple)
-- Superclients use coral (red) regardless of pod number
ALTER TABLE clients ADD COLUMN IF NOT EXISTS pod_number INTEGER DEFAULT 1 CHECK (pod_number >= 1 AND pod_number <= 4);

-- Comment
COMMENT ON COLUMN clients.pod_number IS 'Pod number (1-4) determines client color theme: 1=mint, 2=sky, 3=lemon, 4=lavender';
