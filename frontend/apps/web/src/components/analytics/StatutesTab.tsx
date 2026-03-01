'use client';

import { useMemo } from 'react';
import { Scale, Link2, FileText, Building2 } from 'lucide-react';
import type { StatuteLinkStats } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@/types/state';
import { StatCard, StatGrid } from '@/components/ui';
import { ClientChart, ChartContainer, HorizontalBarChart, PieChart, ChartLegend } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import { LINK_TYPE_LABELS, MATCH_STATUS_LABELS } from '@/lib/constants/values';
import type { BarChartDatum, PieChartDatum } from '@/lib/charts/types';

interface StatutesTabProps {
  stats: StatuteLinkStats | null;
  jurisdiction: JurisdictionCode;
}

/** Color mapping for match statuses */
const MATCH_STATUS_COLORS: Record<string, string> = {
  matched: '#1e752e',    // success green
  corrected: '#004dd1',  // info blue
  unmatched: '#b45309',  // warning yellow
  obsolete: '#b52c2c',   // danger red
};

function formatLinkType(type: string): string {
  return LINK_TYPE_LABELS[type] || type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function formatMatchStatus(status: string): string {
  return MATCH_STATUS_LABELS[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function StatutesTab({ stats, jurisdiction }: StatutesTabProps) {
  const colors = useChartColors();

  // Convert link type data to bar chart format
  const linkTypeData: BarChartDatum[] = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byLinkType)
      .map(([type, count]) => ({
        label: formatLinkType(type),
        value: count,
        secondaryLabel: type,
      }))
      .sort((a, b) => b.value - a.value);
  }, [stats]);

  // Convert match status data to pie chart format
  const matchStatusData: PieChartDatum[] = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats.byMatchStatus)
      .map(([status, count]) => ({
        label: formatMatchStatus(status),
        value: count,
        color: MATCH_STATUS_COLORS[status] || colors.categoryScale(status),
      }))
      .filter((d) => d.value > 0);
  }, [stats, colors]);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
        No statute data available
      </div>
    );
  }

  const linkedPercent = stats.totalStatutes > 0
    ? ((stats.linkedStatutes / stats.totalStatutes) * 100).toFixed(1)
    : '0';

  const regsWithLinksPercent = stats.totalRegulations > 0
    ? ((stats.regulationsWithLinks / stats.totalRegulations) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Statutes"
          value={stats.totalStatutes.toLocaleString()}
          icon={Scale}
          subtitle={`${jurisdiction.toUpperCase()} statute corpus`}
        />
        <StatCard
          label="Linked Statutes"
          value={stats.linkedStatutes.toLocaleString()}
          icon={Link2}
          variant="info"
          subtitle={`${linkedPercent}% of total`}
        />
        <StatCard
          label="Total Links"
          value={stats.totalLinks.toLocaleString()}
          icon={FileText}
          subtitle="Regulation-statute links"
        />
        <StatCard
          label="Regulations with Links"
          value={stats.regulationsWithLinks.toLocaleString()}
          icon={Building2}
          variant="success"
          subtitle={`${regsWithLinksPercent}% of ${stats.totalRegulations.toLocaleString()} regulations`}
        />
      </StatGrid>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Link Type Distribution - Bar Chart */}
        <ChartContainer
          title="Link Type Distribution"
          description="Regulation-statute links by relationship type"
          aspectRatio={1.5}
          minHeight={Math.max(250, linkTypeData.length * 50)}
          maxHeight={400}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              {linkTypeData.length > 0 ? (
                <HorizontalBarChart
                  data={linkTypeData}
                  width={width}
                  height={height}
                  maxBars={10}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                  No link type data available
                </div>
              )}
            </ClientChart>
          )}
        </ChartContainer>

        {/* Match Quality - Pie/Donut Chart */}
        <ChartContainer
          title="Match Quality"
          description="Distribution of statute link match statuses"
          aspectRatio={1.2}
          minHeight={280}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {matchStatusData.length > 0 ? (
                  <PieChart
                    data={matchStatusData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No match status data
                  </div>
                )}
              </ClientChart>
              {matchStatusData.length > 0 && (
                <ChartLegend
                  items={matchStatusData.map((d) => ({
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
      </div>

      {/* Link Type Details */}
      {linkTypeData.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {linkTypeData.map((item) => (
            <div
              key={item.label}
              className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]"
            >
              <div className="text-2xl font-bold text-[var(--color-text)]">
                {item.value.toLocaleString()}
              </div>
              <div className="text-sm text-[var(--color-text-muted)]">{item.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
