import { useEffect, useRef } from 'react';
import { formatNumber } from './ChartUtils';

/**
 * Heatmap Chart Component
 * Used for: Client × Pod Work Matrix
 */
export default function HeatmapChart({
  rows,
  cols,
  matrix,
  maxValue,
  title,
  rowLabel = 'Rows',
  colLabel = 'Columns',
  colorScale = ['#1a1a1a', '#a7f3d0'], // Dark to pastel-mint
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!rows || !cols || !matrix || !canvasRef.current) return;

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

    // Calculate cell size based on available space
    const maxRowLabelWidth = 100;
    const maxColLabelHeight = 60;
    const padding = { top: title ? 50 : 30, right: 20, bottom: 30, left: maxRowLabelWidth };

    const chartWidth = w - padding.left - padding.right;
    const chartHeight = h - padding.top - padding.bottom - maxColLabelHeight;

    const cellWidth = Math.max(30, Math.min(80, chartWidth / cols.length));
    const cellHeight = Math.max(25, Math.min(40, chartHeight / rows.length));

    // Clear canvas
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, w, h);

    // Draw title
    if (title) {
      ctx.fillStyle = '#e5e5e5';
      ctx.font = 'bold 13px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, 20);
    }

    // Helper to interpolate colors
    const interpolateColor = (value) => {
      const ratio = Math.min(1, value / (maxValue || 1));
      const r1 = parseInt(colorScale[0].slice(1, 3), 16);
      const g1 = parseInt(colorScale[0].slice(3, 5), 16);
      const b1 = parseInt(colorScale[0].slice(5, 7), 16);
      const r2 = parseInt(colorScale[1].slice(1, 3), 16);
      const g2 = parseInt(colorScale[1].slice(3, 5), 16);
      const b2 = parseInt(colorScale[1].slice(5, 7), 16);

      const r = Math.round(r1 + (r2 - r1) * ratio);
      const g = Math.round(g1 + (g2 - g1) * ratio);
      const b = Math.round(b1 + (b2 - b1) * ratio);

      return `rgb(${r}, ${g}, ${b})`;
    };

    // Draw column headers
    ctx.fillStyle = '#a3a3a3';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';

    cols.forEach((col, colIdx) => {
      const x = padding.left + colIdx * cellWidth + cellWidth / 2;
      const y = padding.top - 5;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-0.5);
      const label = col.length > 10 ? col.substring(0, 10) + '...' : col;
      ctx.fillText(label, 0, 0);
      ctx.restore();
    });

    // Draw cells and row labels
    rows.forEach((row, rowIdx) => {
      const y = padding.top + rowIdx * cellHeight;

      // Row label
      ctx.fillStyle = '#a3a3a3';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'right';
      const rowLabel = row.length > 12 ? row.substring(0, 12) + '...' : row;
      ctx.fillText(rowLabel, padding.left - 8, y + cellHeight / 2 + 4);

      // Cells
      cols.forEach((col, colIdx) => {
        const x = padding.left + colIdx * cellWidth;
        const value = matrix[row]?.[col] || 0;

        // Cell background
        ctx.fillStyle = interpolateColor(value);
        ctx.fillRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

        // Cell border
        ctx.strokeStyle = '#262626';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);

        // Cell value (only show if cell is big enough)
        if (cellWidth > 35 && cellHeight > 20 && value > 0) {
          // Determine text color based on background brightness
          const ratio = value / (maxValue || 1);
          ctx.fillStyle = ratio > 0.5 ? '#171717' : '#e5e5e5';
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(formatNumber(value, 0), x + cellWidth / 2, y + cellHeight / 2 + 3);
        }
      });
    });

    // Draw color legend
    const legendWidth = 100;
    const legendHeight = 10;
    const legendX = w - padding.right - legendWidth;
    const legendY = h - 20;

    // Legend gradient
    const gradient = ctx.createLinearGradient(legendX, 0, legendX + legendWidth, 0);
    gradient.addColorStop(0, colorScale[0]);
    gradient.addColorStop(1, colorScale[1]);
    ctx.fillStyle = gradient;
    ctx.fillRect(legendX, legendY, legendWidth, legendHeight);

    // Legend labels
    ctx.fillStyle = '#737373';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('0', legendX, legendY + legendHeight + 12);
    ctx.textAlign = 'right';
    ctx.fillText(formatNumber(maxValue), legendX + legendWidth, legendY + legendHeight + 12);
  }, [rows, cols, matrix, maxValue, title, rowLabel, colLabel, colorScale]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg"
    />
  );
}
