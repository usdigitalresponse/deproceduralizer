'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { getJurisdictionFromPathname } from './useStateFromPath';
import type { ComplianceIssueWithAnalysis } from '@deproceduralizer/database';
import type { SuggestionBatchResult } from '@/lib/actions/compliance-issues';
import type { GroupingModeValue, BatchSizeValue } from '@/lib/constants/values';
import {
  groupingModeParser,
  batchSizeParser,
  shownIdsParser,
  focusTypeParser,
  focusSectionParser,
  focusPatternParser,
} from '@/lib/url/parsers';

// Helper to parse comma-separated IDs
function parseShownIds(shownIds: string | null): number[] {
  if (!shownIds) return [];
  return shownIds.split(',').map(Number).filter(id => !isNaN(id));
}

// Helper to serialize IDs to comma-separated string
function serializeShownIds(ids: number[]): string | null {
  if (ids.length === 0) return null;
  // Limit to 50 IDs to prevent URL from getting too long
  const limitedIds = ids.slice(-50);
  return limitedIds.join(',');
}

// Maximum number of recent issue types to track for diversity
const MAX_RECENT_ISSUE_TYPES = 3;

interface UseSuggestionQueueConfig {
  /** Initial batch data from server */
  initialBatch: SuggestionBatchResult;
  /** Callback to fetch a new batch */
  fetchBatch: (options: {
    batchSize: number;
    excludeIds: number[];
    groupingMode: GroupingModeValue;
    focus?: {
      issueType?: string;
      section?: string;
      pattern?: string;
    };
    /** Issue types to avoid for diversity (only used when grouping by issue_type or combined) */
    recentIssueTypes?: string[];
  }) => Promise<SuggestionBatchResult>;
}

interface UseSuggestionQueueReturn {
  /** Current items in the batch */
  items: ComplianceIssueWithAnalysis[];
  /** Current grouping mode */
  groupingMode: GroupingModeValue;
  /** Current focus (issue type, section, pattern) */
  focus: { issueType?: string; section?: string; pattern?: string };
  /** Remaining items in current focus */
  remainingInFocus: number;
  /** Next grouping mode in the cycle */
  nextGroupingMode: GroupingModeValue;
  /** Total unreviewed items */
  totalUnreviewed: number;
  /** IDs of items shown this session */
  shownIds: number[];
  /** Current batch size */
  batchSize: BatchSizeValue;
  /** Jurisdiction code extracted from pathname */
  jurisdiction: string;
  /** Currently selected regulation ID for modal */
  selectedRegulationId: number | null;
  /** Set selected regulation ID */
  setSelectedRegulationId: (id: number | null) => void;
  /** Handle viewing a regulation (opens modal) */
  handleViewRegulation: (regulationId: number) => void;
  /** Handle item reviewed - marks as shown and potentially fetches new batch */
  handleItemReviewed: (item: ComplianceIssueWithAnalysis) => void;
  /** Skip to the next grouping mode */
  skipToNextMode: () => void;
  /** Change batch size */
  setBatchSize: (size: BatchSizeValue) => void;
  /** Clear shown history and start fresh */
  clearHistory: () => void;
  /** Whether a fetch is in progress */
  isLoading: boolean;
}

export function useSuggestionQueue({
  initialBatch,
  fetchBatch,
}: UseSuggestionQueueConfig): UseSuggestionQueueReturn {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Extract jurisdiction from pathname
  const jurisdiction = getJurisdictionFromPathname(pathname);

  // URL state - use shallow: true since we manage data client-side
  // This prevents double-fetching (client fetch + server re-render)
  const [urlParams, setUrlParams] = useQueryStates(
    {
      groupingMode: groupingModeParser,
      batchSize: batchSizeParser,
      shownIds: shownIdsParser,
      focusType: focusTypeParser,
      focusSection: focusSectionParser,
      focusPattern: focusPatternParser,
    },
    { shallow: true }
  );

  // Local state
  const [items, setItems] = useState<ComplianceIssueWithAnalysis[]>(initialBatch.data);
  const [batchMetadata, setBatchMetadata] = useState({
    groupingMode: initialBatch.groupingMode,
    focus: initialBatch.focus,
    remainingInFocus: initialBatch.remainingInFocus,
    nextGroupingMode: initialBatch.nextGroupingMode,
    totalUnreviewed: initialBatch.totalUnreviewed,
  });
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Track recent issue types for diversity (last 3 batches)
  // Only used when grouping by issue_type or combined
  const [recentIssueTypes, setRecentIssueTypes] = useState<string[]>(() => {
    // Initialize with the initial batch's issue type if present
    const initialIssueType = initialBatch.focus.issueType;
    return initialIssueType ? [initialIssueType] : [];
  });

  // Track shown IDs locally during a batch session
  // Only update URL when fetching a new batch (not on each individual review)
  const [sessionShownIds, setSessionShownIds] = useState<number[]>(() =>
    parseShownIds(urlParams.shownIds)
  );

  const batchSize = (urlParams.batchSize || 3) as BatchSizeValue;

  // Sync with initial batch when it changes
  // Use a stable key to avoid unnecessary re-renders
  const initialBatchKey = `${initialBatch.groupingMode}-${initialBatch.totalUnreviewed}-${initialBatch.data.length}-${initialBatch.data[0]?.id ?? 'empty'}`;
  useEffect(() => {
    setItems(initialBatch.data);
    setBatchMetadata({
      groupingMode: initialBatch.groupingMode,
      focus: initialBatch.focus,
      remainingInFocus: initialBatch.remainingInFocus,
      nextGroupingMode: initialBatch.nextGroupingMode,
      totalUnreviewed: initialBatch.totalUnreviewed,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBatchKey]);

  // Sync sessionShownIds when URL changes externally (e.g., browser back/forward)
  useEffect(() => {
    const urlShownIds = parseShownIds(urlParams.shownIds);
    // Only sync if URL has different IDs (external navigation)
    const urlKey = urlShownIds.join(',');
    const sessionKey = sessionShownIds.join(',');
    if (urlKey !== sessionKey) {
      setSessionShownIds(urlShownIds);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParams.shownIds]);

  // Handle view regulation
  const handleViewRegulation = useCallback((regulationId: number) => {
    setSelectedRegulationId(regulationId);
  }, []);

  // Fetch new batch helper
  // Note: batchSizeOverride allows passing a new batch size before URL state updates
  const fetchNewBatch = useCallback(async (
    newShownIds: number[],
    groupingMode: GroupingModeValue,
    focus?: { issueType?: string; section?: string; pattern?: string },
    batchSizeOverride?: BatchSizeValue
  ) => {
    setIsLoading(true);
    try {
      // Only pass recentIssueTypes for issue_type and combined modes (not section)
      // and only when we're not focusing on a specific issue type
      const shouldPassRecentTypes =
        (groupingMode === 'issue_type' || groupingMode === 'combined') &&
        !focus?.issueType;

      const effectiveBatchSize = batchSizeOverride ?? batchSize;
      const result = await fetchBatch({
        batchSize: effectiveBatchSize,
        excludeIds: newShownIds,
        groupingMode,
        focus,
        recentIssueTypes: shouldPassRecentTypes ? recentIssueTypes : undefined,
      });

      setItems(result.data);
      setBatchMetadata({
        groupingMode: result.groupingMode,
        focus: result.focus,
        remainingInFocus: result.remainingInFocus,
        nextGroupingMode: result.nextGroupingMode,
        totalUnreviewed: result.totalUnreviewed,
      });

      // Update recent issue types for diversity tracking
      if (result.focus.issueType) {
        setRecentIssueTypes(prev => {
          // Add new issue type if not already the most recent
          if (prev[prev.length - 1] === result.focus.issueType) {
            return prev; // Already tracking this one
          }
          // Keep only last MAX_RECENT_ISSUE_TYPES
          const updated = [...prev, result.focus.issueType!].slice(-MAX_RECENT_ISSUE_TYPES);
          return updated;
        });
      }

      // Update URL state
      setUrlParams({
        shownIds: serializeShownIds(newShownIds),
        focusType: result.focus.issueType || null,
        focusSection: result.focus.section || null,
        focusPattern: result.focus.pattern || null,
        groupingMode: result.groupingMode,
      });
    } catch (error) {
      console.error('Failed to fetch suggestion batch:', error);
    } finally {
      setIsLoading(false);
    }
  }, [batchSize, fetchBatch, setUrlParams, recentIssueTypes]);

  // Handle item reviewed
  const handleItemReviewed = useCallback((item: ComplianceIssueWithAnalysis) => {
    const itemId = item.id;
    const newShownIds = [...sessionShownIds, itemId];

    // Update local state (not URL) - URL only updates when fetching new batch
    setSessionShownIds(newShownIds);

    // Remove the item from current display
    setItems(prev => prev.filter(i => i.id !== itemId));

    // Update counts optimistically
    setBatchMetadata(prev => ({
      ...prev,
      remainingInFocus: Math.max(0, prev.remainingInFocus - 1),
      totalUnreviewed: Math.max(0, prev.totalUnreviewed - 1),
    }));

    // If we've run out of items in current batch, fetch new batch
    const remainingItems = items.filter(i => i.id !== itemId);
    if (remainingItems.length === 0) {
      // Determine if we should switch grouping mode
      const shouldSwitchMode = batchMetadata.remainingInFocus <= 1;
      const nextMode = shouldSwitchMode
        ? batchMetadata.nextGroupingMode
        : batchMetadata.groupingMode;

      startTransition(() => {
        fetchNewBatch(
          newShownIds,
          nextMode,
          shouldSwitchMode ? undefined : batchMetadata.focus
        );
      });
    }
    // No URL update for individual reviews - let user work through the batch
  }, [sessionShownIds, items, batchMetadata, fetchNewBatch]);

  // Skip to next grouping mode
  const skipToNextMode = useCallback(() => {
    startTransition(() => {
      fetchNewBatch(sessionShownIds, batchMetadata.nextGroupingMode);
    });
  }, [sessionShownIds, batchMetadata.nextGroupingMode, fetchNewBatch]);

  // Change batch size
  const setBatchSizeHandler = useCallback((size: BatchSizeValue) => {
    setUrlParams({ batchSize: size });
    // Refetch with new batch size - pass size as override since URL state hasn't updated yet
    startTransition(() => {
      fetchNewBatch(sessionShownIds, batchMetadata.groupingMode, batchMetadata.focus, size);
    });
  }, [sessionShownIds, batchMetadata, fetchNewBatch, setUrlParams]);

  // Clear history
  const clearHistory = useCallback(() => {
    // Reset local state
    setSessionShownIds([]);
    setRecentIssueTypes([]);
    // Clear URL params
    setUrlParams({
      shownIds: null,
      focusType: null,
      focusSection: null,
      focusPattern: null,
      groupingMode: 'issue_type',
    });
    // Force a page refresh to get fresh data
    router.refresh();
  }, [setUrlParams, router]);

  return {
    items,
    groupingMode: batchMetadata.groupingMode,
    focus: batchMetadata.focus,
    remainingInFocus: batchMetadata.remainingInFocus,
    nextGroupingMode: batchMetadata.nextGroupingMode,
    totalUnreviewed: batchMetadata.totalUnreviewed,
    shownIds: sessionShownIds,
    batchSize,
    jurisdiction,
    selectedRegulationId,
    setSelectedRegulationId,
    handleViewRegulation,
    handleItemReviewed,
    skipToNextMode,
    setBatchSize: setBatchSizeHandler,
    clearHistory,
    isLoading: isLoading || isPending,
  };
}
