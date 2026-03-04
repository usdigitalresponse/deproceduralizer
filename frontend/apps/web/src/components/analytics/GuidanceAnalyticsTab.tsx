'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ScrollText, Link2, Building2, FileText } from 'lucide-react';
import type { GuidanceOverviewStats, GuidanceCitationStats } from '@/lib/actions/guidance-documents';
import type { JurisdictionCode } from '@/types/state';
import { formatLabel } from '@/types/regulation';
import { StatCard, StatGrid } from '@/components/ui';
import { ClientChart, ChartContainer, HorizontalBarChart, PieChart, ChartLegend } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import type { BarChartDatum, PieChartDatum } from '@/lib/charts/types';

interface GuidanceAnalyticsTabProps {
  overviewStats: GuidanceOverviewStats | null;
  citationStats: GuidanceCitationStats | null;
  jurisdiction: JurisdictionCode;
}

/** Color mapping for policy categories */
const CATEGORY_COLORS: Record<string, string> = {
  policy_directive: '#3b82f6',
  legal_interpretation: '#8b5cf6',
  tax_guidance: '#f97316',
  informational: '#06b6d4',
  reference_material: '#22c55e',
  non_policy: '#9ca3af',
  data_dump: '#78716c',
  unclassified: '#d4d4d4',
};

export function GuidanceAnalyticsTab({ overviewStats, citationStats, jurisdiction }: GuidanceAnalyticsTabProps) {
  const colors = useChartColors();

  // By agency bar chart data
  const agencyData: BarChartDatum[] = useMemo(() => {
    if (!overviewStats) return [];
    return overviewStats.byAgency
      .map((row) => ({
        label: row.agency,
        value: row.count,
      }))
      .slice(0, 15);
  }, [overviewStats]);

  // Citation coverage by agency
  const citationCoverageData: BarChartDatum[] = useMemo(() => {
    if (!citationStats) return [];
    return citationStats.citationsByAgency
      .filter((row) => row.totalDocs > 0)
      .map((row) => ({
        label: row.agency,
        value: Math.round((row.docsWithCitations / row.totalDocs) * 100),
        secondaryLabel: `${row.docsWithCitations}/${row.totalDocs}`,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [citationStats]);

  // Policy category pie data
  const categoryData: PieChartDatum[] = useMemo(() => {
    if (!overviewStats) return [];
    return overviewStats.byPolicyCategory
      .map((row) => ({
        label: formatLabel(row.category),
        value: row.count,
        color: CATEGORY_COLORS[row.category.toLowerCase()] || colors.categoryScale(row.category),
      }))
      .filter((d) => d.value > 0);
  }, [overviewStats, colors]);

  // Status pie data
  const statusData: PieChartDatum[] = useMemo(() => {
    if (!overviewStats) return [];
    const STATUS_COLORS: Record<string, string> = {
      active: '#1e752e',
      superseded: '#b45309',
      canceled: '#b52c2c',
      expired: '#9ca3af',
    };
    return overviewStats.byStatus
      .map((row) => ({
        label: row.status.charAt(0).toUpperCase() + row.status.slice(1),
        value: row.count,
        color: STATUS_COLORS[row.status.toLowerCase()] || colors.categoryScale(row.status),
      }))
      .filter((d) => d.value > 0);
  }, [overviewStats, colors]);

  if (!overviewStats) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-muted)]">
        No guidance data available for this jurisdiction
      </div>
    );
  }

  const citationPercent = citationStats && citationStats.totalDocs > 0
    ? ((citationStats.docsWithCitations / citationStats.totalDocs) * 100).toFixed(1)
    : '0';

  const agencyCount = overviewStats.byAgency.length;
  const distinctCitedRegs = citationStats?.topCitedRegulations.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Documents"
          value={overviewStats.total.toLocaleString()}
          icon={ScrollText}
          subtitle={`${jurisdiction.toUpperCase()} guidance corpus`}
        />
        <StatCard
          label="With Citations"
          value={citationStats?.docsWithCitations.toLocaleString() ?? '—'}
          icon={Link2}
          variant="info"
          subtitle={`${citationPercent}% cite regulations`}
        />
        <StatCard
          label="Agencies"
          value={agencyCount.toLocaleString()}
          icon={Building2}
          variant="success"
          subtitle="Issuing agencies"
        />
        <StatCard
          label="Top Cited Regulations"
          value={distinctCitedRegs.toLocaleString()}
          icon={FileText}
          subtitle="Distinct regulations cited"
        />
      </StatGrid>

      {/* Charts Row 1: By Agency + Citation Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Documents by Agency"
          description="Top agencies by guidance document count"
          aspectRatio={1.5}
          minHeight={Math.max(250, agencyData.length * 30)}
          maxHeight={500}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              {agencyData.length > 0 ? (
                <HorizontalBarChart
                  data={agencyData}
                  width={width}
                  height={height}
                  maxBars={15}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                  No agency data
                </div>
              )}
            </ClientChart>
          )}
        </ChartContainer>

        <ChartContainer
          title="Citation Coverage by Agency"
          description="% of documents citing regulations, by agency"
          aspectRatio={1.5}
          minHeight={Math.max(250, citationCoverageData.length * 30)}
          maxHeight={500}
        >
          {({ width, height }) => (
            <ClientChart minHeight={height}>
              {citationCoverageData.length > 0 ? (
                <HorizontalBarChart
                  data={citationCoverageData}
                  width={width}
                  height={height}
                  maxBars={15}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                  No citation data
                </div>
              )}
            </ClientChart>
          )}
        </ChartContainer>
      </div>

      {/* Charts Row 2: Policy Category + Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartContainer
          title="Policy Category"
          description="Documents by policy classification"
          aspectRatio={1.2}
          minHeight={280}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {categoryData.length > 0 ? (
                  <PieChart
                    data={categoryData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No category data
                  </div>
                )}
              </ClientChart>
              {categoryData.length > 0 && (
                <ChartLegend
                  items={categoryData.map((d) => ({
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

        <ChartContainer
          title="Document Status"
          description="Active vs superseded/canceled/expired"
          aspectRatio={1.2}
          minHeight={280}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 80}>
                {statusData.length > 0 ? (
                  <PieChart
                    data={statusData}
                    width={Math.min(width - 20, height - 80)}
                    height={Math.min(width - 20, height - 80)}
                    innerRadiusRatio={0.5}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No status data
                  </div>
                )}
              </ClientChart>
              {statusData.length > 0 && (
                <ChartLegend
                  items={statusData.map((d) => ({
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

      {/* Top-Cited Regulations Table */}
      {citationStats && citationStats.topCitedRegulations.length > 0 && (
        <div className="bg-white rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] overflow-hidden">
          <div className="p-4 border-b border-[var(--color-neutral-200)]">
            <h3 className="font-semibold">Top-Cited Regulations</h3>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Regulations referenced by the most guidance documents
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
                  <th className="text-left py-2 px-4 font-medium text-[var(--color-text-muted)]">#</th>
                  <th className="text-left py-2 px-4 font-medium text-[var(--color-text-muted)]">Citation</th>
                  <th className="text-left py-2 px-4 font-medium text-[var(--color-text-muted)]">Title</th>
                  <th className="text-right py-2 px-4 font-medium text-[var(--color-text-muted)]">Guidance Docs</th>
                </tr>
              </thead>
              <tbody>
                {citationStats.topCitedRegulations.map((reg, i) => (
                  <tr
                    key={reg.regulationId}
                    className="border-b border-[var(--color-neutral-100)] last:border-b-0 hover:bg-[var(--color-neutral-50)]"
                  >
                    <td className="py-2 px-4 text-[var(--color-text-muted)]">{i + 1}</td>
                    <td className="py-2 px-4">
                      <Link
                        href={`/${jurisdiction}/regulations/${reg.regulationId}`}
                        className="text-[var(--color-link)] hover:text-[var(--color-link-hover)] hover:underline"
                      >
                        {reg.citation ?? `ID ${reg.regulationId}`}
                      </Link>
                    </td>
                    <td className="py-2 px-4 text-[var(--color-text)] max-w-md truncate">
                      {reg.title ?? '—'}
                    </td>
                    <td className="py-2 px-4 text-right font-medium">
                      {reg.guidanceCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
