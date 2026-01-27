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
      bg: 'bg-pastel-mint/10',
      border: 'border-pastel-mint/20',
      text: 'text-pastel-mint',
      accent: 'text-pastel-mint',
    },
    sky: {
      bg: 'bg-pastel-sky/10',
      border: 'border-pastel-sky/20',
      text: 'text-pastel-sky',
      accent: 'text-pastel-sky',
    },
    lavender: {
      bg: 'bg-pastel-lavender/10',
      border: 'border-pastel-lavender/20',
      text: 'text-pastel-lavender',
      accent: 'text-pastel-lavender',
    },
    peach: {
      bg: 'bg-pastel-peach/10',
      border: 'border-pastel-peach/20',
      text: 'text-pastel-peach',
      accent: 'text-pastel-peach',
    },
    coral: {
      bg: 'bg-pastel-coral/10',
      border: 'border-pastel-coral/20',
      text: 'text-pastel-coral',
      accent: 'text-pastel-coral',
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
    ? 'text-pastel-mint'
    : calculatedTrend === 'down'
      ? 'text-pastel-coral'
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
