'use client';

import { useState, useMemo } from 'react';
import { Building2, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import type { BarChartDatum } from '@/lib/charts/types';
import type { IbrOverviewStats, IbrTopStandard } from '@/lib/actions/ibr';

type SortColumn = 'standard' | 'org' | 'version' | 'count';
type SortDirection = 'asc' | 'desc';

interface IbrOverviewTabProps {
  stats: IbrOverviewStats | null;
  topStandards: IbrTopStandard[] | null;
  flaggedDocCount?: number;
  onOrgBarClick?: (organization: string) => void;
  onStandardClick?: (search: string) => void;
}

function SortIcon({ column, sortColumn, sortDirection }: { column: SortColumn; sortColumn: SortColumn; sortDirection: SortDirection }) {
  if (column !== sortColumn) {
    return <ArrowUpDown className="w-3 h-3 ml-1 inline-block opacity-40" />;
  }
  return sortDirection === 'asc'
    ? <ArrowUp className="w-3 h-3 ml-1 inline-block" />
    : <ArrowDown className="w-3 h-3 ml-1 inline-block" />;
}

export function IbrOverviewTab({ stats, topStandards, flaggedDocCount, onOrgBarClick, onStandardClick }: IbrOverviewTabProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('count');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection(column === 'count' ? 'desc' : 'asc');
    }
  };

  const sortedStandards = useMemo(() => {
    if (!topStandards || topStandards.length === 0) return [];
    const sorted = [...topStandards].sort((a, b) => {
      const dir = sortDirection === 'asc' ? 1 : -1;
      switch (sortColumn) {
        case 'standard':
          return dir * (a.incorporatedDocument ?? '').localeCompare(b.incorporatedDocument ?? '');
        case 'org':
          return dir * (a.sourceOrganization ?? '').localeCompare(b.sourceOrganization ?? '');
        case 'version':
          return dir * (a.version ?? '').localeCompare(b.version ?? '');
        case 'count':
          return dir * (a.count - b.count);
        default:
          return 0;
      }
    });
    return sorted.slice(0, 10);
  }, [topStandards, sortColumn, sortDirection]);

  const headerClass = 'text-left py-2 pr-3 text-xs font-medium text-[var(--color-text-muted)] cursor-pointer select-none hover:text-[var(--color-text-secondary)] transition-colors';

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
                onBarClick={onOrgBarClick ? (datum: BarChartDatum) => onOrgBarClick(datum.label) : undefined}
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
            {sortedStandards.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-neutral-200)]">
                      <th className={headerClass} onClick={() => handleSort('standard')}>
                        Standard <SortIcon column="standard" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className={headerClass} onClick={() => handleSort('org')}>
                        Org <SortIcon column="org" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className={headerClass} onClick={() => handleSort('version')}>
                        Version <SortIcon column="version" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                      <th className={`${headerClass} !text-right`} onClick={() => handleSort('count')}>
                        Refs <SortIcon column="count" sortColumn={sortColumn} sortDirection={sortDirection} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedStandards.map((standard, i) => (
                      <tr key={i} className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-primary-faint)] transition-colors">
                        <td className="py-2 pr-3 truncate max-w-[200px]" title={standard.incorporatedDocument ?? ''}>
                          {onStandardClick ? (
                            <button
                              type="button"
                              className="text-[var(--color-primary)] hover:underline text-left truncate max-w-full"
                              onClick={() => onStandardClick(standard.incorporatedDocument ?? '')}
                            >
                              {standard.incorporatedDocument ?? 'Unknown'}
                            </button>
                          ) : (
                            <span className="text-[var(--color-text)]">{standard.incorporatedDocument ?? 'Unknown'}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {onOrgBarClick && standard.sourceOrganization ? (
                            <button
                              type="button"
                              className="text-[var(--color-primary)] hover:underline text-left"
                              onClick={() => onOrgBarClick(standard.sourceOrganization!)}
                            >
                              {standard.sourceOrganization}
                            </button>
                          ) : (
                            <span className="text-[var(--color-text-secondary)]">{standard.sourceOrganization ?? '—'}</span>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          {standard.version ? (
                            <span className="font-mono text-xs bg-[var(--color-neutral-100)] px-1.5 py-0.5 rounded">
                              {standard.version}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-muted)]">—</span>
                          )}
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
