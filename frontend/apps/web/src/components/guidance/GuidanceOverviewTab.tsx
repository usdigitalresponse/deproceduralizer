'use client';

import { useMemo, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { Building2, FileType, CheckCircle, GitBranch, FolderTree, AlertTriangle, ChevronDown, ChevronRight, BookOpen } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { MultiSelect } from '@/components/ui/MultiSelect';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { StickyPageSectionTabs } from '@/components/navigation/StickyPageSectionTabs';
import type { SectionConfig } from '@/hooks/useActiveSection';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { formatLabel } from '@/types/regulation';
import { getReadabilityLabel } from './ReadabilityBadge';
import { FleschEaseKey, GradeLevelKey } from './ReadabilityScaleKey';
import { ReadabilityCrossCutSection } from './ReadabilityCrossCutSection';
import type { GuidanceOverviewStats, LineageStats, GuidanceReadabilityStats, ReadabilityCrossCutStats, DocumentFamily } from '@/lib/actions/guidance-documents';
import { getReadabilityByAgencyFiltered } from '@/lib/actions/guidance-documents';
import type { JurisdictionCode } from '@/types/state';

interface GuidanceOverviewTabProps {
  stats: GuidanceOverviewStats | null;
  lineageStats: LineageStats | null;
  readabilityStats: GuidanceReadabilityStats | null;
  crossCutStats: ReadabilityCrossCutStats | null;
  jurisdiction: string;
}

export function GuidanceOverviewTab({ stats, lineageStats, readabilityStats, crossCutStats, jurisdiction }: GuidanceOverviewTabProps) {
  const activeCount = stats?.byStatus.find(s => s.status.toLowerCase() === 'active')?.count ?? 0;
  const activePercentage = stats && stats.total > 0
    ? Math.round((activeCount / stats.total) * 100)
    : 0;

  const sections: SectionConfig[] = useMemo(() => {
    const s: SectionConfig[] = [
      { id: 'gov-overview', label: 'Overview' },
      { id: 'gov-charts', label: 'Charts' },
    ];
    if (lineageStats) {
      s.push({ id: 'gov-lineage', label: 'Lineage', count: lineageStats.docsWithLineage });
    }
    if (readabilityStats && readabilityStats.docsWithMetrics > 0) {
      s.push({ id: 'gov-readability', label: 'Readability', count: readabilityStats.docsWithMetrics });
    }
    if (crossCutStats) {
      s.push({ id: 'gov-crosscuts', label: 'Cross-Cuts' });
    }
    return s;
  }, [lineageStats, readabilityStats, crossCutStats]);

  return (
    <div className="space-y-6">
      <div className="sticky top-[89px] z-10 bg-white border-b border-[var(--color-neutral-200)] -mx-1 px-1 pb-1 shadow-sm">
        <StickyPageSectionTabs sections={sections} scrollOffset={140} />
      </div>

      <div id="gov-overview" className="scroll-mt-[140px]">
      <StatGrid columns={4}>
        <StatCard
          label="Total Guidance Docs"
          value={stats?.total ?? 0}
          icon={getEntityIcon('guidance_document')}
          variant="default"
        />
        <StatCard
          label="Agencies"
          value={stats?.byAgency.length ?? 0}
          icon={Building2}
          variant="info"
        />
        <StatCard
          label="Doc Types"
          value={stats?.byDocType.length ?? 0}
          icon={FileType}
          variant="warning"
        />
        <StatCard
          label="Active"
          value={`${activePercentage}%`}
          icon={CheckCircle}
          variant="success"
          subtitle={`${activeCount} of ${stats?.total ?? 0}`}
        />
      </StatGrid>
      </div>

      <div id="gov-charts" className="scroll-mt-[140px] grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Agency */}
        <ChartContainer title="By Agency" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const agencyData = (stats?.byAgency ?? []).map(d => ({ label: d.agency, value: d.count }));
            if (agencyData.length === 0) {
              return <EmptyState title="No agency data available" />;
            }
            return (
              <HorizontalBarChart
                data={agencyData}
                width={width}
                height={height}
                maxBars={10}
              />
            );
          }}
        </ChartContainer>

        {/* By Policy Category */}
        <ChartContainer title="By Policy Category" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const categoryData = (stats?.byPolicyCategory ?? []).map(d => ({ label: formatLabel(d.category), value: d.count }));
            if (categoryData.length === 0) {
              return <EmptyState title="No category data available" />;
            }
            return (
              <HorizontalBarChart
                data={categoryData}
                width={width}
                height={height}
                maxBars={10}
              />
            );
          }}
        </ChartContainer>

        {/* By Status */}
        <ChartContainer title="By Status" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const statusData = (stats?.byStatus ?? []).map(d => ({ label: formatLabel(d.status), value: d.count }));
            if (statusData.length === 0) {
              return <EmptyState title="No status data available" />;
            }
            return (
              <HorizontalBarChart
                data={statusData}
                width={width}
                height={height}
                maxBars={10}
              />
            );
          }}
        </ChartContainer>

        {/* By Year */}
        <ChartContainer title="By Year" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const yearData = (stats?.byYear ?? []).map(d => ({ label: String(d.year), value: d.count }));
            if (yearData.length === 0) {
              return <EmptyState title="No year data available" />;
            }
            return (
              <HorizontalBarChart
                data={yearData}
                width={width}
                height={height}
                maxBars={15}
              />
            );
          }}
        </ChartContainer>
      </div>

      {/* Document Lineage Section */}
      {lineageStats && (
        <div id="gov-lineage" className="scroll-mt-[140px]">
          <LineageSection lineageStats={lineageStats} stats={stats} jurisdiction={jurisdiction} />
        </div>
      )}

      {/* Readability Analysis Section */}
      {readabilityStats && readabilityStats.docsWithMetrics > 0 && (
        <div id="gov-readability" className="scroll-mt-[140px]">
          <ReadabilitySection readabilityStats={readabilityStats} jurisdiction={jurisdiction as JurisdictionCode} />
        </div>
      )}

      {/* Readability × Compliance × JenAI Cross-Cut Section */}
      {crossCutStats && (
        <div id="gov-crosscuts" className="scroll-mt-[140px]">
          <ReadabilityCrossCutSection stats={crossCutStats} />
        </div>
      )}
    </div>
  );
}

function LineageSection({
  lineageStats,
  stats,
  jurisdiction,
}: {
  lineageStats: LineageStats;
  stats: GuidanceOverviewStats | null;
  jurisdiction: string;
}) {
  const lineagePercentage = stats && stats.total > 0
    ? Math.round((lineageStats.docsWithLineage / stats.total) * 100)
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

function getGradeLevelLabel(grade: number): string {
  if (grade < 8) return 'Middle school';
  if (grade < 13) return 'High school';
  if (grade < 17) return 'College level';
  return 'Graduate level';
}

function formatAudienceLabel(tag: string): string {
  return tag
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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

function ReadabilitySection({
  readabilityStats,
  jurisdiction,
}: {
  readabilityStats: GuidanceReadabilityStats;
  jurisdiction: JurisdictionCode;
}) {
  const [selectedAudiences, setSelectedAudiences] = useState<string[]>([]);
  const [filteredAgencyData, setFilteredAgencyData] = useState<Array<{ label: string; value: number }> | null>(null);
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

  const defaultAgencyData = readabilityStats.readingEaseByAgency.map(d => ({
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
        {/* Grade Level Distribution */}
        <div className="space-y-3">
          <ChartContainer title="Grade Level Distribution" aspectRatio={1.2} minHeight={250}>
            {({ width, height }) => {
              const gradeData = readabilityStats.gradeDistribution.map(d => ({
                label: d.grade,
                value: d.count,
              }));
              if (gradeData.length === 0) {
                return <EmptyState title="No grade level data available" />;
              }
              return (
                <HorizontalBarChart
                  data={gradeData}
                  width={width}
                  height={height}
                  maxBars={10}
                  sortOrder="none"
                />
              );
            }}
          </ChartContainer>
          <GradeLevelKey />
        </div>

        {/* Readability by Agency */}
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
              : undefined}
            aspectRatio={1.2}
            minHeight={250}
          >
            {({ width, height }) => {
              if (agencyReadabilityData.length === 0) {
                return <EmptyState title={selectedAudiences.length > 0 ? 'No data for selected audiences' : 'No agency readability data available'} />;
              }
              return (
                <HorizontalBarChart
                  data={agencyReadabilityData}
                  width={width}
                  height={height}
                  maxBars={15}
                  sortOrder="none"
                />
              );
            }}
          </ChartContainer>
          <FleschEaseKey />
        </div>
      </div>
    </div>
  );
}
