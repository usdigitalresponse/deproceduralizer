'use client';

import { DollarSign, Building2, FileText } from 'lucide-react';
import { StatCard, StatGrid } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { ChartContainer } from '@/components/charts/ChartContainer';
import { HorizontalBarChart } from '@/components/charts/BarChart';
import { PENALTY_TYPE_LABELS_PLURAL } from '@/lib/constants/fines';
import type { FinesOverviewStats } from '@/lib/actions/fines';

interface FinesOverviewTabProps {
  stats: FinesOverviewStats | null;
}

export function FinesOverviewTab({ stats }: FinesOverviewTabProps) {
  return (
    <div className="space-y-6">
      <StatGrid columns={3}>
        <StatCard
          label="Total Fines & Fees"
          value={stats?.total ?? 0}
          icon={DollarSign}
          variant="default"
        />
        <StatCard
          label="Agencies"
          value={stats?.uniqueAgencies ?? 0}
          icon={Building2}
          variant="info"
        />
        <StatCard
          label="Source Documents"
          value={stats?.uniqueDocs ?? 0}
          icon={FileText}
          variant="warning"
        />
      </StatGrid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By Penalty Type Chart */}
        <ChartContainer title="By Type" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const typeData = (stats?.byType ?? []).map(d => ({
              label: PENALTY_TYPE_LABELS_PLURAL[d.type] ?? d.type,
              value: d.count,
            }));
            if (typeData.length === 0) {
              return <EmptyState title="No data available" />;
            }
            return (
              <HorizontalBarChart
                data={typeData}
                width={width}
                height={height}
                maxBars={10}
              />
            );
          }}
        </ChartContainer>

        {/* By Agency Chart */}
        <ChartContainer title="By Agency" aspectRatio={1.2} minHeight={250}>
          {({ width, height }) => {
            const agencyData = (stats?.byAgency ?? []).map(d => ({
              label: d.agency,
              value: d.count,
            }));
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
      </div>
    </div>
  );
}
