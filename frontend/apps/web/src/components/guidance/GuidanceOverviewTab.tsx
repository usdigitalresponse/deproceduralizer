'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, FileType, CheckCircle, GitBranch, FolderTree, AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { GuidanceStatusBadge } from './GuidanceStatusBadge';
import { formatLabel } from '@/types/regulation';
import type { GuidanceOverviewStats, LineageStats, DocumentFamily } from '@/lib/actions/guidance-documents';

interface GuidanceOverviewTabProps {
  stats: GuidanceOverviewStats | null;
  lineageStats: LineageStats | null;
  jurisdiction: string;
}

export function GuidanceOverviewTab({ stats, lineageStats, jurisdiction }: GuidanceOverviewTabProps) {
  const activeCount = stats?.byStatus.find(s => s.status.toLowerCase() === 'active')?.count ?? 0;
  const activePercentage = stats && stats.total > 0
    ? Math.round((activeCount / stats.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        <LineageSection lineageStats={lineageStats} stats={stats} jurisdiction={jurisdiction} />
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
          value={lineageStats.families.length}
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
        <DocumentFamiliesTable families={lineageStats.families} jurisdiction={jurisdiction} />
      )}
    </div>
  );
}

function DocumentFamiliesTable({ families, jurisdiction }: { families: DocumentFamily[]; jurisdiction: string }) {
  const displayFamilies = families.slice(0, 50);
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  return (
    <Card padding="none">
      <CardHeader className="p-6 pb-0">
        <CardTitle>Document Families</CardTitle>
        <CardDescription>
          {families.length} revision chain{families.length !== 1 ? 's' : ''}
          {families.length > 50 ? ' (showing top 50 by chain length)' : ''}
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
            {displayFamilies.map(family => (
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
