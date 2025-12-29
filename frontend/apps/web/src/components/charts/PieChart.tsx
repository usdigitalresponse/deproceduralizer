'use client';

import { useMemo } from 'react';
import * as d3Shape from 'd3-shape';
import { useChartColors } from '@/hooks/useChartColors';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';
import type { PieChartDatum } from '@/lib/charts/types';

interface PieChartProps {
  /** Data for the pie chart */
  data: PieChartDatum[];
  /** Chart width in pixels */
  width: number;
  /** Chart height in pixels */
  height: number;
  /** Inner radius ratio for donut chart (0 = pie, 0.5 = donut). Default: 0.5 */
  innerRadiusRatio?: number;
  /** Padding angle between slices in radians. Default: 0.02 */
  padAngle?: number;
  /** Corner radius for rounded slice edges. Default: 4 */
  cornerRadius?: number;
  /** Show value labels on slices. Default: false */
  showLabels?: boolean;
  /** Center content (for donut charts) */
  centerContent?: React.ReactNode;
  /** Additional class names for the SVG */
  className?: string;
  /** Callback when a slice is clicked */
  onSliceClick?: (datum: PieChartDatum, index: number) => void;
}

/**
 * Pie/Donut chart component using D3 for layout calculations and React for rendering.
 *
 * @example
 * ```tsx
 * <PieChart
 *   data={[
 *     { label: 'High', value: 42, color: '#b52c2c' },
 *     { label: 'Medium', value: 87, color: '#b45309' },
 *     { label: 'Low', value: 156, color: '#1e752e' },
 *   ]}
 *   width={300}
 *   height={300}
 *   innerRadiusRatio={0.6}
 *   centerContent={<span className="text-2xl font-bold">285</span>}
 * />
 * ```
 */
export function PieChart({
  data,
  width,
  height,
  innerRadiusRatio = 0.5,
  padAngle = 0.02,
  cornerRadius = 4,
  showLabels = false,
  centerContent,
  className = '',
  onSliceClick,
}: PieChartProps) {
  const colors = useChartColors();
  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<PieChartDatum>();

  // Calculate dimensions
  const radius = Math.min(width, height) / 2;
  const innerRadius = radius * innerRadiusRatio;

  // Create pie layout and arc generators
  const { arcs, arcGenerator, labelArcGenerator } = useMemo(() => {
    const pieGenerator = d3Shape
      .pie<PieChartDatum>()
      .value((d) => d.value)
      .sort(null)
      .padAngle(padAngle);

    const arcGen = d3Shape
      .arc<d3Shape.PieArcDatum<PieChartDatum>>()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(cornerRadius);

    // Arc generator for label positioning (centered on arc)
    const labelArcGen = d3Shape
      .arc<d3Shape.PieArcDatum<PieChartDatum>>()
      .innerRadius(innerRadius + (radius - innerRadius) * 0.6)
      .outerRadius(innerRadius + (radius - innerRadius) * 0.6);

    return {
      arcs: pieGenerator(data),
      arcGenerator: arcGen,
      labelArcGenerator: labelArcGen,
    };
  }, [data, radius, innerRadius, padAngle, cornerRadius]);

  // Calculate total for percentage display
  const total = useMemo(() => data.reduce((sum, d) => sum + d.value, 0), [data]);

  if (width === 0 || height === 0) return null;

  return (
    <>
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="Pie chart visualization"
      >
        <g transform={`translate(${width / 2}, ${height / 2})`}>
          {arcs.map((arc, index) => {
            const datum = arc.data;
            const color = datum.color ?? colors.categoryScale(datum.label);
            const path = arcGenerator(arc);
            const percentage = total > 0 ? ((datum.value / total) * 100).toFixed(1) : '0';

            return (
              <g key={datum.label}>
                <path
                  d={path ?? undefined}
                  fill={color}
                  className={`
                    transition-opacity duration-[var(--duration-fast)]
                    ${onSliceClick ? 'cursor-pointer' : ''}
                    hover:opacity-80
                  `
                    .trim()
                    .replace(/\s+/g, ' ')}
                  onMouseEnter={(e) => showTooltip(datum, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={hideTooltip}
                  onClick={() => onSliceClick?.(datum, index)}
                  role="graphics-symbol"
                  aria-label={`${datum.label}: ${datum.value} (${percentage}%)`}
                />
                {showLabels && datum.value > 0 && (
                  <text
                    transform={`translate(${labelArcGenerator.centroid(arc)})`}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-[var(--color-text-inverse)] pointer-events-none"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
                  >
                    {percentage}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Center content for donut charts */}
          {centerContent && innerRadiusRatio > 0 && (
            <foreignObject
              x={-innerRadius * 0.8}
              y={-innerRadius * 0.5}
              width={innerRadius * 1.6}
              height={innerRadius}
              className="pointer-events-none"
            >
              <div className="w-full h-full flex items-center justify-center text-center">
                {centerContent}
              </div>
            </foreignObject>
          )}
        </g>
      </svg>

      <ChartTooltip state={tooltip}>
        {(datum) => {
          const percentage = total > 0 ? ((datum.value / total) * 100).toFixed(1) : '0';
          return (
            <div className="space-y-1">
              <div className="font-medium">{datum.label}</div>
              <div className="text-[var(--color-neutral-300)]">
                {datum.value.toLocaleString()} ({percentage}%)
              </div>
            </div>
          );
        }}
      </ChartTooltip>
    </>
  );
}

/**
 * Severity distribution donut chart with preset styling.
 */
export function SeverityDonutChart({
  high,
  medium,
  low,
  notAnalyzed = 0,
  width,
  height,
  showTotal = true,
}: {
  high: number;
  medium: number;
  low: number;
  notAnalyzed?: number;
  width: number;
  height: number;
  showTotal?: boolean;
}) {
  const colors = useChartColors();
  const pieColors = colors.getSeverityPieColors();
  const total = high + medium + low;
  const grandTotal = total + notAnalyzed;

  const data: PieChartDatum[] = [
    { label: pieColors[0].label, value: high, color: pieColors[0].color },
    { label: pieColors[1].label, value: medium, color: pieColors[1].color },
    { label: pieColors[2].label, value: low, color: pieColors[2].color },
  ];

  if (notAnalyzed > 0) {
    data.push({ label: pieColors[3].label, value: notAnalyzed, color: pieColors[3].color });
  }

  return (
    <PieChart
      data={data}
      width={width}
      height={height}
      innerRadiusRatio={0.6}
      centerContent={
        showTotal ? (
          <div className="flex flex-col items-center">
            <span className="text-2xl font-bold text-[var(--color-text)]">
              {grandTotal.toLocaleString()}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">Total</span>
          </div>
        ) : undefined
      }
    />
  );
}
