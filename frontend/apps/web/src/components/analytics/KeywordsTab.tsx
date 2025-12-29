'use client';

import { useMemo } from 'react';
import type { SectionTypeStats, MetadataStats, KeywordStats } from '@/lib/actions/regulations';
import { Card } from '@/components/ui';
import {
  ClientChart,
  ChartContainer,
  PieChart,
  HorizontalBarChart,
  ChartLegend,
} from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import type { PieChartDatum, BarChartDatum } from '@/lib/charts/types';

interface KeywordsTabProps {
  sectionTypeStats: SectionTypeStats[];
  topKeywords: KeywordStats[];
  metadataStats: MetadataStats | null;
}

// Human-readable labels for section types
const SECTION_TYPE_LABELS: Record<string, string> = {
  definitions: 'Definitions',
  requirements: 'Requirements',
  procedures: 'Procedures',
  prohibitions: 'Prohibitions',
  standards: 'Standards',
  eligibility: 'Eligibility',
  penalties: 'Penalties',
  fees: 'Fees',
  forms: 'Forms',
  reporting: 'Reporting',
  scope: 'Scope',
  exemptions: 'Exemptions',
  reserved: 'Reserved',
};

export function KeywordsTab({
  sectionTypeStats,
  topKeywords,
  metadataStats,
}: KeywordsTabProps) {
  const colors = useChartColors();

  // Convert section type stats to pie chart data
  const sectionTypePieData: PieChartDatum[] = useMemo(() => {
    return sectionTypeStats.map((stat) => ({
      label: SECTION_TYPE_LABELS[stat.sectionType] || stat.sectionType,
      value: stat.count,
      color: colors.categoryScale(stat.sectionType),
    }));
  }, [sectionTypeStats, colors]);

  // Convert keywords to bar chart data
  const keywordBarData: BarChartDatum[] = useMemo(() => {
    return topKeywords.map((kw) => ({
      label: kw.keyword,
      value: kw.count,
    }));
  }, [topKeywords]);

  // Calculate metadata coverage
  const metadataCoverage = useMemo(() => {
    if (!metadataStats) return null;
    const total = metadataStats.total;
    if (total === 0) return null;

    return {
      withSummary: ((metadataStats.withSummary / total) * 100).toFixed(0),
      withForm: ((metadataStats.withForm / total) * 100).toFixed(0),
      withIbr: ((metadataStats.withIbr / total) * 100).toFixed(0),
    };
  }, [metadataStats]);

  return (
    <div className="space-y-6">
      {/* Metadata Coverage */}
      {metadataCoverage && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card padding="md" className="text-center">
            <div className="text-3xl font-bold text-[var(--color-primary)]">
              {metadataCoverage.withSummary}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Have AI Summaries</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl font-bold text-[var(--color-info)]">
              {metadataCoverage.withForm}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Reference Forms</div>
          </Card>
          <Card padding="md" className="text-center">
            <div className="text-3xl font-bold text-[var(--color-warning)]">
              {metadataCoverage.withIbr}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">
              Incorporate External Standards
            </div>
          </Card>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section Type Distribution */}
        <ChartContainer
          title="Section Type Distribution"
          description="AI-categorized section types across regulations"
          aspectRatio={1.2}
          minHeight={300}
          maxHeight={400}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {sectionTypePieData.length > 0 ? (
                  <PieChart
                    data={sectionTypePieData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No section type data available
                  </div>
                )}
              </ClientChart>
              {sectionTypePieData.length > 0 && (
                <ChartLegend
                  items={sectionTypePieData.slice(0, 6).map((d) => ({
                    label: d.label,
                    color: d.color ?? colors.categoryScale(d.label),
                    value: d.value,
                  }))}
                  orientation="horizontal"
                  className="flex-wrap justify-center"
                />
              )}
            </div>
          )}
        </ChartContainer>

        {/* Top Keywords */}
        <ChartContainer
          title="Top Keywords"
          description="Most common keywords extracted from regulations"
          aspectRatio={1.2}
          minHeight={300}
          maxHeight={500}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              {keywordBarData.length > 0 ? (
                <HorizontalBarChart
                  data={keywordBarData}
                  width={width}
                  height={height}
                  maxBars={15}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                  No keyword data available
                </div>
              )}
            </ClientChart>
          )}
        </ChartContainer>
      </div>

      {/* Section Type Details */}
      {sectionTypeStats.length > 0 && (
        <Card padding="md">
          <h4 className="text-sm font-medium text-[var(--color-text)] mb-3">
            All Section Types
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {sectionTypeStats.map((stat) => (
              <div
                key={stat.sectionType}
                className="flex items-center gap-2 text-sm p-2 bg-[var(--color-neutral-50)] rounded-[var(--radius-md)]"
              >
                <span
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: colors.categoryScale(stat.sectionType) }}
                />
                <span className="text-[var(--color-text-secondary)] truncate flex-1">
                  {SECTION_TYPE_LABELS[stat.sectionType] || stat.sectionType}
                </span>
                <span className="text-[var(--color-text-muted)] font-medium">
                  {stat.count}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
