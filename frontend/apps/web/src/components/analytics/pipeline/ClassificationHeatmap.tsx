'use client';

import { useMemo } from 'react';
import * as d3Scale from 'd3-scale';
import * as d3Interpolate from 'd3-interpolate';
import {
  ChartContainer,
  ClientChart,
  ChartTooltip,
  useChartTooltip,
} from '@/components/charts';
import { Card } from '@/components/ui';
import { useChartColors } from '@/hooks/useChartColors';
import type { TierTransitionData, TransitionReasonData } from '@/lib/actions/pipeline-analytics';
import type { HeatmapData } from '@/lib/charts/types';

interface ClassificationHeatmapProps {
  data: TierTransitionData | null;
  transitionReasons: TransitionReasonData | null;
}

interface HeatmapCellTooltipData {
  row: string;
  column: string;
  value: number;
  triggerReason: string | null;
}

const MARGIN = {
  top: 60,
  right: 20,
  bottom: 20,
  left: 120,
};

/** Format a trigger reason for display: replace underscores with spaces. */
function formatReason(reason: string): string {
  return reason.replace(/_/g, ' ');
}

/** Truncate text to fit within a cell, adding ellipsis if needed. */
function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}\u2026`;
}

/** Truncate a label for axis display. */
function truncateLabel(label: string, maxLength: number): string {
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}...` : label;
}

/**
 * Heatmap showing how classifications changed between Tier 2 and Tier 3 analysis.
 * Off-diagonal cells (where classification changed) show the top trigger reason
 * as a subtle annotation below the count.
 */
export function ClassificationHeatmap({ data, transitionReasons }: ClassificationHeatmapProps) {
  const { colors, getContrastColor } = useChartColors();
  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<HeatmapCellTooltipData>();

  const heatmapData = useMemo((): HeatmapData | null => {
    if (!data || data.classificationCrossTab.length === 0) return null;

    const rowSet = new Set<string>();
    const colSet = new Set<string>();
    let maxValue = 0;

    for (const entry of data.classificationCrossTab) {
      rowSet.add(entry.tier2Classification);
      colSet.add(entry.tier3Classification);
      if (entry.count > maxValue) maxValue = entry.count;
    }

    return {
      rows: Array.from(rowSet),
      columns: Array.from(colSet),
      cells: data.classificationCrossTab.map((entry) => ({
        row: entry.tier2Classification,
        column: entry.tier3Classification,
        value: entry.count,
      })),
      maxValue,
    };
  }, [data]);

  // Build a lookup map: (tier2Class, tier3Class) -> top trigger reason
  const reasonLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (!transitionReasons) return map;

    // Transitions are ordered by count DESC, so first occurrence for each pair is the top reason
    for (const t of transitionReasons.transitions) {
      const key = `${t.tier2Classification}__${t.tier3Classification}`;
      if (!map.has(key)) {
        map.set(key, t.triggerReason);
      }
    }
    return map;
  }, [transitionReasons]);

  if (!data || !heatmapData) {
    return (
      <Card variant="bordered" padding="lg">
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          No classification change data available
        </div>
      </Card>
    );
  }

  return (
    <ChartContainer
      title="Tier 2 → 3 Classification Changes"
      description="How classifications changed between Tier 2 and Tier 3 analysis. Off-diagonal cells show the top trigger reason."
      aspectRatio={16 / 10}
      minHeight={280}
      maxHeight={500}
      margin={MARGIN}
    >
      {({ width, height }) => (
        <ClientChart minHeight={280}>
          <AnnotatedHeatmapGrid
            data={heatmapData}
            width={width}
            height={height}
            reasonLookup={reasonLookup}
            colors={colors}
            getContrastColor={getContrastColor}
            tooltip={{ showTooltip, hideTooltip, handleMouseMove }}
          />
          <ChartTooltip state={tooltip}>
            {(cell) => (
              <div className="space-y-1">
                <div className="font-medium">
                  {cell.row} &rarr; {cell.column}
                </div>
                <div className="text-[var(--color-neutral-300)]">
                  Count: {cell.value.toLocaleString()}
                </div>
                {cell.triggerReason && (
                  <div className="text-[var(--color-neutral-400)] text-xs">
                    Top reason: {formatReason(cell.triggerReason)}
                  </div>
                )}
              </div>
            )}
          </ChartTooltip>
        </ClientChart>
      )}
    </ChartContainer>
  );
}

// ─── Internal SVG component ─────────────────────────────────────

interface AnnotatedHeatmapGridProps {
  data: HeatmapData;
  width: number;
  height: number;
  reasonLookup: Map<string, string>;
  colors: ReturnType<typeof useChartColors>['colors'];
  getContrastColor: (bg: string) => string;
  tooltip: {
    showTooltip: (data: HeatmapCellTooltipData, e: React.MouseEvent) => void;
    hideTooltip: () => void;
    handleMouseMove: (e: React.MouseEvent) => void;
  };
}

function AnnotatedHeatmapGrid({
  data,
  width,
  height,
  reasonLookup,
  colors,
  getContrastColor,
  tooltip,
}: AnnotatedHeatmapGridProps) {
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
    <svg
      width={width}
      height={height}
      role="img"
      aria-label="Classification heatmap with transition reasons"
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

            const isDiagonal = row === col;
            const reasonKey = `${row}__${col}`;
            const triggerReason = isDiagonal ? null : (reasonLookup.get(reasonKey) ?? null);
            const hasReason = triggerReason !== null && cellWidth > 40 && cellHeight > 32;

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
                  onMouseEnter={(e) =>
                    tooltip.showTooltip({ row, column: col, value, triggerReason }, e)
                  }
                  onMouseMove={tooltip.handleMouseMove}
                  onMouseLeave={tooltip.hideTooltip}
                  role="graphics-symbol"
                  aria-label={`${row} / ${col}: ${value}${triggerReason ? ` (${formatReason(triggerReason)})` : ''}`}
                />
                {cellWidth > 24 && cellHeight > 16 && (
                  <text
                    x={x + cellWidth / 2}
                    y={hasReason ? y + cellHeight / 2 - 6 : y + cellHeight / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={textColor}
                    className="text-xs font-medium pointer-events-none"
                  >
                    {value}
                  </text>
                )}
                {hasReason && (
                  <text
                    x={x + cellWidth / 2}
                    y={y + cellHeight / 2 + 8}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={textColor}
                    opacity={0.7}
                    className="pointer-events-none"
                    style={{ fontSize: '9px' }}
                  >
                    {truncateText(formatReason(triggerReason), 15)}
                  </text>
                )}
              </g>
            );
          })
        )}
      </g>
    </svg>
  );
}
