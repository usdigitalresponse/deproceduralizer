'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ComplianceIssueWithContext, ComplianceIssueStatusCounts } from '@deproceduralizer/database';
import { ReviewProgress } from './ReviewProgress';
import { ComplianceIssueCard } from './ComplianceIssueCard';
import { ReviewKeyboardNav } from './ReviewKeyboardNav';
import { Button, Select } from '@/components/ui';
import RegulationModal from './RegulationModal';
import { getStateFromPathname } from '@/hooks';
import { REVIEW_STATUSES, COMPLIANCE_ISSUE_TYPES } from '@/types/regulation';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface ComplianceFilterOptions {
  status?: string;
  issueType?: string;
}

interface ComplianceReviewQueueProps {
  initialIssues: ComplianceIssueWithContext[];
  pagination: PaginationInfo;
  statusCounts: ComplianceIssueStatusCounts;
  issueTypes: string[];
  currentFilters: ComplianceFilterOptions;
  sortBy: string;
  sortOrder: string;
}

export function ComplianceReviewQueue({
  initialIssues,
  pagination,
  statusCounts,
  issueTypes,
  currentFilters,
  sortBy,
  sortOrder,
}: ComplianceReviewQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname
  const state = getStateFromPathname(pathname, 'nj');

  // Local state for optimistic updates
  const [issues, setIssues] = useState<ComplianceIssueWithContext[]>(initialIssues);
  const [counts, setCounts] = useState<ComplianceIssueStatusCounts>(statusCounts);

  // Focused card for keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Modal state for viewing regulation
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Sync with server data when props change
  useEffect(() => {
    setIssues(initialIssues);
    setCounts(statusCounts);
  }, [initialIssues, statusCounts]);

  // Handle issue update (optimistic)
  const handleIssueUpdated = useCallback((updatedIssue: ComplianceIssueWithContext) => {
    setIssues((prevIssues) => {
      const oldIssue = prevIssues.find((i) => i.id === updatedIssue.id);
      const oldStatus = oldIssue?.reviewStatus || 'unreviewed';
      const newStatus = updatedIssue.reviewStatus || 'unreviewed';

      if (oldStatus !== newStatus) {
        setCounts((prevCounts) => {
          const newCounts = { ...prevCounts };
          if (oldStatus in newCounts && oldStatus !== 'total') {
            newCounts[oldStatus as keyof ComplianceIssueStatusCounts] = Math.max(
              0,
              (newCounts[oldStatus as keyof ComplianceIssueStatusCounts] as number) - 1
            );
          }
          if (newStatus in newCounts && newStatus !== 'total') {
            newCounts[newStatus as keyof ComplianceIssueStatusCounts] =
              (newCounts[newStatus as keyof ComplianceIssueStatusCounts] as number) + 1;
          }
          return newCounts;
        });
      }

      return prevIssues.map((i) => (i.id === updatedIssue.id ? updatedIssue : i));
    });
  }, []);

  // Handle view regulation
  const handleViewRegulation = useCallback((regulationId: number) => {
    setSelectedRegulationId(regulationId);
  }, []);

  // Keyboard navigation handlers
  const handleNavigate = useCallback((direction: 'up' | 'down') => {
    setFocusedIndex((prev) => {
      const newIndex = direction === 'down'
        ? Math.min(prev + 1, issues.length - 1)
        : Math.max(prev - 1, 0);

      cardRefs.current[newIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });

      return newIndex;
    });
  }, [issues.length]);

  const handleNextUnreviewed = useCallback(() => {
    const nextUnreviewedIndex = issues.findIndex(
      (i, idx) => idx > focusedIndex && (i.reviewStatus === 'unreviewed' || !i.reviewStatus)
    );
    if (nextUnreviewedIndex !== -1) {
      setFocusedIndex(nextUnreviewedIndex);
      cardRefs.current[nextUnreviewedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [issues, focusedIndex]);

  // Filter and pagination helpers
  const updateParams = useCallback((updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    params.set('page', '1'); // Reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  // Build filter options
  const statusOptions = [{ value: 'all', label: 'All Statuses' }, ...REVIEW_STATUSES];
  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...issueTypes.map(t => {
      const found = COMPLIANCE_ISSUE_TYPES.find(ct => ct.value === t);
      return { value: t, label: found?.label || t };
    }),
  ];
  const sortOptions = [
    { value: 'createdAt', label: 'Date Created' },
    { value: 'issueType', label: 'Issue Type' },
    { value: 'reviewedAt', label: 'Last Reviewed' },
  ];

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ReviewProgress counts={counts} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)]">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Status:</label>
          <Select
            value={currentFilters.status || 'all'}
            onValueChange={(value) => updateParams({ status: value === 'all' ? undefined : value })}
            options={statusOptions}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Type:</label>
          <Select
            value={currentFilters.issueType || 'all'}
            onValueChange={(value) => updateParams({ issueType: value === 'all' ? undefined : value })}
            options={typeOptions}
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-[var(--color-text-secondary)]">Sort:</label>
          <Select
            value={sortBy}
            onValueChange={(value) => updateParams({ sortBy: value })}
            options={sortOptions}
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => updateParams({ status: undefined, issueType: undefined, sortBy: undefined })}
        >
          Clear Filters
        </Button>
      </div>

      {/* Keyboard navigation */}
      <ReviewKeyboardNav
        onNavigate={handleNavigate}
        onNextUnreviewed={handleNextUnreviewed}
        onViewRegulation={() => {
          if (issues[focusedIndex]) {
            handleViewRegulation(issues[focusedIndex].regulation.id);
          }
        }}
      />

      {/* Results info */}
      <div className="flex items-center justify-between text-sm text-[var(--color-text-secondary)]">
        <span>
          Showing {issues.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
          –{Math.min(pagination.page * pagination.pageSize, pagination.total)} of {pagination.total} issues
        </span>
        <span className="text-xs text-[var(--color-text-muted)]">
          Press <kbd className="px-1.5 py-0.5 bg-[var(--color-neutral-100)] rounded text-xs font-mono">?</kbd> for keyboard shortcuts
        </span>
      </div>

      {/* Issue cards */}
      {issues.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-muted)]">
          <p className="text-lg mb-2">No compliance issues found</p>
          <p className="text-sm">Try adjusting your filters or check back later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {issues.map((issue, index) => (
            <ComplianceIssueCard
              key={issue.id}
              ref={(el) => { cardRefs.current[index] = el; }}
              issue={issue}
              onUpdated={handleIssueUpdated}
              onViewRegulation={handleViewRegulation}
              isFocused={index === focusedIndex}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => goToPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <span className="px-4 text-sm text-[var(--color-text-secondary)]">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => goToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      )}

      {/* Regulation Modal */}
      <RegulationModal
        regulationId={selectedRegulationId}
        onClose={() => setSelectedRegulationId(null)}
      />
    </div>
  );
}

export default ComplianceReviewQueue;
