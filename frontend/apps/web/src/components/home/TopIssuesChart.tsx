'use client';

import { ChartContainer } from '@/components/charts/ChartContainer';
import { ClientChart } from '@/components/charts/ClientChart';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

interface TopIssuesChartProps {
  byType: Record<string, number>;
}

export function TopIssuesChart({ byType }: TopIssuesChartProps) {
  const entries = Object.entries(byType)
    .map(([type, count]) => ({
      label: ISSUE_TYPE_LABELS[type] ?? type,
      value: count,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  if (entries.length === 0) {
    return null;
  }

  return (
    <ChartContainer
      title="Top Issue Types"
      aspectRatio={4 / 3}
      minHeight={200}
      maxHeight={320}
    >
      {({ width, height }) => (
        <ClientChart minHeight={200}>
          <HorizontalBarChart
            data={entries}
            width={width}
            height={height}
            maxBars={6}
          />
        </ClientChart>
      )}
    </ChartContainer>
  );
}

export default TopIssuesChart;
