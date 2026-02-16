'use client';

import { useMemo } from 'react';
import {
  HorizontalBarChart,
  BarChart,
  ChartContainer,
  ClientChart,
  HeatmapGrid,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import { Card } from '@/components/ui';
import type { TierTransitionData } from '@/lib/actions/pipeline-analytics';
import type { HeatmapData, BarChartDatum } from '@/lib/charts/types';

interface TierTransitionPanelProps {
  data: TierTransitionData | null;
}

/**
 * Panel displaying classification changes between pipeline tiers.
 *
 * Contains three sub-sections:
 * 1. Tier 2 -> 3 classification cross-tab heatmap
 * 2. Tier 3 trigger reasons horizontal bar chart
 * 3. Confidence distributions per tier (3 histograms)
 */
export function TierTransitionPanel({ data }: TierTransitionPanelProps) {
  const { colors } = useChartColors();

  // Transform classificationCrossTab into HeatmapData
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

  // Transform triggerReasons into BarChartDatum[]
  const triggerReasonData = useMemo((): BarChartDatum[] => {
    if (!data || data.triggerReasons.length === 0) return [];

    return data.triggerReasons.map((entry) => ({
      label: formatReasonLabel(entry.reason),
      value: entry.count,
    }));
  }, [data]);

  // Transform confidence distributions into BarChartDatum[] per tier
  const confidenceData = useMemo(() => {
    if (!data) return { tier1: [], tier2: [], tier3: [] };

    const transform = (buckets: Array<{ bucket: string; count: number }>): BarChartDatum[] =>
      buckets.map((b) => ({
        label: b.bucket,
        value: b.count,
        color: colors.primary,
      }));

    return {
      tier1: transform(data.confidenceDistributions.tier1),
      tier2: transform(data.confidenceDistributions.tier2),
      tier3: transform(data.confidenceDistributions.tier3),
    };
  }, [data, colors.primary]);

  if (!data) {
    return (
      <Card variant="bordered" padding="lg">
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          No transition data available for this selection.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Tier 2->3 Classification Heatmap */}
      {heatmapData && (
        <ChartContainer
          title="Tier 2\u21923 Classification Changes"
          description="How classifications changed between Tier 2 and Tier 3 analysis"
          aspectRatio={16 / 10}
          minHeight={280}
          maxHeight={500}
          margin={{ top: 60, right: 20, bottom: 20, left: 120 }}
        >
          {({ width, height }) => (
            <ClientChart minHeight={280}>
              <HeatmapGrid data={heatmapData} width={width} height={height} />
            </ClientChart>
          )}
        </ChartContainer>
      )}

      {/* Section 2: Trigger Reasons */}
      {triggerReasonData.length > 0 && (
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
      )}

      {/* Section 3: Confidence Distributions */}
      {(confidenceData.tier1.length > 0 ||
        confidenceData.tier2.length > 0 ||
        confidenceData.tier3.length > 0) && (
        <div>
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
            Confidence Distributions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(['tier1', 'tier2', 'tier3'] as const).map((tier, index) => {
              const tierData = confidenceData[tier];
              if (tierData.length === 0) return null;

              const tierLabel = `Tier ${index + 1} Confidence`;

              return (
                <ChartContainer
                  key={tier}
                  title={tierLabel}
                  aspectRatio={4 / 3}
                  minHeight={200}
                  maxHeight={350}
                  padding="sm"
                >
                  {({ width, height }) => (
                    <ClientChart minHeight={200}>
                      <BarChart
                        data={tierData}
                        width={width}
                        height={height}
                        barPadding={0.15}
                        showLabels={false}
                        margin={{ top: 10, right: 10, bottom: 30, left: 40 }}
                      />
                    </ClientChart>
                  )}
                </ChartContainer>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Format a trigger reason label: replace underscores with spaces and title-case.
 */
function formatReasonLabel(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
