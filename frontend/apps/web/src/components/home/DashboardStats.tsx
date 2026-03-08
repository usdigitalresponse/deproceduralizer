'use client';

import { getEntityIcon } from '@/lib/constants/entity-types';
import type { DashboardStats as DashboardStatsType } from '@deproceduralizer/database';
import { StatCard, StatGrid } from '@/components/ui';

interface DashboardStatsProps {
  stats: DashboardStatsType;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <StatGrid columns={2}>
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
    </StatGrid>
  );
}

export default DashboardStats;
