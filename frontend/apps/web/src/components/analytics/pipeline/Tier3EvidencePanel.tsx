'use client';

import { useMemo } from 'react';
import {
  ChartContainer,
  ClientChart,
  StackedBarChart,
  BarChart,
  PieChart,
  ChartLegend,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import { Card } from '@/components/ui';
import type { BarChartDatum, PieChartDatum } from '@/lib/charts/types';
import type { Tier3EvidenceStats } from '@/lib/actions/pipeline-analytics';

interface Tier3EvidencePanelProps {
  data: Tier3EvidenceStats | null;
}

/** Human-readable labels for evidence flag keys. */
const FLAG_LABELS: Record<keyof Tier3EvidenceStats['flags'], string> = {
  federalMandateConfirmed: 'Federal Mandate',
  stateDiscretionFound: 'State Discretion',
  modernizedAlternativeFound: 'Modern Alternative',
  supersededByLaw: 'Superseded by Law',
  advocacyForChange: 'Advocacy for Change',
};

/** Human-readable labels for cleanup type keys. */
const CLEANUP_TYPE_LABELS: Record<string, string> = {
  alternative_in_practice: 'Alternative in Practice',
  alternative_authorized: 'Alternative Authorized',
  peer_state_solution: 'Peer State Solution',
};

/**
 * Panel visualizing Tier 3 evidence findings.
 *
 * Contains three sub-sections:
 * 1. Flag distribution stacked bar chart
 * 2. Severity adjustment bar chart
 * 3. Easy cleanup summary with pie chart breakdown
 */
export function Tier3EvidencePanel({ data }: Tier3EvidencePanelProps) {
  const { colors } = useChartColors();

  // --- Section 1: Flag Distribution ---
  const flagBarData = useMemo(() => {
    if (!data) return [];

    const flagKeys = Object.keys(FLAG_LABELS) as Array<keyof Tier3EvidenceStats['flags']>;

    return flagKeys.map((key) => ({
      label: FLAG_LABELS[key],
      segments: [
        { label: 'True', value: data.flags[key].true, color: colors.success },
        { label: 'False', value: data.flags[key].false, color: colors.neutral300 },
      ],
    }));
  }, [data, colors.success, colors.neutral300]);

  const flagLegendItems = useMemo(
    () => [
      { label: 'True', color: colors.success },
      { label: 'False', color: colors.neutral300 },
    ],
    [colors.success, colors.neutral300]
  );

  // --- Section 2: Severity Adjustments ---
  const severityAdjustmentData = useMemo((): BarChartDatum[] => {
    if (!data || data.severityAdjustments.length === 0) return [];

    return data.severityAdjustments.map((entry) => {
      let color: string;
      let label: string;

      if (entry.adjustment < 0) {
        color = colors.success;
        label = String(entry.adjustment);
      } else if (entry.adjustment === 0) {
        color = colors.neutral400;
        label = '0';
      } else {
        color = colors.danger;
        label = `+${entry.adjustment}`;
      }

      return { label, value: entry.count, color };
    });
  }, [data, colors.success, colors.neutral400, colors.danger]);

  // --- Section 3: Easy Cleanup ---
  const cleanupPieData = useMemo((): PieChartDatum[] => {
    if (!data || data.cleanup.byType.length === 0) return [];

    return data.cleanup.byType.map((entry) => ({
      label: CLEANUP_TYPE_LABELS[entry.cleanupType] ?? formatCleanupType(entry.cleanupType),
      value: entry.count,
    }));
  }, [data]);

  // --- Null state ---
  if (!data) {
    return (
      <Card variant="bordered" padding="lg">
        <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
          No Tier 3 evidence data available
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Flag Distribution */}
      {flagBarData.length > 0 && (
        <div>
          <ChartContainer
            title="Tier 3 Evidence Flags"
            aspectRatio={16 / 9}
            minHeight={250}
            maxHeight={450}
          >
            {({ width, height }) => (
              <ClientChart minHeight={250}>
                <StackedBarChart data={flagBarData} width={width} height={height} />
              </ClientChart>
            )}
          </ChartContainer>
          <div className="mt-2">
            <ChartLegend items={flagLegendItems} />
          </div>
        </div>
      )}

      {/* Section 2: Severity Adjustments */}
      {severityAdjustmentData.length > 0 && (
        <ChartContainer
          title="Tier 3 Severity Adjustments"
          aspectRatio={16 / 9}
          minHeight={220}
          maxHeight={400}
        >
          {({ width, height }) => (
            <ClientChart minHeight={220}>
              <BarChart
                data={severityAdjustmentData}
                width={width}
                height={height}
                barPadding={0.15}
                showLabels={false}
              />
            </ClientChart>
          )}
        </ChartContainer>
      )}

      {/* Section 3: Easy Cleanup Candidates */}
      <Card padding="md">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">
          Easy Cleanup Candidates
        </h3>
        <div className="flex items-center gap-8">
          <div className="flex flex-col items-center justify-center min-w-[120px]">
            <span className="text-4xl font-bold text-[var(--color-text)]">
              {data.cleanup.totalCandidates.toLocaleString()}
            </span>
            <span className="text-sm text-[var(--color-text-muted)] mt-1">Total Candidates</span>
          </div>

          {cleanupPieData.length > 0 && (
            <div className="flex-1">
              <ChartContainer
                title="Breakdown by Type"
                aspectRatio={4 / 3}
                minHeight={200}
                maxHeight={300}
                padding="sm"
              >
                {({ width, height }) => (
                  <ClientChart minHeight={200}>
                    <PieChart
                      data={cleanupPieData}
                      width={width}
                      height={height}
                      innerRadiusRatio={0.5}
                      showLabels
                    />
                  </ClientChart>
                )}
              </ChartContainer>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

/**
 * Fallback formatter for cleanup types not in the lookup table.
 * Converts snake_case to Title Case.
 */
function formatCleanupType(type: string): string {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
