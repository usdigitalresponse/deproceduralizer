'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import * as d3Scale from 'd3-scale';
import * as d3Array from 'd3-array';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { useChartTooltip, ChartTooltip } from '@/components/charts/ChartTooltip';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { getTagReadabilityCrosscuts } from '@/lib/actions/tags';
import type { TagReadabilityCrosscuts } from '@/lib/actions/tags';
import type { JurisdictionCode, TagReadabilityRow } from '@deproceduralizer/database';
import { getReadabilityLabel } from '@/components/guidance/ReadabilityBadge';

// ---------------------------------------------------------------------------
// Field options (readability is primarily for guidance documents)
// ---------------------------------------------------------------------------

const READABILITY_FIELD_OPTIONS = [
  { value: 'policy_category', label: 'Policy Category' },
  { value: 'target_audience', label: 'Target Audience' },
  { value: 'guid_section_type', label: 'Section Type (Guidance)' },
  { value: 'guid_keywords', label: 'Keywords (Guidance)' },
];

// ---------------------------------------------------------------------------
// Readability tier color helpers
// ---------------------------------------------------------------------------

function fleschColor(score: number): string {
  if (score >= 70) return '#1e752e';   // green (easy to read)
  if (score >= 60) return '#6b6b6b';   // neutral
  if (score >= 50) return '#ca8a04';   // yellow
  if (score >= 30) return '#ea580c';   // orange
  return '#b52c2c';                     // red (very difficult)
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortColumn = 'value' | 'count' | 'avgFleschEase' | 'avgGradeLevel' | 'avgWordCount';
type SortDirection = 'asc' | 'desc';

function sortRows(
  rows: TagReadabilityRow[],
  column: SortColumn,
  direction: SortDirection,
): TagReadabilityRow[] {
  const sorted = [...rows];
  sorted.sort((a, b) => {
    const aVal = column === 'value' ? a.value : a[column];
    const bVal = column === 'value' ? b.value : b[column];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const an = Number(aVal);
    const bn = Number(bVal);
    return direction === 'asc' ? an - bn : bn - an;
  });
  return sorted;
}

// ---------------------------------------------------------------------------
// Scatter plot component
// ---------------------------------------------------------------------------

interface ScatterPoint {
  value: string;
  count: number;
  avgFleschEase: number;
}

const SCATTER_MARGIN = { top: 20, right: 20, bottom: 40, left: 60 };

function ReadabilityScatter({
  data,
  width,
  height,
}: {
  data: ScatterPoint[];
  width: number;
  height: number;
}) {
  const { tooltip, showTooltip, hideTooltip, handleMouseMove } = useChartTooltip<ScatterPoint>();

  const innerWidth = Math.max(0, width - SCATTER_MARGIN.left - SCATTER_MARGIN.right);
  const innerHeight = Math.max(0, height - SCATTER_MARGIN.top - SCATTER_MARGIN.bottom);

  const { xScale, yScale } = useMemo(() => {
    const maxCount = d3Array.max(data, d => d.count) ?? 10;
    const fleschExtent = d3Array.extent(data, d => d.avgFleschEase) as [number, number];

    return {
      xScale: d3Scale
        .scaleLinear()
        .domain([0, maxCount * 1.1])
        .range([0, innerWidth])
        .nice(),
      yScale: d3Scale
        .scaleLinear()
        .domain([
          Math.max(0, (fleschExtent[0] ?? 0) - 5),
          Math.min(100, (fleschExtent[1] ?? 100) + 5),
        ])
        .range([innerHeight, 0])
        .nice(),
    };
  }, [data, innerWidth, innerHeight]);

  if (width === 0 || height === 0 || data.length === 0) return null;

  return (
    <>
      <svg width={width} height={height} role="img" aria-label="Readability scatter plot">
        <g transform={`translate(${SCATTER_MARGIN.left}, ${SCATTER_MARGIN.top})`}>
          {/* Grid lines */}
          <g>
            {yScale.ticks(5).map(tick => (
              <line
                key={tick}
                x1={0}
                y1={yScale(tick)}
                x2={innerWidth}
                y2={yScale(tick)}
                stroke="var(--color-neutral-200)"
                strokeDasharray="4,4"
              />
            ))}
          </g>

          {/* Circles */}
          {data.map(point => (
            <circle
              key={point.value}
              cx={xScale(point.count)}
              cy={yScale(point.avgFleschEase)}
              r={6}
              fill={fleschColor(point.avgFleschEase)}
              fillOpacity={0.75}
              stroke={fleschColor(point.avgFleschEase)}
              strokeWidth={1.5}
              className="transition-opacity duration-[var(--duration-fast)] hover:opacity-90"
              onMouseEnter={e => showTooltip(point, e)}
              onMouseMove={handleMouseMove}
              onMouseLeave={hideTooltip}
            />
          ))}

          {/* Y-axis labels */}
          {yScale.ticks(5).map(tick => (
            <text
              key={tick}
              x={-8}
              y={yScale(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-xs fill-[var(--color-text-muted)]"
            >
              {tick}
            </text>
          ))}

          {/* X-axis labels */}
          <g transform={`translate(0, ${innerHeight})`}>
            {xScale.ticks(5).map(tick => (
              <text
                key={tick}
                x={xScale(tick)}
                y={20}
                textAnchor="middle"
                className="text-xs fill-[var(--color-text-muted)]"
              >
                {tick}
              </text>
            ))}
          </g>

          {/* Axis titles */}
          <text
            x={innerWidth / 2}
            y={innerHeight + 35}
            textAnchor="middle"
            className="text-xs fill-[var(--color-text-secondary)]"
          >
            Document Count
          </text>
          <text
            x={-innerHeight / 2}
            y={-45}
            textAnchor="middle"
            transform="rotate(-90)"
            className="text-xs fill-[var(--color-text-secondary)]"
          >
            Avg Flesch Reading Ease
          </text>
        </g>
      </svg>

      <ChartTooltip state={tooltip}>
        {(point) => (
          <div className="space-y-1">
            <div className="font-medium">{point.value}</div>
            <div className="text-[var(--color-neutral-300)]">
              Count: {point.count.toLocaleString()}
            </div>
            <div className="text-[var(--color-neutral-300)]">
              Flesch Ease: {point.avgFleschEase.toFixed(1)} ({getReadabilityLabel(point.avgFleschEase)})
            </div>
          </div>
        )}
      </ChartTooltip>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface TagsReadabilityTabProps {
  jurisdiction: string;
}

export function TagsReadabilityTab({ jurisdiction }: TagsReadabilityTabProps) {
  const [field, setField] = useState('policy_category');
  const [crosscuts, setCrosscuts] = useState<TagReadabilityCrosscuts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Table sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>('avgFleschEase');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getTagReadabilityCrosscuts(jurisdiction as JurisdictionCode, field).then(result => {
      if (cancelled) return;
      setLoading(false);
      if (result.success) {
        setCrosscuts(result.data);
      } else {
        setError(result.error);
      }
    });

    return () => { cancelled = true; };
  }, [jurisdiction, field]);

  // Bar chart data
  const barData = useMemo(() => {
    if (!crosscuts?.rows?.length) return [];
    return crosscuts.rows.map(row => ({
      label: row.value,
      value: Math.round(row.avgFleschEase * 10) / 10,
    }));
  }, [crosscuts]);

  // Scatter plot data
  const scatterData = useMemo((): ScatterPoint[] => {
    if (!crosscuts?.rows?.length) return [];
    return crosscuts.rows.map(row => ({
      value: row.value,
      count: row.count,
      avgFleschEase: row.avgFleschEase,
    }));
  }, [crosscuts]);

  // Sorted table data
  const sortedRows = useMemo(() => {
    if (!crosscuts?.rows?.length) return [];
    return sortRows(crosscuts.rows, sortColumn, sortDirection);
  }, [crosscuts, sortColumn, sortDirection]);

  const handleSort = useCallback((column: SortColumn) => {
    setSortColumn(prev => {
      if (prev === column) {
        setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
        return column;
      }
      setSortDirection('asc');
      return column;
    });
  }, []);

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (loading) {
    return (
      <div className="text-[var(--color-text-muted)] text-sm py-12 text-center">
        Loading readability data...
      </div>
    );
  }

  if (error) {
    return <EmptyState title="Failed to load readability data" description={error} />;
  }

  if (!crosscuts || crosscuts.rows.length === 0) {
    return (
      <EmptyState
        title="No readability data"
        description="Readability metrics are not yet available for this jurisdiction and field."
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Field selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm text-[var(--color-text-muted)] whitespace-nowrap">
          Group by:
        </label>
        <div className="w-56">
          <Select
            value={field}
            onValueChange={setField}
            options={READABILITY_FIELD_OPTIONS}
            aria-label="Readability grouping field"
          />
        </div>
      </div>

      {/* Readability tier legend */}
      <div className="flex flex-wrap gap-4 px-1">
        {[
          { label: 'Very Difficult (<30)', color: fleschColor(20) },
          { label: 'Difficult (30-49)', color: fleschColor(40) },
          { label: 'Fairly Difficult (50-59)', color: fleschColor(55) },
          { label: 'Standard (60-69)', color: fleschColor(65) },
          { label: 'Easy (70+)', color: fleschColor(80) },
        ].map(tier => (
          <div key={tier.label} className="flex items-center gap-1.5 text-xs">
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ backgroundColor: tier.color }}
            />
            <span className="text-[var(--color-text-secondary)]">{tier.label}</span>
          </div>
        ))}
      </div>

      {/* Top: Bar Chart */}
      <ChartContainer
        title="Average Flesch Reading Ease by Tag Value"
        description="Higher scores indicate easier-to-read text."
        aspectRatio={16 / 9}
        minHeight={250}
        maxHeight={450}
      >
        {({ width, height }) =>
          barData.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <HorizontalBarChart data={barData} width={width} height={height} maxBars={15} />
          )
        }
      </ChartContainer>

      {/* Middle: Scatter Plot */}
      <ChartContainer
        title="Readability vs. Document Count"
        description="Each circle represents a tag value. Color indicates readability tier."
        aspectRatio={16 / 9}
        minHeight={250}
        maxHeight={400}
      >
        {({ width, height }) =>
          scatterData.length === 0 ? (
            <EmptyState title="No data" />
          ) : (
            <ReadabilityScatter data={scatterData} width={width} height={height} />
          )
        }
      </ChartContainer>

      {/* Bottom: Cross-cut Table */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          Readability Cross-Cut Table
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-neutral-200)]">
                {([
                  ['value', 'Value'],
                  ['count', 'Count'],
                  ['avgFleschEase', 'Avg Flesch'],
                  ['avgGradeLevel', 'Avg Grade'],
                  ['avgWordCount', 'Avg Words'],
                ] as [SortColumn, string][]).map(([col, label]) => (
                  <th
                    key={col}
                    className={`
                      py-2 pr-4 font-medium text-[var(--color-text-muted)] cursor-pointer hover:text-[var(--color-text-secondary)]
                      ${col === 'value' ? 'text-left' : 'text-right'}
                    `.trim().replace(/\s+/g, ' ')}
                    onClick={() => handleSort(col)}
                  >
                    {label}{sortIndicator(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(row => (
                <tr
                  key={row.value}
                  className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)] transition-colors"
                >
                  <td className="py-2 pr-4 text-[var(--color-text)]">{row.value}</td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {row.count.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ color: fleschColor(row.avgFleschEase) }}
                    >
                      {row.avgFleschEase.toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {row.avgGradeLevel.toFixed(1)}
                  </td>
                  <td className="py-2 text-right tabular-nums text-[var(--color-text-secondary)]">
                    {Math.round(row.avgWordCount).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
