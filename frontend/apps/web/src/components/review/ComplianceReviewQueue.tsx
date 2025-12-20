'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import type { ComplianceIssueWithContext, ComplianceIssueStatusCounts } from '@deproceduralizer/database';
import { ReviewProgress } from './ReviewProgress';
import { ComplianceIssueCard } from './ComplianceIssueCard';
import { ComplianceFilters } from './ComplianceFilters';
import { ReviewKeyboardNav } from './ReviewKeyboardNav';
import RegulationModal from './RegulationModal';
import { 
  QueueResultsInfo, 
  QueueEmptyState, 
  QueuePagination 
} from './shared';
import { getStateFromPathname, useDeepLink, useQueueNavigation } from '@/hooks';
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
  compact?: boolean;
}

export function ComplianceReviewQueue({
  initialIssues,
  pagination,
  statusCounts,
  issueTypes,
  compact = false,
}: ComplianceReviewQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Extract state from pathname
  const state = getStateFromPathname(pathname, 'nj');

  // Local state for optimistic updates
  const [issues, setIssues] = useState<ComplianceIssueWithContext[]>(initialIssues);
  const [counts, setCounts] = useState<ComplianceIssueStatusCounts>(statusCounts);

  // Modal state for viewing regulation
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  // Keyboard navigation hook
  const { 
    focusedIndex, 
    setFocusedIndex, 
    setCardRef, 
    navigate, 
    goToNextUnreviewed,
    cardRefs 
  } = useQueueNavigation({
    items: issues,
    getItemId: (i) => `compliance-${i.id}`,
    onViewRegulation: (i) => setSelectedRegulationId(i.regulation.id),
    findNextUnreviewed: (idx) => issues.findIndex(
      (i, index) => index > idx && (i.reviewStatus === 'unreviewed' || !i.reviewStatus)
    ),
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: issues.map((i) => ({ id: i.id })),
    cardRefs,
    setFocusedIndex,
    itemType: 'compliance',
  });

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

  // Pagination helper
  const goToPage = useCallback((page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ReviewProgress counts={counts} />

      {/* Filters */}
      <ComplianceFilters issueTypes={issueTypes} />

      {/* Keyboard navigation */}
      <ReviewKeyboardNav
        onNavigate={navigate}
        onNextUnreviewed={goToNextUnreviewed}
        onViewRegulation={() => {
          if (issues[focusedIndex]) {
            handleViewRegulation(issues[focusedIndex].regulation.id);
          }
        }}
      />

      {/* Results info */}
      <QueueResultsInfo
        startItem={issues.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
        endItem={Math.min(pagination.page * pagination.pageSize, pagination.total)}
        total={pagination.total}
        itemLabel="issues"
      />

      {/* Issue cards */}
      {issues.length === 0 ? (
        <QueueEmptyState 
          title="No compliance issues found" 
          description="Try adjusting your filters or check back later." 
        />
      ) : (
        <div className="space-y-4">
          {issues.map((issue, index) => (
            <ComplianceIssueCard
              key={issue.id}
              ref={(el) => setCardRef(index, el)}
              issue={issue}
              onUpdated={handleIssueUpdated}
              onViewRegulation={handleViewRegulation}
              isFocused={index === focusedIndex}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <QueuePagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={goToPage}
      />

      {/* Regulation Modal */}
      <RegulationModal
        regulationId={selectedRegulationId}
        onClose={() => setSelectedRegulationId(null)}
      />
    </div>
  );
}

export default ComplianceReviewQueue;
