'use client';

import { useMemo } from 'react';
import {
  HorizontalBarChart,
  PieChart,
  ChartContainer,
  ClientChart,
} from '@/components/charts';
import { Card } from '@/components/ui';
import type { ContextUsedStats } from '@/lib/actions/pipeline-analytics';
import type { BarChartDatum, PieChartDatum } from '@/lib/charts/types';

interface ContextUsedPanelProps {
  data: ContextUsedStats | null;
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Panel showing context_used breakdown by source type and web sub-types.
 */
export function ContextUsedPanel({ data }: ContextUsedPanelProps) {
  const sourceBarData = useMemo((): BarChartDatum[] => {
    if (!data) return [];
    return data.bySourceType
      .filter((r) => r.sourceType !== 'self')
      .map((r) => ({ label: formatLabel(r.sourceType), value: r.count }));
  }, [data]);

  const webPieData = useMemo((): PieChartDatum[] => {
    if (!data || data.webBySourceType.length === 0) return [];
    return data.webBySourceType.map((r) => ({
      label: formatLabel(r.sourceType),
      value: r.count,
    }));
  }, [data]);

  if (!data) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)]">
        No context usage data available
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">
        Context Cited in Analysis
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.totalContextEntries.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Citations</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.totalAnalysesWithContext.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Analyses With Context</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.avgContextPerAnalysis.toFixed(1)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Avg Citations / Analysis</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source type bar chart */}
        {sourceBarData.length > 0 && (
          <ChartContainer
            title="By Source Type"
            description="Context entries cited, excluding 'self' (the regulation text itself)"
            aspectRatio={4 / 3}
            minHeight={Math.max(180, sourceBarData.length * 40)}
            maxHeight={400}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                <HorizontalBarChart data={sourceBarData} width={width} height={height} maxBars={10} />
              </ClientChart>
            )}
          </ChartContainer>
        )}

        {/* Web source types pie chart */}
        {webPieData.length > 0 && (
          <ChartContainer
            title="Web Source Types"
            description="Breakdown of web evidence by source type"
            aspectRatio={4 / 3}
            minHeight={200}
            maxHeight={350}
          >
            {({ width, height }) => (
              <ClientChart minHeight={200}>
                <PieChart
                  data={webPieData}
                  width={width}
                  height={height}
                  innerRadiusRatio={0.5}
                  showLabels
                />
              </ClientChart>
            )}
          </ChartContainer>
        )}
      </div>
    </div>
  );
}
