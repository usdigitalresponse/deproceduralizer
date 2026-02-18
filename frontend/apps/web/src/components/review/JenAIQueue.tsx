'use client';

import { useState, useEffect, useTransition } from 'react';
import { JenAICard } from './JenAICard';
import { QueuePagination, QueueResultsInfo } from './shared';
import { getJenAIIssuesPaginated, getJenAICategories, getJenAIStatusCounts } from '@/lib/actions/jenai';
import { ReviewProgress } from './ReviewProgress';
import { JENAI_CATEGORY_LABELS } from '@/lib/constants/jenai';
import { formatLabel } from '@/types/regulation';
import { JenAIAvatar } from './JenAIAvatar';
import type { StateCode } from '@/types/state';

interface JenAIQueueProps {
  state: StateCode;
  mode?: 'review' | 'developer';
}

export function JenAIQueue({ state, mode = 'review' }: JenAIQueueProps) {
  const [issues, setIssues] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isPending, startTransition] = useTransition();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'severity' | 'category' | 'reviewedAt' | 'confidence'>('severity');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Categories and counts
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const pageSize = 10;

  // Load data
  useEffect(() => {
    startTransition(async () => {
      const [issuesResult, categoriesResult, countsResult] = await Promise.all([
        getJenAIIssuesPaginated(state, {
          page,
          pageSize,
          sortBy,
          sortOrder,
          filters: {
            status: statusFilter === 'all' ? undefined : statusFilter,
            severity: severityFilter === 'all' ? undefined : severityFilter as 'high' | 'medium' | 'low',
            category: categoryFilter || undefined,
          },
        }),
        getJenAICategories(state),
        getJenAIStatusCounts(state),
      ]);

      if (issuesResult.success) {
        setIssues(issuesResult.data.data as unknown as Array<Record<string, unknown>>);
        setTotal(issuesResult.data.total);
        setTotalPages(issuesResult.data.totalPages);
      }

      if (categoriesResult.success) {
        setCategories(categoriesResult.data);
      }

      if (countsResult.success) {
        const counts: Record<string, number> = {};
        const data = countsResult.data;
        for (const [key, value] of Object.entries(data)) {
          if (key !== 'total') {
            counts[key] = value as number;
          }
        }
        setStatusCounts(counts);
      }
    });
  }, [state, page, statusFilter, severityFilter, categoryFilter, sortBy, sortOrder]);

  const goToPage = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div>
      {/* Status counts progress */}
      {Object.keys(statusCounts).length > 0 && (
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
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-background)] text-sm text-[var(--color-text)]"
        >
          <option value="all">All Statuses</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="confirmed">Confirmed</option>
          <option value="rejected_clear_fp">Rejected (FP)</option>
          <option value="rejected_not_obvious_bad">Rejected (Not Bad)</option>
          <option value="needs_context">Needs Context</option>
          <option value="deferred">Deferred</option>
        </select>

        {/* Severity filter */}
        <select
          value={severityFilter}
          onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-background)] text-sm text-[var(--color-text)]"
        >
          <option value="all">All Severity</option>
          <option value="high">High (7-10)</option>
          <option value="medium">Medium (4-6)</option>
          <option value="low">Low (1-3)</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-background)] text-sm text-[var(--color-text)]"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat.category} value={cat.category}>
              {JENAI_CATEGORY_LABELS[cat.category] || formatLabel(cat.category)} ({cat.count})
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-background)] text-sm text-[var(--color-text)]"
        >
          <option value="severity">Sort by Severity</option>
          <option value="confidence">Sort by Confidence</option>
          <option value="category">Sort by Category</option>
          <option value="reviewedAt">Sort by Reviewed At</option>
        </select>

        <button
          onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-1.5 rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] bg-[var(--color-background)] text-sm text-[var(--color-text)] hover:bg-[var(--color-neutral-50)]"
        >
          {sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        </button>
      </div>

      {/* Results info */}
      {total > 0 && (
        <QueueResultsInfo
          startItem={(page - 1) * pageSize + 1}
          endItem={Math.min(page * pageSize, total)}
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
            <JenAICard key={issue.id as number} issue={issue as never} state={state} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <QueuePagination
          page={page}
          totalPages={totalPages}
          onPageChange={goToPage}
        />
      )}
    </div>
  );
}

export default JenAIQueue;
