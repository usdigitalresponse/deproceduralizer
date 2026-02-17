'use client';

import { Search } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import type { DashboardStats as DashboardStatsType } from '@deproceduralizer/database';
import { StatCard, StatGrid } from '@/components/ui';

interface DashboardStatsProps {
  stats: DashboardStatsType;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const analysisPct = stats.totalDocuments > 0
    ? Math.round((stats.analyzedDocuments / stats.totalDocuments) * 100)
    : 0;

  return (
    <StatGrid columns={4}>
      <StatCard
        label="Total Regulations"
        value={stats.totalDocuments}
        icon={getEntityIcon('regulatory_document')}
        variant="default"
      />
      <StatCard
        label="Analyzed"
        value={stats.analyzedDocuments}
        icon={Search}
        variant="info"
        subtitle={`${analysisPct}% coverage`}
      />
      <StatCard
        label="Compliance Issues"
        value={stats.complianceIssues?.total ?? 0}
        icon={getEntityIcon('compliance_issue')}
        variant="warning"
        subtitle={stats.complianceIssues?.unreviewed ? `${stats.complianceIssues.unreviewed.toLocaleString()} unreviewed` : undefined}
      />
      <StatCard
        label="Red Flags"
        value={stats.totalFlags}
        icon={getEntityIcon('red_flag')}
        variant="danger"
        subtitle={stats.unreviewedFlags ? `${stats.unreviewedFlags.toLocaleString()} unreviewed` : undefined}
      />
    </StatGrid>
  );
}

export default DashboardStats;
