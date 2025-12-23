'use client';

import type { ComplianceIssueWithContext, ComplianceIssueStatusCounts } from '@deproceduralizer/database';
import { ReviewProgress } from './ReviewProgress';
import { ComplianceIssueCard } from './ComplianceIssueCard';
import { ComplianceFilters } from './ComplianceFilters';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination,
  KeyboardHelpModal,
} from './shared';
import { useDeepLink, useQueueNavigation, useQueue, type PaginationInfo } from '@/hooks';

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
  // Use generic queue hook for state management
  const {
    items: issues,
    counts,
    selectedRegulationId,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated: handleIssueUpdated,
    goToPage,
  } = useQueue<ComplianceIssueWithContext, ComplianceIssueStatusCounts>({
    initialItems: initialIssues,
    initialCounts: statusCounts,
    getItemId: (i) => i.id,
    getItemStatus: (i) => i.reviewStatus || 'unreviewed',
    defaultStatus: 'unreviewed',
    getRegulationId: (i) => i.regulation.id,
  });

  // Keyboard navigation hook (auto-attaches listener)
  const {
    focusedIndex,
    setFocusedIndex,
    setCardRef,
    cardRefs,
    showHelp,
    setShowHelp,
    shortcuts,
  } = useQueueNavigation({
    items: issues,
    getItemId: (i) => `compliance-${i.id}`,
    onViewRegulation: (i) => setSelectedRegulationId(i.regulation.id),
    findNextUnreviewed: (idx) => issues.findIndex(
      (i, index) => index > idx && (i.reviewStatus === 'unreviewed' || !i.reviewStatus)
    ),
    enableHelpModal: true,
    itemLabel: 'issue',
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: issues.map((i) => ({ id: i.id })),
    cardRefs,
    setFocusedIndex,
    itemType: 'compliance',
  });

  return (
    <div className="space-y-6">
      {/* Progress */}
      <ReviewProgress counts={counts} />

      {/* Filters */}
      <ComplianceFilters issueTypes={issueTypes} />

      {/* Keyboard help modal */}
      <KeyboardHelpModal
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
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
