'use client';

import { useMemo } from 'react';
import {
  HorizontalBarChart,
  ChartContainer,
  ClientChart,
} from '@/components/charts';
import { Card } from '@/components/ui';
import type { Tier2ContextRequestsStats } from '@/lib/actions/pipeline-analytics';
import type { BarChartDatum } from '@/lib/charts/types';
import { useChartColors } from '@/hooks/useChartColors';

interface Tier2ContextRequestsPanelProps {
  data: Tier2ContextRequestsStats | null;
}

function formatLabel(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Panel displaying Tier 2 additional context request analytics.
 * Shows summary stats + horizontal bar chart of request types.
 */
export function Tier2ContextRequestsPanel({ data }: Tier2ContextRequestsPanelProps) {
  const { colors } = useChartColors();

  const barData = useMemo((): BarChartDatum[] => {
    if (!data || data.byContextType.length === 0) return [];

    // Aggregate by context type (ignore need level for the bar chart)
    const totals = new Map<string, number>();
    for (const row of data.byContextType) {
      totals.set(row.contextType, (totals.get(row.contextType) ?? 0) + row.count);
    }

    return [...totals.entries()]
      .map(([type, count]) => ({ label: formatLabel(type), value: count }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  if (!data) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)]">
        No Tier 2 context request data available
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">
        Tier 2 Additional Requests
      </h3>

      {/* Summary stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.totalRequests.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Total Requests</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.totalAnalysesWithRequests.toLocaleString()}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Analyses With Requests</div>
        </Card>
        <Card padding="md" className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text)]">
            {data.summary.avgRequestsPerAnalysis.toFixed(1)}
          </div>
          <div className="text-sm text-[var(--color-text-muted)]">Avg Requests / Analysis</div>
        </Card>
      </div>

      {/* Bar chart */}
      {barData.length > 0 && (
        <ChartContainer
          title="Requests by Context Type"
          aspectRatio={2}
          minHeight={Math.max(160, barData.length * 40)}
          maxHeight={350}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              <HorizontalBarChart data={barData} width={width} height={height} maxBars={10} />
            </ClientChart>
          )}
        </ChartContainer>
      )}
    </div>
  );
}
