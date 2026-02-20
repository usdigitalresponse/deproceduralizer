'use client';

import { Search } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';
import type { DashboardStats as DashboardStatsType } from '@deproceduralizer/database';
import { StatCard, StatGrid } from '@/components/ui';

interface DashboardStatsProps {
  stats: DashboardStatsType;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <StatGrid columns={4}>
      <StatCard
        label="Regulations Scanned"
        value={stats.totalDocuments}
        icon={getEntityIcon('regulatory_document')}
        variant="default"
        subtitle="All scanned for compliance issues"
      />
      <StatCard
        label="Compliance Issues"
        value={stats.complianceIssues?.total ?? 0}
        icon={getEntityIcon('compliance_issue')}
        variant="warning"
        subtitle={stats.complianceIssues?.unreviewed ? `${stats.complianceIssues.unreviewed.toLocaleString()} awaiting human review` : undefined}
      />
      <StatCard
        label="Red Flags"
        value={stats.totalFlags}
        icon={getEntityIcon('red_flag')}
        variant="danger"
        subtitle={stats.unreviewedFlags ? `${stats.unreviewedFlags.toLocaleString()} awaiting human review` : undefined}
      />
      <StatCard
        label="Red Flag Analysis"
        value={stats.analyzedDocuments}
        icon={Search}
        variant="info"
        subtitle={`${stats.analyzedDocuments.toLocaleString()} of ${stats.totalDocuments.toLocaleString()} regulations`}
      />
    </StatGrid>
  );
}

export default DashboardStats;
