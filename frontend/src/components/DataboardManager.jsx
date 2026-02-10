import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Database, RefreshCw, Loader2, Settings, Trash2, Edit3,
  LayoutGrid, Link2, ChevronDown, FileSpreadsheet, AlertCircle,
  BarChart3, LineChart as LineChartIcon, PieChart, Grid3X3, Gauge,
  X, Check, Save, ExternalLink, Calendar, Maximize2, Tag, FolderOpen
} from 'lucide-react';
import clsx from 'clsx';
import { sourcesApi, dashboardsApi, widgetsApi } from '../api/dashboards';
import {
  StackedBarChart,
  HeatmapChart,
  DonutChart,
  LineChart,
  KPIWidget,
  processDataForChart,
  processHeatmapData,
  applyFilters,
  aggregators,
} from './charts';

// Widget type definitions
const WIDGET_TYPES = [
  { id: 'stacked_bar', label: 'Stacked Bar', icon: BarChart3, description: 'Compare grouped values' },
  { id: 'horizontal_bar', label: 'Horizontal Bar', icon: BarChart3, description: 'Ranked bar chart' },
  { id: 'heatmap', label: 'Heatmap', icon: Grid3X3, description: 'Matrix visualization' },
  { id: 'donut', label: 'Donut/Pie', icon: PieChart, description: 'Part-to-whole' },
  { id: 'line', label: 'Line Chart', icon: LineChartIcon, description: 'Trends over time' },
  { id: 'kpi', label: 'KPI Card', icon: Gauge, description: 'Single metric' },
];

// Timeframe presets
const TIMEFRAME_PRESETS = [
  { id: 'mtd', label: 'MTD', description: 'Month to Date' },
  { id: '7d', label: '7D', description: 'Last 7 Days' },
  { id: '30d', label: '30D', description: 'Last 30 Days' },
  { id: 'ytd', label: 'YTD', description: 'Year to Date' },
  { id: 'all', label: 'All', description: 'All Time' },
];

function getTimeframeRange(preset) {
  const now = new Date();
  // Set end of day for the end date
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (preset) {
    case 'mtd':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end };
    case '7d': {
      const start = new Date(end);
      start.setDate(start.getDate() - 7);
      return { start, end };
    }
    case '30d': {
      const start = new Date(end);
      start.setDate(start.getDate() - 30);
      return { start, end };
    }
    case 'ytd':
      return { start: new Date(now.getFullYear(), 0, 1), end };
    case 'all':
    default:
      return null;
  }
}

export default function DataboardManager({ clientId }) {
  const queryClient = useQueryClient();
  const [showSourcesManager, setShowSourcesManager] = useState(false);
  const [showDashboardModal, setShowDashboardModal] = useState(false);
  const [showWidgetModal, setShowWidgetModal] = useState(false);
  const [editingWidget, setEditingWidget] = useState(null);
  const [sourceData, setSourceData] = useState({});
  const [timeframe, setTimeframe] = useState('mtd');
  const [dateField, setDateField] = useState('Due Date');
  const [fullscreenWidget, setFullscreenWidget] = useState(null);

  // Close fullscreen on Escape key
  useEffect(() => {
    if (!fullscreenWidget) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setFullscreenWidget(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreenWidget]);

  // Fetch sources
  const { data: sources = [], isLoading: loadingSources } = useQuery({
    queryKey: ['dashboardSources', clientId],
    queryFn: () => sourcesApi.getByClientId(clientId),
  });

  // Fetch dashboards
  const { data: dashboards = [], isLoading: loadingDashboards } = useQuery({
    queryKey: ['dashboards', clientId],
    queryFn: () => dashboardsApi.getByClientId(clientId),
  });

  // Create source mutation
  const createSourceMutation = useMutation({
    mutationFn: sourcesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboardSources', clientId]);
      setShowSourcesManager(false);
    },
  });

  // Delete source mutation
  const deleteSourceMutation = useMutation({
    mutationFn: sourcesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboardSources', clientId]);
    },
  });

  // Set source group mutation
  const setSourceGroupMutation = useMutation({
    mutationFn: ({ sourceId, group }) => sourcesApi.setGroup(sourceId, group),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboardSources', clientId]);
    },
  });

  // Create dashboard mutation
  const createDashboardMutation = useMutation({
    mutationFn: dashboardsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['dashboards', clientId]);
      setShowDashboardModal(false);
      setSelectedDashboardId(data.id);
    },
  });

  // Create widget mutation
  const createWidgetMutation = useMutation({
    mutationFn: ({ dashboardId, widget }) => widgetsApi.create(dashboardId, widget),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboards', clientId]);
      setShowWidgetModal(false);
      setEditingWidget(null);
    },
  });

  // Update widget mutation
  const updateWidgetMutation = useMutation({
    mutationFn: ({ widgetId, updates }) => widgetsApi.update(widgetId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboards', clientId]);
      setShowWidgetModal(false);
      setEditingWidget(null);
    },
  });

  // Delete widget mutation
  const deleteWidgetMutation = useMutation({
    mutationFn: widgetsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboards', clientId]);
    },
  });

  // Delete dashboard mutation
  const deleteDashboardMutation = useMutation({
    mutationFn: dashboardsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries(['dashboards', clientId]);
      setSelectedDashboardId(null);
    },
  });

  // Fetch data for sources
  const fetchSourceData = useCallback(async (sourceId, tab) => {
    try {
      const result = await sourcesApi.getData(sourceId, { tab, useCache: true });
      setSourceData(prev => ({
        ...prev,
        [`${sourceId}-${tab || 'default'}`]: result.data,
      }));
      return result.data;
    } catch (error) {
      console.error('Error fetching source data:', error);
      return null;
    }
  }, []);

  // Track selected dashboard by ID to avoid reference-equality issues with React Query
  const [selectedDashboardId, setSelectedDashboardId] = useState(null);

  // Auto-select first dashboard
  useEffect(() => {
    if (dashboards.length > 0 && !selectedDashboardId) {
      setSelectedDashboardId(dashboards[0].id);
    }
  }, [dashboards, selectedDashboardId]);

  // Derive the selected dashboard object from query data using the stable ID
  const selectedDashboardDerived = useMemo(() => {
    if (!selectedDashboardId || dashboards.length === 0) return null;
    return dashboards.find(d => d.id === selectedDashboardId) || null;
  }, [dashboards, selectedDashboardId]);

  // Load selected dashboard data — only re-fetch when the dashboard ID changes
  useEffect(() => {
    if (selectedDashboardDerived?.widgets) {
      selectedDashboardDerived.widgets.forEach(widget => {
        if (widget.source_id && widget.config?.source_tab) {
          const dataKey = `${widget.source_id}-${widget.config.source_tab}`;
          // Only fetch if we don't already have this data
          if (!sourceData[dataKey]) {
            fetchSourceData(widget.source_id, widget.config.source_tab);
          }
        }
      });
    }
  }, [selectedDashboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync timeframe from dashboard settings when dashboard is selected
  useEffect(() => {
    if (selectedDashboardDerived?.settings?.timeframe) {
      setTimeframe(selectedDashboardDerived.settings.timeframe);
    }
    if (selectedDashboardDerived?.settings?.dateField) {
      setDateField(selectedDashboardDerived.settings.dateField);
    }
  }, [selectedDashboardId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute timeframe date filters
  const timeframeFilters = useMemo(() => {
    const range = getTimeframeRange(timeframe);
    if (!range) return [];
    return [
      { field: dateField, operator: 'date_gte', value: range.start.toISOString() },
      { field: dateField, operator: 'date_lte', value: range.end.toISOString() },
    ];
  }, [timeframe, dateField]);

  // Merge timeframe filters with widget-specific filters
  const getWidgetFilters = useCallback((widgetFilters) => {
    return [...timeframeFilters, ...(widgetFilters || [])];
  }, [timeframeFilters]);

  // Render widget based on type and config
  const renderWidget = (widget) => {
    const dataKey = `${widget.source_id}-${widget.config?.source_tab || 'default'}`;
    const data = sourceData[dataKey];

    if (!data) {
      return (
        <div className="flex items-center justify-center h-full text-neutral-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading data...
        </div>
      );
    }

    const { rows, headers } = data;
    if (!rows || rows.length === 0) {
      return (
        <div className="flex items-center justify-center h-full text-neutral-500">
          <AlertCircle className="w-5 h-5 mr-2" />
          No data available
        </div>
      );
    }

    const config = widget.config || {};

    switch (widget.widget_type) {
      case 'stacked_bar':
      case 'horizontal_bar': {
        const { chartData, stackKeys } = processDataForChart(rows, {
          primaryMetric: config.primary_metric,
          groupBy: config.group_by,
          stackBy: config.stack_by,
          aggregation: config.aggregation || 'sum',
          filters: getWidgetFilters(config.filters),
          sortBy: config.sort_by || 'value',
          sortOrder: config.sort_order || 'desc',
          limit: config.limit || 20,
        });
        return (
          <StackedBarChart
            data={chartData}
            stackKeys={stackKeys}
            title={widget.title}
            horizontal={widget.widget_type === 'horizontal_bar'}
            showLegend={config.show_legend !== false}
            referenceLine={config.reference_line}
          />
        );
      }

      case 'heatmap': {
        const { rows: heatRows, cols, matrix, maxValue } = processHeatmapData(rows, {
          rowField: config.row_field,
          colField: config.col_field,
          valueField: config.value_field,
          aggregation: config.aggregation || 'sum',
          filters: getWidgetFilters(config.filters),
        });
        return (
          <HeatmapChart
            rows={heatRows}
            cols={cols}
            matrix={matrix}
            maxValue={maxValue}
            title={widget.title}
          />
        );
      }

      case 'donut': {
        const { chartData } = processDataForChart(rows, {
          primaryMetric: config.primary_metric,
          groupBy: config.group_by,
          aggregation: config.aggregation || 'count',
          filters: getWidgetFilters(config.filters),
          limit: config.limit || 10,
        });
        const pieData = chartData.map(d => ({ label: d.label, value: d.value }));
        return (
          <DonutChart
            data={pieData}
            title={widget.title}
            showLegend={config.show_legend !== false}
            innerRadius={config.inner_radius || 0.6}
          />
        );
      }

      case 'line': {
        const { chartData } = processDataForChart(rows, {
          primaryMetric: config.primary_metric,
          groupBy: config.group_by,
          aggregation: config.aggregation || 'sum',
          filters: getWidgetFilters(config.filters),
          sortBy: 'label',
          sortOrder: 'asc',
        });
        return (
          <LineChart
            data={chartData}
            series={[{ key: 'value', label: config.primary_metric }]}
            title={widget.title}
            showArea={config.show_area}
            referenceLine={config.reference_line}
          />
        );
      }

      case 'kpi': {
        const filteredRows = applyFilters(rows, getWidgetFilters(config.filters));
        const values = filteredRows.map(r => r[config.primary_metric]);
        const value = aggregators[config.aggregation || 'sum'](values);
        return (
          <KPIWidget
            title={widget.title}
            value={value}
            format={config.format || 'number'}
            color={config.color || 'mint'}
            size="large"
          />
        );
      }

      default:
        return (
          <div className="flex items-center justify-center h-full text-neutral-500">
            Unknown widget type: {widget.widget_type}
          </div>
        );
    }
  };

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex-shrink-0 bg-neutral-900/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pastel-mint/20 to-pastel-sky/20 flex items-center justify-center border border-pastel-mint/20">
              <LayoutGrid className="w-5 h-5 text-pastel-mint" />
            </div>
            <div>
              <h3 className="font-semibold text-neutral-100 text-lg">Databoards</h3>
              <p className="text-xs text-neutral-500">Real-time KPI visualization from your data sources</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSourcesManager(true)}
              className="px-3 py-2 text-sm font-medium text-neutral-300 bg-neutral-800/80 rounded-lg hover:bg-neutral-700 flex items-center gap-2 border border-neutral-700"
            >
              <Database className="w-4 h-4" />
              Connect Data
              {sources.length > 0 && (
                <span className="px-1.5 py-0.5 text-xs bg-neutral-700 rounded-full">{sources.length}</span>
              )}
            </button>
            <button
              onClick={() => setShowDashboardModal(true)}
              className="px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-pastel-mint to-pastel-sky rounded-lg hover:opacity-90 flex items-center gap-2 shadow-lg shadow-pastel-mint/20"
            >
              <Plus className="w-4 h-4" />
              New Databoard
            </button>
          </div>
        </div>

        {/* Databoard Tabs */}
        {dashboards.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-dark">
            {dashboards.map(dashboard => (
              <div
                key={dashboard.id}
                className={clsx(
                  'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all group',
                  selectedDashboardDerived?.id === dashboard.id
                    ? 'bg-pastel-mint/15 text-pastel-mint border border-pastel-mint/30 shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/50 border border-transparent'
                )}
              >
                <button
                  onClick={() => setSelectedDashboardId(dashboard.id)}
                  className="flex-1"
                >
                  {dashboard.name}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete databoard "${dashboard.name}"? This will also delete all widgets in this databoard.`)) {
                      deleteDashboardMutation.mutate(dashboard.id);
                    }
                  }}
                  className={clsx(
                    'p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity',
                    selectedDashboardDerived?.id === dashboard.id
                      ? 'hover:bg-pastel-mint/20 text-pastel-mint hover:text-red-400'
                      : 'hover:bg-neutral-700 text-neutral-500 hover:text-red-400'
                  )}
                  title="Delete databoard"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Sources Panel */}
        {sources.length > 0 && !selectedDashboardDerived && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-neutral-300 mb-3 flex items-center gap-2">
              <Database className="w-4 h-4" />
              Connected Data Sources
            </h4>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {sources.map(source => (
                <div
                  key={source.id}
                  className="p-4 bg-neutral-900/50 rounded-xl border border-neutral-800 hover:border-neutral-700 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-pastel-mint" />
                      <span className="text-sm font-medium text-neutral-200">{source.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <a
                        href={source.sheet_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 text-neutral-500 hover:text-neutral-300 rounded"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => {
                          if (confirm(`Delete data source "${source.name}"? This will not affect any widgets using this source.`)) {
                            deleteSourceMutation.mutate(source.id);
                          }
                        }}
                        className="p-1 text-neutral-500 hover:text-red-400 rounded"
                        title="Delete data source"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-500 mb-2">
                    {source.sheet_tabs?.length || 0} tabs available
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {source.sheet_tabs?.slice(0, 4).map((tab, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 text-xs bg-neutral-800 text-neutral-400 rounded"
                      >
                        {tab.title || tab}
                      </span>
                    ))}
                    {source.sheet_tabs?.length > 4 && (
                      <span className="px-2 py-0.5 text-xs text-neutral-500">
                        +{source.sheet_tabs.length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Dashboard */}
        {selectedDashboardDerived ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <h4 className="text-lg font-semibold text-neutral-200">{selectedDashboardDerived.name}</h4>
                  {selectedDashboardDerived.description && (
                    <p className="text-sm text-neutral-500">{selectedDashboardDerived.description}</p>
                  )}
                </div>

                {/* Timeframe Selector */}
                <div className="flex items-center gap-1 bg-neutral-800/60 rounded-lg p-1 border border-neutral-700/50">
                  <Calendar className="w-3.5 h-3.5 text-neutral-500 ml-1.5" />
                  {TIMEFRAME_PRESETS.map(preset => (
                    <button
                      key={preset.id}
                      onClick={() => setTimeframe(preset.id)}
                      title={preset.description}
                      className={clsx(
                        'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
                        timeframe === preset.id
                          ? 'bg-pastel-mint/20 text-pastel-mint shadow-sm'
                          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={() => {
                  setEditingWidget(null);
                  setShowWidgetModal(true);
                }}
                className="px-3 py-1.5 text-sm font-medium text-pastel-mint bg-pastel-mint/15 rounded-lg hover:bg-pastel-mint/25 flex items-center gap-2 border border-pastel-mint/25"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
            </div>

            {/* Widgets Grid */}
            <div className="grid gap-4 grid-cols-12">
              {selectedDashboardDerived.widgets?.map(widget => (
                <div
                  key={widget.id}
                  className={clsx(
                    'bg-neutral-900/50 rounded-xl border border-neutral-800 overflow-hidden',
                    `col-span-${widget.grid_w || 6}`,
                    widget.widget_type === 'kpi' ? 'row-span-1' : 'row-span-2'
                  )}
                  style={{
                    gridColumn: `span ${widget.grid_w || 6}`,
                    minHeight: widget.widget_type === 'kpi' ? '120px' : '300px',
                  }}
                >
                  {/* Widget Header */}
                  <div className="px-3 py-2 border-b border-neutral-800 flex items-center justify-between">
                    <span className="text-xs font-medium text-neutral-400">{widget.title}</span>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setFullscreenWidget(widget)}
                        className="p-1 text-neutral-500 hover:text-neutral-300 rounded"
                        title="View fullscreen"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingWidget(widget);
                          setShowWidgetModal(true);
                        }}
                        className="p-1 text-neutral-500 hover:text-neutral-300 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteWidgetMutation.mutate(widget.id)}
                        className="p-1 text-neutral-500 hover:text-pastel-coral rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Widget Content */}
                  <div className="p-3 h-[calc(100%-36px)]">
                    {renderWidget(widget)}
                  </div>
                </div>
              ))}
            </div>

            {(!selectedDashboardDerived.widgets || selectedDashboardDerived.widgets.length === 0) && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-neutral-800 flex items-center justify-center mb-4">
                  <BarChart3 className="w-8 h-8 text-neutral-600" />
                </div>
                <h4 className="text-lg font-medium text-neutral-300 mb-2">No widgets yet</h4>
                <p className="text-sm text-neutral-500 mb-4 max-w-md">
                  Add widgets to visualize your data. Choose from bar charts, heatmaps, line charts, and more.
                </p>
                <button
                  onClick={() => setShowWidgetModal(true)}
                  className="px-4 py-2 text-sm font-medium text-pastel-mint bg-pastel-mint/15 rounded-lg hover:bg-pastel-mint/25 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add First Widget
                </button>
              </div>
            )}
          </div>
        ) : dashboards.length === 0 && sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-pastel-mint/20 to-pastel-sky/20 flex items-center justify-center mb-6 border border-pastel-mint/20">
              <LayoutGrid className="w-12 h-12 text-pastel-mint" />
            </div>
            <h4 className="text-2xl font-semibold text-neutral-100 mb-3">Create Your First Databoard</h4>
            <p className="text-sm text-neutral-400 mb-8 max-w-lg leading-relaxed">
              Connect a Google Sheet as a data source, then build interactive databoards with KPI cards, charts, and real-time metrics visualization.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowSourcesManager(true)}
                className="px-5 py-2.5 text-sm font-medium text-neutral-200 bg-neutral-800 rounded-lg hover:bg-neutral-700 flex items-center gap-2 border border-neutral-700"
              >
                <Database className="w-4 h-4" />
                Connect Data Source
              </button>
              <button
                onClick={() => setShowDashboardModal(true)}
                className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-pastel-mint to-pastel-sky rounded-lg hover:opacity-90 flex items-center gap-2 shadow-lg shadow-pastel-mint/20"
              >
                <Plus className="w-4 h-4" />
                Create Databoard
              </button>
            </div>
          </div>
        ) : !selectedDashboardDerived && dashboards.length > 0 ? (
          <div className="text-center py-12 text-neutral-400">
            Select a databoard above to view your metrics
          </div>
        ) : null}
      </div>

      {/* Sources Manager Modal */}
      {showSourcesManager && (
        <SourcesManagerModal
          sources={sources}
          clientId={clientId}
          onClose={() => setShowSourcesManager(false)}
          onAddSource={(data) => createSourceMutation.mutate({ clientId, ...data })}
          onDeleteSource={(sourceId) => deleteSourceMutation.mutate(sourceId)}
          onSetGroup={(sourceId, group) => setSourceGroupMutation.mutate({ sourceId, group })}
          isAdding={createSourceMutation.isPending}
          isDeleting={deleteSourceMutation.isPending}
        />
      )}

      {/* Dashboard Modal */}
      {showDashboardModal && (
        <DashboardModal
          onClose={() => setShowDashboardModal(false)}
          onSubmit={(data) => createDashboardMutation.mutate({ clientId, ...data })}
          isLoading={createDashboardMutation.isPending}
        />
      )}

      {/* Widget Modal */}
      {showWidgetModal && selectedDashboardDerived && (
        <WidgetModal
          sources={sources}
          widget={editingWidget}
          onClose={() => {
            setShowWidgetModal(false);
            setEditingWidget(null);
          }}
          onSubmit={(data) => {
            if (editingWidget) {
              updateWidgetMutation.mutate({ widgetId: editingWidget.id, updates: data });
            } else {
              createWidgetMutation.mutate({ dashboardId: selectedDashboardDerived.id, widget: data });
            }
          }}
          isLoading={createWidgetMutation.isPending || updateWidgetMutation.isPending}
          fetchSourceData={fetchSourceData}
        />
      )}

      {/* Fullscreen Widget Modal */}
      {fullscreenWidget && (
        <div
          className="fixed inset-0 z-50 bg-neutral-950/90 backdrop-blur-sm flex flex-col"
          onClick={(e) => { if (e.target === e.currentTarget) setFullscreenWidget(null); }}
        >
          {/* Fullscreen Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-800 bg-neutral-900/80 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pastel-mint/20 to-pastel-sky/20 flex items-center justify-center">
                {fullscreenWidget.widget_type === 'line' ? <LineChartIcon className="w-4 h-4 text-pastel-mint" /> :
                 fullscreenWidget.widget_type === 'donut' ? <PieChart className="w-4 h-4 text-pastel-mint" /> :
                 fullscreenWidget.widget_type === 'heatmap' ? <Grid3X3 className="w-4 h-4 text-pastel-mint" /> :
                 fullscreenWidget.widget_type === 'kpi' ? <Gauge className="w-4 h-4 text-pastel-mint" /> :
                 <BarChart3 className="w-4 h-4 text-pastel-mint" />}
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-100">{fullscreenWidget.title}</h3>
                <p className="text-xs text-neutral-500">
                  {WIDGET_TYPES.find(t => t.id === fullscreenWidget.widget_type)?.label}
                  {timeframe !== 'all' && ` · ${TIMEFRAME_PRESETS.find(p => p.id === timeframe)?.description}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFullscreenWidget(null)}
              className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Fullscreen Chart */}
          <div className="flex-1 p-6 overflow-auto">
            <div className="w-full h-full min-h-[500px] bg-neutral-900/50 rounded-2xl border border-neutral-800 p-6">
              {renderWidget(fullscreenWidget)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sources Manager Modal Component
function SourcesManagerModal({ sources, clientId, onClose, onAddSource, onDeleteSource, onSetGroup, isAdding, isDeleting }) {
  const [showAddForm, setShowAddForm] = useState(sources.length === 0);
  const [name, setName] = useState('');
  const [sheetUrl, setSheetUrl] = useState('');
  const [group, setGroup] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupValue, setEditGroupValue] = useState('');

  // Extract unique groups from sources
  const groups = useMemo(() => {
    const set = new Set(sources.map(s => s.custom_group).filter(Boolean));
    return [...set].sort();
  }, [sources]);

  // Filter sources by group
  const filteredSources = useMemo(() => {
    if (filterGroup === 'all') return sources;
    if (filterGroup === 'ungrouped') return sources.filter(s => !s.custom_group);
    return sources.filter(s => s.custom_group === filterGroup);
  }, [sources, filterGroup]);

  // Group the filtered sources for display
  const groupedSources = useMemo(() => {
    const grouped = {};
    filteredSources.forEach(source => {
      const g = source.custom_group || 'Ungrouped';
      if (!grouped[g]) grouped[g] = [];
      grouped[g].push(source);
    });
    // Sort: named groups first (alphabetical), then Ungrouped last
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Ungrouped') return 1;
      if (b === 'Ungrouped') return -1;
      return a.localeCompare(b);
    });
    return sortedKeys.map(key => ({ group: key, sources: grouped[key] }));
  }, [filteredSources]);

  const handleAddSource = () => {
    onAddSource({ name, sheetUrl, group: group || undefined });
    setName('');
    setSheetUrl('');
    setGroup('');
    setShowAddForm(false);
  };

  const handleSaveGroup = (sourceId) => {
    onSetGroup(sourceId, editGroupValue);
    setEditingGroupId(null);
    setEditGroupValue('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-2xl p-6 shadow-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pastel-sky/20 to-pastel-lavender/20 flex items-center justify-center">
              <Database className="w-5 h-5 text-pastel-sky" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-100">Data Sources</h3>
              <p className="text-xs text-neutral-500">{sources.length} connected source{sources.length !== 1 ? 's' : ''}{groups.length > 0 ? ` in ${groups.length} group${groups.length !== 1 ? 's' : ''}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Group Filter Pills */}
        {groups.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            <button
              onClick={() => setFilterGroup('all')}
              className={clsx(
                'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                filterGroup === 'all'
                  ? 'bg-pastel-sky/15 text-pastel-sky border border-pastel-sky/30'
                  : 'text-neutral-400 hover:text-neutral-200 bg-neutral-800 border border-neutral-700 hover:border-neutral-600'
              )}
            >
              All ({sources.length})
            </button>
            {groups.map(g => {
              const count = sources.filter(s => s.custom_group === g).length;
              return (
                <button
                  key={g}
                  onClick={() => setFilterGroup(g)}
                  className={clsx(
                    'px-2.5 py-1 text-xs font-medium rounded-lg transition-all flex items-center gap-1',
                    filterGroup === g
                      ? 'bg-pastel-lavender/15 text-pastel-lavender border border-pastel-lavender/30'
                      : 'text-neutral-400 hover:text-neutral-200 bg-neutral-800 border border-neutral-700 hover:border-neutral-600'
                  )}
                >
                  <FolderOpen className="w-3 h-3" />
                  {g} ({count})
                </button>
              );
            })}
            {sources.some(s => !s.custom_group) && (
              <button
                onClick={() => setFilterGroup('ungrouped')}
                className={clsx(
                  'px-2.5 py-1 text-xs font-medium rounded-lg transition-all',
                  filterGroup === 'ungrouped'
                    ? 'bg-neutral-600/30 text-neutral-300 border border-neutral-500/30'
                    : 'text-neutral-500 hover:text-neutral-300 bg-neutral-800 border border-neutral-700 hover:border-neutral-600'
                )}
              >
                Ungrouped ({sources.filter(s => !s.custom_group).length})
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {/* Sources grouped by category */}
          {filteredSources.length > 0 && (
            <div className="space-y-4 mb-4">
              {groupedSources.map(({ group: groupName, sources: groupSources }) => (
                <div key={groupName}>
                  {/* Group header (only show if there are actual groups) */}
                  {groups.length > 0 && (
                    <div className="flex items-center gap-2 mb-2">
                      <FolderOpen className="w-3.5 h-3.5 text-neutral-500" />
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">{groupName}</span>
                      <div className="flex-1 h-px bg-neutral-800" />
                    </div>
                  )}
                  <div className="space-y-2">
                    {groupSources.map(source => (
                      <div
                        key={source.id}
                        className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700 hover:border-neutral-600 transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <FileSpreadsheet className="w-4 h-4 text-pastel-mint flex-shrink-0" />
                              <span className="text-sm font-medium text-neutral-200 truncate">{source.name}</span>
                            </div>
                            <p className="text-xs text-neutral-500 mb-2 truncate">{source.sheet_url}</p>
                            <div className="flex flex-wrap gap-1 items-center">
                              {source.sheet_tabs?.slice(0, 5).map((tab, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 text-xs bg-neutral-700 text-neutral-400 rounded"
                                >
                                  {tab.title || tab}
                                </span>
                              ))}
                              {source.sheet_tabs?.length > 5 && (
                                <span className="px-2 py-0.5 text-xs text-neutral-500">
                                  +{source.sheet_tabs.length - 5} more
                                </span>
                              )}
                            </div>
                            {/* Inline group editor */}
                            {editingGroupId === source.id ? (
                              <div className="flex items-center gap-2 mt-2">
                                <Tag className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
                                <input
                                  type="text"
                                  value={editGroupValue}
                                  onChange={(e) => setEditGroupValue(e.target.value)}
                                  placeholder="Group name..."
                                  list={`groups-${source.id}`}
                                  className="flex-1 px-2 py-1 text-xs bg-neutral-800 border border-neutral-600 rounded text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-sky/50"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveGroup(source.id);
                                    if (e.key === 'Escape') { setEditingGroupId(null); setEditGroupValue(''); }
                                  }}
                                />
                                <datalist id={`groups-${source.id}`}>
                                  {groups.map(g => <option key={g} value={g} />)}
                                </datalist>
                                <button
                                  onClick={() => handleSaveGroup(source.id)}
                                  className="p-1 text-pastel-mint hover:bg-pastel-mint/10 rounded"
                                  title="Save group"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => { setEditingGroupId(null); setEditGroupValue(''); }}
                                  className="p-1 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 rounded"
                                  title="Cancel"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingGroupId(source.id); setEditGroupValue(source.custom_group || ''); }}
                                className="flex items-center gap-1.5 mt-2 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
                                title="Set group"
                              >
                                <Tag className="w-3 h-3" />
                                {source.custom_group || 'Add to group...'}
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                            <a
                              href={source.sheet_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700 rounded-lg transition-colors"
                              title="Open in Google Sheets"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                            <button
                              onClick={() => {
                                if (confirm(`Delete data source "${source.name}"? Widgets using this source will no longer display data.`)) {
                                  onDeleteSource(source.id);
                                }
                              }}
                              disabled={isDeleting}
                              className="p-2 text-neutral-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors disabled:opacity-50"
                              title="Delete data source"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add New Source Form */}
          {showAddForm ? (
            <div className="p-4 bg-neutral-800/30 rounded-xl border border-neutral-700 border-dashed">
              <h4 className="text-sm font-medium text-neutral-300 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Add New Data Source
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Source Name (optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Marketing KPIs Sheet"
                    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-pastel-sky/50 focus:border-pastel-sky/50"
                  />
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Google Sheet URL *</label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="url"
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      className="w-full pl-10 pr-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-pastel-sky/50 focus:border-pastel-sky/50"
                    />
                  </div>
                  <p className="text-xs text-neutral-500 mt-2">
                    Sheet must be shared with the service account or set to "Anyone with the link can view"
                  </p>
                </div>

                <div>
                  <label className="block text-sm text-neutral-400 mb-1.5">Group (optional)</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
                    <input
                      type="text"
                      value={group}
                      onChange={(e) => setGroup(e.target.value)}
                      placeholder="e.g. Marketing, Finance, Operations"
                      list="add-source-groups"
                      className="w-full pl-10 pr-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-pastel-sky/50 focus:border-pastel-sky/50"
                    />
                    <datalist id="add-source-groups">
                      {groups.map(g => <option key={g} value={g} />)}
                    </datalist>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {sources.length > 0 && (
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={handleAddSource}
                    disabled={!sheetUrl || isAdding}
                    className="px-4 py-2 text-sm font-medium text-white bg-pastel-sky rounded-lg hover:bg-pastel-sky/90 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isAdding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Connect Source
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAddForm(true)}
              className="w-full p-4 border-2 border-dashed border-neutral-700 rounded-xl text-neutral-400 hover:text-neutral-300 hover:border-neutral-600 hover:bg-neutral-800/30 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add New Data Source
            </button>
          )}
        </div>

        <div className="flex justify-end pt-4 mt-4 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-neutral-300 bg-neutral-800 rounded-lg hover:bg-neutral-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Databoard Modal Component
function DashboardModal({ onClose, onSubmit, isLoading }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-md p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pastel-mint/20 to-pastel-sky/20 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-pastel-mint" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-100">Create Databoard</h3>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Databoard Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Weekly KPI Dashboard"
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-pastel-mint/50 focus:border-pastel-mint/50"
            />
          </div>

          <div>
            <label className="block text-sm text-neutral-400 mb-1.5">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Overview of key performance metrics..."
              rows={3}
              className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-pastel-mint/50 focus:border-pastel-mint/50 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ name, description })}
            disabled={!name || isLoading}
            className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-pastel-mint to-pastel-sky rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-pastel-mint/20"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Create Databoard
          </button>
        </div>
      </div>
    </div>
  );
}

// Helper to detect column types from sample data
function detectColumnType(values) {
  const sampleValues = values.filter(v => v != null && v !== '').slice(0, 20);
  if (sampleValues.length === 0) return 'text';

  const numericCount = sampleValues.filter(v => !isNaN(parseFloat(v)) && isFinite(v)).length;
  const dateCount = sampleValues.filter(v => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && v.toString().match(/\d{4}|\d{1,2}[\/\-]\d{1,2}/);
  }).length;

  if (numericCount / sampleValues.length > 0.7) return 'number';
  if (dateCount / sampleValues.length > 0.7) return 'date';
  return 'text';
}

// Helper to get unique values for a column
function getUniqueValues(rows, column) {
  const values = rows.map(r => r[column]).filter(v => v != null && v !== '');
  return [...new Set(values)].slice(0, 50);
}

// Widget Modal Component - Enhanced with data preview and smart selection
function WidgetModal({ sources, widget, onClose, onSubmit, isLoading, fetchSourceData }) {
  const [step, setStep] = useState(1); // 1: Source, 2: Data Selection, 3: Widget Config
  const [widgetType, setWidgetType] = useState(widget?.widget_type || 'kpi');
  const [title, setTitle] = useState(widget?.title || '');
  const [sourceId, setSourceId] = useState(widget?.source_id || '');
  const [sourceTab, setSourceTab] = useState(widget?.config?.source_tab || '');
  const [availableTabs, setAvailableTabs] = useState([]);
  const [sheetData, setSheetData] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [columnInfo, setColumnInfo] = useState([]);

  // Config fields
  const [primaryMetric, setPrimaryMetric] = useState(widget?.config?.primary_metric || '');
  const [groupBy, setGroupBy] = useState(widget?.config?.group_by || '');
  const [stackBy, setStackBy] = useState(widget?.config?.stack_by || '');
  const [aggregation, setAggregation] = useState(widget?.config?.aggregation || 'sum');
  const [rowField, setRowField] = useState(widget?.config?.row_field || '');
  const [colField, setColField] = useState(widget?.config?.col_field || '');
  const [valueField, setValueField] = useState(widget?.config?.value_field || '');
  const [gridW, setGridW] = useState(widget?.grid_w || 6);
  const [filters, setFilters] = useState(widget?.config?.filters || []);
  const [filterColumn, setFilterColumn] = useState('');
  const [filterValue, setFilterValue] = useState('');

  // Update available tabs when source changes
  useEffect(() => {
    const source = sources.find(s => s.id === sourceId);
    if (source?.sheet_tabs) {
      setAvailableTabs(source.sheet_tabs.map(t => ({ title: t.title || t, ...t })));
    } else {
      setAvailableTabs([]);
    }
  }, [sourceId, sources]);

  // Fetch data when source tab changes
  useEffect(() => {
    if (sourceId && sourceTab) {
      setLoadingData(true);
      fetchSourceData(sourceId, sourceTab).then(data => {
        if (data) {
          setSheetData(data);
          // Analyze columns
          if (data.headers && data.rows) {
            const info = data.headers.filter(Boolean).map(header => {
              const values = data.rows.map(r => r[header]);
              return {
                name: header,
                type: detectColumnType(values),
                uniqueCount: new Set(values.filter(v => v != null && v !== '')).size,
                sampleValues: getUniqueValues(data.rows, header).slice(0, 5),
              };
            });
            setColumnInfo(info);
          }
        }
        setLoadingData(false);
      });
    }
  }, [sourceId, sourceTab, fetchSourceData]);

  const numericColumns = columnInfo.filter(c => c.type === 'number');
  const textColumns = columnInfo.filter(c => c.type === 'text');
  const dateColumns = columnInfo.filter(c => c.type === 'date');

  const addFilter = () => {
    if (filterColumn && filterValue) {
      setFilters([...filters, { column: filterColumn, value: filterValue }]);
      setFilterColumn('');
      setFilterValue('');
    }
  };

  const removeFilter = (idx) => {
    setFilters(filters.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    const config = {
      source_tab: sourceTab,
      aggregation,
      filters,
    };

    if (widgetType === 'heatmap') {
      config.row_field = rowField;
      config.col_field = colField;
      config.value_field = valueField;
    } else {
      config.primary_metric = primaryMetric;
      config.group_by = groupBy;
      if (stackBy) config.stack_by = stackBy;
    }

    onSubmit({
      widgetType,
      title,
      sourceId,
      gridW,
      gridH: widgetType === 'kpi' ? 2 : 4,
      config,
    });
  };

  const canProceedToStep2 = sourceId && sourceTab;
  const canProceedToStep3 = canProceedToStep2 && (
    widgetType === 'kpi' ? primaryMetric :
    widgetType === 'heatmap' ? (rowField && colField && valueField) :
    (primaryMetric && groupBy)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto py-4">
      <div className="bg-neutral-900 rounded-2xl border border-neutral-800 w-full max-w-4xl mx-4 my-auto shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pastel-mint/20 to-pastel-sky/20 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-pastel-mint" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-neutral-100">
                {widget ? 'Edit Widget' : 'Create Widget'}
              </h3>
              <p className="text-xs text-neutral-500">Step {step} of 3</p>
            </div>
          </div>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-300 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 py-3 bg-neutral-900/50 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <button
                  onClick={() => s < step && setStep(s)}
                  disabled={s > step}
                  className={clsx(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    step === s ? 'bg-pastel-mint text-neutral-900' :
                    step > s ? 'bg-pastel-mint/30 text-pastel-mint cursor-pointer hover:bg-pastel-mint/40' :
                    'bg-neutral-800 text-neutral-500'
                  )}
                >
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </button>
                {s < 3 && (
                  <div className={clsx(
                    'flex-1 h-0.5 mx-2',
                    step > s ? 'bg-pastel-mint/30' : 'bg-neutral-800'
                  )} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className={clsx('text-xs', step === 1 ? 'text-pastel-mint' : 'text-neutral-500')}>Select Data</span>
            <span className={clsx('text-xs', step === 2 ? 'text-pastel-mint' : 'text-neutral-500')}>Configure</span>
            <span className={clsx('text-xs', step === 3 ? 'text-pastel-mint' : 'text-neutral-500')}>Customize</span>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Select Data Source */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Source Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Data Source</label>
                  <select
                    value={sourceId}
                    onChange={(e) => { setSourceId(e.target.value); setSourceTab(''); setSheetData(null); }}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 focus:ring-2 focus:ring-pastel-mint/50 focus:border-pastel-mint/50"
                  >
                    <option value="">Choose a connected sheet...</option>
                    {sources.map(source => (
                      <option key={source.id} value={source.id}>{source.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">Sheet Tab</label>
                  <select
                    value={sourceTab}
                    onChange={(e) => setSourceTab(e.target.value)}
                    disabled={!sourceId}
                    className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 focus:ring-2 focus:ring-pastel-mint/50 focus:border-pastel-mint/50 disabled:opacity-50"
                  >
                    <option value="">Choose a tab...</option>
                    {availableTabs.map((tab, idx) => (
                      <option key={idx} value={tab.title}>
                        {tab.title} {tab.rowCount ? `(${tab.rowCount} rows)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Data Preview */}
              {loadingData && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-pastel-mint mr-2" />
                  <span className="text-neutral-400">Loading sheet data...</span>
                </div>
              )}

              {sheetData && !loadingData && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-neutral-300">Data Preview</h4>
                    <span className="text-xs text-neutral-500">
                      {sheetData.rows?.length || 0} rows × {columnInfo.length} columns
                    </span>
                  </div>

                  {/* Column Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {columnInfo.slice(0, 12).map((col, idx) => (
                      <div
                        key={idx}
                        className={clsx(
                          'p-3 rounded-lg border transition-all',
                          col.type === 'number' ? 'bg-pastel-mint/5 border-pastel-mint/20' :
                          col.type === 'date' ? 'bg-pastel-sky/5 border-pastel-sky/20' :
                          'bg-neutral-800/50 border-neutral-700'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className={clsx(
                            'px-1.5 py-0.5 text-[10px] font-medium rounded',
                            col.type === 'number' ? 'bg-pastel-mint/20 text-pastel-mint' :
                            col.type === 'date' ? 'bg-pastel-sky/20 text-pastel-sky' :
                            'bg-neutral-700 text-neutral-400'
                          )}>
                            {col.type === 'number' ? '#' : col.type === 'date' ? '📅' : 'Aa'}
                          </span>
                          <span className="text-xs font-medium text-neutral-200 truncate">{col.name}</span>
                        </div>
                        <div className="text-[10px] text-neutral-500">
                          {col.uniqueCount} unique values
                        </div>
                        <div className="mt-1 text-[10px] text-neutral-400 truncate">
                          {col.sampleValues.slice(0, 3).join(', ')}
                        </div>
                      </div>
                    ))}
                    {columnInfo.length > 12 && (
                      <div className="p-3 rounded-lg bg-neutral-800/30 border border-neutral-700 flex items-center justify-center">
                        <span className="text-xs text-neutral-500">+{columnInfo.length - 12} more</span>
                      </div>
                    )}
                  </div>

                  {/* Sample Data Table */}
                  <div className="border border-neutral-800 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-neutral-800/50">
                          <tr>
                            {columnInfo.slice(0, 6).map((col, idx) => (
                              <th key={idx} className="px-3 py-2 text-left text-neutral-400 font-medium whitespace-nowrap">
                                {col.name}
                              </th>
                            ))}
                            {columnInfo.length > 6 && (
                              <th className="px-3 py-2 text-neutral-500">...</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetData.rows?.slice(0, 5).map((row, rowIdx) => (
                            <tr key={rowIdx} className="border-t border-neutral-800">
                              {columnInfo.slice(0, 6).map((col, colIdx) => (
                                <td key={colIdx} className="px-3 py-2 text-neutral-300 whitespace-nowrap max-w-[150px] truncate">
                                  {row[col.name] ?? '-'}
                                </td>
                              ))}
                              {columnInfo.length > 6 && (
                                <td className="px-3 py-2 text-neutral-500">...</td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure Data */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Widget Type Selection */}
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-3">Widget Type</label>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {WIDGET_TYPES.map(type => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setWidgetType(type.id)}
                        className={clsx(
                          'p-3 rounded-xl border text-center transition-all',
                          widgetType === type.id
                            ? 'bg-pastel-mint/15 border-pastel-mint/40 text-pastel-mint'
                            : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
                        )}
                      >
                        <Icon className="w-6 h-6 mx-auto mb-1.5" />
                        <div className="text-xs font-medium">{type.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Data Mapping */}
              <div className="bg-neutral-800/30 rounded-xl p-4 border border-neutral-800">
                <h4 className="text-sm font-medium text-neutral-300 mb-4">Map Your Data</h4>

                {widgetType === 'kpi' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Metric Column (numeric)</label>
                      <select
                        value={primaryMetric}
                        onChange={(e) => setPrimaryMetric(e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                      >
                        <option value="">Select a numeric column...</option>
                        {numericColumns.map((col, idx) => (
                          <option key={idx} value={col.name}>{col.name}</option>
                        ))}
                        <optgroup label="Other columns">
                          {textColumns.map((col, idx) => (
                            <option key={idx} value={col.name}>{col.name}</option>
                          ))}
                        </optgroup>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Aggregation</label>
                      <div className="flex gap-2">
                        {['sum', 'avg', 'count', 'min', 'max'].map(agg => (
                          <button
                            key={agg}
                            onClick={() => setAggregation(agg)}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                              aggregation === agg
                                ? 'bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-neutral-300'
                            )}
                          >
                            {agg.charAt(0).toUpperCase() + agg.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {widgetType === 'heatmap' && (
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Row Labels</label>
                      <select
                        value={rowField}
                        onChange={(e) => setRowField(e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                      >
                        <option value="">Select column...</option>
                        {columnInfo.map((col, idx) => (
                          <option key={idx} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Column Labels</label>
                      <select
                        value={colField}
                        onChange={(e) => setColField(e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                      >
                        <option value="">Select column...</option>
                        {columnInfo.map((col, idx) => (
                          <option key={idx} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Values (numeric)</label>
                      <select
                        value={valueField}
                        onChange={(e) => setValueField(e.target.value)}
                        className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                      >
                        <option value="">Select column...</option>
                        {numericColumns.map((col, idx) => (
                          <option key={idx} value={col.name}>{col.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {['stacked_bar', 'horizontal_bar', 'line', 'donut'].includes(widgetType) && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1.5">
                          {widgetType === 'line' ? 'X-Axis (category/date)' : 'Group By'}
                        </label>
                        <select
                          value={groupBy}
                          onChange={(e) => setGroupBy(e.target.value)}
                          className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                        >
                          <option value="">Select column...</option>
                          {dateColumns.length > 0 && (
                            <optgroup label="Date columns">
                              {dateColumns.map((col, idx) => (
                                <option key={idx} value={col.name}>{col.name}</option>
                              ))}
                            </optgroup>
                          )}
                          <optgroup label="Text columns">
                            {textColumns.map((col, idx) => (
                              <option key={idx} value={col.name}>{col.name}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1.5">
                          {widgetType === 'line' ? 'Y-Axis (value)' : 'Metric (Value)'}
                        </label>
                        <select
                          value={primaryMetric}
                          onChange={(e) => setPrimaryMetric(e.target.value)}
                          className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                        >
                          <option value="">Select column...</option>
                          {numericColumns.map((col, idx) => (
                            <option key={idx} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {['stacked_bar', 'horizontal_bar'].includes(widgetType) && (
                      <div>
                        <label className="block text-xs text-neutral-400 mb-1.5">Stack By (optional)</label>
                        <select
                          value={stackBy}
                          onChange={(e) => setStackBy(e.target.value)}
                          className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200"
                        >
                          <option value="">No stacking</option>
                          {textColumns.filter(c => c.name !== groupBy).map((col, idx) => (
                            <option key={idx} value={col.name}>{col.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-xs text-neutral-400 mb-1.5">Aggregation</label>
                      <div className="flex gap-2">
                        {['sum', 'avg', 'count', 'min', 'max'].map(agg => (
                          <button
                            key={agg}
                            onClick={() => setAggregation(agg)}
                            className={clsx(
                              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                              aggregation === agg
                                ? 'bg-pastel-mint/20 text-pastel-mint border border-pastel-mint/30'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700 hover:text-neutral-300'
                            )}
                          >
                            {agg.charAt(0).toUpperCase() + agg.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Filters */}
              <div className="bg-neutral-800/30 rounded-xl p-4 border border-neutral-800">
                <h4 className="text-sm font-medium text-neutral-300 mb-3">Filters (optional)</h4>

                {filters.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {filters.map((f, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-2 py-1 bg-pastel-sky/15 text-pastel-sky rounded-lg text-xs"
                      >
                        {f.column} = "{f.value}"
                        <button onClick={() => removeFilter(idx)} className="hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <select
                    value={filterColumn}
                    onChange={(e) => setFilterColumn(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200"
                  >
                    <option value="">Column...</option>
                    {columnInfo.map((col, idx) => (
                      <option key={idx} value={col.name}>{col.name}</option>
                    ))}
                  </select>
                  <select
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    disabled={!filterColumn}
                    className="flex-1 px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-xs text-neutral-200 disabled:opacity-50"
                  >
                    <option value="">Value...</option>
                    {filterColumn && columnInfo.find(c => c.name === filterColumn)?.sampleValues?.map((val, idx) => (
                      <option key={idx} value={val}>{val}</option>
                    ))}
                  </select>
                  <button
                    onClick={addFilter}
                    disabled={!filterColumn || !filterValue}
                    className="px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-400 hover:text-neutral-200 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Customize */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-2">Widget Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Monthly Revenue Growth"
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm text-neutral-200 placeholder-neutral-500 focus:ring-2 focus:ring-pastel-mint/50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-neutral-300 mb-3">Widget Size</label>
                <div className="flex gap-3">
                  {[
                    { w: 4, label: 'Small', desc: '1/3 width' },
                    { w: 6, label: 'Medium', desc: '1/2 width' },
                    { w: 8, label: 'Large', desc: '2/3 width' },
                    { w: 12, label: 'Full', desc: 'Full width' },
                  ].map(size => (
                    <button
                      key={size.w}
                      onClick={() => setGridW(size.w)}
                      className={clsx(
                        'flex-1 p-3 rounded-xl border text-center transition-all',
                        gridW === size.w
                          ? 'bg-pastel-mint/15 border-pastel-mint/40 text-pastel-mint'
                          : 'bg-neutral-800 border-neutral-700 text-neutral-400 hover:border-neutral-600'
                      )}
                    >
                      <div className="text-sm font-medium">{size.label}</div>
                      <div className="text-xs text-neutral-500">{size.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preview Summary */}
              <div className="bg-neutral-800/30 rounded-xl p-4 border border-neutral-800">
                <h4 className="text-sm font-medium text-neutral-300 mb-3">Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-neutral-500">Type:</span>
                    <span className="ml-2 text-neutral-200">{WIDGET_TYPES.find(t => t.id === widgetType)?.label}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Source:</span>
                    <span className="ml-2 text-neutral-200">{sourceTab}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Metric:</span>
                    <span className="ml-2 text-neutral-200">{primaryMetric || valueField || '-'}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">Aggregation:</span>
                    <span className="ml-2 text-neutral-200">{aggregation}</span>
                  </div>
                  {filters.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-neutral-500">Filters:</span>
                      <span className="ml-2 text-neutral-200">{filters.length} applied</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-between">
          <button
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-4 py-2 text-sm text-neutral-400 hover:text-neutral-200"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 ? !canProceedToStep2 : !canProceedToStep3}
              className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-pastel-mint to-pastel-sky rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              Continue
              <ChevronDown className="w-4 h-4 rotate-[-90deg]" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!title || isLoading}
              className="px-5 py-2 text-sm font-medium text-white bg-gradient-to-r from-pastel-mint to-pastel-sky rounded-lg hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-pastel-mint/20"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {widget ? 'Update Widget' : 'Create Widget'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
