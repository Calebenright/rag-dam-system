import { useState, useEffect, useRef } from 'react';
import {
  BarChart3, LineChart, PieChart, RefreshCw, Loader2, AlertCircle,
  Download, Link2, Table2, ChevronDown, X, Check, TrendingUp
} from 'lucide-react';
import clsx from 'clsx';
import Papa from 'papaparse';

// Chart types
const CHART_TYPES = [
  { id: 'bar', label: 'Bar Chart', icon: BarChart3 },
  { id: 'line', label: 'Line Chart', icon: LineChart },
  { id: 'pie', label: 'Pie Chart', icon: PieChart },
];

// Color palette for charts
const CHART_COLORS = [
  '#a7f3d0', // pastel-mint
  '#93c5fd', // pastel-sky
  '#c4b5fd', // pastel-lavender
  '#fcd9bd', // pastel-peach
  '#fca5a5', // pastel-coral
  '#fde68a', // yellow
  '#6ee7b7', // emerald
  '#f9a8d4', // pink
];

export default function DataVisualizer({ clientId }) {
  const [sheetUrl, setSheetUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [chartType, setChartType] = useState('bar');
  const [labelColumn, setLabelColumn] = useState('');
  const [valueColumns, setValueColumns] = useState([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const canvasRef = useRef(null);
  const chartInstance = useRef(null);

  // Extract spreadsheet ID from Google Sheets URL
  const extractSpreadsheetId = (url) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  };

  // Fetch data from public Google Sheet
  const fetchSheetData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const spreadsheetId = extractSpreadsheetId(sheetUrl);
      if (!spreadsheetId) {
        throw new Error('Invalid Google Sheets URL. Please enter a valid public Google Sheet link.');
      }

      // Use Google Sheets CSV export URL for public sheets
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch sheet. Make sure the sheet is publicly accessible (Anyone with the link can view).');
      }

      const csvText = await response.text();

      // Parse CSV data
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
      });

      if (parsed.errors.length > 0) {
        console.warn('CSV parsing warnings:', parsed.errors);
      }

      if (parsed.data.length === 0) {
        throw new Error('The sheet appears to be empty.');
      }

      const columnHeaders = parsed.meta.fields || [];
      setHeaders(columnHeaders);
      setData(parsed.data);

      // Auto-select first column as label, rest as values
      if (columnHeaders.length > 0) {
        setLabelColumn(columnHeaders[0]);
        // Select numeric columns as value columns
        const numericCols = columnHeaders.filter((col, idx) => {
          if (idx === 0) return false;
          return parsed.data.some(row => typeof row[col] === 'number');
        });
        setValueColumns(numericCols.length > 0 ? [numericCols[0]] : [columnHeaders[1] || columnHeaders[0]]);
      }

    } catch (err) {
      setError(err.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Draw chart using Canvas API (no external dependencies)
  useEffect(() => {
    if (!data || !labelColumn || valueColumns.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size with device pixel ratio for sharp rendering
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 40, right: 20, bottom: 60, left: 60 };

    // Clear canvas
    ctx.fillStyle = '#171717'; // neutral-900
    ctx.fillRect(0, 0, width, height);

    // Prepare chart data
    const labels = data.slice(0, 20).map(row => String(row[labelColumn] || ''));
    const datasets = valueColumns.map((col, idx) => ({
      label: col,
      data: data.slice(0, 20).map(row => parseFloat(row[col]) || 0),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));

    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    if (chartType === 'bar') {
      drawBarChart(ctx, labels, datasets, padding, chartWidth, chartHeight);
    } else if (chartType === 'line') {
      drawLineChart(ctx, labels, datasets, padding, chartWidth, chartHeight);
    } else if (chartType === 'pie') {
      drawPieChart(ctx, labels, datasets[0], width, height, padding);
    }

    // Draw title
    ctx.fillStyle = '#e5e5e5';
    ctx.font = 'bold 14px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${valueColumns.join(', ')} by ${labelColumn}`, width / 2, 20);

  }, [data, labelColumn, valueColumns, chartType]);

  const drawBarChart = (ctx, labels, datasets, padding, chartWidth, chartHeight) => {
    const allValues = datasets.flatMap(d => d.data);
    const maxValue = Math.max(...allValues, 1);
    const barGroupWidth = chartWidth / labels.length;
    const barWidth = (barGroupWidth * 0.7) / datasets.length;
    const barGap = barGroupWidth * 0.15;

    // Draw grid lines
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#737373';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      const value = maxValue * (5 - i) / 5;
      ctx.fillText(formatNumber(value), padding.left - 8, y + 4);
    }

    // Draw bars
    datasets.forEach((dataset, datasetIdx) => {
      dataset.data.forEach((value, idx) => {
        const barHeight = (value / maxValue) * chartHeight;
        const x = padding.left + barGap + (idx * barGroupWidth) + (datasetIdx * barWidth);
        const y = padding.top + chartHeight - barHeight;

        // Draw bar with gradient
        const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
        gradient.addColorStop(0, dataset.color);
        gradient.addColorStop(1, adjustColor(dataset.color, -30));
        ctx.fillStyle = gradient;

        // Rounded top corners
        const radius = Math.min(4, barWidth / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + barWidth - radius, y);
        ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
        ctx.lineTo(x + barWidth, y + barHeight);
        ctx.lineTo(x, y + barHeight);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.fill();
      });
    });

    // X-axis labels
    ctx.fillStyle = '#737373';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((label, idx) => {
      const x = padding.left + barGap + (idx * barGroupWidth) + (barGroupWidth * 0.35);
      const truncatedLabel = label.length > 10 ? label.substring(0, 10) + '...' : label;
      ctx.save();
      ctx.translate(x, padding.top + chartHeight + 15);
      ctx.rotate(-0.4);
      ctx.fillText(truncatedLabel, 0, 0);
      ctx.restore();
    });

    // Draw legend
    drawLegend(ctx, datasets, padding.left, padding.top + chartHeight + 45);
  };

  const drawLineChart = (ctx, labels, datasets, padding, chartWidth, chartHeight) => {
    const allValues = datasets.flatMap(d => d.data);
    const maxValue = Math.max(...allValues, 1);
    const minValue = Math.min(...allValues, 0);
    const range = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (chartHeight * i / 5);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#737373';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      const value = maxValue - (range * i / 5);
      ctx.fillText(formatNumber(value), padding.left - 8, y + 4);
    }

    // Draw lines
    datasets.forEach((dataset) => {
      ctx.strokeStyle = dataset.color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();

      dataset.data.forEach((value, idx) => {
        const x = padding.left + (idx / (labels.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

        if (idx === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();

      // Draw points
      dataset.data.forEach((value, idx) => {
        const x = padding.left + (idx / (labels.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((value - minValue) / range) * chartHeight;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = dataset.color;
        ctx.fill();
        ctx.strokeStyle = '#171717';
        ctx.lineWidth = 2;
        ctx.stroke();
      });
    });

    // X-axis labels
    ctx.fillStyle = '#737373';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    labels.forEach((label, idx) => {
      const x = padding.left + (idx / (labels.length - 1 || 1)) * chartWidth;
      const truncatedLabel = label.length > 10 ? label.substring(0, 10) + '...' : label;
      ctx.save();
      ctx.translate(x, padding.top + chartHeight + 15);
      ctx.rotate(-0.4);
      ctx.fillText(truncatedLabel, 0, 0);
      ctx.restore();
    });

    drawLegend(ctx, datasets, padding.left, padding.top + chartHeight + 45);
  };

  const drawPieChart = (ctx, labels, dataset, width, height, padding) => {
    const centerX = width / 2;
    const centerY = (height - padding.bottom + padding.top) / 2;
    const radius = Math.min(centerX - padding.left, centerY - padding.top) * 0.7;

    const total = dataset.data.reduce((sum, val) => sum + Math.max(0, val), 0) || 1;
    let currentAngle = -Math.PI / 2;

    dataset.data.forEach((value, idx) => {
      if (value <= 0) return;

      const sliceAngle = (value / total) * Math.PI * 2;
      const color = CHART_COLORS[idx % CHART_COLORS.length];

      // Draw slice
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#171717';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw label
      const midAngle = currentAngle + sliceAngle / 2;
      const labelRadius = radius * 1.2;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;

      ctx.fillStyle = '#e5e5e5';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textAlign = midAngle > Math.PI / 2 && midAngle < Math.PI * 1.5 ? 'right' : 'left';
      const percentage = ((value / total) * 100).toFixed(1);
      const truncatedLabel = labels[idx]?.length > 12 ? labels[idx].substring(0, 12) + '...' : labels[idx];
      ctx.fillText(`${truncatedLabel}: ${percentage}%`, labelX, labelY);

      currentAngle += sliceAngle;
    });
  };

  const drawLegend = (ctx, datasets, x, y) => {
    if (datasets.length <= 1) return;

    ctx.font = '11px Inter, system-ui, sans-serif';
    let currentX = x;

    datasets.forEach((dataset) => {
      ctx.fillStyle = dataset.color;
      ctx.fillRect(currentX, y - 8, 12, 12);

      ctx.fillStyle = '#a3a3a3';
      ctx.textAlign = 'left';
      ctx.fillText(dataset.label, currentX + 16, y);

      currentX += ctx.measureText(dataset.label).width + 30;
    });
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toFixed(num % 1 === 0 ? 0 : 1);
  };

  const adjustColor = (hex, amount) => {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, Math.min(255, (num >> 16) + amount));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount));
    const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  };

  const toggleValueColumn = (col) => {
    if (valueColumns.includes(col)) {
      if (valueColumns.length > 1) {
        setValueColumns(valueColumns.filter(c => c !== col));
      }
    } else {
      setValueColumns([...valueColumns, col]);
    }
  };

  const downloadChart = () => {
    if (!canvasRef.current) return;
    const link = document.createElement('a');
    link.download = 'chart.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-neutral-800 flex-shrink-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pastel-lavender/20 to-pastel-sky/20 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-pastel-lavender" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-200">Data Visualizer</h3>
            <p className="text-xs text-neutral-500">Visualize data from public Google Sheets</p>
          </div>
        </div>

        {/* URL Input */}
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input
              type="url"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              placeholder="Paste public Google Sheet URL..."
              className="w-full pl-10 pr-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 placeholder-neutral-500 focus:ring-1 focus:ring-pastel-lavender/50 focus:border-pastel-lavender"
              onKeyDown={(e) => e.key === 'Enter' && fetchSheetData()}
            />
          </div>
          <button
            onClick={fetchSheetData}
            disabled={isLoading || !sheetUrl.trim()}
            className="px-4 py-2 bg-pastel-lavender/15 text-pastel-lavender rounded-lg hover:bg-pastel-lavender/25 transition-all disabled:opacity-50 text-sm font-medium flex items-center gap-2 border border-pastel-lavender/25"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Load
          </button>
        </div>

        <p className="text-xs text-neutral-500 mt-2">
          Sheet must be public: File → Share → Anyone with the link can view
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 p-3 bg-pastel-coral/10 border border-pastel-coral/20 rounded-lg">
          <AlertCircle className="w-4 h-4 text-pastel-coral flex-shrink-0" />
          <p className="text-sm text-pastel-coral">{error}</p>
        </div>
      )}

      {/* Main Content */}
      {data && headers.length > 0 ? (
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            {/* Chart Type Selector */}
            <div className="flex bg-neutral-800 rounded-lg p-1">
              {CHART_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => setChartType(type.id)}
                    className={clsx(
                      'px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2',
                      chartType === type.id
                        ? 'bg-pastel-lavender/20 text-pastel-lavender'
                        : 'text-neutral-400 hover:text-neutral-200'
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {type.label}
                  </button>
                );
              })}
            </div>

            {/* Label Column Selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">Labels:</span>
              <select
                value={labelColumn}
                onChange={(e) => setLabelColumn(e.target.value)}
                className="px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 focus:ring-1 focus:ring-pastel-sky/50"
              >
                {headers.map((header) => (
                  <option key={header} value={header}>{header}</option>
                ))}
              </select>
            </div>

            {/* Value Columns Selector */}
            <div className="relative">
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-200 hover:border-neutral-600"
              >
                <span className="text-xs text-neutral-500">Values:</span>
                <span className="text-pastel-mint">{valueColumns.length} selected</span>
                <ChevronDown className="w-4 h-4 text-neutral-500" />
              </button>

              {showColumnDropdown && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 py-1 max-h-60 overflow-y-auto">
                  {headers.filter(h => h !== labelColumn).map((header) => (
                    <button
                      key={header}
                      onClick={() => toggleValueColumn(header)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 flex items-center justify-between"
                    >
                      <span className={valueColumns.includes(header) ? 'text-pastel-mint' : 'text-neutral-300'}>
                        {header}
                      </span>
                      {valueColumns.includes(header) && (
                        <Check className="w-4 h-4 text-pastel-mint" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Download Button */}
            <button
              onClick={downloadChart}
              className="ml-auto px-3 py-1.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-neutral-300 hover:bg-neutral-700 flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export PNG
            </button>
          </div>

          {/* Chart Canvas */}
          <div className="flex-1 bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden min-h-[300px]">
            <canvas
              ref={canvasRef}
              className="w-full h-full"
              style={{ width: '100%', height: '100%' }}
            />
          </div>

          {/* Data Preview */}
          <div className="mt-4">
            <button
              onClick={() => document.getElementById('data-preview').classList.toggle('hidden')}
              className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200"
            >
              <Table2 className="w-4 h-4" />
              Preview Data ({data.length} rows)
              <ChevronDown className="w-4 h-4" />
            </button>
            <div id="data-preview" className="hidden mt-2 max-h-40 overflow-auto rounded-lg border border-neutral-800">
              <table className="w-full text-xs">
                <thead className="bg-neutral-800 sticky top-0">
                  <tr>
                    {headers.slice(0, 6).map((header) => (
                      <th key={header} className="px-3 py-2 text-left text-neutral-400 font-medium">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.slice(0, 10).map((row, idx) => (
                    <tr key={idx} className="border-t border-neutral-800">
                      {headers.slice(0, 6).map((header) => (
                        <td key={header} className="px-3 py-2 text-neutral-300 truncate max-w-[150px]">
                          {String(row[header] ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : !isLoading && !error ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-md px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pastel-lavender/20 to-pastel-sky/20 flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-pastel-lavender" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-200 mb-2">Visualize Your Data</h3>
            <p className="text-sm text-neutral-500 mb-4">
              Paste a public Google Sheets URL above to create interactive bar, line, or pie charts from your spreadsheet data.
            </p>
            <div className="text-xs text-neutral-600 space-y-1">
              <p>1. Open your Google Sheet</p>
              <p>2. Click Share → Anyone with the link → Viewer</p>
              <p>3. Copy the URL and paste above</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-pastel-lavender mx-auto mb-3" />
            <p className="text-sm text-neutral-400">Loading sheet data...</p>
          </div>
        </div>
      )}
    </div>
  );
}
