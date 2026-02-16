'use client';

import { useMemo } from 'react';
import {
  HorizontalBarChart,
  ChartContainer,
  ClientChart,
} from '@/components/charts';
import { Card } from '@/components/ui';
import type { TierTransitionData } from '@/lib/actions/pipeline-analytics';
import type { BarChartDatum } from '@/lib/charts/types';

interface TriggerReasonsProps {
  data: TierTransitionData | null;
}

/**
 * Horizontal bar chart showing distribution of Tier 3 trigger reasons.
 * Extracted from TierTransitionPanel for subtab composition.
 */
export function TriggerReasons({ data }: TriggerReasonsProps) {
  const triggerReasonData = useMemo((): BarChartDatum[] => {
    if (!data || data.triggerReasons.length === 0) return [];

    return data.triggerReasons.map((entry) => ({
      label: formatReasonLabel(entry.reason),
      value: entry.count,
    }));
  }, [data]);

  if (!data || triggerReasonData.length === 0) {
    return (
      <Card variant="bordered" padding="lg">
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          No trigger reason data available
        </div>
      </Card>
    );
  }

  return (
    <ChartContainer
      title="Tier 3 Trigger Reasons"
      description="Distribution of reasons issues were escalated to Tier 3"
      aspectRatio={16 / 9}
      minHeight={200}
      maxHeight={400}
      margin={{ top: 10, right: 20, bottom: 30, left: 120 }}
    >
      {({ width, height }) => (
        <ClientChart minHeight={200}>
          <HorizontalBarChart data={triggerReasonData} width={width} height={height} />
        </ClientChart>
      )}
    </ChartContainer>
  );
}

function formatReasonLabel(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
