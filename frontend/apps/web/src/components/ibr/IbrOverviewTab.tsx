'use client';

import { Building2, Search } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import type { IbrOverviewStats, IbrTopStandard } from '@/lib/actions/ibr';

interface IbrOverviewTabProps {
  stats: IbrOverviewStats | null;
  topStandards: IbrTopStandard[] | null;
  flaggedDocCount?: number;
}

export function IbrOverviewTab({ stats, topStandards, flaggedDocCount }: IbrOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <StatGrid columns={4}>
        <StatCard
          label="Total IBRs"
          value={stats?.total ?? 0}
          icon={getEntityIcon('ibr_standard')}
          variant="default"
        />
        <StatCard
          label="Source Organizations"
          value={stats?.uniqueOrgs ?? 0}
          icon={Building2}
          variant="info"
        />
        <StatCard
          label="Regulations Referenced"
          value={stats?.uniqueDocs ?? 0}
          icon={getEntityIcon('regulatory_document')}
          variant="warning"
        />
        <StatCard
          label="Extraction Coverage"
          value={flaggedDocCount ? `${stats?.uniqueDocs ?? 0} / ${flaggedDocCount}` : `${stats?.uniqueDocs ?? 0}`}
          icon={Search}
          variant={flaggedDocCount && stats && stats.uniqueDocs < flaggedDocCount ? 'danger' : 'success'}
          subtitle={flaggedDocCount ? `${flaggedDocCount} docs flagged has_ibr` : undefined}
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Source Organization Chart */}
        <ChartContainer title="Standards by Organization" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const orgData = (stats?.byOrg ?? []).map(d => ({ label: d.organization, value: d.count }));
            if (orgData.length === 0) {
              return <EmptyState title="No organization data available" />;
            }
            return (
              <HorizontalBarChart
                data={orgData}
                width={width}
                height={height}
                maxBars={10}
              />
            );
          }}
        </ChartContainer>

        {/* Top Referenced Standards */}
        <Card padding="lg">
          <CardHeader>
            <CardTitle>Most Referenced Standards</CardTitle>
          </CardHeader>
          <div className="pt-4">
            {topStandards && topStandards.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-neutral-200)]">
                      <th className="text-left py-2 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Standard</th>
                      <th className="text-left py-2 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Org</th>
                      <th className="text-left py-2 pr-3 text-xs font-medium text-[var(--color-text-muted)]">Version</th>
                      <th className="text-right py-2 text-xs font-medium text-[var(--color-text-muted)]">Refs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStandards.slice(0, 10).map((standard, i) => (
                      <tr key={i} className="border-b border-[var(--color-neutral-100)]">
                        <td className="py-2 pr-3 text-[var(--color-text)] truncate max-w-[200px]" title={standard.incorporatedDocument ?? ''}>
                          {standard.incorporatedDocument ?? 'Unknown'}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-text-secondary)]">
                          {standard.sourceOrganization ?? '—'}
                        </td>
                        <td className="py-2 pr-3 text-[var(--color-text-muted)]">
                          {standard.version ?? '—'}
                        </td>
                        <td className="py-2 text-right font-medium text-[var(--color-text)]">
                          {standard.count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="No standards data available" />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
