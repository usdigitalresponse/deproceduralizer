'use client';

import { useMemo } from 'react';
import type { ComplianceIssueWithAnalysis } from '@deproceduralizer/database';
import type { DeveloperItem, CombinedDeveloperStatusCounts } from '@/lib/actions/developer';
import { DeveloperProgress } from './DeveloperProgress';
import { ComplianceDeveloperFilters } from './ComplianceDeveloperFilters';
import { DeveloperCard } from './DeveloperCard';
import { ExcludedSectionsList } from './ExcludedSectionsList';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination
} from './shared';
import { useDeepLink, useQueueNavigation, useQueue, type PaginationInfo } from '@/hooks';
import { useQueryState } from 'nuqs';
import { developerStatusParser } from '@/lib/url/parsers';

interface ComplianceDeveloperQueueProps {
  initialItems: ComplianceIssueWithAnalysis[];
  pagination: PaginationInfo;
  statusCounts: CombinedDeveloperStatusCounts;
  issueTypes: string[];
}

/**
 * Convert ComplianceIssueWithAnalysis to DeveloperItem format for reusing DeveloperCard
 */
function toDeveloperItem(issue: ComplianceIssueWithAnalysis): DeveloperItem {
  return {
    id: issue.id,
    type: 'compliance_issue' as const,
    reviewStatus: issue.reviewStatus,
    reviewedBy: issue.reviewedBy,
    reviewedAt: issue.reviewedAt,
    justificationNotes: issue.justificationNotes,
    teamNotes: issue.teamNotes,
    developerStatus: issue.developerStatus,
    developerAssigned: issue.developerAssigned,
    developerNotes: issue.developerNotes,
    resolutionType: issue.resolutionType,
    resolutionComments: issue.resolutionComments,
    developerQuestion: issue.developerQuestion,
    developerCheckedAt: issue.developerCheckedAt,
    regulation: {
      id: issue.regulation.id,
      title: issue.regulation.title,
      url: issue.regulation.url,
    },
    complianceIssueData: issue,
  };
}

export function ComplianceDeveloperQueue({
  initialItems,
  pagination,
  statusCounts,
  issueTypes,
}: ComplianceDeveloperQueueProps) {
  // Read current developer status filter from URL for filter-aware item removal
  const [developerStatus] = useQueryState('developerStatus', developerStatusParser);

  // Convert to DeveloperItem format - memoize to prevent infinite re-renders
  const initialDeveloperItems = useMemo(
    () => initialItems.map(toDeveloperItem),
    [initialItems]
  );

  // Use generic queue hook for state management
  const {
    items,
    counts,
    selectedRegulationId,
    jurisdiction: state,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemUpdated,
    goToPage,
  } = useQueue<DeveloperItem, CombinedDeveloperStatusCounts>({
    initialItems: initialDeveloperItems,
    initialCounts: statusCounts,
    getItemId: (i) => `${i.type}-${i.id}`,
    getItemStatus: (i) => i.developerStatus || 'unresolved',
    defaultStatus: 'unresolved',
    getRegulationId: (i) => i.regulation.id,
    statusFilter: developerStatus || 'all',
  });

  // Keyboard navigation hook (auto-attaches listener)
  const {
    focusedIndex,
    setFocusedIndex,
    setCardRef,
    cardRefs,
  } = useQueueNavigation({
    items: items,
    getItemId: (i) => `${i.type}-${i.id}`,
    onViewRegulation: (i) => setSelectedRegulationId(i.regulation.id),
    itemLabel: 'issue',
  });

  // Deep link handling - scroll to item if hash is present
  useDeepLink({
    items: items.map((i) => ({ id: i.id, type: i.type })),
    cardRefs,
    setFocusedIndex,
  });

  return (
    <div className="space-y-6">
      {/* Excluded Sections - collapsible */}
      <ExcludedSectionsList />

      {/* Progress */}
      <DeveloperProgress counts={counts} />

      {/* Filters */}
      <ComplianceDeveloperFilters issueTypes={issueTypes} className="mb-2" />

      {/* Results info */}
      <QueueResultsInfo
        startItem={items.length > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0}
        endItem={Math.min(pagination.page * pagination.pageSize, pagination.total)}
        total={pagination.total}
        itemLabel="compliance issues"
        keyboardHintText="Use j/k to navigate"
      />

      {/* Item cards */}
      {items.length === 0 ? (
        <QueueEmptyState
          title="No reviewed compliance issues found"
          description="Compliance issues will appear here after they have been reviewed in Review Mode."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <DeveloperCard
              key={`${item.type}-${item.id}`}
              ref={(el) => setCardRef(index, el)}
              item={item}
              onUpdated={handleItemUpdated}
              isFocused={index === focusedIndex}
              state={state}
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

export default ComplianceDeveloperQueue;
