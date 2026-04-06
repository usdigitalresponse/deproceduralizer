'use client';

import type { ComplianceIssueWithAnalysis, ComplianceIssueStatusCounts } from '@deproceduralizer/database';
import type { SuggestionBatchResult } from '@/lib/actions/compliance-issues';
import type { QueueModeValue, GroupingModeValue, BatchSizeValue } from '@/lib/constants/values';
import { ReviewProgress } from './ReviewProgress';
import { ComplianceIssueCard } from './ComplianceIssueCard';
import { ComplianceFilters } from './ComplianceFilters';
import { ComplianceQueueModeSwitcher } from './ComplianceQueueModeSwitcher';
import { SuggestionModeControls } from './SuggestionModeControls';
import RegulationModal from './RegulationModal';
import {
  QueueResultsInfo,
  QueueEmptyState,
  QueuePagination,
  KeyboardHelpModal,
} from './shared';
import {
  useDeepLink,
  useQueueNavigation,
  useQueue,
  useSuggestionQueue,
  type PaginationInfo,
} from '@/hooks';
import { useQueryState } from 'nuqs';
import { reviewStatusParser } from '@/lib/url/parsers';

interface BaseProps {
  statusCounts: ComplianceIssueStatusCounts;
  issueTypes: string[];
  compact?: boolean;
}

interface FilterModeProps extends BaseProps {
  mode: 'filter';
  initialIssues: ComplianceIssueWithAnalysis[];
  pagination: PaginationInfo;
  initialBatch?: never;
  fetchBatch?: never;
}

interface SuggestionModeProps extends BaseProps {
  mode: 'suggestion';
  initialBatch: SuggestionBatchResult;
  fetchBatch: (options: {
    batchSize: number;
    excludeIds: number[];
    groupingMode: GroupingModeValue;
    focus?: {
      issueType?: string;
      section?: string;
      pattern?: string;
    };
  }) => Promise<SuggestionBatchResult>;
  initialIssues?: never;
  pagination?: never;
}

type ComplianceReviewQueueProps = FilterModeProps | SuggestionModeProps;

// Default empty batch for suggestion mode hook initialization
const EMPTY_BATCH: SuggestionBatchResult = {
  data: [],
  groupingMode: 'issue_type',
  focus: {},
  remainingInFocus: 0,
  nextGroupingMode: 'section',
  totalUnreviewed: 0,
};

const EMPTY_FETCH = async (): Promise<SuggestionBatchResult> => EMPTY_BATCH;

// Stable empty references for filter mode fallback (prevents infinite re-renders)
const EMPTY_ITEMS: ComplianceIssueWithAnalysis[] = [];
const EMPTY_PAGINATION: PaginationInfo = { page: 1, pageSize: 10, total: 0, totalPages: 0 };

export function ComplianceReviewQueue(props: ComplianceReviewQueueProps) {
  const { statusCounts, issueTypes, compact = false, mode } = props;

  // Read current review status filter from URL for filter-aware item removal
  const [reviewStatus] = useQueryState('reviewStatus', reviewStatusParser);

  // Extract mode-specific props with defaults for the unused mode
  // IMPORTANT: Use stable module-level constants to prevent infinite re-render loops
  const filterProps = mode === 'filter' ? props : { initialIssues: EMPTY_ITEMS, pagination: EMPTY_PAGINATION };
  const suggestionProps = mode === 'suggestion' ? props : { initialBatch: EMPTY_BATCH, fetchBatch: EMPTY_FETCH };

  // =====================
  // Filter Mode Hooks
  // =====================
  const filterQueue = useQueue<ComplianceIssueWithAnalysis, ComplianceIssueStatusCounts>({
    initialItems: filterProps.initialIssues,
    initialCounts: statusCounts,
    getItemId: (i) => i.id,
    getItemStatus: (i) => i.reviewStatus || 'unreviewed',
    defaultStatus: 'unreviewed',
    getRegulationId: (i) => i.regulation?.id ?? 0,
    statusFilter: reviewStatus || 'unreviewed',
  });

  // =====================
  // Suggestion Mode Hooks
  // =====================
  const suggestionQueue = useSuggestionQueue({
    initialBatch: suggestionProps.initialBatch,
    fetchBatch: suggestionProps.fetchBatch,
  });

  // =====================
  // Select active state based on mode
  // =====================
  const issues = mode === 'filter' ? filterQueue.items : suggestionQueue.items;
  const selectedRegulationId = mode === 'filter'
    ? filterQueue.selectedRegulationId
    : suggestionQueue.selectedRegulationId;
  const setSelectedRegulationId = mode === 'filter'
    ? filterQueue.setSelectedRegulationId
    : suggestionQueue.setSelectedRegulationId;
  const handleViewRegulation = mode === 'filter'
    ? filterQueue.handleViewRegulation
    : suggestionQueue.handleViewRegulation;
  const handleItemUpdated = mode === 'filter'
    ? filterQueue.handleItemUpdated
    : suggestionQueue.handleItemReviewed;

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
    onViewRegulation: (i) => i.regulation?.id ? setSelectedRegulationId(i.regulation.id) : undefined,
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
      <ReviewProgress counts={mode === 'filter' ? filterQueue.counts : statusCounts} />

      {/* Mode Switcher */}
      <ComplianceQueueModeSwitcher mode={mode} />

      {/* Filters or Suggestion Controls */}
      {mode === 'filter' ? (
        <ComplianceFilters issueTypes={issueTypes} />
      ) : (
        <SuggestionModeControls
          groupingMode={suggestionQueue.groupingMode}
          focus={suggestionQueue.focus}
          remainingInFocus={suggestionQueue.remainingInFocus}
          nextGroupingMode={suggestionQueue.nextGroupingMode}
          totalUnreviewed={suggestionQueue.totalUnreviewed}
          batchSize={suggestionQueue.batchSize}
          shownCount={suggestionQueue.shownIds.length}
          onSkipToNextMode={suggestionQueue.skipToNextMode}
          onClearHistory={suggestionQueue.clearHistory}
          onBatchSizeChange={suggestionQueue.setBatchSize}
        />
      )}

      {/* Keyboard help modal */}
      <KeyboardHelpModal
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
      />

      {/* Results info - only in filter mode */}
      {mode === 'filter' && (
        <QueueResultsInfo
          startItem={issues.length > 0 ? (filterProps.pagination.page - 1) * filterProps.pagination.pageSize + 1 : 0}
          endItem={Math.min(filterProps.pagination.page * filterProps.pagination.pageSize, filterProps.pagination.total)}
          total={filterProps.pagination.total}
          itemLabel="issues"
        />
      )}

      {/* Loading state for suggestion mode */}
      {mode === 'suggestion' && suggestionQueue.isLoading && (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
        </div>
      )}

      {/* Issue cards */}
      {issues.length === 0 && !suggestionQueue.isLoading ? (
        <QueueEmptyState
          title={mode === 'filter' ? "No compliance issues found" : "All items reviewed!"}
          description={mode === 'filter'
            ? "Try adjusting your filters or check back later."
            : "Great job! You've reviewed all available items in this batch."
          }
        />
      ) : (
        <div className="space-y-4">
          {issues.map((issue, index) => (
            <ComplianceIssueCard
              key={issue.id}
              ref={(el) => setCardRef(index, el)}
              issue={issue}
              onUpdated={handleItemUpdated}
              isFocused={index === focusedIndex}
            />
          ))}
        </div>
      )}

      {/* Pagination - only in filter mode */}
      {mode === 'filter' && (
        <QueuePagination
          page={filterProps.pagination.page}
          totalPages={filterProps.pagination.totalPages}
          onPageChange={filterQueue.goToPage}
        />
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
