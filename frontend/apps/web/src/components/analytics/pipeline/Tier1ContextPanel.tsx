'use client';

import { useMemo } from 'react';
import { scaleBand, scaleLinear } from 'd3-scale';
import { max } from 'd3-array';
import type { Tier1ContextRequestStats } from '@/lib/actions/pipeline-analytics';
import { Card } from '@/components/ui';
import {
  ChartContainer,
  ClientChart,
  HorizontalBarChart,
  ChartLegend,
  useChartTooltip,
  ChartTooltip,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import type { LegendItem, BarChartDatum } from '@/lib/charts/types';

interface Tier1ContextPanelProps {
  data: Tier1ContextRequestStats | null;
  onIssueTypeClick?: (issueType: string) => void;
}

/** Known context type display order and color mapping key */
const CONTEXT_TYPES = ['sibling', 'cross_reference', 'definition', 'hierarchy'] as const;

/** Format an issue type slug into a human-readable label. */
function formatIssueType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

// ── Inline horizontal stacked bar chart ─────────────────────────
interface HorizontalStackedBarDatum {
  label: string;
  slug: string;
  total: number;
  segments: { label: string; contextType: string; value: number; color: string }[];
}

function HorizontalStackedBarInline({
  data,
  width,
  height,
  onBarClick,
}: {
  data: HorizontalStackedBarDatum[];
  width: number;
  height: number;
  onBarClick?: (issueType: string) => void;
}) {
  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<{
    category: string;
    segment: string;
    value: number;
  }>();

  const margin = { top: 10, right: 20, bottom: 10, left: 160 };
  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const { yScale, xScale } = useMemo(() => {
    const maxTotal = max(data, (d) => d.total) ?? 0;

    return {
      yScale: scaleBand<string>()
        .domain(data.map((d) => d.label))
        .range([0, innerHeight])
        .padding(0.18),
      xScale: scaleLinear()
        .domain([0, maxTotal * 1.1])
        .range([0, innerWidth])
        .nice(),
    };
  }, [data, innerWidth, innerHeight]);

  if (width === 0 || height === 0 || data.length === 0) return null;

  return (
    <>
      <svg width={width} height={height} role="img" aria-label="Horizontal stacked bar chart">
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Grid lines */}
          <g>
            {xScale.ticks(5).map((tick) => (
              <line
                key={tick}
                x1={xScale(tick)}
                y1={0}
                x2={xScale(tick)}
                y2={innerHeight}
                stroke="var(--color-neutral-200)"
                strokeDasharray="4,4"
              />
            ))}
          </g>

          {/* Bars */}
          {data.map((item) => {
            const y = yScale(item.label) ?? 0;
            const barHeight = yScale.bandwidth();
            let xOffset = 0;

            return (
              <g key={item.label}>
                {item.segments.map((segment) => {
                  const segmentWidth = xScale(segment.value);
                  const currentX = xOffset;
                  xOffset += segmentWidth;

                  if (segment.value === 0) return null;

                  return (
                    <rect
                      key={segment.contextType}
                      x={currentX}
                      y={y}
                      width={segmentWidth}
                      height={barHeight}
                      fill={segment.color}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                      onMouseEnter={(e) =>
                        showTooltip(
                          { category: item.label, segment: segment.label, value: segment.value },
                          e
                        )
                      }
                      onMouseMove={handleMouseMove}
                      onMouseLeave={hideTooltip}
                      onClick={() => onBarClick?.(item.slug)}
                      role="graphics-symbol"
                      aria-label={`${item.label} - ${segment.label}: ${segment.value}`}
                    />
                  );
                })}
              </g>
            );
          })}

          {/* Y Axis labels */}
          <g>
            {data.map((item) => (
              <text
                key={item.label}
                x={-8}
                y={(yScale(item.label) ?? 0) + yScale.bandwidth() / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-[var(--color-text-secondary)] cursor-pointer hover:fill-[var(--color-text)]"
                style={{ fontSize: '11px' }}
                onClick={() => onBarClick?.(item.slug)}
              >
                {item.label}
              </text>
            ))}
          </g>

          {/* X Axis tick labels */}
          <g transform={`translate(0, ${innerHeight})`}>
            {xScale.ticks(5).map((tick) => (
              <text
                key={tick}
                x={xScale(tick)}
                y={14}
                textAnchor="middle"
                className="fill-[var(--color-text-muted)]"
                style={{ fontSize: '10px' }}
              >
                {tick.toLocaleString()}
              </text>
            ))}
          </g>
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

export function Tier1ContextPanel({ data, onIssueTypeClick }: Tier1ContextPanelProps) {
  const { categoryScale, colors } = useChartColors();

  // ── Stable color map for context types ──────────────────────────
  const contextTypeColors = useMemo(() => {
    const map: Record<string, string> = {};
    for (const ct of CONTEXT_TYPES) {
      map[ct] = categoryScale(ct);
    }
    return map;
  }, [categoryScale]);

  // ── Section 2: Horizontal stacked bar chart data (by issue type) ─
  const { stackedData, stackedLegend } = useMemo(() => {
    if (!data) return { stackedData: [], stackedLegend: [] };

    // Aggregate totals per issue type
    const totals = new Map<string, number>();
    const segments = new Map<string, Map<string, number>>();

    for (const row of data.byIssueType) {
      totals.set(row.issueType, (totals.get(row.issueType) ?? 0) + row.count);
      if (!segments.has(row.issueType)) {
        segments.set(row.issueType, new Map());
      }
      const segMap = segments.get(row.issueType)!;
      segMap.set(row.contextType, (segMap.get(row.contextType) ?? 0) + row.count);
    }

    // Top 10 issue types by total count
    const top10 = [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([issueType]) => issueType);

    // Collect all distinct context types seen in the data
    const seenContextTypes = new Set<string>();
    for (const row of data.byIssueType) {
      seenContextTypes.add(row.contextType);
    }

    const bars = top10.map((issueType) => {
      const segMap = segments.get(issueType)!;
      const total = totals.get(issueType) ?? 0;
      return {
        label: formatIssueType(issueType),
        slug: issueType,
        total,
        segments: [...seenContextTypes].map((ct) => ({
          label: formatIssueType(ct),
          contextType: ct,
          value: segMap.get(ct) ?? 0,
          color: contextTypeColors[ct] ?? categoryScale(ct),
        })),
      };
    });

    const legend: LegendItem[] = [...seenContextTypes].map((ct) => ({
      label: formatIssueType(ct),
      color: contextTypeColors[ct] ?? categoryScale(ct),
    }));

    return { stackedData: bars, stackedLegend: legend };
  }, [data, contextTypeColors, categoryScale]);

  // ── Section 3: Horizontal bar chart data (context type distribution) ──
  const contextTypeBarData: BarChartDatum[] = useMemo(() => {
    if (!data) return [];

    // Aggregate counts by context type
    const totals = new Map<string, number>();
    for (const row of data.byContextType) {
      totals.set(row.contextType, (totals.get(row.contextType) ?? 0) + row.count);
    }

    // Check need level for color coding
    const needLevelByType = new Map<string, string>();
    for (const row of data.byContextType) {
      // Use the dominant need level (last one wins, but 'full_text' takes priority)
      const existing = needLevelByType.get(row.contextType);
      if (!existing || row.needLevel === 'full_text') {
        needLevelByType.set(row.contextType, row.needLevel);
      }
    }

    return [...totals.entries()]
      .map(([contextType, count]) => {
        const needLevel = needLevelByType.get(contextType) ?? 'summary';
        return {
          label: formatIssueType(contextType),
          value: count,
          color: needLevel === 'full_text' ? colors.warning : colors.primary,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [data, colors]);

  // ── Null state ──────────────────────────────────────────────────
  if (!data) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)]">
        No context request data available
      </Card>
    );
  }

  const pct =
    data.summary.totalAnalyses > 0
      ? ((data.summary.analysesWithRequests / data.summary.totalAnalyses) * 100).toFixed(1)
      : '0';

  return (
    <div className="space-y-6">
      {/* ── 1. Summary Stats ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.totalRequests.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Total Context Requests
          </div>
        </Card>

        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.analysesWithRequests.toLocaleString()} / {data.summary.totalAnalyses.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Analyses With Requests ({pct}%)
          </div>
        </Card>

        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.avgRequestsPerAnalysis.toFixed(1)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">
            Avg Requests / Analysis
          </div>
        </Card>
      </div>

      {/* ── 2. Context Requests by Issue Type (Horizontal Stacked Bar) ── */}
      {stackedData.length > 0 && (
        <>
          <ChartContainer
            title="Context Requests by Issue Type"
            description="Top 10 issue types by total context requests, segmented by context type"
            aspectRatio={16 / 10}
            minHeight={Math.max(300, stackedData.length * 36 + 20)}
            maxHeight={500}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                <HorizontalStackedBarInline
                  data={stackedData}
                  width={width}
                  height={height}
                  onBarClick={onIssueTypeClick}
                />
              </ClientChart>
            )}
          </ChartContainer>
          <ChartLegend items={stackedLegend} />
        </>
      )}

      {/* ── 3. Context Type Distribution (Horizontal Bar) ──────── */}
      {contextTypeBarData.length > 0 && (
        <ChartContainer
          title="Context Type Distribution"
          description="Aggregate request count per context type (colored by dominant need level)"
          aspectRatio={2}
          minHeight={Math.max(200, contextTypeBarData.length * 40)}
          maxHeight={400}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              <HorizontalBarChart
                data={contextTypeBarData}
                width={width}
                height={height}
                maxBars={10}
              />
            </ClientChart>
          )}
        </ChartContainer>
      )}
    </div>
  );
}
