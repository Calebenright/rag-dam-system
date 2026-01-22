import { useState } from 'react';
import {
  BarChart3, LineChart, PieChart, TrendingUp, TrendingDown,
  Plus, MoreHorizontal, RefreshCw, Settings, Maximize2,
  Calendar, Filter, Download, Share2, Grip, X,
  Activity, Users, DollarSign, Target, Zap, Eye
} from 'lucide-react';
import clsx from 'clsx';

// Sample widget types for Databox-style dashboard
const WIDGET_TYPES = [
  { id: 'metric', name: 'Metric', icon: Target },
  { id: 'line-chart', name: 'Line Chart', icon: LineChart },
  { id: 'bar-chart', name: 'Bar Chart', icon: BarChart3 },
  { id: 'pie-chart', name: 'Pie Chart', icon: PieChart },
  { id: 'goal', name: 'Goal Tracker', icon: Activity },
];

// Sample data sources
const DATA_SOURCES = [
  { id: 'google-analytics', name: 'Google Analytics', icon: '📊', connected: false },
  { id: 'hubspot', name: 'HubSpot', icon: '🧲', connected: false },
  { id: 'salesforce', name: 'Salesforce', icon: '☁️', connected: false },
  { id: 'stripe', name: 'Stripe', icon: '💳', connected: false },
  { id: 'manual', name: 'Manual Entry', icon: '✏️', connected: true },
];

// Sample widgets for demo
const SAMPLE_WIDGETS = [
  {
    id: 'w1',
    type: 'metric',
    title: 'Total Revenue',
    value: '$124,500',
    change: 12.5,
    changeType: 'increase',
    period: 'vs last month',
    icon: DollarSign,
    color: 'green',
    size: 'small',
  },
  {
    id: 'w2',
    type: 'metric',
    title: 'Active Users',
    value: '2,847',
    change: 8.2,
    changeType: 'increase',
    period: 'vs last month',
    icon: Users,
    color: 'cyan',
    size: 'small',
  },
  {
    id: 'w3',
    type: 'metric',
    title: 'Conversion Rate',
    value: '3.24%',
    change: -2.1,
    changeType: 'decrease',
    period: 'vs last month',
    icon: Target,
    color: 'purple',
    size: 'small',
  },
  {
    id: 'w4',
    type: 'metric',
    title: 'Page Views',
    value: '89.2K',
    change: 15.7,
    changeType: 'increase',
    period: 'vs last month',
    icon: Eye,
    color: 'pink',
    size: 'small',
  },
  {
    id: 'w5',
    type: 'line-chart',
    title: 'Revenue Over Time',
    size: 'large',
    data: [30, 45, 35, 50, 49, 60, 70, 65, 80, 85, 90, 95],
  },
  {
    id: 'w6',
    type: 'bar-chart',
    title: 'Traffic by Source',
    size: 'medium',
    data: [
      { label: 'Organic', value: 45 },
      { label: 'Direct', value: 28 },
      { label: 'Social', value: 18 },
      { label: 'Referral', value: 9 },
    ],
  },
  {
    id: 'w7',
    type: 'goal',
    title: 'Monthly Goal',
    current: 78500,
    target: 100000,
    size: 'medium',
  },
];

// Simple sparkline component
function Sparkline({ data, color = 'cyan' }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 120;
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10">
      <polyline
        fill="none"
        stroke={`var(--color-accent-${color})`}
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

// Simple bar chart component
function SimpleBarChart({ data }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div className="space-y-2">
      {data.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="text-xs text-gray-400 w-16 truncate">{item.label}</span>
          <div className="flex-1 h-4 bg-dark-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-accent-cyan to-accent-purple rounded-full transition-all"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-300 w-8 text-right">{item.value}%</span>
        </div>
      ))}
    </div>
  );
}

// Goal progress component
function GoalProgress({ current, target }) {
  const percentage = Math.round((current / target) * 100);
  const radius = 45;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <svg className="w-28 h-28 -rotate-90">
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-dark-700"
          />
          <circle
            cx="56"
            cy="56"
            r={radius}
            stroke="url(#gradient)"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-500"
          />
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-accent-cyan)" />
              <stop offset="100%" stopColor="var(--color-accent-purple)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-100">{percentage}%</span>
          <span className="text-xs text-gray-500">of goal</span>
        </div>
      </div>
    </div>
  );
}

// Widget component
function Widget({ widget, onRemove }) {
  const getColorClasses = (color) => {
    const colors = {
      green: 'text-accent-green bg-accent-green/10',
      cyan: 'text-accent-cyan bg-accent-cyan/10',
      purple: 'text-accent-purple bg-accent-purple/10',
      pink: 'text-accent-pink bg-accent-pink/10',
    };
    return colors[color] || colors.cyan;
  };

  const getSizeClasses = (size) => {
    const sizes = {
      small: 'col-span-1',
      medium: 'col-span-1 md:col-span-2',
      large: 'col-span-1 md:col-span-2 lg:col-span-3',
    };
    return sizes[size] || sizes.small;
  };

  return (
    <div className={clsx(
      'bg-dark-800/50 border border-dark-700 rounded-xl p-4 hover:border-dark-600 transition-all group',
      getSizeClasses(widget.size)
    )}>
      {/* Widget header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Grip className="w-4 h-4 text-gray-600 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity" />
          <h3 className="text-sm font-medium text-gray-300">{widget.title}</h3>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-1 text-gray-500 hover:text-gray-300 hover:bg-dark-700 rounded">
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            onClick={() => onRemove?.(widget.id)}
            className="p-1 text-gray-500 hover:text-red-400 hover:bg-dark-700 rounded"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Widget content */}
      {widget.type === 'metric' && (
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-gray-100">{widget.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {widget.changeType === 'increase' ? (
                <TrendingUp className="w-4 h-4 text-accent-green" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-400" />
              )}
              <span className={widget.changeType === 'increase' ? 'text-accent-green' : 'text-red-400'}>
                {widget.change > 0 ? '+' : ''}{widget.change}%
              </span>
              <span className="text-gray-500 text-xs">{widget.period}</span>
            </div>
          </div>
          {widget.icon && (
            <div className={clsx('p-3 rounded-xl', getColorClasses(widget.color))}>
              <widget.icon className="w-6 h-6" />
            </div>
          )}
        </div>
      )}

      {widget.type === 'line-chart' && widget.data && (
        <div>
          <Sparkline data={widget.data} />
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>Jan</span>
            <span>Dec</span>
          </div>
        </div>
      )}

      {widget.type === 'bar-chart' && widget.data && (
        <SimpleBarChart data={widget.data} />
      )}

      {widget.type === 'goal' && (
        <div className="flex flex-col items-center">
          <GoalProgress current={widget.current} target={widget.target} />
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-300">
              ${widget.current.toLocaleString()} <span className="text-gray-500">of ${widget.target.toLocaleString()}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DataDashboard({ clientId, client }) {
  const [widgets, setWidgets] = useState(SAMPLE_WIDGETS);
  const [showAddWidget, setShowAddWidget] = useState(false);
  const [showConnectSource, setShowConnectSource] = useState(false);
  const [dateRange, setDateRange] = useState('30d');

  const removeWidget = (widgetId) => {
    setWidgets(widgets.filter(w => w.id !== widgetId));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="bg-dark-900/50 border-b border-dark-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-100">Data Dashboard</h2>
            <span className="text-sm text-gray-500">•</span>
            <span className="text-sm text-gray-400">{widgets.length} widgets</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Date Range */}
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="px-3 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-sm text-gray-300 focus:border-accent-cyan focus:outline-none"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
            </select>

            <button className="p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-800 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>

            <button className="p-2 text-gray-400 hover:text-gray-300 hover:bg-dark-800 rounded-lg">
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={() => setShowConnectSource(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 border border-dark-700 text-gray-300 rounded-lg hover:border-accent-purple transition-all text-sm"
            >
              <Zap className="w-4 h-4" />
              Connect Data
            </button>

            <button
              onClick={() => setShowAddWidget(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-accent-purple/20 text-accent-purple rounded-lg hover:bg-accent-purple/30 transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
          </div>
        </div>
      </div>

      {/* Dashboard Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {widgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="p-6 bg-gradient-to-br from-accent-purple/20 to-accent-cyan/20 rounded-2xl mb-4">
              <BarChart3 className="w-16 h-16 text-accent-purple" />
            </div>
            <h3 className="text-xl font-semibold text-gray-100 mb-2">No widgets yet</h3>
            <p className="text-gray-400 mb-6 max-w-md">
              Connect your data sources and add widgets to build your custom dashboard
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConnectSource(true)}
                className="flex items-center gap-2 px-4 py-2 bg-dark-800 border border-dark-700 text-gray-300 rounded-lg hover:border-accent-cyan transition-all"
              >
                <Zap className="w-4 h-4" />
                Connect Data Source
              </button>
              <button
                onClick={() => setShowAddWidget(true)}
                className="flex items-center gap-2 px-4 py-2 bg-accent-purple text-white rounded-lg hover:bg-accent-purple/80 transition-all"
              >
                <Plus className="w-4 h-4" />
                Add Widget
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {widgets.map((widget) => (
              <Widget key={widget.id} widget={widget} onRemove={removeWidget} />
            ))}
          </div>
        )}
      </div>

      {/* Add Widget Modal */}
      {showAddWidget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Add Widget</h3>
              <button
                onClick={() => setShowAddWidget(false)}
                className="p-1 text-gray-400 hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {WIDGET_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    const newWidget = {
                      id: `w${Date.now()}`,
                      type: type.id,
                      title: `New ${type.name}`,
                      size: type.id === 'metric' ? 'small' : 'medium',
                      value: type.id === 'metric' ? '0' : undefined,
                      data: type.id.includes('chart') ? [10, 20, 15, 30, 25, 40] : undefined,
                      current: type.id === 'goal' ? 0 : undefined,
                      target: type.id === 'goal' ? 100 : undefined,
                    };
                    setWidgets([...widgets, newWidget]);
                    setShowAddWidget(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 bg-dark-800/50 border border-dark-700 rounded-lg hover:border-accent-purple transition-all"
                >
                  <div className="p-2 bg-accent-purple/10 text-accent-purple rounded-lg">
                    <type.icon className="w-5 h-5" />
                  </div>
                  <span className="text-gray-200">{type.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Connect Data Source Modal */}
      {showConnectSource && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-dark-900 border border-dark-700 rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-100">Connect Data Source</h3>
              <button
                onClick={() => setShowConnectSource(false)}
                className="p-1 text-gray-400 hover:text-gray-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {DATA_SOURCES.map((source) => (
                <button
                  key={source.id}
                  className="w-full flex items-center justify-between p-3 bg-dark-800/50 border border-dark-700 rounded-lg hover:border-accent-cyan transition-all"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{source.icon}</span>
                    <span className="text-gray-200">{source.name}</span>
                  </div>
                  {source.connected ? (
                    <span className="px-2 py-0.5 text-xs bg-accent-green/20 text-accent-green rounded-full">
                      Connected
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-dark-700 text-gray-400 rounded-full">
                      Connect
                    </span>
                  )}
                </button>
              ))}
            </div>

            <p className="mt-4 text-xs text-gray-500 text-center">
              More integrations coming soon
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
