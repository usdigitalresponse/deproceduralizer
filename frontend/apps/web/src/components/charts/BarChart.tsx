'use client';

import { useMemo } from 'react';
import * as d3Scale from 'd3-scale';
import * as d3Array from 'd3-array';
import { useChartColors } from '@/hooks/useChartColors';
import { useChartTooltip, ChartTooltip } from './ChartTooltip';
import type { BarChartDatum, BarOrientation, ChartMargin } from '@/lib/charts/types';

interface BarChartProps {
  /** Data for the bar chart */
  data: BarChartDatum[];
  /** Chart width in pixels */
  width: number;
  /** Chart height in pixels */
  height: number;
  /** Bar orientation. Default: 'vertical' */
  orientation?: BarOrientation;
  /** Chart margins */
  margin?: ChartMargin;
  /** Gap between bars as a ratio (0-1). Default: 0.2 */
  barPadding?: number;
  /** Show value labels on bars. Default: true */
  showLabels?: boolean;
  /** Maximum number of bars to show. Default: all */
  maxBars?: number;
  /** Sort bars by value. Default: 'none' */
  sortOrder?: 'none' | 'ascending' | 'descending';
  /** Additional class names for the SVG */
  className?: string;
  /** Callback when a bar is clicked */
  onBarClick?: (datum: BarChartDatum, index: number) => void;
}

const DEFAULT_MARGIN: ChartMargin = {
  top: 20,
  right: 20,
  bottom: 40,
  left: 60,
};

/**
 * Bar chart component using D3 for scale calculations and React for rendering.
 * Supports both vertical and horizontal orientations.
 *
 * @example
 * ```tsx
 * <BarChart
 *   data={[
 *     { label: 'January', value: 42 },
 *     { label: 'February', value: 87 },
 *     { label: 'March', value: 156 },
 *   ]}
 *   width={400}
 *   height={300}
 *   orientation="vertical"
 * />
 * ```
 */
export function BarChart({
  data,
  width,
  height,
  orientation = 'vertical',
  margin = DEFAULT_MARGIN,
  barPadding = 0.2,
  showLabels = true,
  maxBars,
  sortOrder = 'none',
  className = '',
  onBarClick,
}: BarChartProps) {
  const colors = useChartColors();
  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<BarChartDatum>();

  // Calculate inner dimensions
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  // Process and sort data
  const processedData = useMemo(() => {
    let result = [...data];

    if (sortOrder === 'ascending') {
      result.sort((a, b) => a.value - b.value);
    } else if (sortOrder === 'descending') {
      result.sort((a, b) => b.value - a.value);
    }

    if (maxBars && result.length > maxBars) {
      result = result.slice(0, maxBars);
    }

    return result;
  }, [data, sortOrder, maxBars]);

  // Create scales
  const { categoryScale, valueScale } = useMemo(() => {
    const maxValue = d3Array.max(processedData, (d) => d.value) ?? 0;

    if (orientation === 'horizontal') {
      return {
        categoryScale: d3Scale
          .scaleBand<string>()
          .domain(processedData.map((d) => d.label))
          .range([0, innerHeight])
          .padding(barPadding),
        valueScale: d3Scale
          .scaleLinear()
          .domain([0, maxValue * 1.1])
          .range([0, innerWidth])
          .nice(),
      };
    }

    return {
      categoryScale: d3Scale
        .scaleBand<string>()
        .domain(processedData.map((d) => d.label))
        .range([0, innerWidth])
        .padding(barPadding),
      valueScale: d3Scale
        .scaleLinear()
        .domain([0, maxValue * 1.1])
        .range([innerHeight, 0])
        .nice(),
    };
  }, [processedData, innerWidth, innerHeight, barPadding, orientation]);

  if (width === 0 || height === 0 || processedData.length === 0) return null;

  const isHorizontal = orientation === 'horizontal';

  return (
    <>
      <svg
        width={width}
        height={height}
        className={className}
        role="img"
        aria-label="Bar chart visualization"
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          <g className="text-[var(--color-neutral-200)]">
            {(isHorizontal ? valueScale.ticks(5) : valueScale.ticks(5)).map((tick) => (
              <line
                key={tick}
                x1={isHorizontal ? valueScale(tick) : 0}
                y1={isHorizontal ? 0 : valueScale(tick)}
                x2={isHorizontal ? valueScale(tick) : innerWidth}
                y2={isHorizontal ? innerHeight : valueScale(tick)}
                stroke="currentColor"
                strokeDasharray="4,4"
              />
            ))}
          </g>

          {/* Bars */}
          {processedData.map((datum, index) => {
            const color = datum.color ?? colors.categoryScale(datum.label);
            const barWidth = categoryScale.bandwidth();

            let x: number, y: number, barHeight: number, rectWidth: number;

            if (isHorizontal) {
              x = 0;
              y = categoryScale(datum.label) ?? 0;
              rectWidth = valueScale(datum.value);
              barHeight = barWidth;
            } else {
              x = categoryScale(datum.label) ?? 0;
              y = valueScale(datum.value);
              rectWidth = barWidth;
              barHeight = innerHeight - valueScale(datum.value);
            }

            return (
              <g key={datum.label}>
                <rect
                  x={x}
                  y={y}
                  width={rectWidth}
                  height={barHeight}
                  fill={color}
                  rx={4}
                  className={`
                    transition-opacity duration-[var(--duration-fast)]
                    ${onBarClick ? 'cursor-pointer' : ''}
                    hover:opacity-80
                  `
                    .trim()
                    .replace(/\s+/g, ' ')}
                  onMouseEnter={(e) => showTooltip(datum, e)}
                  onMouseMove={handleMouseMove}
                  onMouseLeave={hideTooltip}
                  onClick={() => onBarClick?.(datum, index)}
                  role="graphics-symbol"
                  aria-label={`${datum.label}: ${datum.value}`}
                />
                {showLabels && rectWidth > 40 && (
                  <text
                    x={isHorizontal ? rectWidth - 8 : x + rectWidth / 2}
                    y={isHorizontal ? y + barHeight / 2 : y + 16}
                    textAnchor={isHorizontal ? 'end' : 'middle'}
                    dominantBaseline="middle"
                    className="text-xs font-medium fill-[var(--color-text-inverse)] pointer-events-none"
                  >
                    {datum.value.toLocaleString()}
                  </text>
                )}
              </g>
            );
          })}

          {/* Y Axis (category axis for horizontal, value axis for vertical) */}
          <g>
            {isHorizontal ? (
              // Category labels on left for horizontal
              processedData.map((datum) => (
                <text
                  key={datum.label}
                  x={-8}
                  y={(categoryScale(datum.label) ?? 0) + categoryScale.bandwidth() / 2}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs fill-[var(--color-text-secondary)]"
                >
                  {truncateLabel(datum.label, 15)}
                </text>
              ))
            ) : (
              // Value axis ticks on left for vertical
              valueScale.ticks(5).map((tick) => (
                <text
                  key={tick}
                  x={-8}
                  y={valueScale(tick)}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs fill-[var(--color-text-muted)]"
                >
                  {formatValue(tick)}
                </text>
              ))
            )}
          </g>

          {/* X Axis (value axis for horizontal, category axis for vertical) */}
          <g transform={`translate(0, ${innerHeight})`}>
            {isHorizontal ? (
              // Value axis ticks on bottom for horizontal
              valueScale.ticks(5).map((tick) => (
                <text
                  key={tick}
                  x={valueScale(tick)}
                  y={20}
                  textAnchor="middle"
                  className="text-xs fill-[var(--color-text-muted)]"
                >
                  {formatValue(tick)}
                </text>
              ))
            ) : (
              // Category labels on bottom for vertical
              processedData.map((datum) => (
                <text
                  key={datum.label}
                  x={(categoryScale(datum.label) ?? 0) + categoryScale.bandwidth() / 2}
                  y={20}
                  textAnchor="middle"
                  className="text-xs fill-[var(--color-text-secondary)]"
                >
                  {truncateLabel(datum.label, 10)}
                </text>
              ))
            )}
          </g>
        </g>
      </svg>

      <ChartTooltip state={tooltip}>
        {(datum) => (
          <div className="space-y-1">
            <div className="font-medium">{datum.label}</div>
            {datum.secondaryLabel && (
              <div className="text-[var(--color-neutral-400)] text-xs">{datum.secondaryLabel}</div>
            )}
            <div className="text-[var(--color-neutral-300)]">{datum.value.toLocaleString()}</div>
          </div>
        )}
      </ChartTooltip>
    </>
  );
}

/**
 * Horizontal bar chart with preset styling for ranking/leaderboard displays.
 */
export function HorizontalBarChart({
  data,
  width,
  height,
  maxBars = 10,
  ...props
}: Omit<BarChartProps, 'orientation'>) {
  return (
    <BarChart
      data={data}
      width={width}
      height={height}
      orientation="horizontal"
      sortOrder="descending"
      maxBars={maxBars}
      margin={{ top: 10, right: 20, bottom: 30, left: 120 }}
      {...props}
    />
  );
}

/**
 * Stacked bar chart for showing composition.
 */
export function StackedBarChart({
  data,
  width,
  height,
  className = '',
}: {
  data: { label: string; segments: { label: string; value: number; color: string }[] }[];
  width: number;
  height: number;
  className?: string;
}) {
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<{
    category: string;
    segment: string;
    value: number;
  }>();

  // Calculate scales
  const { xScale, yScale } = useMemo(() => {
    const maxTotal = d3Array.max(data, (d) =>
      d.segments.reduce((sum, s) => sum + s.value, 0)
    ) ?? 0;

    return {
      xScale: d3Scale
        .scaleBand<string>()
        .domain(data.map((d) => d.label))
        .range([0, innerWidth])
        .padding(0.2),
      yScale: d3Scale.scaleLinear().domain([0, maxTotal * 1.1]).range([innerHeight, 0]).nice(),
    };
  }, [data, innerWidth, innerHeight]);

  if (width === 0 || height === 0) return null;

  return (
    <>
      <svg width={width} height={height} className={className}>
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {data.map((item) => {
            const x = xScale(item.label) ?? 0;
            const barWidth = xScale.bandwidth();
            let yOffset = innerHeight;

            return (
              <g key={item.label}>
                {item.segments.map((segment) => {
                  const segmentHeight = innerHeight - yScale(segment.value);
                  yOffset -= segmentHeight;

                  return (
                    <rect
                      key={segment.label}
                      x={x}
                      y={yOffset}
                      width={barWidth}
                      height={segmentHeight}
                      fill={segment.color}
                      className="transition-opacity hover:opacity-80"
                      onMouseEnter={(e) =>
                        showTooltip(
                          { category: item.label, segment: segment.label, value: segment.value },
                          e
                        )
                      }
                      onMouseMove={handleMouseMove}
                      onMouseLeave={hideTooltip}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* X Axis */}
          <g transform={`translate(0, ${innerHeight})`}>
            {data.map((item) => (
              <text
                key={item.label}
                x={(xScale(item.label) ?? 0) + xScale.bandwidth() / 2}
                y={20}
                textAnchor="middle"
                className="text-xs fill-[var(--color-text-secondary)]"
              >
                {truncateLabel(item.label, 10)}
              </text>
            ))}
          </g>

          {/* Y Axis */}
          {yScale.ticks(5).map((tick) => (
            <text
              key={tick}
              x={-8}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs fill-[var(--color-text-muted)]"
            >
              {formatValue(tick)}
            </text>
          ))}
        </g>
      </svg>

      <ChartTooltip state={tooltip}>
        {(d) => (
          <div className="space-y-1">
            <div className="font-medium">{d.category}</div>
            <div className="text-[var(--color-neutral-300)]">
              {d.segment}: {d.value.toLocaleString()}
            </div>
          </div>
        )}
      </ChartTooltip>
    </>
  );
}

// Helpers
function truncateLabel(label: string, maxLength: number): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label;
}

function formatValue(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}
