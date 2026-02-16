'use client';

import { useMemo } from 'react';
import * as d3Scale from 'd3-scale';
import * as d3Interpolate from 'd3-interpolate';
import { useChartColors } from '@/hooks/useChartColors';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';
import type { HeatmapData, HeatmapCell } from '@/lib/charts/types';

interface HeatmapGridProps {
  /** Heatmap data with rows, columns, cells, and maxValue */
  data: HeatmapData;
  /** Chart width in pixels */
  width: number;
  /** Chart height in pixels */
  height: number;
  /** Additional class names for the SVG */
  className?: string;
}

const MARGIN = {
  top: 60,
  right: 20,
  bottom: 20,
  left: 120,
};

/**
 * Heatmap grid chart using D3 for scale calculations and React for rendering.
 * Displays a matrix of colored cells with row labels on the left and column
 * labels on top. Color intensity encodes the cell value.
 *
 * @example
 * ```tsx
 * <HeatmapGrid
 *   data={{
 *     rows: ['burdensome', 'justified'],
 *     columns: ['burdensome', 'justified', 'unclear'],
 *     cells: [
 *       { row: 'burdensome', column: 'burdensome', value: 42 },
 *       { row: 'burdensome', column: 'justified', value: 5 },
 *     ],
 *     maxValue: 42,
 *   }}
 *   width={500}
 *   height={300}
 * />
 * ```
 */
export function HeatmapGrid({ data, width, height, className = '' }: HeatmapGridProps) {
  const { colors, getContrastColor } = useChartColors();
  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<HeatmapCell>();

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = Math.max(0, height - MARGIN.top - MARGIN.bottom);

  // Build a lookup map for fast cell access
  const cellMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const cell of data.cells) {
      map.set(`${cell.row}__${cell.column}`, cell.value);
    }
    return map;
  }, [data.cells]);

  // Create scales
  const { rowScale, columnScale, colorScale } = useMemo(() => {
    return {
      rowScale: d3Scale
        .scaleBand<string>()
        .domain(data.rows)
        .range([0, innerHeight])
        .padding(0.05),
      columnScale: d3Scale
        .scaleBand<string>()
        .domain(data.columns)
        .range([0, innerWidth])
        .padding(0.05),
      colorScale: d3Scale
        .scaleSequential<string>()
        .domain([0, data.maxValue])
        .interpolator(
          d3Interpolate.interpolateRgbBasis([
            colors.primaryWeaker,
            colors.warning,
            colors.danger,
          ])
        ),
    };
  }, [data.rows, data.columns, data.maxValue, innerWidth, innerHeight, colors]);

  if (width === 0 || height === 0 || data.rows.length === 0 || data.columns.length === 0) {
    return null;
  }

  return (
    <>
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="Heatmap grid visualization"
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Column labels (top) */}
          <g>
            {data.columns.map((col) => (
              <text
                key={col}
                x={(columnScale(col) ?? 0) + columnScale.bandwidth() / 2}
                y={-10}
                textAnchor="middle"
                dominantBaseline="auto"
                className="text-xs fill-[var(--color-text-muted)]"
              >
                {truncateLabel(col, 14)}
              </text>
            ))}
          </g>

          {/* Row labels (left) */}
          <g>
            {data.rows.map((row) => (
              <text
                key={row}
                x={-10}
                y={(rowScale(row) ?? 0) + rowScale.bandwidth() / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="text-xs fill-[var(--color-text-muted)]"
              >
                {truncateLabel(row, 16)}
              </text>
            ))}
          </g>

          {/* Grid cells */}
          {data.rows.map((row) =>
            data.columns.map((col) => {
              const value = cellMap.get(`${row}__${col}`) ?? 0;
              const x = columnScale(col) ?? 0;
              const y = rowScale(row) ?? 0;
              const cellWidth = columnScale.bandwidth();
              const cellHeight = rowScale.bandwidth();
              const fillColor = value > 0 ? colorScale(value) : 'var(--color-neutral-100)';
              const textColor =
                value > 0 ? getContrastColor(colorScale(value)) : 'var(--color-text-muted)';

              return (
                <g key={`${row}__${col}`}>
                  <rect
                    x={x}
                    y={y}
                    width={cellWidth}
                    height={cellHeight}
                    fill={fillColor}
                    rx={4}
                    stroke="var(--color-neutral-200)"
                    strokeWidth={1}
                    className="transition-opacity duration-[var(--duration-fast)] hover:opacity-80"
                    onMouseEnter={(e) => showTooltip({ row, column: col, value }, e)}
                    onMouseMove={handleMouseMove}
                    onMouseLeave={hideTooltip}
                    role="graphics-symbol"
                    aria-label={`${row} / ${col}: ${value}`}
                  />
                  {cellWidth > 24 && cellHeight > 16 && (
                    <text
                      x={x + cellWidth / 2}
                      y={y + cellHeight / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={textColor}
                      className="text-xs font-medium pointer-events-none"
                    >
                      {value}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </g>
      </svg>

      <ChartTooltip state={tooltip}>
        {(cell) => (
          <div className="space-y-1">
            <div className="font-medium">
              {cell.row} → {cell.column}
            </div>
            <div className="text-[var(--color-neutral-300)]">
              Count: {cell.value.toLocaleString()}
            </div>
          </div>
        )}
      </ChartTooltip>
    </>
  );
}

function truncateLabel(label: string, maxLength: number): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label;
}
