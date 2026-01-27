import { useEffect, useRef } from 'react';
import { CHART_COLORS, formatNumber, adjustColor } from './ChartUtils';

/**
 * Line Chart Component
 * Used for: Due Date Performance Trend Over Time
 */
export default function LineChart({
  data,
  series = [], // Array of { key, label, color }
  title,
  showPoints = true,
  showArea = false,
  showLegend = true,
  referenceLine,
  yAxisLabel,
  xAxisLabel,
  formatYAxis,
  colors = CHART_COLORS,
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!data || data.length === 0 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size with device pixel ratio
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const padding = {
      top: title ? 45 : 25,
      right: 20,
      bottom: showLegend ? 65 : 50,
      left: 60,
    };

    // Clear canvas
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, w, h);

    const chartWidth = w - padding.left - padding.right;
    const chartHeight = h - padding.top - padding.bottom;

    // Determine series to draw
    const seriesKeys = series.length > 0
      ? series
      : [{ key: 'value', label: 'Value', color: colors[0] }];

    // Calculate min/max values
    let minValue = Infinity;
    let maxValue = -Infinity;

    data.forEach(d => {
      seriesKeys.forEach(s => {
        const val = d[s.key];
        if (typeof val === 'number' && !isNaN(val)) {
          if (val < minValue) minValue = val;
          if (val > maxValue) maxValue = val;
        }
      });
    });

    // Add padding to range
    const range = maxValue - minValue || 1;
    minValue = Math.max(0, minValue - range * 0.1);
    maxValue = maxValue + range * 0.1;

    // Draw title
    if (title) {
      ctx.fillStyle = '#e5e5e5';
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, 20);
    }

    // Draw grid lines
    ctx.strokeStyle = '#404040';
    ctx.lineWidth = 0.5;
    const gridLines = 5;

    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight * i) / gridLines;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartWidth, y);
      ctx.stroke();

      // Y-axis labels
      const value = maxValue - ((maxValue - minValue) * i) / gridLines;
      ctx.fillStyle = '#737373';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      const labelText = formatYAxis ? formatYAxis(value) : formatNumber(value);
      ctx.fillText(labelText, padding.left - 8, y + 4);
    }

    // Draw reference line
    if (referenceLine && typeof referenceLine.value === 'number') {
      const refY = padding.top + chartHeight -
        ((referenceLine.value - minValue) / (maxValue - minValue)) * chartHeight;

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(padding.left, refY);
      ctx.lineTo(padding.left + chartWidth, refY);
      ctx.stroke();
      ctx.setLineDash([]);

      if (referenceLine.label) {
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(referenceLine.label, padding.left + chartWidth + 5, refY + 4);
      }
    }

    // Draw lines for each series
    seriesKeys.forEach((s, seriesIdx) => {
      const color = s.color || colors[seriesIdx % colors.length];
      const points = [];

      // Calculate point positions
      data.forEach((d, idx) => {
        const val = d[s.key];
        if (typeof val !== 'number' || isNaN(val)) return;

        const x = padding.left + (idx / (data.length - 1 || 1)) * chartWidth;
        const y = padding.top + chartHeight - ((val - minValue) / (maxValue - minValue)) * chartHeight;
        points.push({ x, y, value: val, label: d.label });
      });

      if (points.length === 0) return;

      // Draw area fill
      if (showArea) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, padding.top + chartHeight);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, padding.top + chartHeight);
        ctx.closePath();

        const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartHeight);
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '05');
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      // Draw line
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      points.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.stroke();

      // Draw points
      if (showPoints) {
        points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = '#171717';
          ctx.lineWidth = 2;
          ctx.stroke();
        });
      }
    });

    // X-axis labels
    ctx.fillStyle = '#737373';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    const maxLabels = Math.min(10, data.length);
    const labelStep = Math.ceil(data.length / maxLabels);

    data.forEach((d, idx) => {
      if (idx % labelStep !== 0 && idx !== data.length - 1) return;

      const x = padding.left + (idx / (data.length - 1 || 1)) * chartWidth;
      const label = d.label?.length > 8 ? d.label.substring(0, 8) + '...' : d.label;

      ctx.save();
      ctx.translate(x, padding.top + chartHeight + 15);
      ctx.rotate(-0.4);
      ctx.fillText(label || '', 0, 0);
      ctx.restore();
    });

    // Draw legend
    if (showLegend && seriesKeys.length > 1) {
      ctx.font = '10px Inter, system-ui, sans-serif';
      let legendX = padding.left;
      const legendY = h - 20;

      seriesKeys.forEach((s, idx) => {
        const color = s.color || colors[idx % colors.length];

        // Line sample
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(legendX, legendY - 3);
        ctx.lineTo(legendX + 20, legendY - 3);
        ctx.stroke();

        // Point
        ctx.beginPath();
        ctx.arc(legendX + 10, legendY - 3, 3, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Label
        ctx.fillStyle = '#a3a3a3';
        ctx.textAlign = 'left';
        ctx.fillText(s.label, legendX + 25, legendY);

        legendX += ctx.measureText(s.label).width + 45;
      });
    }
  }, [data, series, title, showPoints, showArea, showLegend, referenceLine, yAxisLabel, xAxisLabel, formatYAxis, colors]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg"
    />
  );
}
