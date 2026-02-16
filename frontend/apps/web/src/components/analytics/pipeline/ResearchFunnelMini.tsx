'use client';

import { useMemo } from 'react';
import { ChartContainer, ClientChart } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import { Card } from '@/components/ui';
import type { ResearchFunnelStats } from '@/lib/actions/pipeline-analytics';

interface ResearchFunnelMiniProps {
  data: ResearchFunnelStats | null;
}

interface FunnelSVGProps {
  data: ResearchFunnelStats;
  width: number;
  height: number;
  colors: ReturnType<typeof useChartColors>;
}

function FunnelMiniSVG({ data, width, height, colors }: FunnelSVGProps) {
  const layout = useMemo(() => {
    const colWidth = Math.min(120, width * 0.25);
    const headerH = 28;
    const barTop = headerH + 12;
    const barBottom = height - (data.tier2Fetched > 0 ? 40 : 28);
    const maxBarH = barBottom - barTop;
    const gap = (width - 2 * colWidth) / 3;

    const maxVal = Math.max(data.tier1Requested, data.contextCited, 1);

    const cols = [
      { label: 'Recommended by Tier 1', value: data.tier1Requested, x: gap },
      { label: 'Cited in Analysis', value: data.contextCited, x: gap * 2 + colWidth },
    ].map((col) => {
      const barH = maxVal > 0 ? (col.value / maxVal) * maxBarH : 0;
      return { ...col, barH, barY: barBottom - barH };
    });

    // Single flow path between the two columns
    const from = cols[0];
    const to = cols[1];
    const x1 = from.x + colWidth;
    const x2 = to.x;
    const cpOff = (x2 - x1) * 0.4;
    const flowPath = [
      `M ${x1} ${from.barY}`,
      `C ${x1 + cpOff} ${from.barY}, ${x2 - cpOff} ${to.barY}, ${x2} ${to.barY}`,
      `L ${x2} ${barBottom}`,
      `C ${x2 - cpOff} ${barBottom}, ${x1 + cpOff} ${barBottom}, ${x1} ${barBottom}`,
      'Z',
    ].join(' ');

    // Citation rate
    let citationLabel = '';
    if (data.tier1Requested > 0) {
      const rate = ((data.contextCited / data.tier1Requested) * 100).toFixed(0);
      citationLabel = `${rate}% citation rate`;
    }

    const midX = (from.x + colWidth + to.x) / 2;
    const midY = (barTop + barBottom) / 2;

    return { cols, flowPath, citationLabel, colWidth, barTop, barBottom, midX, midY };
  }, [data, width, height]);

  const colColors = [colors.colors.primary, colors.colors.success];

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Research funnel: ${data.tier1Requested} recommended by Tier 1, ${data.contextCited} cited in analysis`}
    >
      {/* Flow path */}
      <path d={layout.flowPath} fill={colors.colors.primary} opacity={0.12} />

      {/* Columns */}
      {layout.cols.map((col, i) => (
        <g key={col.label}>
          {/* Header */}
          <text
            x={col.x + layout.colWidth / 2}
            y={14}
            textAnchor="middle"
            className="fill-[var(--color-text-muted)]"
            fontSize={11}
          >
            {col.label}
          </text>

          {/* Bar */}
          <rect
            x={col.x}
            y={col.barY}
            width={layout.colWidth}
            height={col.barH}
            fill={colColors[i]}
            rx={4}
          />

          {/* Value — inside bar if tall enough, above otherwise */}
          {col.barH > 20 ? (
            <text
              x={col.x + layout.colWidth / 2}
              y={col.barY + col.barH / 2 + 4}
              textAnchor="middle"
              fill={colors.getContrastColor(colColors[i])}
              fontSize={13}
              fontWeight={700}
            >
              {col.value.toLocaleString()}
            </text>
          ) : (
            <text
              x={col.x + layout.colWidth / 2}
              y={col.barY - 4}
              textAnchor="middle"
              className="fill-[var(--color-text)]"
              fontSize={12}
              fontWeight={600}
            >
              {col.value.toLocaleString()}
            </text>
          )}
        </g>
      ))}

      {/* Citation rate label between columns */}
      {layout.citationLabel && (
        <text
          x={layout.midX}
          y={layout.midY}
          textAnchor="middle"
          className="fill-[var(--color-text-muted)]"
          fontSize={11}
          fontWeight={500}
        >
          {layout.citationLabel}
        </text>
      )}

      {/* Tier 2 annotation below the funnel */}
      {data.tier2Fetched > 0 && (
        <text
          x={width / 2}
          y={height - 8}
          textAnchor="middle"
          className="fill-[var(--color-text-muted)]"
          fontSize={10}
          fontStyle="italic"
        >
          Plus {data.tier2Fetched.toLocaleString()} additional context requests in Tier 2
        </text>
      )}
    </svg>
  );
}

/**
 * Compact SVG funnel showing: Recommended by Tier 1 → Cited in Analysis.
 * Optional annotation for Tier 2 additional context requests.
 * ~180px tall, full width.
 */
export function ResearchFunnelMini({ data }: ResearchFunnelMiniProps) {
  const colors = useChartColors();

  if (!data || (data.tier1Requested === 0 && data.contextCited === 0)) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)]">
        No research funnel data available
      </Card>
    );
  }

  return (
    <ChartContainer
      title="Research Funnel"
      description="Context recommended by Tier 1 analysis vs. actually cited in final output"
      aspectRatio={3}
      minHeight={180}
      maxHeight={260}
    >
      {({ width, height }) => (
        <ClientChart minHeight={180}>
          <FunnelMiniSVG data={data} width={width} height={height} colors={colors} />
        </ClientChart>
      )}
    </ChartContainer>
  );
}
