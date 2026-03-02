'use client';

import { Building2, FileType, CheckCircle } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { formatLabel } from '@/types/regulation';
import type { GuidanceOverviewStats } from '@/lib/actions/guidance-documents';

interface GuidanceOverviewTabProps {
  stats: GuidanceOverviewStats | null;
}

export function GuidanceOverviewTab({ stats }: GuidanceOverviewTabProps) {
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
    </div>
  );
}
