'use client';

import { useState, useEffect, useTransition, useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { JenAICard } from './JenAICard';
import { QueuePagination, QueueResultsInfo } from './shared';
import {
  getJenAIIssuesPaginated,
  getJenAIDeveloperItems,
  getJenAICategories,
  getJenAIParts,
  getJenAISectionTypes,
  getJenAIStatusCounts,
  getJenAIDeveloperStatusCounts,
} from '@/lib/actions/jenai';
import { ReviewProgress } from './ReviewProgress';
import { DeveloperProgress } from './DeveloperProgress';
import { JenAIReviewFilters } from './JenAIReviewFilters';
import { JenAIDeveloperFilters } from './JenAIDeveloperFilters';
import { JenAIAvatar } from './JenAIAvatar';
import { jenaiQueueParsers } from '@/lib/url/parsers';
import type { JurisdictionCode } from '@/types/state';
import type { JenAIIssueWithContext } from '@deproceduralizer/database';

type JenAISortBy = 'severity' | 'category' | 'reviewedAt' | 'confidence' | 'developerCheckedAt';

interface JenAIQueueProps {
  jurisdiction: JurisdictionCode;
  mode?: 'review' | 'developer';
}

export function JenAIQueue({ jurisdiction, mode = 'review' }: JenAIQueueProps) {
  const isDeveloper = mode === 'developer';

  // shallow: true (default) — data is fetched via client-side server actions in useEffect,
  // not via server components, so full Next.js navigation is unnecessary overhead.
  const [filters, setFilters] = useQueryStates(jenaiQueueParsers);
  const effectiveSortBy = (filters.sortBy || (isDeveloper ? 'reviewedAt' : 'severity')) as JenAISortBy;

  const [issues, setIssues] = useState<JenAIIssueWithContext[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isPending, startTransition] = useTransition();

  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [parts, setParts] = useState<{ part: string; partName: string | null; count: number }[]>([]);
  const [sectionTypes, setSectionTypes] = useState<{ sectionType: string; count: number }[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const pageSize = 10;

  // Stable data: categories, parts, sectionTypes + status counts only depend on jurisdiction and mode
  useEffect(() => {
    startTransition(async () => {
      const [categoriesResult, partsResult, sectionTypesResult, countsResult] = await Promise.all([
        getJenAICategories(jurisdiction),
        getJenAIParts(jurisdiction),
        getJenAISectionTypes(jurisdiction),
        isDeveloper
          ? getJenAIDeveloperStatusCounts(jurisdiction)
          : getJenAIStatusCounts(jurisdiction),
      ]);

      if (categoriesResult.success) {
        setCategories(categoriesResult.data);
      }

      if (partsResult.success) {
        setParts(partsResult.data);
      }

      if (sectionTypesResult.success) {
        setSectionTypes(sectionTypesResult.data);
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
            page: filters.page,
            pageSize,
            sortBy: effectiveSortBy,
            sortOrder: filters.sortOrder,
            developerStatus: filters.developerStatus === 'all' ? undefined : filters.developerStatus,
            developerAssigned: filters.developerAssigned || undefined,
            severity: filters.severity || undefined,
            category: filters.category || undefined,
            source: filters.source,
            part: filters.part || undefined,
            sectionType: filters.sectionType || undefined,
            search: filters.search || undefined,
            complexity: filters.complexity || undefined,
            verbatim: filters.verbatim || undefined,
          })
        : await getJenAIIssuesPaginated(jurisdiction, {
            page: filters.page,
            pageSize,
            sortBy: effectiveSortBy,
            sortOrder: filters.sortOrder,
            filters: {
              status: filters.reviewStatus === 'all' ? undefined : filters.reviewStatus,
              severity: filters.severity || undefined,
              category: filters.category || undefined,
              source: filters.source,
              part: filters.part || undefined,
              sectionType: filters.sectionType || undefined,
              search: filters.search || undefined,
              complexity: filters.complexity || undefined,
              verbatim: filters.verbatim || undefined,
            },
          });

      if (issuesResult.success) {
        setIssues(issuesResult.data.data);
        setTotal(issuesResult.data.total);
        setTotalPages(issuesResult.data.totalPages);
      }
    });
  }, [jurisdiction, isDeveloper, filters, effectiveSortBy]);

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
      ? filters.developerStatus
      : filters.reviewStatus;

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
  }, [isDeveloper, filters.developerStatus, filters.reviewStatus, refreshStatusCounts]);

  const handleIssueCleared = useCallback((issueId: number) => {
    setIssues(prev => prev.filter(i => i.id !== issueId));
    setTotal(prev => Math.max(0, prev - 1));
    refreshStatusCounts();
  }, [refreshStatusCounts]);

  const currentPage = filters.page;

  const goToPage = useCallback((newPage: number) => {
    setFilters({ page: newPage });
  }, [setFilters]);

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
        <JenAIDeveloperFilters
          categories={categories}
          parts={parts}
          sectionTypes={sectionTypes}
          className="mb-4"
        />
      ) : (
        <JenAIReviewFilters
          categories={categories}
          parts={parts}
          sectionTypes={sectionTypes}
          className="mb-4"
        />
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
