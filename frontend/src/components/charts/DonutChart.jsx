import { useEffect, useRef } from 'react';
import { CHART_COLORS, formatNumber } from './ChartUtils';

/**
 * Donut Chart Component
 * Used for: On-Time Delivery Scorecard
 */
export default function DonutChart({
  data,
  title,
  showPercentages = true,
  showLegend = true,
  innerRadius = 0.6, // 0 = pie chart, 0.6 = donut
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
    const padding = { top: title ? 40 : 20, right: 20, bottom: showLegend ? 50 : 20, left: 20 };

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

    const chartHeight = h - padding.top - padding.bottom;
    const centerX = w / 2;
    const centerY = padding.top + chartHeight / 2;
    const outerRadius = Math.min(chartHeight / 2, (w - padding.left - padding.right) / 2) - 20;
    const innerRad = outerRadius * innerRadius;

    // Calculate total
    const total = data.reduce((sum, d) => sum + (d.value || 0), 0) || 1;

    // Draw slices
    let currentAngle = -Math.PI / 2; // Start from top

    data.forEach((d, idx) => {
      if (d.value <= 0) return;

      const sliceAngle = (d.value / total) * Math.PI * 2;
      const color = d.color || colors[idx % colors.length];

      // Draw slice
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, currentAngle, currentAngle + sliceAngle);
      ctx.arc(centerX, centerY, innerRad, currentAngle + sliceAngle, currentAngle, true);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();

      // Add subtle border
      ctx.strokeStyle = '#171717';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw percentage labels (for slices > 5%)
      if (showPercentages && d.value / total > 0.05) {
        const midAngle = currentAngle + sliceAngle / 2;
        const labelRadius = outerRadius * 0.75;
        const labelX = centerX + Math.cos(midAngle) * labelRadius;
        const labelY = centerY + Math.sin(midAngle) * labelRadius;

        const percentage = ((d.value / total) * 100).toFixed(0);
        ctx.fillStyle = '#171717';
        ctx.font = 'bold 11px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${percentage}%`, labelX, labelY + 4);
      }

      currentAngle += sliceAngle;
    });

    // Draw center text (total)
    if (innerRadius > 0.3) {
      ctx.fillStyle = '#e5e5e5';
      ctx.font = 'bold 18px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(formatNumber(total), centerX, centerY + 5);
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.fillStyle = '#737373';
      ctx.fillText('Total', centerX, centerY + 20);
    }

    // Draw legend
    if (showLegend) {
      ctx.font = '10px Inter, system-ui, sans-serif';
      const legendY = h - 25;
      let legendX = (w - data.length * 80) / 2; // Center legend

      data.forEach((d, idx) => {
        const color = d.color || colors[idx % colors.length];
        ctx.fillStyle = color;
        ctx.fillRect(legendX, legendY - 6, 10, 10);

        ctx.fillStyle = '#a3a3a3';
        ctx.textAlign = 'left';
        const label = d.label.length > 8 ? d.label.substring(0, 8) + '...' : d.label;
        ctx.fillText(label, legendX + 14, legendY);

        legendX += 80;
      });
    }
  }, [data, title, showPercentages, showLegend, innerRadius, colors]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%' }}
      className="rounded-lg"
    />
  );
}
