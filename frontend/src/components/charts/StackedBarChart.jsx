import { useEffect, useRef } from 'react';
import { CHART_COLORS, formatNumber, adjustColor } from './ChartUtils';

/**
 * Stacked Bar Chart Component
 * Used for: Pod Load & Output Snapshot, Credit Mix by Person, Due Date Change Reasons
 */
export default function StackedBarChart({
  data,
  stackKeys = [],
  width = 600,
  height = 400,
  showLegend = true,
  showValues = false,
  horizontal = false,
  colors = CHART_COLORS,
  referenceLine,
  title,
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
      bottom: showLegend ? 70 : 50,
      left: horizontal ? 100 : 60,
    };

    // Clear canvas
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, w, h);

    const chartWidth = w - padding.left - padding.right;
    const chartHeight = h - padding.top - padding.bottom;

    // Determine if this is a stacked chart
    const isStacked = stackKeys.length > 0;
    const keys = isStacked ? stackKeys : ['value'];

    // Calculate max value
    let maxValue = 0;
    data.forEach(d => {
      if (isStacked) {
        const total = keys.reduce((sum, key) => sum + (d[key] || 0), 0);
        if (total > maxValue) maxValue = total;
      } else {
        if (d.value > maxValue) maxValue = d.value;
      }
    });
    maxValue = maxValue || 1;

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
      const value = (maxValue * i) / gridLines;

      if (horizontal) {
        const x = padding.left + (chartWidth * i) / gridLines;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();

        ctx.fillStyle = '#737373';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(formatNumber(value), x, padding.top + chartHeight + 15);
      } else {
        const y = padding.top + chartHeight - (chartHeight * i) / gridLines;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        ctx.fillStyle = '#737373';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(formatNumber(value), padding.left - 8, y + 4);
      }
    }

    // Draw reference line
    if (referenceLine && referenceLine.value) {
      const refValue = referenceLine.value;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([5, 3]);

      if (horizontal) {
        const x = padding.left + (refValue / maxValue) * chartWidth;
        ctx.beginPath();
        ctx.moveTo(x, padding.top);
        ctx.lineTo(x, padding.top + chartHeight);
        ctx.stroke();
      } else {
        const y = padding.top + chartHeight - (refValue / maxValue) * chartHeight;
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(padding.left + chartWidth, y);
        ctx.stroke();

        if (referenceLine.label) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = '10px Inter, system-ui, sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(referenceLine.label, padding.left + chartWidth + 5, y + 4);
        }
      }
      ctx.setLineDash([]);
    }

    // Draw bars
    const barCount = data.length;
    const barGroupSize = horizontal ? chartHeight / barCount : chartWidth / barCount;
    const barPadding = barGroupSize * 0.15;
    const barSize = barGroupSize - barPadding * 2;

    data.forEach((d, idx) => {
      let stackOffset = 0;

      keys.forEach((key, keyIdx) => {
        const value = isStacked ? (d[key] || 0) : d.value;
        const barLength = (value / maxValue) * (horizontal ? chartWidth : chartHeight);
        const color = colors[keyIdx % colors.length];

        if (horizontal) {
          const y = padding.top + idx * barGroupSize + barPadding;
          const x = padding.left + stackOffset;

          // Draw bar with gradient
          const gradient = ctx.createLinearGradient(x, y, x + barLength, y);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, adjustColor(color, -20));
          ctx.fillStyle = gradient;

          // Rounded right corners for horizontal bars
          const radius = Math.min(3, barSize / 2);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x + barLength - radius, y);
          ctx.quadraticCurveTo(x + barLength, y, x + barLength, y + radius);
          ctx.lineTo(x + barLength, y + barSize - radius);
          ctx.quadraticCurveTo(x + barLength, y + barSize, x + barLength - radius, y + barSize);
          ctx.lineTo(x, y + barSize);
          ctx.closePath();
          ctx.fill();

          stackOffset += barLength;
        } else {
          const x = padding.left + idx * barGroupSize + barPadding;
          const barHeight = barLength;
          const y = padding.top + chartHeight - stackOffset - barHeight;

          // Draw bar with gradient
          const gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, color);
          gradient.addColorStop(1, adjustColor(color, -20));
          ctx.fillStyle = gradient;

          // Rounded top corners
          const radius = Math.min(3, barSize / 2);
          ctx.beginPath();
          ctx.moveTo(x + radius, y);
          ctx.lineTo(x + barSize - radius, y);
          ctx.quadraticCurveTo(x + barSize, y, x + barSize, y + radius);
          ctx.lineTo(x + barSize, y + barHeight);
          ctx.lineTo(x, y + barHeight);
          ctx.lineTo(x, y + radius);
          ctx.quadraticCurveTo(x, y, x + radius, y);
          ctx.fill();

          stackOffset += barHeight;
        }
      });

      // Draw labels
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '10px Inter, system-ui, sans-serif';

      const label = d.label?.length > 12 ? d.label.substring(0, 12) + '...' : d.label;

      if (horizontal) {
        ctx.textAlign = 'right';
        const y = padding.top + idx * barGroupSize + barPadding + barSize / 2 + 4;
        ctx.fillText(label, padding.left - 8, y);
      } else {
        ctx.textAlign = 'center';
        const x = padding.left + idx * barGroupSize + barPadding + barSize / 2;
        ctx.save();
        ctx.translate(x, padding.top + chartHeight + 12);
        ctx.rotate(-0.4);
        ctx.fillText(label, 0, 0);
        ctx.restore();
      }
    });

    // Draw legend
    if (showLegend && isStacked) {
      ctx.font = '10px Inter, system-ui, sans-serif';
      let legendX = padding.left;
      const legendY = h - 20;

      keys.forEach((key, idx) => {
        const color = colors[idx % colors.length];
        ctx.fillStyle = color;
        ctx.fillRect(legendX, legendY - 8, 12, 12);

        ctx.fillStyle = '#a3a3a3';
        ctx.textAlign = 'left';
        const text = key.length > 15 ? key.substring(0, 15) + '...' : key;
        ctx.fillText(text, legendX + 16, legendY);

        legendX += ctx.measureText(text).width + 30;
      });
    }
  }, [data, stackKeys, width, height, showLegend, showValues, horizontal, colors, referenceLine, title]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg"
    />
  );
}
