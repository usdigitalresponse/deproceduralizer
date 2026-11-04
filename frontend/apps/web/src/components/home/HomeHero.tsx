import Link from 'next/link';
import { FlaskConical, Scale } from 'lucide-react';
import { Container } from '@/components/layout';
import type { DashboardStats } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@/types/state';
import { DEFAULT_JURISDICTION, VALID_JURISDICTIONS } from '@/types/state';

interface HomeHeroProps {
  stats: DashboardStats;
  stateStats: Record<JurisdictionCode, DashboardStats>;
  guidanceTotal: number;
  barrierTotal: number;
  barrierUnreviewed: number;
}

const jurisdictionPills: Record<JurisdictionCode, { abbrev: string; textColor: string; bgColor: string }> = {
  ny: { abbrev: 'NY', textColor: 'text-[var(--color-state-ny-accent)]', bgColor: 'bg-[var(--color-state-ny-bg)]' },
  nj: { abbrev: 'NJ', textColor: 'text-[var(--color-state-nj-accent)]', bgColor: 'bg-[var(--color-state-nj-bg)]' },
  nyc: { abbrev: 'NYC', textColor: 'text-[var(--color-state-nyc-accent)]', bgColor: 'bg-[var(--color-state-nyc-bg)]' },
};

export function HomeHero({ stats, stateStats, guidanceTotal, barrierTotal, barrierUnreviewed }: HomeHeroProps) {
  const totalIssues = stats.complianceIssues.total + barrierTotal;
  const totalUnreviewed = stats.complianceIssues.unreviewed + barrierUnreviewed;

  return (
    <div className="bg-[var(--color-primary-faint)] border-b border-[var(--color-neutral-200)]">
      <Container size="2xl" className="py-8 sm:py-10">
        {/* Eyebrow */}
        <p className="text-xs tracking-[0.15em] font-medium uppercase text-[var(--color-primary-mid)]">
          Regulatory Analysis Dashboard
        </p>

        {/* Stat blocks */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mt-4">
          <div>
            <p className="text-4xl font-bold tracking-tight text-[var(--color-text)]">
              {stats.totalDocuments.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">regulations scanned</p>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tight text-[var(--color-primary)]">
              {guidanceTotal.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">guidance documents</p>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tight text-[var(--color-warning)]">
              {totalIssues.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">issues found</p>
          </div>
          <div>
            <p className="text-4xl font-bold tracking-tight text-[var(--color-danger)]">
              {totalUnreviewed.toLocaleString()}
            </p>
            <p className="text-sm text-[var(--color-text-muted)]">awaiting review</p>
          </div>
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-[var(--color-neutral-200)]">
          <div className="flex items-center gap-4">
            <Link
              href={`/${DEFAULT_JURISDICTION}/pipeline`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-link)] hover:text-[var(--color-link-hover)] transition-colors"
            >
              <FlaskConical className="w-4 h-4" />
              Pipeline →
            </Link>
            <Link
              href={`/${DEFAULT_JURISDICTION}/burden`}
              className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-link)] hover:text-[var(--color-link-hover)] transition-colors"
            >
              <Scale className="w-4 h-4" />
              Burden Index →
            </Link>
          </div>

          <div className="flex items-center gap-2">
            {VALID_JURISDICTIONS.map((j) => {
              const pill = jurisdictionPills[j];
              const count = stateStats[j]?.totalDocuments ?? 0;
              return (
                <Link
                  key={j}
                  href={`/${j}`}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${pill.bgColor} ${pill.textColor} hover:opacity-80 transition-opacity`}
                >
                  {pill.abbrev} · {count.toLocaleString()}
                </Link>
              );
            })}
          </div>
        </div>
      </Container>
    </div>
  );
}
