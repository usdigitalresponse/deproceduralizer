'use client';

import { FileText, Search, AlertTriangle, CheckCircle, ClipboardList, PenTool } from 'lucide-react';
import type { DashboardStats as DashboardStatsType } from '@deproceduralizer/database';
import { StatCard, StatGrid } from '@/components/ui';

interface DashboardStatsProps {
  stats: DashboardStatsType;
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="space-y-4">
      {/* Document & Flag Stats */}
      <StatGrid columns={4}>
        <StatCard
          label="Total Regulations"
          value={stats.totalDocuments}
          icon={FileText}
          variant="default"
        />
        <StatCard
          label="Analyzed"
          value={stats.analyzedDocuments}
          icon={Search}
          variant="info"
        />
        <StatCard
          label="With Flags"
          value={stats.documentsWithFlags}
          icon={AlertTriangle}
          variant="warning"
        />
        <StatCard
          label="Unreviewed Flags"
          value={stats.unreviewedFlags}
          icon={CheckCircle}
          variant="danger"
        />
      </StatGrid>

      {/* Compliance Issues Stats */}
      {stats.complianceIssues && stats.complianceIssues.total > 0 && (
        <StatGrid columns={4}>
          <StatCard
            label="Compliance Issues"
            value={stats.complianceIssues.total}
            icon={ClipboardList}
            variant="warning"
          />
          <StatCard
            label="Wet Signatures"
            value={stats.complianceIssues.byType.wet_signature || 0}
            icon={PenTool}
            variant="warning"
          />
          <StatCard
            label="Unreviewed Issues"
            value={stats.complianceIssues.unreviewed}
            icon={CheckCircle}
            variant="danger"
          />
        </StatGrid>
      )}
    </div>
  );
}

export default DashboardStats;
