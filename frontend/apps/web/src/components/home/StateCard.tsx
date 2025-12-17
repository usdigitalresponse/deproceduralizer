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
  },
  nj: {
    name: 'New Jersey',
    fullName: 'New Jersey State',
    abbrev: 'NJ',
    accentColor: 'bg-amber-500',
    accentColorLight: 'bg-amber-50',
    borderColor: 'border-amber-200',
  },
};

export function StateCard({ state, stats }: StateCardProps) {
  const info = stateInfo[state];

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

        {/* Stats row */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-[var(--color-neutral-200)]">
          <Badge variant="info">
            {stats.analyzedDocuments.toLocaleString()} analyzed
          </Badge>
          {stats.documentsWithFlags > 0 && (
            <Badge variant="warning">
              {stats.documentsWithFlags.toLocaleString()} with flags
            </Badge>
          )}
          {stats.complianceIssues && stats.complianceIssues.total > 0 && (
            <Badge variant="warning">
              {stats.complianceIssues.total.toLocaleString()} compliance issues
            </Badge>
          )}
          {stats.unreviewedFlags > 0 && (
            <Badge variant="danger">
              {stats.unreviewedFlags.toLocaleString()} unreviewed flags
            </Badge>
          )}
          {stats.complianceIssues && stats.complianceIssues.unreviewed > 0 && (
            <Badge variant="danger">
              {stats.complianceIssues.unreviewed.toLocaleString()} unreviewed issues
            </Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}

export default StateCard;
