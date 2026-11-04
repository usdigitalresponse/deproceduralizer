'use client';

import { useMemo, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { ScrollText, Link2, Building2, FileText, BookOpen, GitBranch, FolderTree, AlertTriangle, ChevronDown, ChevronRight, Calendar } from 'lucide-react';
import type { GuidanceOverviewStats, GuidanceCitationStats, GuidanceReadabilityStats, ReadabilityCrossCutStats, LineageStats, DocumentFamily } from '@/lib/actions/guidance-documents';
import { getReadabilityByAgencyFiltered } from '@/lib/actions/guidance-documents';
import type { JurisdictionCode } from '@/types/state';
import { formatLabel } from '@/types/regulation';
import { getReadabilityLabel } from '@/components/guidance/ReadabilityBadge';
import { GuidanceStatusBadge } from '@/components/guidance/GuidanceStatusBadge';
import { FleschEaseKey, GradeLevelKey } from '@/components/guidance/ReadabilityScaleKey';
import { StatCard, StatGrid, MultiSelect } from '@/components/ui';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { ReadabilityCrossCutSection } from '@/components/guidance/ReadabilityCrossCutSection';
import { StickyPageSectionTabs } from '@/components/navigation/StickyPageSectionTabs';
import type { SectionConfig } from '@/hooks/useActiveSection';
import { ClientChart, ChartContainer, HorizontalBarChart, PieChart, ChartLegend } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';
import type { BarChartDatum, PieChartDatum } from '@/lib/charts/types';

interface GuidanceAnalyticsTabProps {
  overviewStats: GuidanceOverviewStats | null;
  citationStats: GuidanceCitationStats | null;
  readabilityStats: GuidanceReadabilityStats | null;
  crossCutStats: ReadabilityCrossCutStats | null;
  lineageStats: LineageStats | null;
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

export function GuidanceAnalyticsTab({ overviewStats, citationStats, readabilityStats, crossCutStats, lineageStats, jurisdiction }: GuidanceAnalyticsTabProps) {
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

  // By-year bar chart data
  const yearData: BarChartDatum[] = useMemo(() => {
    if (!overviewStats) return [];
    return overviewStats.byYear.map((row) => ({
      label: String(row.year),
      value: row.count,
    }));
  }, [overviewStats]);

  const sections: SectionConfig[] = useMemo(() => {
    const s: SectionConfig[] = [
      { id: 'guidance-overview', label: 'Overview' },
      { id: 'guidance-agencies', label: 'Agencies' },
      { id: 'guidance-categories', label: 'Categories' },
    ];
    if (citationStats && citationStats.topCitedRegulations.length > 0) {
      s.push({ id: 'guidance-citations', label: 'Top Citations', count: citationStats.topCitedRegulations.length });
    }
    if (lineageStats && lineageStats.docsWithLineage > 0) {
      s.push({ id: 'guidance-lineage', label: 'Lineage', count: lineageStats.docsWithLineage });
    }
    if (readabilityStats && readabilityStats.docsWithMetrics > 0) {
      s.push({ id: 'guidance-readability', label: 'Readability', count: readabilityStats.docsWithMetrics });
    }
    if (crossCutStats) {
      s.push({ id: 'guidance-crosscuts', label: 'Cross-Cuts' });
    }
    return s;
  }, [citationStats, lineageStats, readabilityStats, crossCutStats]);

  return (
    <div className="space-y-6">
      <div className="sticky top-[89px] z-10 bg-white border-b border-[var(--color-neutral-200)] -mx-1 px-1 pb-1 shadow-sm">
        <StickyPageSectionTabs sections={sections} scrollOffset={140} />
      </div>

      {/* Stat Cards */}
      <div id="guidance-overview" className="scroll-mt-[140px]">
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
      </div>

      {/* Charts Row 1: By Agency + Citation Coverage */}
      <div id="guidance-agencies" className="scroll-mt-[140px] grid grid-cols-1 lg:grid-cols-2 gap-6">
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
      <div id="guidance-categories" className="scroll-mt-[140px] grid grid-cols-1 lg:grid-cols-2 gap-6">
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

      {/* Charts Row 3: By Year */}
      {yearData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartContainer
            title="Documents by Year"
            description="Distribution of guidance documents by publication year"
            aspectRatio={1.5}
            minHeight={Math.max(250, yearData.length * 25)}
            maxHeight={500}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                <HorizontalBarChart
                  data={yearData}
                  width={width}
                  height={height}
                  maxBars={20}
                  sortOrder="none"
                />
              </ClientChart>
            )}
          </ChartContainer>
        </div>
      )}

      {/* Top-Cited Regulations Table */}
      {citationStats && citationStats.topCitedRegulations.length > 0 && (
        <div id="guidance-citations" className="scroll-mt-[140px] bg-white rounded-[var(--radius-lg)] border border-[var(--color-neutral-200)] overflow-hidden">
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

      {/* Document Lineage Section */}
      {lineageStats && lineageStats.docsWithLineage > 0 && (
        <div id="guidance-lineage" className="scroll-mt-[140px]">
          <LineageSection lineageStats={lineageStats} overviewStats={overviewStats} jurisdiction={jurisdiction} />
        </div>
      )}

      {/* Readability Analysis Section */}
      {readabilityStats && readabilityStats.docsWithMetrics > 0 && (
        <div id="guidance-readability" className="scroll-mt-[140px]">
          <ReadabilitySection readabilityStats={readabilityStats} jurisdiction={jurisdiction} />
        </div>
      )}

      {/* Readability × Compliance × Barrier Cross-Cut Section */}
      {crossCutStats && (
        <div id="guidance-crosscuts" className="scroll-mt-[140px]">
          <ReadabilityCrossCutSection stats={crossCutStats} />
        </div>
      )}
    </div>
  );
}

function getGradeLevelLabel(grade: number): string {
  if (grade < 8) return 'Middle school';
  if (grade < 13) return 'High school';
  if (grade < 17) return 'College level';
  return 'Graduate level';
}

function MetricCell({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex justify-between gap-2 py-1 px-2">
      <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
      <span className="text-xs font-medium text-[var(--color-text)] tabular-nums">
        {value !== null ? value.toFixed(1) : '--'}
      </span>
    </div>
  );
}

function formatAudienceLabel(tag: string): string {
  return tag
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function ReadabilitySection({
  readabilityStats,
  jurisdiction,
}: {
  readabilityStats: GuidanceReadabilityStats;
  jurisdiction: JurisdictionCode;
}) {
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [filteredAgencyData, setFilteredAgencyData] = useState<BarChartDatum[] | null>(null);
  const [isPending, startTransition] = useTransition();

  const analyzedPct = readabilityStats.totalDocs > 0
    ? Math.round((readabilityStats.docsWithMetrics / readabilityStats.totalDocs) * 100)
    : 0;

  const avgEaseLabel = readabilityStats.avgFleschReadingEase !== null
    ? getReadabilityLabel(readabilityStats.avgFleschReadingEase)
    : undefined;

  const avgGradeLabel = readabilityStats.avgFleschKincaidGrade !== null
    ? getGradeLevelLabel(readabilityStats.avgFleschKincaidGrade)
    : undefined;

  const gradeData: BarChartDatum[] = readabilityStats.gradeDistribution.map(d => ({
    label: d.grade,
    value: d.count,
  }));

  const defaultAgencyData: BarChartDatum[] = readabilityStats.readingEaseByAgency.map(d => ({
    label: d.agency,
    value: Number(d.avgReadingEase),
  }));

  const agencyReadabilityData = filteredAgencyData ?? defaultAgencyData;

  const audienceOptions = useMemo(() =>
    readabilityStats.audienceTags.map(t => ({
      value: t.tag,
      label: formatAudienceLabel(t.tag),
      count: t.count,
    })),
    [readabilityStats.audienceTags]
  );

  const handleAudienceChange = useCallback((values: string[]) => {
    setSelectedAudiences(values);
    if (values.length === 0) {
      setFilteredAgencyData(null);
      return;
    }
    startTransition(async () => {
      const result = await getReadabilityByAgencyFiltered(jurisdiction, values);
      if (result.success) {
        setFilteredAgencyData(result.data.map(d => ({
          label: d.agency,
          value: Number(d.avgReadingEase),
        })));
      }
    });
  }, [jurisdiction]);

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">Readability Analysis</h3>

      <StatGrid columns={3}>
        <StatCard
          label="Docs Analyzed"
          value={readabilityStats.docsWithMetrics}
          icon={BookOpen}
          variant="info"
          subtitle={`${analyzedPct}% of total`}
        />
        <StatCard
          label="Avg Reading Ease"
          value={readabilityStats.avgFleschReadingEase !== null
            ? Number(readabilityStats.avgFleschReadingEase).toFixed(1)
            : '--'}
          icon={BookOpen}
          variant={readabilityStats.avgFleschReadingEase !== null && readabilityStats.avgFleschReadingEase < 30
            ? 'danger'
            : readabilityStats.avgFleschReadingEase !== null && readabilityStats.avgFleschReadingEase < 50
              ? 'warning'
              : 'default'}
          subtitle={avgEaseLabel}
        />
        <StatCard
          label="Avg Grade Level"
          value={readabilityStats.avgFleschKincaidGrade !== null
            ? Number(readabilityStats.avgFleschKincaidGrade).toFixed(1)
            : '--'}
          icon={BookOpen}
          variant="default"
          subtitle={avgGradeLabel}
        />
      </StatGrid>

      {/* All readability formula averages + text stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-3">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Corpus Readability Averages</p>
          <div className="grid grid-cols-2 gap-x-4">
            <MetricCell label="Flesch Reading Ease" value={readabilityStats.avgFleschReadingEase} />
            <MetricCell label="FK Grade" value={readabilityStats.avgFleschKincaidGrade} />
            <MetricCell label="Gunning Fog" value={readabilityStats.avgGunningFog} />
            <MetricCell label="ARI" value={readabilityStats.avgAutomatedReadabilityIndex} />
            <MetricCell label="Coleman-Liau" value={readabilityStats.avgColemanLiauIndex} />
            <MetricCell label="SMOG" value={readabilityStats.avgSmogIndex} />
            <MetricCell label="Dale-Chall" value={readabilityStats.avgDaleChallScore} />
            <MetricCell label="Linsear Write" value={readabilityStats.avgLinsearWriteFormula} />
          </div>
        </div>
        <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-3">
          <p className="text-xs font-semibold text-[var(--color-text-secondary)] mb-2">Corpus Text Statistics</p>
          <div className="grid grid-cols-2 gap-x-4">
            <MetricCell label="Avg Words / Doc" value={readabilityStats.avgWordCount} />
            <MetricCell label="Avg Sentences / Doc" value={readabilityStats.avgSentenceCount} />
            <MetricCell label="Avg Difficult Words %" value={readabilityStats.avgDifficultWordPct} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <ChartContainer
            title="Grade Level Distribution"
            description="Documents bucketed by Flesch-Kincaid grade level"
            aspectRatio={1.2}
            minHeight={250}
            maxHeight={400}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                {gradeData.length > 0 ? (
                  <HorizontalBarChart
                    data={gradeData}
                    width={width}
                    height={height}
                    maxBars={10}
                    sortOrder="none"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    No grade level data
                  </div>
                )}
              </ClientChart>
            )}
          </ChartContainer>
          <GradeLevelKey />
        </div>

        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <MultiSelect
                label="Filter by Audience"
                options={audienceOptions}
                value={selectedAudiences}
                onChange={handleAudienceChange}
                placeholder="All audiences"
                searchable
              />
            </div>
            {isPending && (
              <span className="text-xs text-[var(--color-text-muted)] pb-2">Loading...</span>
            )}
          </div>
          <ChartContainer
            title="Readability by Agency"
            description={selectedAudiences.length > 0
              ? `Filtered to ${selectedAudiences.map(formatAudienceLabel).join(', ')}`
              : 'Average Flesch Reading Ease by agency (higher = easier)'}
            aspectRatio={1.2}
            minHeight={Math.max(250, agencyReadabilityData.length * 30)}
            maxHeight={500}
          >
            {({ width, height }) => (
              <ClientChart minHeight={height}>
                {agencyReadabilityData.length > 0 ? (
                  <HorizontalBarChart
                    data={agencyReadabilityData}
                    width={width}
                    height={height}
                    maxBars={15}
                    sortOrder="none"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-[var(--color-text-muted)]">
                    {selectedAudiences.length > 0 ? 'No data for selected audiences' : 'No agency readability data'}
                  </div>
                )}
              </ClientChart>
            )}
          </ChartContainer>
          <FleschEaseKey />
        </div>
      </div>
    </div>
  );
}

function LineageSection({
  lineageStats,
  overviewStats,
  jurisdiction,
}: {
  lineageStats: LineageStats;
  overviewStats: GuidanceOverviewStats | null;
  jurisdiction: JurisdictionCode;
}) {
  const lineagePercentage = overviewStats && overviewStats.total > 0
    ? Math.round((lineageStats.docsWithLineage / overviewStats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">Document Lineage</h3>

      <StatGrid columns={3}>
        <StatCard
          label="Docs with Lineage"
          value={lineageStats.docsWithLineage}
          icon={GitBranch}
          variant="info"
          subtitle={`${lineagePercentage}% of total`}
        />
        <StatCard
          label="Document Families"
          value={lineageStats.totalFamilies}
          icon={FolderTree}
          variant="default"
          subtitle="Revision chains"
        />
        <StatCard
          label="Orphaned References"
          value={lineageStats.orphanedReferences}
          icon={AlertTriangle}
          variant={lineageStats.orphanedReferences > 0 ? 'warning' : 'default'}
          subtitle="Refs to missing docs"
        />
      </StatGrid>

      {lineageStats.families.length > 0 && (
        <DocumentFamiliesTable families={lineageStats.families} totalFamilies={lineageStats.totalFamilies} jurisdiction={jurisdiction} />
      )}
    </div>
  );
}

function DocumentFamiliesTable({ families, totalFamilies, jurisdiction }: { families: DocumentFamily[]; totalFamilies: number; jurisdiction: string }) {
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  return (
    <Card padding="none">
      <CardHeader className="p-6 pb-0">
        <CardTitle>Document Families</CardTitle>
        <CardDescription>
          {totalFamilies} revision chain{totalFamilies !== 1 ? 's' : ''}
          {totalFamilies > families.length ? ` (showing top ${families.length} by chain length)` : ''}
        </CardDescription>
      </CardHeader>
      <div className="mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-neutral-200)]">
              <th className="text-left p-3 pl-6 text-[var(--color-text-muted)] font-medium">Family (oldest ref)</th>
              <th className="text-left p-3 text-[var(--color-text-muted)] font-medium">Agency</th>
              <th className="text-center p-3 text-[var(--color-text-muted)] font-medium">Chain</th>
              <th className="text-left p-3 pr-6 text-[var(--color-text-muted)] font-medium">Active Version</th>
            </tr>
          </thead>
          <tbody>
            {families.map(family => (
              <FamilyRow
                key={family.familyId}
                family={family}
                jurisdiction={jurisdiction}
                isExpanded={expandedFamily === family.familyId}
                onToggle={() =>
                  setExpandedFamily(prev =>
                    prev === family.familyId ? null : family.familyId
                  )
                }
              />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FamilyRow({
  family,
  jurisdiction,
  isExpanded,
  onToggle,
}: {
  family: DocumentFamily;
  jurisdiction: string;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const activeMember = family.members.find(m => m.id === family.currentActiveId);
  const ChevronIcon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <>
      <tr
        className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-primary-faint)] cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="p-3 pl-6">
          <div className="flex items-center gap-2">
            <ChevronIcon className="h-4 w-4 text-[var(--color-text-muted)] flex-shrink-0" />
            <span className="font-medium text-[var(--color-text)]">{family.familyId}</span>
          </div>
        </td>
        <td className="p-3 text-[var(--color-text-secondary)]">{family.agency}</td>
        <td className="p-3 text-center text-[var(--color-text)]">{family.chainLength}</td>
        <td className="p-3 pr-6">
          {activeMember ? (
            <span className="text-[var(--color-success)] font-medium">
              {activeMember.canonicalRef}
            </span>
          ) : (
            <span className="text-[var(--color-warning)] flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              None active
            </span>
          )}
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={4} className="bg-[var(--color-neutral-50)] px-6 py-3">
            <div className="space-y-2">
              {family.members.map((member, i) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-[var(--color-text-muted)] w-4 text-right flex-shrink-0">
                    {i + 1}.
                  </span>
                  <Link
                    href={`/${jurisdiction}/guidance/${member.id}`}
                    className="text-[var(--color-primary)] hover:underline font-medium"
                    onClick={e => e.stopPropagation()}
                  >
                    {member.canonicalRef}
                  </Link>
                  {member.year && (
                    <span className="text-[var(--color-text-muted)]">({member.year})</span>
                  )}
                  <span className="text-[var(--color-text-secondary)] truncate max-w-[300px]">
                    {member.title}
                  </span>
                  <GuidanceStatusBadge status={member.status} />
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
