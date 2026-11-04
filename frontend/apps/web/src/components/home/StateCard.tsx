'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight } from 'lucide-react';
import type { DashboardStats, BurdenOverviewStats, BarrierReviewStatusCounts } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@/types/state';

interface StateCardProps {
  jurisdiction: JurisdictionCode;
  stats: DashboardStats;
  guidanceTotal?: number;
  burdenStats?: BurdenOverviewStats | null;
  barrierStats?: BarrierReviewStatusCounts | null;
}

const jurisdictionInfo: Record<JurisdictionCode, {
  name: string;
  fullName: string;
  abbrev: string;
  accentVar: string;
  bgVar: string;
  borderVar: string;
}> = {
  ny: {
    name: 'New York',
    fullName: 'New York State',
    abbrev: 'NY',
    accentVar: '--color-state-ny-accent',
    bgVar: '--color-state-ny-bg',
    borderVar: '--color-state-ny-border',
  },
  nj: {
    name: 'New Jersey',
    fullName: 'New Jersey State',
    abbrev: 'NJ',
    accentVar: '--color-state-nj-accent',
    bgVar: '--color-state-nj-bg',
    borderVar: '--color-state-nj-border',
  },
  nyc: {
    name: 'New York City',
    fullName: 'New York City',
    abbrev: 'NYC',
    accentVar: '--color-state-nyc-accent',
    bgVar: '--color-state-nyc-bg',
    borderVar: '--color-state-nyc-border',
  },
};

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  barColor: string;
}

function ProgressBar({ label, current, total, barColor }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-[var(--color-text-muted)]">
        <span>{label}</span>
        <span>
          {current.toLocaleString()}/{total.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: `var(${barColor})` }}
        />
      </div>
    </div>
  );
}

function BurdenBar({ average }: { average: number }) {
  // Burden scores range from 0–100
  const pct = Math.min(Math.round(average), 100);

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--color-text-muted)] shrink-0">
        Avg burden: {average.toFixed(1)}
      </span>
      <div className="flex-1 h-1.5 bg-[var(--color-neutral-100)] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-warning)] transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function StateCard({ jurisdiction, stats, guidanceTotal, burdenStats, barrierStats }: StateCardProps) {
  const info = jurisdictionInfo[jurisdiction];

  const issuesTotal = stats.complianceIssues?.total ?? 0;
  const issuesUnreviewed = stats.complianceIssues?.unreviewed ?? 0;
  const issuesReviewed = issuesTotal - issuesUnreviewed;

  return (
    <Link href={`/${jurisdiction}`} className="block group">
      <Card
        className="relative overflow-hidden transition-all duration-[var(--duration-base)] hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary-weak)]"
        style={{ borderColor: `var(${info.borderVar})` }}
      >
        {/* Accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ backgroundColor: `var(${info.accentVar})` }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* State abbreviation badge */}
            <div
              className="flex items-center justify-center w-12 h-12 rounded-[var(--radius-md)] font-bold text-lg"
              style={{ backgroundColor: `var(${info.bgVar})` }}
            >
              {info.abbrev}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                {info.fullName}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {stats.totalDocuments.toLocaleString()} regulations
                {guidanceTotal ? ` · ${guidanceTotal.toLocaleString()} guidance` : ''}
              </p>
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
        </div>

        {/* Stats section */}
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)] space-y-2">
          {issuesTotal > 0 && (
            <ProgressBar
              label="Compliance Issues Human-Reviewed"
              current={issuesReviewed}
              total={issuesTotal}
              barColor={info.accentVar}
            />
          )}

          {barrierStats && barrierStats.total > 0 && (
            <ProgressBar
              label="Barrier Issues Reviewed"
              current={barrierStats.total - barrierStats.unreviewed}
              total={barrierStats.total}
              barColor={info.accentVar}
            />
          )}

          {burdenStats && burdenStats.totalAnalyzed > 0 && (
            <BurdenBar average={burdenStats.averageBurden} />
          )}
        </div>

        {/* Actionable badges */}
        {issuesUnreviewed > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="danger">
              {issuesUnreviewed.toLocaleString()} unreviewed issues
            </Badge>
          </div>
        )}
      </Card>
    </Link>
  );
}

export default StateCard;
