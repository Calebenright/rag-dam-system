import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatNumber, formatPercent } from './ChartUtils';
import clsx from 'clsx';

/**
 * KPI Widget Component
 * Used for: Credits Completed vs Planned, single metric displays
 */
export default function KPIWidget({
  title,
  value,
  previousValue,
  format = 'number', // 'number', 'percent', 'currency'
  prefix = '',
  suffix = '',
  trend, // 'up', 'down', 'neutral'
  trendLabel,
  color = 'mint', // 'mint', 'sky', 'lavender', 'peach', 'coral'
  size = 'medium', // 'small', 'medium', 'large'
}) {
  // Format the value
  const formatValue = (val) => {
    if (val === null || val === undefined) return '-';

    switch (format) {
      case 'percent':
        return formatPercent(val);
      case 'currency':
        return `$${formatNumber(val)}`;
      default:
        return formatNumber(val);
    }
  };

  // Calculate trend if not provided
  const calculatedTrend = trend || (previousValue !== undefined
    ? value > previousValue ? 'up' : value < previousValue ? 'down' : 'neutral'
    : null);

  // Calculate percentage change
  const percentChange = previousValue && previousValue !== 0
    ? ((value - previousValue) / previousValue * 100).toFixed(1)
    : null;

  const colorClasses = {
    mint: {
      bg: 'bg-success-500/10',
      border: 'border-success-500/20',
      text: 'text-success-500',
      accent: 'text-success-500',
    },
    sky: {
      bg: 'bg-blue-300/10',
      border: 'border-blue-300/20',
      text: 'text-blue-300',
      accent: 'text-blue-300',
    },
    lavender: {
      bg: 'bg-purple-300/10',
      border: 'border-purple-300/20',
      text: 'text-purple-300',
      accent: 'text-purple-300',
    },
    peach: {
      bg: 'bg-red-300/10',
      border: 'border-red-300/20',
      text: 'text-red-300',
      accent: 'text-red-300',
    },
    coral: {
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      text: 'text-red-500',
      accent: 'text-red-500',
    },
  };

  const sizeClasses = {
    small: {
      container: 'p-3',
      title: 'text-xs',
      value: 'text-xl',
      trend: 'text-xs',
    },
    medium: {
      container: 'p-4',
      title: 'text-sm',
      value: 'text-3xl',
      trend: 'text-sm',
    },
    large: {
      container: 'p-5',
      title: 'text-base',
      value: 'text-4xl',
      trend: 'text-base',
    },
  };

  const colors = colorClasses[color] || colorClasses.mint;
  const sizes = sizeClasses[size] || sizeClasses.medium;

  const TrendIcon = calculatedTrend === 'up'
    ? TrendingUp
    : calculatedTrend === 'down'
      ? TrendingDown
      : Minus;

  const trendColor = calculatedTrend === 'up'
    ? 'text-success-500'
    : calculatedTrend === 'down'
      ? 'text-red-500'
      : 'text-neutral-500';

  return (
    <div className={clsx(
      'rounded-xl border',
      colors.bg,
      colors.border,
      sizes.container,
    )}>
      {/* Title */}
      <p className={clsx('text-neutral-400 font-medium mb-1', sizes.title)}>
        {title}
      </p>

      {/* Value */}
      <div className="flex items-baseline gap-2">
        <span className={clsx('font-bold', colors.text, sizes.value)}>
          {prefix}{formatValue(value)}{suffix}
        </span>
      </div>

      {/* Trend */}
      {(calculatedTrend || trendLabel) && (
        <div className={clsx('flex items-center gap-1 mt-2', sizes.trend)}>
          {calculatedTrend && (
            <TrendIcon className={clsx('w-4 h-4', trendColor)} />
          )}
          {percentChange && (
            <span className={trendColor}>
              {percentChange > 0 ? '+' : ''}{percentChange}%
            </span>
          )}
          {trendLabel && (
            <span className="text-neutral-500 ml-1">{trendLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}
