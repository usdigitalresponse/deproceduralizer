import Link from 'next/link';
import { AlertTriangle, FileText, DollarSign, Scale, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import type { JurisdictionCode } from '@/types/state';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

interface RegulatoryLandscapeProps {
  complianceStats: { total: number; unreviewed: number; byType: Record<string, number> };
  guidanceStats: { total: number; agencyCount: number } | null;
  finesStats: { total: number; uniqueAgencies: number } | null;
  barrierStats: { total: number; unreviewed: number; topCategory: string | null } | null;
  jurisdiction: JurisdictionCode;
}

function getTopIssueType(byType: Record<string, number>): string | null {
  const entries = Object.entries(byType);
  if (entries.length === 0) return null;
  const [topType] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  return ISSUE_TYPE_LABELS[topType] ?? topType;
}

interface LandscapeCardProps {
  href: string;
  icon: React.ReactNode;
  accentColor: string;
  title: string;
  metric: number | null;
  metricLabel: string;
  secondary: string | null;
}

function LandscapeCard({ href, icon, accentColor, title, metric, metricLabel, secondary }: LandscapeCardProps) {
  const hasData = metric !== null && metric > 0;

  return (
    <Link href={href} className="block group">
      <Card
        className={`
          relative overflow-hidden transition-all duration-[var(--duration-base)]
          hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary-weak)]
          border-l-4
        `}
        style={{ borderLeftColor: `var(${accentColor})` }}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 text-[var(--color-text-muted)]">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
              <ArrowRight className="w-4 h-4 text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            {hasData ? (
              <>
                <p className="text-2xl font-bold tracking-tight text-[var(--color-text)] mt-1">
                  {metric.toLocaleString()}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{metricLabel}</p>
                {secondary && (
                  <p className="text-xs text-[var(--color-text-secondary)] mt-1">{secondary}</p>
                )}
              </>
            ) : (
              <p className="text-sm text-[var(--color-text-muted)] mt-2">No data yet</p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function RegulatoryLandscape({ complianceStats, guidanceStats, finesStats, barrierStats, jurisdiction }: RegulatoryLandscapeProps) {
  const topIssue = getTopIssueType(complianceStats.byType);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <LandscapeCard
        href={`/${jurisdiction}/pipeline`}
        icon={<AlertTriangle className="w-5 h-5" />}
        accentColor="--color-warning"
        title="Compliance Issues"
        metric={complianceStats.total}
        metricLabel="total issues identified"
        secondary={
          [
            complianceStats.unreviewed > 0 ? `${complianceStats.unreviewed.toLocaleString()} unreviewed` : null,
            topIssue ? `Top: ${topIssue}` : null,
          ].filter(Boolean).join(' · ') || null
        }
      />

      <LandscapeCard
        href={`/${jurisdiction}/burden`}
        icon={<Scale className="w-5 h-5" />}
        accentColor="--color-info"
        title="Barrier Issues"
        metric={barrierStats?.total ?? null}
        metricLabel="implementation issues"
        secondary={
          barrierStats
            ? [
                barrierStats.unreviewed > 0 ? `${barrierStats.unreviewed.toLocaleString()} unreviewed` : null,
                barrierStats.topCategory ? `Top: ${barrierStats.topCategory}` : null,
              ].filter(Boolean).join(' · ') || null
            : null
        }
      />

      <LandscapeCard
        href={`/${jurisdiction}/guidance`}
        icon={<FileText className="w-5 h-5" />}
        accentColor="--color-primary"
        title="Guidance Documents"
        metric={guidanceStats?.total ?? null}
        metricLabel="documents indexed"
        secondary={
          guidanceStats && guidanceStats.agencyCount > 0
            ? `${guidanceStats.agencyCount} agencies`
            : null
        }
      />

      <LandscapeCard
        href={`/${jurisdiction}/fines`}
        icon={<DollarSign className="w-5 h-5" />}
        accentColor="--color-danger"
        title="Fines & Fees"
        metric={finesStats?.total ?? null}
        metricLabel="penalties cataloged"
        secondary={
          finesStats && finesStats.uniqueAgencies > 0
            ? `${finesStats.uniqueAgencies} agencies`
            : null
        }
      />
    </div>
  );
}
