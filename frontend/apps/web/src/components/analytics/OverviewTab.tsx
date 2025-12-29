'use client';

import { FileText, Flag, AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';
import type { DashboardStats } from '@deproceduralizer/database';
import type { ReviewStatusCounts } from '@/lib/actions/red-flags';
import type { ComplianceIssueStatusCounts } from '@/lib/actions/compliance-issues';
import { Card } from '@/components/ui';
import { ClientChart, ChartContainer, SeverityDonutChart, ChartLegend } from '@/components/charts';
import { useChartColors } from '@/hooks/useChartColors';

interface OverviewTabProps {
  dashboardStats: DashboardStats | null;
  redFlagStatus: ReviewStatusCounts | null;
  complianceStatus: ComplianceIssueStatusCounts | null;
}

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'warning' | 'danger';
  subtitle?: string;
}

function StatCard({ title, value, icon: Icon, variant = 'default', subtitle }: StatCardProps) {
  const variantStyles = {
    default: 'text-[var(--color-primary)]',
    success: 'text-[var(--color-success)]',
    warning: 'text-[var(--color-warning)]',
    danger: 'text-[var(--color-danger)]',
  };

  return (
    <Card className="flex items-center gap-4">
      <div
        className={`
          p-3 rounded-[var(--radius-lg)]
          bg-[var(--color-neutral-50)]
          ${variantStyles[variant]}
        `}
      >
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm text-[var(--color-text-muted)]">{title}</p>
        <p className="text-2xl font-bold text-[var(--color-text)]">{value.toLocaleString()}</p>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
    </Card>
  );
}

function ReviewProgressBar({
  label,
  counts,
}: {
  label: string;
  counts: { confirmed: number; unreviewed: number; total: number };
}) {
  const colors = useChartColors();
  const reviewedPercent = counts.total > 0 ? (counts.confirmed / counts.total) * 100 : 0;
  const unreviewedPercent = counts.total > 0 ? (counts.unreviewed / counts.total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="font-medium text-[var(--color-text)]">{label}</span>
        <span className="text-[var(--color-text-muted)]">
          {counts.confirmed.toLocaleString()} / {counts.total.toLocaleString()} reviewed
        </span>
      </div>
      <div className="h-3 bg-[var(--color-neutral-100)] rounded-full overflow-hidden flex">
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${reviewedPercent}%`,
            backgroundColor: colors.colors.success,
          }}
        />
        <div
          className="h-full transition-all duration-300"
          style={{
            width: `${unreviewedPercent}%`,
            backgroundColor: colors.colors.neutral300,
          }}
        />
      </div>
      <div className="flex gap-4 text-xs text-[var(--color-text-muted)]">
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: colors.colors.success }}
          />
          Reviewed ({reviewedPercent.toFixed(0)}%)
        </span>
        <span className="flex items-center gap-1">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: colors.colors.neutral300 }}
          />
          Unreviewed ({unreviewedPercent.toFixed(0)}%)
        </span>
      </div>
    </div>
  );
}

export function OverviewTab({
  dashboardStats,
  redFlagStatus,
  complianceStatus,
}: OverviewTabProps) {
  const colors = useChartColors();

  if (!dashboardStats) {
    return (
      <div className="text-center py-12 text-[var(--color-text-muted)]">
        No statistics available
      </div>
    );
  }

  // Calculate severity distribution
  const severityData = dashboardStats.flagsBySeverity;
  const high = severityData?.high ?? 0;
  const medium = severityData?.medium ?? 0;
  const low = severityData?.low ?? 0;
  const totalFlags = dashboardStats.totalFlags ?? 0;
  const notAnalyzed = dashboardStats.totalDocuments - dashboardStats.analyzedDocuments;

  // Review progress
  const redFlagReviewed = redFlagStatus?.confirmed ?? 0;
  const redFlagUnreviewed = redFlagStatus?.unreviewed ?? 0;
  const redFlagTotal = redFlagStatus?.total ?? 0;

  const complianceReviewed = complianceStatus?.confirmed ?? 0;
  const complianceUnreviewed = complianceStatus?.unreviewed ?? 0;
  const complianceTotal = complianceStatus?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Documents"
          value={dashboardStats.totalDocuments}
          icon={FileText}
          subtitle={`${dashboardStats.analyzedDocuments} analyzed`}
        />
        <StatCard
          title="Red Flags"
          value={totalFlags}
          icon={Flag}
          variant={totalFlags > 0 ? 'danger' : 'default'}
          subtitle={`${dashboardStats.unreviewedFlags} unreviewed`}
        />
        <StatCard
          title="Compliance Issues"
          value={dashboardStats.complianceIssues.total}
          icon={AlertTriangle}
          variant={dashboardStats.complianceIssues.total > 0 ? 'warning' : 'default'}
          subtitle={`${dashboardStats.complianceIssues.unreviewed} unreviewed`}
        />
        <StatCard
          title="Documents with Flags"
          value={dashboardStats.documentsWithFlags}
          icon={CheckCircle}
          subtitle={`${((dashboardStats.documentsWithFlags / dashboardStats.analyzedDocuments) * 100).toFixed(0)}% of analyzed`}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <ChartContainer
          title="Flag Severity Distribution"
          description="Distribution of red flags by severity level"
          aspectRatio={1.2}
          minHeight={250}
          maxHeight={350}
        >
          {({ width, height }) => (
            <div className="flex flex-col items-center gap-4">
              <ClientChart minHeight={height - 60}>
                <SeverityDonutChart
                  high={high}
                  medium={medium}
                  low={low}
                  width={Math.min(width, height - 60)}
                  height={Math.min(width, height - 60)}
                  showTotal
                />
              </ClientChart>
              <ChartLegend
                items={colors.getSeverityPieColors().slice(0, 3).map((item, i) => ({
                  ...item,
                  value: [high, medium, low][i],
                }))}
                orientation="horizontal"
              />
            </div>
          )}
        </ChartContainer>

        {/* Review Progress */}
        <Card padding="lg">
          <h3 className="text-lg font-semibold text-[var(--color-text)] mb-6">Review Progress</h3>
          <div className="space-y-6">
            <ReviewProgressBar
              label="Red Flags"
              counts={{
                confirmed: redFlagReviewed,
                unreviewed: redFlagUnreviewed,
                total: redFlagTotal,
              }}
            />
            <ReviewProgressBar
              label="Compliance Issues"
              counts={{
                confirmed: complianceReviewed,
                unreviewed: complianceUnreviewed,
                total: complianceTotal,
              }}
            />
          </div>
        </Card>
      </div>

      {/* Summary Stats */}
      <Card padding="lg">
        <h3 className="text-lg font-semibold text-[var(--color-text)] mb-4">Analysis Coverage</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]">
            <div className="text-2xl font-bold text-[var(--color-text)]">
              {((dashboardStats.analyzedDocuments / dashboardStats.totalDocuments) * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Documents Analyzed</div>
          </div>
          <div className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]">
            <div className="text-2xl font-bold text-[var(--color-success)]">
              {redFlagTotal > 0 ? ((redFlagReviewed / redFlagTotal) * 100).toFixed(0) : 0}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Flags Reviewed</div>
          </div>
          <div className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]">
            <div className="text-2xl font-bold text-[var(--color-success)]">
              {complianceTotal > 0
                ? ((complianceReviewed / complianceTotal) * 100).toFixed(0)
                : 0}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Issues Reviewed</div>
          </div>
          <div className="text-center p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]">
            <div className="text-2xl font-bold text-[var(--color-text)]">{notAnalyzed}</div>
            <div className="text-sm text-[var(--color-text-muted)]">Awaiting Analysis</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
