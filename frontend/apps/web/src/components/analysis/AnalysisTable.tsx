'use client';

import { useEffect, useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { useQueryStates } from 'nuqs';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import type { StateCode, AnalysisListItem } from '@deproceduralizer/database';
import { analysisTableParsers } from '@/lib/url/parsers';
import { getAnalysisListPaginated, type PaginatedAnalysisResult } from '@/lib/actions/analysis';
import { getBookmarkedDocIssuePairs, toggleAnalysisBookmarkByDocIssue } from '@/lib/actions/bookmarks';
import { ClassificationBadge } from '@/components/issues/TierClassificationFlow';
import { Badge, BookmarkButton } from '@/components/ui';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

interface AnalysisTableProps {
  state: StateCode;
}

export function AnalysisTable({ state }: AnalysisTableProps) {
  const [filters] = useQueryStates(analysisTableParsers);
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<PaginatedAnalysisResult | null>(null);
  const [, setFilters] = useQueryStates(analysisTableParsers);
  const [bookmarkedPairs, setBookmarkedPairs] = useState<Set<string>>(new Set());

  // Fetch bookmarked items
  useEffect(() => {
    async function fetchBookmarks() {
      const result = await getBookmarkedDocIssuePairs(state);
      if (result.success) {
        setBookmarkedPairs(result.data);
      }
    }
    fetchBookmarks();
  }, [state]);

  // Handle bookmark toggle with optimistic update
  const handleBookmarkToggle = useCallback(async (documentId: number, issueType: string) => {
    const key = `${documentId}-${issueType}`;
    const wasBookmarked = bookmarkedPairs.has(key);

    // Optimistic update
    setBookmarkedPairs(prev => {
      const next = new Set(prev);
      if (wasBookmarked) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });

    // Server update
    const result = await toggleAnalysisBookmarkByDocIssue(documentId, issueType, state);

    // Revert if failed
    if (!result.success) {
      setBookmarkedPairs(prev => {
        const next = new Set(prev);
        if (wasBookmarked) {
          next.add(key);
        } else {
          next.delete(key);
        }
        return next;
      });
      console.error('Failed to toggle bookmark:', result.error);
    }
  }, [state, bookmarkedPairs]);

  // Fetch data when filters change
  useEffect(() => {
    startTransition(async () => {
      const result = await getAnalysisListPaginated(state, {
        page: filters.page,
        pageSize: filters.pageSize,
        sortBy: filters.sortBy as 'issueType' | 'severity' | 'highestTier' | 'createdAt',
        sortOrder: filters.sortOrder as 'asc' | 'desc',
        filters: {
          tierCompleted: filters.tierCompleted !== 'all' ? parseInt(filters.tierCompleted) : undefined,
          classification: filters.classification !== 'all' ? filters.classification : undefined,
          federalMandate: filters.federalMandate !== 'all' ? filters.federalMandate === 'true' : undefined,
          pipelineRun: filters.pipelineRun !== 'all' ? filters.pipelineRun === 'true' : undefined,
          issueType: filters.issueType && filters.issueType !== 'all' ? filters.issueType : undefined,
          // V5 Tier 3 filters
          severity: filters.severity !== 'all' ? filters.severity : undefined,
          severityChanged: filters.severityChanged !== 'all' ? filters.severityChanged : undefined,
          federalMandateConfirmed: filters.federalMandateConfirmed !== 'all' ? filters.federalMandateConfirmed : undefined,
          stateDiscretion: filters.stateDiscretion !== 'all' ? filters.stateDiscretion : undefined,
          alternativeFound: filters.alternativeFound !== 'all' ? filters.alternativeFound : undefined,
          evidenceGap: filters.evidenceGap !== 'all' ? filters.evidenceGap : undefined,
          supersededByLaw: filters.supersededByLaw !== 'all' ? filters.supersededByLaw : undefined,
          advocacyForChange: filters.advocacyForChange !== 'all' ? filters.advocacyForChange : undefined,
          tier3Trigger: filters.tier3Trigger !== 'all' ? filters.tier3Trigger : undefined,
          // V5.1 Easy Cleanup filter
          easyCleanup: filters.easyCleanup !== 'all' ? filters.easyCleanup : undefined,
          bookmarkedOnly: filters.bookmarkedOnly === 'true' ? true : undefined,
        },
      });

      if (result.success) {
        setData(result.data);
      }
    });
  }, [state, filters]);

  const handlePageChange = (newPage: number) => {
    setFilters({ page: newPage });
  };

  if (!data && isPending) {
    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
        <div className="animate-pulse text-[var(--color-text-muted)]">Loading pipeline data...</div>
      </div>
    );
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] p-8 text-center">
        <p className="text-[var(--color-text-muted)]">No pipeline records found matching your filters.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-md)] overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[var(--color-neutral-50)] border-b border-[var(--color-neutral-200)]">
              <th className="w-10 px-2 py-3"></th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Issue Type</th>
              <th className="text-left px-4 py-3 font-medium text-[var(--color-text-muted)]">Document</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T1</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T2</th>
              <th className="text-center px-2 py-3 font-medium text-[var(--color-text-muted)]">T3</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Severity</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Federal</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Easy Fix</th>
              <th className="text-center px-3 py-3 font-medium text-[var(--color-text-muted)]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {data.data.map((item) => (
              <AnalysisTableRow
                key={`${item.documentId}-${item.issueType}`}
                item={item}
                state={state}
                isBookmarked={bookmarkedPairs.has(`${item.documentId}-${item.issueType}`)}
                onBookmarkToggle={() => handleBookmarkToggle(item.documentId, item.issueType)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-neutral-200)] bg-[var(--color-neutral-50)]">
        <div className="text-xs text-[var(--color-text-muted)]">
          Showing {(data.page - 1) * data.pageSize + 1} - {Math.min(data.page * data.pageSize, data.total)} of {data.total.toLocaleString()}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(data.page - 1)}
            disabled={data.page <= 1 || isPending}
            className="p-1.5 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <span className="text-sm text-[var(--color-text-muted)]">
            Page {data.page} of {data.totalPages}
          </span>

          <button
            onClick={() => handlePageChange(data.page + 1)}
            disabled={data.page >= data.totalPages || isPending}
            className="p-1.5 rounded border border-[var(--color-neutral-300)] hover:bg-[var(--color-neutral-100)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Loading overlay */}
      {isPending && (
        <div className="absolute inset-0 bg-white/50 flex items-center justify-center">
          <div className="animate-spin w-6 h-6 border-2 border-[var(--color-primary)] border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}

interface AnalysisTableRowProps {
  item: AnalysisListItem;
  state: StateCode;
  isBookmarked: boolean;
  onBookmarkToggle: () => void;
}

function AnalysisTableRow({ item, state, isBookmarked, onBookmarkToggle }: AnalysisTableRowProps) {
  const issueTypeLabel = ISSUE_TYPE_LABELS[item.issueType as keyof typeof ISSUE_TYPE_LABELS] || item.issueType;

  return (
    <tr className="border-b border-[var(--color-neutral-100)] hover:bg-[var(--color-neutral-50)]">
      {/* Bookmark */}
      <td className="px-2 py-3 text-center">
        <BookmarkButton
          isBookmarked={isBookmarked}
          onToggle={onBookmarkToggle}
          size="sm"
        />
      </td>

      {/* Issue Type */}
      <td className="px-4 py-3">
        <Badge variant="warning" className="text-xs">
          {issueTypeLabel}
        </Badge>
      </td>

      {/* Document */}
      <td className="px-4 py-3 max-w-xs">
        <div className="truncate text-[var(--color-text)]" title={item.documentTitle || ''}>
          {item.documentTitle || 'Untitled'}
        </div>
        {item.citation && (
          <div className="truncate text-xs text-[var(--color-text-muted)] font-mono" title={item.citation}>
            {item.citation}
          </div>
        )}
      </td>

      {/* Tier Classifications (V5: 3 tiers, T3 = web search) */}
      <td className="px-2 py-3 text-center">
        <ClassificationBadge classification={item.tier1Classification} />
      </td>
      <td className="px-2 py-3 text-center">
        <div className="flex flex-col items-center gap-0.5">
          <ClassificationBadge classification={item.tier2Classification} />
          {item.rerunCount > 0 && (
            <span
              className="text-[10px] px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-medium"
              title={`Tier 2 required ${item.rerunCount} re-run(s) for additional context`}
            >
              {item.rerunCount}x rerun
            </span>
          )}
        </div>
      </td>
      <td className="px-2 py-3 text-center">
        {/* Show T3 for V5, or T4 for legacy V4 data */}
        <ClassificationBadge classification={item.tier3Classification || item.tier4Classification} />
      </td>

      {/* Severity */}
      <td className="px-3 py-3 text-center">
        {item.finalSeverity !== null ? (
          <span
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              item.finalSeverity >= 7
                ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]'
                : item.finalSeverity >= 4
                  ? 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]'
                  : 'bg-[var(--color-success-bg)] text-[var(--color-success)]'
            }`}
          >
            {item.finalSeverity}
          </span>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>

      {/* Federal Mandate */}
      <td className="px-3 py-3 text-center">
        {item.federalMandateFound ? (
          <Badge variant="danger" className="text-xs">Yes</Badge>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>

      {/* Easy Cleanup */}
      <td className="px-3 py-3 text-center">
        {item.easyCleanupCandidate ? (
          <Badge
            variant="success"
            className="text-xs"
            title={item.cleanupType === 'alternative_in_practice'
              ? 'Alternative already accepted in practice'
              : item.cleanupType === 'alternative_authorized'
                ? 'State has authorized alternative'
                : 'Peer state has solution'}
          >
            {item.cleanupEffort === 'trivial' ? '🎯 Trivial' :
             item.cleanupEffort === 'easy' ? '✨ Easy' :
             '📋 Medium'}
          </Badge>
        ) : (
          <span className="text-[var(--color-text-muted)]">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-3 py-3 text-center">
        <Link
          href={`/${state.toLowerCase()}/pipeline/${item.documentId}/${item.issueType}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-[var(--color-primary)] hover:underline"
        >
          View
          <ExternalLink className="w-3 h-3" />
        </Link>
      </td>
    </tr>
  );
}

export default AnalysisTable;
