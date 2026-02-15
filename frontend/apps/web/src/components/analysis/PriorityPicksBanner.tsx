'use client';

import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { Zap, ArrowRight } from 'lucide-react';
import type { AnalysisListItem, StateCode } from '@deproceduralizer/database';
import { Badge } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';
import { analysisTableParsers } from '@/lib/url/parsers';

interface PriorityPicksBannerProps {
  state: StateCode;
  items: AnalysisListItem[];
  totalQuickWins: number;
  isQuickWinMode: boolean;
  /** When provided, "View all" renders as a Link to this URL instead of setting nuqs filters in-place. */
  viewAllHref?: string;
}

export function PriorityPicksBanner({
  state,
  items,
  totalQuickWins,
  isQuickWinMode,
  viewAllHref,
}: PriorityPicksBannerProps) {
  const [, setFilters] = useQueryStates(analysisTableParsers);

  if (items.length === 0) {
    return null;
  }

  const heading = isQuickWinMode ? 'Start Here' : 'Highest Priority Issues';
  const subtext = isQuickWinMode
    ? 'These high-severity issues have known easy fixes'
    : 'Top burdensome issues by severity';

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-[var(--color-warning)]" />
          <h3 className="text-lg font-semibold text-[var(--color-text)]">
            {heading}
          </h3>
        </div>
        <span className="text-xs text-[var(--color-text-muted)]">
          {subtext}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {items.map((item) => (
          <PriorityCard key={`${item.documentId}-${item.issueType}`} item={item} state={state} />
        ))}
      </div>

      {isQuickWinMode && totalQuickWins > 5 && (
        <div className="mt-4 pt-3 border-t border-[var(--color-neutral-100)]">
          {viewAllHref ? (
            <Link
              href={viewAllHref}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
            >
              View all {totalQuickWins} quick wins
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <button
              onClick={() => setFilters({ severity: 'high', easyCleanup: 'any', page: 1 })}
              className="inline-flex items-center gap-1 text-sm text-[var(--color-primary)] hover:underline"
            >
              View all {totalQuickWins} quick wins
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

interface PriorityCardProps {
  item: AnalysisListItem;
  state: StateCode;
}

function PriorityCard({ item, state }: PriorityCardProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[item.issueType as keyof typeof ISSUE_TYPE_LABELS] || item.issueType;

  return (
    <Link
      href={`/${state.toLowerCase()}/pipeline/${item.documentId}/${item.issueType}`}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-3 rounded-[var(--radius-sm)] border border-[var(--color-neutral-200)] hover:border-[var(--color-primary-weak)] hover:bg-[var(--color-primary-faint)] transition-colors"
    >
      <div className="flex items-center gap-2 mb-2">
        {/* Severity circle */}
        {item.finalSeverity !== null && (
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold shrink-0 ${
              item.finalSeverity >= 7
                ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                : item.finalSeverity >= 4
                  ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
            }`}
          >
            {item.finalSeverity}
          </span>
        )}
        <Badge variant="warning" className="text-xs truncate">
          {issueTypeLabel}
        </Badge>
      </div>

      <div className="text-xs text-[var(--color-text)] truncate" title={item.documentTitle || ''}>
        {item.documentTitle || 'Untitled'}
      </div>

      {item.easyCleanupCandidate && (
        <div className="mt-1.5">
          <Badge variant="success" className="text-[10px]">
            {item.cleanupEffort === 'trivial' ? 'Trivial Fix' :
             item.cleanupEffort === 'easy' ? 'Easy Fix' :
             'Medium Fix'}
          </Badge>
        </div>
      )}
    </Link>
  );
}
