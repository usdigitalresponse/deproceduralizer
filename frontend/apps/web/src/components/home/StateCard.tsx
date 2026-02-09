'use client';

import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ChevronRight } from 'lucide-react';
import type { DashboardStats } from '@deproceduralizer/database';

interface StateCardProps {
  state: 'ny' | 'nj';
  stats: DashboardStats;
}

const stateInfo = {
  ny: {
    name: 'New York',
    fullName: 'New York State',
    abbrev: 'NY',
    accentColor: 'bg-blue-500',
    accentColorLight: 'bg-blue-50',
    borderColor: 'border-blue-200',
    barColor: 'bg-blue-500',
  },
  nj: {
    name: 'New Jersey',
    fullName: 'New Jersey State',
    abbrev: 'NJ',
    accentColor: 'bg-amber-500',
    accentColorLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
    barColor: 'bg-amber-500',
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
          className={`h-full rounded-full ${barColor} transition-all duration-300`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function StateCard({ state, stats }: StateCardProps) {
  const info = stateInfo[state];

  const issuesTotal = stats.complianceIssues?.total ?? 0;
  const issuesUnreviewed = stats.complianceIssues?.unreviewed ?? 0;
  const issuesReviewed = issuesTotal - issuesUnreviewed;

  return (
    <Link href={`/${state}`} className="block group">
      <Card
        className={`
          relative overflow-hidden transition-all duration-[var(--duration-normal)]
          hover:shadow-[var(--shadow-md)] hover:border-[var(--color-primary-weak)]
          ${info.borderColor}
        `}
      >
        {/* Accent bar */}
        <div className={`absolute top-0 left-0 right-0 h-1 ${info.accentColor}`} />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* State abbreviation badge */}
            <div className={`
              flex items-center justify-center
              w-12 h-12
              rounded-[var(--radius-md)]
              ${info.accentColorLight}
              font-bold text-lg
            `}>
              {info.abbrev}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-[var(--color-text)]">
                {info.fullName}
              </h3>
              <p className="text-sm text-[var(--color-text-muted)]">
                {stats.totalDocuments.toLocaleString()} regulations
              </p>
            </div>
          </div>

          <ChevronRight className="w-5 h-5 text-[var(--color-text-muted)] group-hover:text-[var(--color-primary)] transition-colors" />
        </div>

        {/* Progress bars */}
        <div className="mt-4 pt-4 border-t border-[var(--color-neutral-200)] space-y-2">
          <ProgressBar
            label="Analyzed"
            current={stats.analyzedDocuments}
            total={stats.totalDocuments}
            barColor={info.barColor}
          />
          {issuesTotal > 0 && (
            <ProgressBar
              label="Reviewed"
              current={issuesReviewed}
              total={issuesTotal}
              barColor={info.barColor}
            />
          )}
        </div>

        {/* Actionable badges */}
        {(stats.unreviewedFlags > 0 || issuesUnreviewed > 0) && (
          <div className="flex flex-wrap gap-2 mt-3">
            {stats.unreviewedFlags > 0 && (
              <Badge variant="danger">
                {stats.unreviewedFlags.toLocaleString()} unreviewed flags
              </Badge>
            )}
            {issuesUnreviewed > 0 && (
              <Badge variant="danger">
                {issuesUnreviewed.toLocaleString()} unreviewed issues
              </Badge>
            )}
          </div>
        )}
      </Card>
    </Link>
  );
}

export default StateCard;
