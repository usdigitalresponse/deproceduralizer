'use client';

import { useMemo } from 'react';
import {
  HorizontalBarChart,
  ChartContainer,
  ClientChart,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import { Card } from '@/components/ui';
import type { ConfidenceByClassificationData } from '@/lib/actions/pipeline-analytics';
import type { BarChartDatum } from '@/lib/charts/types';

interface ConfidenceDistributionsProps {
  data: ConfidenceByClassificationData | null;
}

const TIER_LABELS: Record<string, string> = {
  tier1: 'Tier 1 Confidence',
  tier2: 'Tier 2 Confidence',
  tier3: 'Tier 3 Confidence',
};

/**
 * Confidence by Classification: horizontal bar charts showing average confidence
 * per classification outcome for each tier.
 */
export function ConfidenceDistributions({ data }: ConfidenceDistributionsProps) {
  const { categoryScale } = useChartColors();

  const chartData = useMemo(() => {
    if (!data) return { tier1: [], tier2: [], tier3: [] };

    const transform = (
      classifications: Array<{ classification: string; avgConfidence: number; count: number }>
    ): BarChartDatum[] =>
      classifications.map((c) => ({
        label: c.classification,
        value: c.avgConfidence,
        color: categoryScale(c.classification),
        secondaryLabel: `(${c.count.toLocaleString()})`,
      }));

    const result: Record<string, BarChartDatum[]> = { tier1: [], tier2: [], tier3: [] };
    for (const tierData of data.tiers) {
      result[tierData.tier] = transform(tierData.classifications);
    }

    return result;
  }, [data, categoryScale]);

  const hasData =
    chartData.tier1.length > 0 ||
    chartData.tier2.length > 0 ||
    chartData.tier3.length > 0;

  if (!data || !hasData) {
    return (
      <Card variant="bordered" padding="lg">
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          No confidence by classification data available
        </div>
      </Card>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
        Confidence by Classification
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['tier1', 'tier2', 'tier3'] as const).map((tier) => {
          const tierData = chartData[tier];
          if (tierData.length === 0) return null;

          return (
            <ChartContainer
              key={tier}
              title={TIER_LABELS[tier]}
              aspectRatio={4 / 3}
              minHeight={200}
              maxHeight={350}
              padding="sm"
            >
              {({ width, height }) => (
                <ClientChart minHeight={200}>
                  <HorizontalBarChart
                    data={tierData}
                    width={width}
                    height={height}
                    maxBars={10}
                    sortOrder="descending"
                    barPadding={0.25}
                    showLabels={false}
                  />
                </ClientChart>
              )}
            </ChartContainer>
          );
        })}
      </div>
    </div>
  );
}
