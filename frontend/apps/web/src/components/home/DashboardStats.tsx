'use client';

import { Card } from '@/components/ui/Card';
import { FileText, Search, AlertTriangle, CheckCircle } from 'lucide-react';
import type { DashboardStats as DashboardStatsType } from '@deproceduralizer/database';

interface DashboardStatsProps {
  stats: DashboardStatsType;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  iconColor: string;
}

function StatCard({ label, value, icon, iconColor }: StatCardProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`p-3 rounded-[var(--radius-md)] ${iconColor}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-semibold text-[var(--color-text)]">
          {value.toLocaleString()}
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
      </div>
    </Card>
  );
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Total Regulations"
        value={stats.totalDocuments}
        icon={<FileText className="w-6 h-6 text-[var(--color-primary)]" />}
        iconColor="bg-[var(--color-primary-weaker)]"
      />
      <StatCard
        label="Analyzed"
        value={stats.analyzedDocuments}
        icon={<Search className="w-6 h-6 text-[var(--color-info)]" />}
        iconColor="bg-[var(--color-info-bg)]"
      />
      <StatCard
        label="With Flags"
        value={stats.documentsWithFlags}
        icon={<AlertTriangle className="w-6 h-6 text-[var(--color-warning)]" />}
        iconColor="bg-[var(--color-warning-bg)]"
      />
      <StatCard
        label="Unreviewed Flags"
        value={stats.unreviewedFlags}
        icon={<CheckCircle className="w-6 h-6 text-[var(--color-danger)]" />}
        iconColor="bg-[var(--color-danger-bg)]"
      />
    </div>
  );
}

export default DashboardStats;
