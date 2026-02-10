// Chart color palette matching the app's design
export const CHART_COLORS = [
  '#a7f3d0', // pastel-mint
  '#93c5fd', // pastel-sky
  '#c4b5fd', // pastel-lavender
  '#fcd9bd', // pastel-peach
  '#fca5a5', // pastel-coral
  '#fde68a', // yellow
  '#6ee7b7', // emerald
  '#f9a8d4', // pink
  '#67e8f9', // cyan
  '#a5b4fc', // indigo
];

// Format numbers for display
export const formatNumber = (num, decimals = 1) => {
  if (num === null || num === undefined) return '-';
  if (typeof num !== 'number') num = parseFloat(num);
  if (isNaN(num)) return '-';

  if (Math.abs(num) >= 1000000) return (num / 1000000).toFixed(decimals) + 'M';
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(decimals) + 'K';
  return num % 1 === 0 ? num.toString() : num.toFixed(decimals);
};

// Format percentage
export const formatPercent = (num, decimals = 1) => {
  if (num === null || num === undefined) return '-';
  return `${(num * 100).toFixed(decimals)}%`;
};

// Adjust color brightness
export const adjustColor = (hex, amount) => {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0x0000ff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
};

// Data aggregation functions
export const aggregators = {
  sum: (values) => values.reduce((a, b) => a + (parseFloat(b) || 0), 0),
  count: (values) => values.length,
  avg: (values) => {
    const nums = values.map(v => parseFloat(v)).filter(v => !isNaN(v));
    return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
  },
  min: (values) => Math.min(...values.map(v => parseFloat(v)).filter(v => !isNaN(v))),
  max: (values) => Math.max(...values.map(v => parseFloat(v)).filter(v => !isNaN(v))),
};

// Group data by a field
export const groupBy = (data, field) => {
  return data.reduce((acc, row) => {
    const key = row[field] || 'Unknown';
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
};

// Apply filters to data
export const applyFilters = (data, filters) => {
  if (!filters || filters.length === 0) return data;

  return data.filter(row => {
    return filters.every(filter => {
      const value = row[filter.field];
      const filterValue = filter.value;

      switch (filter.operator) {
        case '=':
        case '==':
          return value == filterValue;
        case '!=':
          return value != filterValue;
        case '>':
          return parseFloat(value) > parseFloat(filterValue);
        case '>=':
          return parseFloat(value) >= parseFloat(filterValue);
        case '<':
          return parseFloat(value) < parseFloat(filterValue);
        case '<=':
          return parseFloat(value) <= parseFloat(filterValue);
        case 'contains':
          return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
        case 'startsWith':
          return String(value).toLowerCase().startsWith(String(filterValue).toLowerCase());
        case 'in':
          return Array.isArray(filterValue) ? filterValue.includes(value) : false;
        case 'date_gte': {
          const d = new Date(value);
          const fd = new Date(filterValue);
          return !isNaN(d.getTime()) && d >= fd;
        }
        case 'date_lte': {
          const d = new Date(value);
          const fd = new Date(filterValue);
          return !isNaN(d.getTime()) && d <= fd;
        }
        default:
          return true;
      }
    });
  });
};

// Process data for visualization
export const processDataForChart = (data, config) => {
  const {
    primaryMetric,
    groupBy: groupField,
    stackBy,
    aggregation = 'sum',
    filters = [],
    sortBy = 'value',
    sortOrder = 'desc',
    limit = 20,
  } = config;

  // Apply filters
  let filteredData = applyFilters(data, filters);

  // Group by primary dimension
  const grouped = groupBy(filteredData, groupField);

  // Calculate aggregations
  let chartData = Object.entries(grouped).map(([label, rows]) => {
    const result = { label };

    if (stackBy) {
      // Group by stack dimension
      const stacked = groupBy(rows, stackBy);
      Object.entries(stacked).forEach(([stackLabel, stackRows]) => {
        const values = stackRows.map(r => r[primaryMetric]);
        result[stackLabel] = aggregators[aggregation](values);
      });
      // Calculate total for sorting
      result._total = Object.keys(result)
        .filter(k => k !== 'label' && k !== '_total')
        .reduce((sum, k) => sum + (result[k] || 0), 0);
    } else {
      const values = rows.map(r => r[primaryMetric]);
      result.value = aggregators[aggregation](values);
    }

    return result;
  });

  // Sort
  if (sortBy === 'value') {
    chartData.sort((a, b) => {
      const aVal = stackBy ? a._total : a.value;
      const bVal = stackBy ? b._total : b.value;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  } else if (sortBy === 'label') {
    chartData.sort((a, b) => {
      return sortOrder === 'desc'
        ? b.label.localeCompare(a.label)
        : a.label.localeCompare(b.label);
    });
  }

  // Limit
  if (limit > 0) {
    chartData = chartData.slice(0, limit);
  }

  // Get stack keys (unique values in stack dimension)
  let stackKeys = [];
  if (stackBy) {
    const allStackKeys = new Set();
    filteredData.forEach(row => {
      if (row[stackBy]) allStackKeys.add(row[stackBy]);
    });
    stackKeys = Array.from(allStackKeys);
  }

  return { chartData, stackKeys };
};

// Generate heatmap data
export const processHeatmapData = (data, config) => {
  const { rowField, colField, valueField, aggregation = 'sum', filters = [] } = config;

  const filteredData = applyFilters(data, filters);

  // Get unique rows and columns
  const rows = [...new Set(filteredData.map(d => d[rowField]))].filter(Boolean);
  const cols = [...new Set(filteredData.map(d => d[colField]))].filter(Boolean);

  // Build matrix
  const matrix = {};
  let maxValue = 0;

  rows.forEach(row => {
    matrix[row] = {};
    cols.forEach(col => {
      const matchingRows = filteredData.filter(
        d => d[rowField] === row && d[colField] === col
      );
      const values = matchingRows.map(r => r[valueField]);
      const aggregated = aggregators[aggregation](values);
      matrix[row][col] = aggregated;
      if (aggregated > maxValue) maxValue = aggregated;
    });
  });

  return { rows, cols, matrix, maxValue };
};

// Calculate date-based aggregations
export const groupByTimePeriod = (data, dateField, period = 'week') => {
  return data.reduce((acc, row) => {
    const date = new Date(row[dateField]);
    if (isNaN(date.getTime())) return acc;

    let key;
    switch (period) {
      case 'day':
        key = date.toISOString().split('T')[0];
        break;
      case 'week':
        const startOfWeek = new Date(date);
        startOfWeek.setDate(date.getDate() - date.getDay());
        key = startOfWeek.toISOString().split('T')[0];
        break;
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        break;
      case 'quarter':
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        key = `${date.getFullYear()}-Q${quarter}`;
        break;
      case 'year':
        key = String(date.getFullYear());
        break;
      default:
        key = date.toISOString().split('T')[0];
    }

    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
};
