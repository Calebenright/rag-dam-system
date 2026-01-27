-- Migration: Add dashboards and widgets tables for Data Visualization
-- Run this in your Supabase SQL editor

-- Table to store dashboard configurations
CREATE TABLE IF NOT EXISTS dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  layout VARCHAR(50) DEFAULT 'grid', -- 'grid', 'columns', 'rows'
  settings JSONB DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store data sources for dashboards
CREATE TABLE IF NOT EXISTS dashboard_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  source_type VARCHAR(50) NOT NULL DEFAULT 'google_sheets', -- 'google_sheets', 'csv', 'api'
  spreadsheet_id VARCHAR(255),
  sheet_url TEXT,
  sheet_tabs JSONB DEFAULT '[]', -- Array of tab names with their gid
  column_mappings JSONB DEFAULT '{}', -- Map columns to standard fields
  refresh_interval INTEGER DEFAULT 300, -- seconds
  last_synced TIMESTAMP WITH TIME ZONE,
  cached_data JSONB, -- Cache the fetched data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table to store dashboard widgets
CREATE TABLE IF NOT EXISTS dashboard_widgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
  source_id UUID REFERENCES dashboard_sources(id) ON DELETE SET NULL,
  widget_type VARCHAR(50) NOT NULL, -- 'stacked_bar', 'heatmap', 'horizontal_bar', 'donut', 'line', 'scatter', 'kpi'
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Widget position and size in grid
  grid_x INTEGER DEFAULT 0,
  grid_y INTEGER DEFAULT 0,
  grid_w INTEGER DEFAULT 6, -- width in grid units (12 = full width)
  grid_h INTEGER DEFAULT 4, -- height in grid units

  -- Data configuration
  config JSONB NOT NULL DEFAULT '{}',
  -- Example config structure:
  -- {
  --   "source_tab": "Credits Log",
  --   "primary_metric": "Credit Volume",
  --   "group_by": "Pod",
  --   "stack_by": "Credit Type",
  --   "aggregation": "sum", -- sum, count, avg, min, max
  --   "filters": [
  --     {"field": "Status", "operator": "=", "value": "Completed"},
  --     {"field": "Date", "operator": ">=", "value": "{{start_date}}"}
  --   ],
  --   "sort_by": "value",
  --   "sort_order": "desc",
  --   "limit": 20,
  --   "colors": ["#a7f3d0", "#93c5fd", "#c4b5fd"],
  --   "show_legend": true,
  --   "reference_line": {"type": "average", "label": "4-Week Avg"}
  -- }

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboards_client ON dashboards(client_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_sources_client ON dashboard_sources(client_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_source ON dashboard_widgets(source_id);

-- Enable RLS
ALTER TABLE dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_widgets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all operations on dashboards" ON dashboards
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on dashboard_sources" ON dashboard_sources
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on dashboard_widgets" ON dashboard_widgets
  FOR ALL USING (true) WITH CHECK (true);

-- Updated_at triggers
CREATE TRIGGER update_dashboards_updated_at
  BEFORE UPDATE ON dashboards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_sources_updated_at
  BEFORE UPDATE ON dashboard_sources
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_widgets_updated_at
  BEFORE UPDATE ON dashboard_widgets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
