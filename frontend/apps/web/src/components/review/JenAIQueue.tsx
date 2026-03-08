'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { JenAICard } from './JenAICard';
import { QueuePagination, QueueResultsInfo } from './shared';
import {
  getJenAIIssuesPaginated,
  getJenAIDeveloperItems,
  getJenAICategories,
  getJenAIStatusCounts,
  getJenAIDeveloperStatusCounts,
} from '@/lib/actions/jenai';
import { ReviewProgress } from './ReviewProgress';
import { DeveloperProgress } from './DeveloperProgress';
import { JenAIReviewFilters } from './JenAIReviewFilters';
import { JenAIDeveloperFilters } from './JenAIDeveloperFilters';
import { JenAIAvatar } from './JenAIAvatar';
import { jenaiReviewQueueParsers, jenaiDeveloperQueueParsers } from '@/lib/url/parsers';
import type { JurisdictionCode } from '@/types/state';
import type { JenAIIssueWithContext } from '@deproceduralizer/database';

interface JenAIQueueProps {
  jurisdiction: JurisdictionCode;
  mode?: 'review' | 'developer';
}

export function JenAIQueue({ jurisdiction, mode = 'review' }: JenAIQueueProps) {
  const isDeveloper = mode === 'developer';

  const [reviewFilters, setReviewFilters] = useQueryStates(jenaiReviewQueueParsers, { shallow: false });
  const [devFilters, setDevFilters] = useQueryStates(jenaiDeveloperQueueParsers, { shallow: false });

  const [issues, setIssues] = useState<JenAIIssueWithContext[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const pageSize = 10;

  // Stable data: categories + status counts only depend on jurisdiction and mode
  useEffect(() => {
    startTransition(async () => {
      const [categoriesResult, countsResult] = await Promise.all([
        getJenAICategories(jurisdiction),
        isDeveloper
          ? getJenAIDeveloperStatusCounts(jurisdiction)
          : getJenAIStatusCounts(jurisdiction),
      ]);

      if (categoriesResult.success) {
        setCategories(categoriesResult.data);
      }

      if (countsResult.success) {
        const counts: Record<string, number> = {};
        for (const [key, value] of Object.entries(countsResult.data)) {
          if (key !== 'total') {
            counts[key] = value as number;
          }
        }
        setStatusCounts(counts);
      }
    });
  }, [jurisdiction, isDeveloper]);

  // Filtered data: issues depend on URL filter state
  useEffect(() => {
    startTransition(async () => {
      const issuesResult = isDeveloper
        ? await getJenAIDeveloperItems(jurisdiction, {
            page: devFilters.page,
            pageSize,
            sortBy: devFilters.sortBy,
            sortOrder: devFilters.sortOrder,
            developerStatus: devFilters.developerStatus === 'all' ? undefined : devFilters.developerStatus,
            developerAssigned: devFilters.developerAssigned || undefined,
            severity: devFilters.severity,
            category: devFilters.category || undefined,
            source: devFilters.source,
          })
        : await getJenAIIssuesPaginated(jurisdiction, {
            page: reviewFilters.page,
            pageSize,
            sortBy: reviewFilters.sortBy,
            sortOrder: reviewFilters.sortOrder,
            filters: {
              status: reviewFilters.reviewStatus === 'all' ? undefined : reviewFilters.reviewStatus,
              severity: reviewFilters.severity === 'all' ? undefined : reviewFilters.severity,
              category: reviewFilters.category || undefined,
              source: reviewFilters.source,
            },
          });

      if (issuesResult.success) {
        setIssues(issuesResult.data.data);
        setTotal(issuesResult.data.total);
        setTotalPages(issuesResult.data.totalPages);
      }
    });
  }, [jurisdiction, isDeveloper, reviewFilters, devFilters]);

  const refreshStatusCounts = useCallback(() => {
    const countsFetcher = isDeveloper
      ? getJenAIDeveloperStatusCounts(jurisdiction)
      : getJenAIStatusCounts(jurisdiction);
    countsFetcher.then((result) => {
      if (result.success) {
        const counts: Record<string, number> = {};
        for (const [key, value] of Object.entries(result.data)) {
          if (key !== 'total') {
            counts[key] = value as number;
          }
        }
        setStatusCounts(counts);
      }
    });
  }, [jurisdiction, isDeveloper]);

  const handleIssueUpdated = useCallback((updated: JenAIIssueWithContext) => {
    // Check if updated issue still matches the active status filter
    const activeStatusFilter = isDeveloper
      ? devFilters.developerStatus
      : reviewFilters.reviewStatus;

    const updatedStatus = isDeveloper
      ? updated.developerStatus
      : updated.reviewStatus;

    // If a status filter is active and the updated issue no longer matches, remove it
    if (activeStatusFilter && activeStatusFilter !== 'all' && updatedStatus !== activeStatusFilter) {
      setIssues(prev => prev.filter(i => i.id !== updated.id));
      setTotal(prev => Math.max(0, prev - 1));
    } else {
      setIssues(prev => prev.map(i => i.id === updated.id ? updated : i));
    }

    // Refresh status counts to keep progress bar accurate
    refreshStatusCounts();
  }, [isDeveloper, devFilters.developerStatus, reviewFilters.reviewStatus, refreshStatusCounts]);

  const handleIssueCleared = useCallback((issueId: number) => {
    setIssues(prev => prev.filter(i => i.id !== issueId));
    setTotal(prev => Math.max(0, prev - 1));
    refreshStatusCounts();
  }, [refreshStatusCounts]);

  const currentPage = isDeveloper ? devFilters.page : reviewFilters.page;

  const goToPage = useCallback((newPage: number) => {
    if (isDeveloper) {
      setDevFilters({ page: newPage });
    } else {
      setReviewFilters({ page: newPage });
    }
  }, [isDeveloper, setDevFilters, setReviewFilters]);

  return (
    <div>
      {/* Progress bar */}
      {Object.keys(statusCounts).length > 0 && (
        isDeveloper ? (
          <DeveloperProgress
            counts={{
              unresolved: statusCounts.unresolved ?? 0,
              resolved: statusCounts.resolved ?? 0,
              pending: statusCounts.pending ?? 0,
              backlogged: statusCounts.backlogged ?? 0,
              need_more_info: statusCounts.need_more_info ?? 0,
              total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
            }}
          />
        ) : (
          <ReviewProgress
            counts={{
              unreviewed: statusCounts.unreviewed ?? 0,
              confirmed: statusCounts.confirmed ?? 0,
              rejected_clear_fp: statusCounts.rejected_clear_fp ?? 0,
              rejected_not_obvious_bad: statusCounts.rejected_not_obvious_bad ?? 0,
              needs_context: statusCounts.needs_context ?? 0,
              deferred: statusCounts.deferred ?? 0,
              total: Object.values(statusCounts).reduce((a, b) => a + b, 0),
            }}
          />
        )
      )}

      {/* Filters */}
      {isDeveloper ? (
        <JenAIDeveloperFilters categories={categories} className="mb-4" />
      ) : (
        <JenAIReviewFilters categories={categories} className="mb-4" />
      )}

      {/* Results info */}
      {total > 0 && (
        <QueueResultsInfo
          startItem={(currentPage - 1) * pageSize + 1}
          endItem={Math.min(currentPage * pageSize, total)}
          total={total}
          itemLabel="JenAI issues"
          showKeyboardHint={false}
        />
      )}

      {/* Loading state */}
      {isPending && (
        <div className="text-center py-8 text-[var(--color-text-muted)]">
          Loading...
        </div>
      )}

      {/* Issue cards */}
      {!isPending && issues.length === 0 && (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <JenAIAvatar size={80} className="mx-auto mb-4" />
          <p className="text-lg mb-2">No JenAI issues found</p>
          <p className="text-sm">No implementation issues match your current filters. Try broadening your search criteria.</p>
        </div>
      )}

      {!isPending && issues.length > 0 && (
        <div className="space-y-4">
          {issues.map((issue) => (
            <JenAICard key={issue.id} issue={issue} onUpdated={handleIssueUpdated} onCleared={handleIssueCleared} state={jurisdiction} mode={mode} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <QueuePagination
          page={currentPage}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}
    </div>
  );
}

export default JenAIQueue;
