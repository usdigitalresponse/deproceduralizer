'use client';

import { useMemo } from 'react';
import { BarChart3, Filter, ArrowUpRight, RefreshCw } from 'lucide-react';
import type { PipelineFunnelData } from '@/lib/actions/pipeline-analytics';
import { Card, StatCard, StatGrid } from '@/components/ui';
import { ChartContainer, ClientChart } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';

interface PipelineFunnelProps {
  data: PipelineFunnelData | null;
}

// ═══════════════════════════════════════════════════════════════════
// SVG Funnel Internals
// ═══════════════════════════════════════════════════════════════════

interface SegmentDef {
  label: string;
  value: number;
  color: string;
}

interface ColumnLayout {
  title: string;
  x: number;
  segments: SegmentDef[];
  total: number;
}

/** Compute stacked bar y-positions for a column */
function computeBarPositions(
  segments: SegmentDef[],
  total: number,
  barTop: number,
  maxBarHeight: number
) {
  if (total === 0) {
    return segments.map((seg) => ({
      ...seg,
      y: barTop,
      height: 0,
    }));
  }

  let currentY = barTop;
  return segments.map((seg) => {
    const height = (seg.value / total) * maxBarHeight;
    const entry = { ...seg, y: currentY, height };
    currentY += height;
    return entry;
  });
}

/** Build a cubic bezier path connecting two vertical ranges */
function buildFlowPath(
  x1: number,
  y1Start: number,
  y1End: number,
  x2: number,
  y2Start: number,
  y2End: number
): string {
  const cpOffset = (x2 - x1) * 0.45;
  return [
    `M ${x1} ${y1Start}`,
    `C ${x1 + cpOffset} ${y1Start}, ${x2 - cpOffset} ${y2Start}, ${x2} ${y2Start}`,
    `L ${x2} ${y2End}`,
    `C ${x2 - cpOffset} ${y2End}, ${x1 + cpOffset} ${y1End}, ${x1} ${y1End}`,
    'Z',
  ].join(' ');
}

interface FunnelSVGProps {
  data: PipelineFunnelData;
  width: number;
  height: number;
  colors: ReturnType<typeof useChartColors>;
}

function FunnelSVG({ data, width, height, colors }: FunnelSVGProps) {
  const layout = useMemo(() => {
    const barWidth = Math.min(120, width * 0.18);
    const headerHeight = 32;
    const barTop = headerHeight + 16;
    const bottomPadding = 24;
    const maxBarHeight = height - barTop - bottomPadding;
    const columnGap = (width - 3 * barWidth) / 4;

    const columns: ColumnLayout[] = [
      {
        title: 'Tier 1',
        x: columnGap,
        total: data.tier1.total,
        segments: [
          {
            label: 'False Positives',
            value: data.tier1.falsePositives,
            color: colors.colors.danger,
          },
          {
            label: 'Needs Research',
            value: data.tier1.needsResearch,
            color: colors.colors.primary,
          },
        ],
      },
      {
        title: 'Tier 2',
        x: columnGap * 2 + barWidth,
        total: data.tier2.total,
        segments: [
          {
            label: 'Burdensome',
            value: data.tier2.burdensome,
            color: colors.colors.danger,
          },
          {
            label: 'Justified',
            value: data.tier2.justified,
            color: colors.colors.success,
          },
          {
            label: 'Unrelated',
            value: data.tier2.unrelated,
            color: colors.colors.neutral400,
          },
          {
            label: 'Needs Context',
            value: data.tier2.needsFullContext,
            color: colors.colors.warning,
          },
        ],
      },
      {
        title: 'Tier 3',
        x: columnGap * 3 + barWidth * 2,
        total: data.tier3.total,
        segments: [
          {
            label: 'Burdensome',
            value: data.tier3.burdensome,
            color: colors.colors.danger,
          },
          {
            label: 'Justified',
            value: data.tier3.justified,
            color: colors.colors.success,
          },
          {
            label: 'Unrelated',
            value: data.tier3.unrelated,
            color: colors.colors.neutral400,
          },
        ],
      },
    ];

    const positionedColumns = columns.map((col) => ({
      ...col,
      bars: computeBarPositions(col.segments, col.total, barTop, maxBarHeight),
    }));

    // Flow path 1: Tier 1 "Needs Research" → Tier 2 total
    const t1Bars = positionedColumns[0].bars;
    const t2Bars = positionedColumns[1].bars;
    const t3Bars = positionedColumns[2].bars;

    // Tier1 "Needs Research" is the second segment (index 1)
    const t1NeedsResearch = t1Bars[1];
    const t1FlowStart = t1NeedsResearch.y;
    const t1FlowEnd = t1NeedsResearch.y + t1NeedsResearch.height;

    // Tier 2 full bar range
    const t2FlowStart = t2Bars.length > 0 ? t2Bars[0].y : barTop;
    const t2Last = t2Bars[t2Bars.length - 1];
    const t2FlowEnd = t2Last ? t2Last.y + t2Last.height : barTop;

    const flow1 = buildFlowPath(
      positionedColumns[0].x + barWidth,
      t1FlowStart,
      t1FlowEnd,
      positionedColumns[1].x,
      t2FlowStart,
      t2FlowEnd
    );

    // Flow path 2: Tier 2 (burdensome + justified + needs_full_context) → Tier 3
    // These are indices 0 (burdensome), 1 (justified), 3 (needs_full_context)
    const escalatedFromT2 =
      data.tier2.burdensome + data.tier2.justified + data.tier2.needsFullContext;
    let t2EscStart = barTop;
    let t2EscEnd = barTop;

    if (data.tier2.total > 0 && escalatedFromT2 > 0) {
      // Burdensome starts at the top
      t2EscStart = t2Bars[0].y;
      // Justified ends after justified segment
      const justifiedEnd = t2Bars[1].y + t2Bars[1].height;
      // Needs context segment
      const needsContextEnd = t2Bars[3].y + t2Bars[3].height;
      // The escalated range spans: burdensome top to max(justified end, needsContext end)
      // Since unrelated is between justified and needsContext, the flow includes
      // the visual range from burdensome top to needsContext bottom, but we should
      // show the actual escalated proportion
      t2EscEnd = barTop + (escalatedFromT2 / data.tier2.total) * (t2FlowEnd - t2FlowStart);
      t2EscStart = barTop;
    }

    const t3FlowStart = t3Bars.length > 0 ? t3Bars[0].y : barTop;
    const t3Last = t3Bars[t3Bars.length - 1];
    const t3FlowEnd = t3Last ? t3Last.y + t3Last.height : barTop;

    const flow2 = buildFlowPath(
      positionedColumns[1].x + barWidth,
      t2EscStart,
      t2EscEnd,
      positionedColumns[2].x,
      t3FlowStart,
      t3FlowEnd
    );

    return {
      barWidth,
      barTop,
      maxBarHeight,
      columns: positionedColumns,
      flow1,
      flow2,
    };
  }, [data, width, height, colors]);

  const labelFontSize = Math.max(9, Math.min(12, width / 60));

  return (
    <svg width={width} height={height} role="img" aria-label="Pipeline funnel visualization">
      {/* Column headers */}
      {layout.columns.map((col) => (
        <text
          key={`header-${col.title}`}
          x={col.x + layout.barWidth / 2}
          y={16}
          textAnchor="middle"
          className="fill-[var(--color-text)] font-semibold"
          fontSize={14}
        >
          {col.title}
        </text>
      ))}

      {/* Flow paths (behind bars) */}
      <path d={layout.flow1} fill={colors.colors.primary} opacity={0.2} />
      <path d={layout.flow2} fill={colors.colors.primary} opacity={0.2} />

      {/* Stacked bars and labels */}
      {layout.columns.map((col) =>
        col.bars.map((bar) => {
          if (bar.height < 1) return null;

          const showLabelInside = bar.height >= 28;
          const barCenterY = bar.y + bar.height / 2;

          return (
            <g key={`${col.title}-${bar.label}`}>
              <rect
                x={col.x}
                y={bar.y}
                width={layout.barWidth}
                height={bar.height}
                fill={bar.color}
                rx={3}
              />
              {showLabelInside ? (
                <>
                  <text
                    x={col.x + layout.barWidth / 2}
                    y={barCenterY - 5}
                    textAnchor="middle"
                    fill={colors.getContrastColor(bar.color)}
                    fontSize={labelFontSize}
                    fontWeight={600}
                  >
                    {bar.value.toLocaleString()}
                  </text>
                  <text
                    x={col.x + layout.barWidth / 2}
                    y={barCenterY + 9}
                    textAnchor="middle"
                    fill={colors.getContrastColor(bar.color)}
                    fontSize={Math.max(8, labelFontSize - 2)}
                    opacity={0.85}
                  >
                    {bar.label}
                  </text>
                </>
              ) : (
                <text
                  x={col.x + layout.barWidth + 6}
                  y={barCenterY + 4}
                  textAnchor="start"
                  className="fill-[var(--color-text-muted)]"
                  fontSize={Math.max(8, labelFontSize - 1)}
                >
                  {bar.label} ({bar.value})
                </text>
              )}
            </g>
          );
        })
      )}

      {/* Column totals below bars */}
      {layout.columns.map((col) => {
        const lastBar = col.bars[col.bars.length - 1];
        const bottomY = lastBar ? lastBar.y + lastBar.height : layout.barTop;
        return (
          <text
            key={`total-${col.title}`}
            x={col.x + layout.barWidth / 2}
            y={Math.min(bottomY + 18, height - 4)}
            textAnchor="middle"
            className="fill-[var(--color-text-muted)]"
            fontSize={11}
          >
            Total: {col.total.toLocaleString()}
          </text>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════

export function PipelineFunnel({ data }: PipelineFunnelProps) {
  const colors = useChartColors();

  if (!data) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)]">
        No funnel data available
      </Card>
    );
  }

  const tier1FpRate =
    data.tier1.total > 0
      ? ((data.tier1.falsePositives / data.tier1.total) * 100).toFixed(1) + '%'
      : '0.0%';

  const tier3EscalationRate =
    data.tier2.total > 0
      ? ((data.tier3.total / data.tier2.total) * 100).toFixed(1) + '%'
      : '0.0%';

  const tier3ChangeSubtitle =
    data.tier3.total > 0
      ? `${((data.tier3.classificationChangedFromTier2 / data.tier3.total) * 100).toFixed(0)}% of Tier 3`
      : 'N/A';

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Analyses"
          value={data.totalAnalyses}
          icon={BarChart3}
        />
        <StatCard
          label="Tier 1 FP Rate"
          value={tier1FpRate}
          icon={Filter}
          variant="danger"
          subtitle={`${data.tier1.falsePositives} filtered`}
        />
        <StatCard
          label="Tier 3 Escalation Rate"
          value={tier3EscalationRate}
          icon={ArrowUpRight}
          variant="warning"
          subtitle={`${data.tier3.total} escalated`}
        />
        <StatCard
          label="Tier 3 Classification Changes"
          value={data.tier3.classificationChangedFromTier2}
          icon={RefreshCw}
          variant="info"
          subtitle={tier3ChangeSubtitle}
        />
      </StatGrid>

      {/* Funnel Flow Diagram */}
      <ChartContainer
        title="Pipeline Funnel"
        description="Volume flow through 3-tier analysis pipeline"
        aspectRatio={2}
        minHeight={300}
        maxHeight={500}
      >
        {({ width, height }) => (
          <ClientChart minHeight={height}>
            <FunnelSVG data={data} width={width} height={height} colors={colors} />
          </ClientChart>
        )}
      </ChartContainer>
    </div>
  );
}
