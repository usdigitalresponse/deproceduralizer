'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryStates } from 'nuqs';
import { getDefinitionsForReview, getDefinitionReviewStats, getUniqueScopeTexts } from '@/lib/actions/definitions';
import { DefinitionReviewCard } from './DefinitionReviewCard';
import { DefinitionsReviewFilters } from './DefinitionsReviewFilters';
import { DefinitionsProgress } from './DefinitionsProgress';
import { BulkActionsBar } from './BulkActionsBar';
import {
  QueuePagination,
  QueueResultsInfo,
  QueueEmptyState,
  KeyboardHelpModal,
} from '../shared';
import { RegulationModal } from '../RegulationModal';
import { useQueueNavigation } from '@/hooks';
import { definitionsReviewParsers } from '@/lib/url/parsers';
import type { DefinitionWithContext, StateCode } from '@deproceduralizer/database';

interface DefinitionsReviewQueueProps {
  state: StateCode;
}

export function DefinitionsReviewQueue({ state }: DefinitionsReviewQueueProps) {
  // Use nuqs for URL state (consistent with filters)
  const [filters, setFilters] = useQueryStates(definitionsReviewParsers, { shallow: false });

  const [definitions, setDefinitions] = useState<DefinitionWithContext[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [exitingIds, setExitingIds] = useState<Set<number>>(new Set());
  const [stats, setStats] = useState({
    unreviewed: 0,
    confirmed: 0,
    corrected: 0,
    falsePositive: 0,
    total: 0,
  });
  const [scopeTexts, setScopeTexts] = useState<string[]>([]);

  // Modal state
  const [modalRegulationId, setModalRegulationId] = useState<number | null>(null);

  // Derived values from filters
  const page = filters.page;
  const pageSize = 10;

  // Check if we're filtering by unreviewed (should remove cards after review)
  const isFilteringUnreviewed = filters.reviewStatus === 'unreviewed';

  // Selection toggle for 'x' key
  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

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
    items: definitions,
    getItemId: (d) => `def-${d.id}`,
    onViewRegulation: (d) => {
      if (d.regulation) {
        setModalRegulationId(d.regulation.id);
      }
    },
    onCustomKey: (key, item) => {
      if (key === 'x' && item) {
        toggleSelection(item.id);
        return true;
      }
      return false;
    },
    enableHelpModal: true,
    itemLabel: 'definition',
  });



  // Fetch scope texts for filter dropdown (only once per state)
  useEffect(() => {
    getUniqueScopeTexts(state).then((result) => {
      if (result.success) {
        setScopeTexts(result.data);
      }
    });
  }, [state]);

  // Fetch stats once on mount and when state changes (not on every filter/page change)
  useEffect(() => {
    getDefinitionReviewStats(state).then((result) => {
      if (result.success) {
        setStats(result.data);
      }
    });
  }, [state]);

  // Fetch definitions
  const fetchDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      // Convert nuqs filter values to API params
      const reviewStatus = filters.reviewStatus === 'all' ? undefined : filters.reviewStatus as 'unreviewed' | 'confirmed' | 'corrected' | 'false_positive';
      const scopeLevel = filters.scopeLevel === 'all' ? undefined : filters.scopeLevel;
      const definitionType = filters.definitionType === 'all' ? undefined : filters.definitionType as 'formal' | 'abbreviation';
      const sortBy = filters.sortBy as 'term' | 'extractedAt' | 'document';
      const sortOrder = (filters.sortOrder || 'desc') as 'asc' | 'desc';
      const isCrossReference = filters.isCrossReference === 'all' ? undefined : filters.isCrossReference === 'true';
      const inDefinitionsSection = filters.inDefinitionsSection === 'all' ? undefined : filters.inDefinitionsSection === 'true';
      const scopeText = filters.scopeText || undefined;
      const scopeRelation = filters.scopeRelation === 'all' ? undefined : filters.scopeRelation as 'self' | 'parent';
      const scopeMismatch = filters.scopeMismatch === 'all' ? undefined : filters.scopeMismatch === 'true';
      const termSearch = filters.termSearch || undefined;
      const definitionId = filters.definitionId || undefined;

      const defsResult = await getDefinitionsForReview(state, {
        page,
        pageSize,
        reviewStatus,
        scopeLevel,
        definitionType,
        sortBy,
        sortOrder,
        isCrossReference,
        inDefinitionsSection,
        scopeText,
        scopeRelation,
        scopeMismatch,
        termSearch,
        definitionId,
      });

      if (defsResult.success) {
        setDefinitions(defsResult.data.data);
        setTotalPages(defsResult.data.totalPages);
        setTotal(defsResult.data.total);
      }
    } finally {
      setIsLoading(false);
    }
  }, [state, page, pageSize, filters]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const handleDefinitionUpdated = useCallback((updated: DefinitionWithContext) => {
    setDefinitions((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d))
    );
    // Remove from selection if updated
    setSelectedIds((prev) => prev.filter((id) => id !== updated.id));
    // Refresh stats
    getDefinitionReviewStats(state).then((result) => {
      if (result.success) {
        setStats(result.data);
      }
    });
  }, [state]);

  // Handle review completion: animate out and advance to next
  const handleReviewComplete = useCallback((definitionId: number, _status: 'confirmed' | 'corrected' | 'false_positive') => {
    // Find the current index of this definition
    const currentIndex = definitions.findIndex(d => d.id === definitionId);

    if (isFilteringUnreviewed) {
      // Add to exiting set to trigger animation
      setExitingIds(prev => new Set(prev).add(definitionId));

      // After animation, remove from list and advance focus
      setTimeout(() => {
        setDefinitions(prev => prev.filter(d => d.id !== definitionId));
        setExitingIds(prev => {
          const next = new Set(prev);
          next.delete(definitionId);
          return next;
        });
        setTotal(prev => Math.max(0, prev - 1));

        // Advance focus to next item (or stay at same index if more items exist)
        if (currentIndex >= 0 && currentIndex < definitions.length - 1) {
          // There are more items after this one - focus stays at same index
          // (which will now be the next item)
          setFocusedIndex(currentIndex);
        } else if (currentIndex > 0) {
          // This was the last item - focus the previous one
          setFocusedIndex(currentIndex - 1);
        }
      }, 300); // Match the CSS transition duration
    } else {
      // Not filtering by unreviewed - just advance focus to next
      if (currentIndex >= 0 && currentIndex < definitions.length - 1) {
        setFocusedIndex(currentIndex + 1);
      }
    }
  }, [definitions, isFilteringUnreviewed, setFocusedIndex]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(definitions.map((d) => d.id));
  }, [definitions]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const handleBulkComplete = useCallback(() => {
    fetchDefinitions();
    setSelectedIds([]);
  }, [fetchDefinitions]);

  const handleViewRegulation = useCallback((regulationId: number) => {
    setModalRegulationId(regulationId);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setFilters({ page: newPage });
  }, [setFilters]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DefinitionsProgress counts={stats} />
      <DefinitionsReviewFilters counts={stats} scopeTexts={scopeTexts} />

      {/* Keyboard help modal */}
      <KeyboardHelpModal
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
      />

      {definitions.length === 0 ? (
        <QueueEmptyState
          title="No definitions found"
          description="No definitions found matching your filters."
        />
      ) : (
        <>
          <QueueResultsInfo
            startItem={(page - 1) * pageSize + 1}
            endItem={Math.min(page * pageSize, total)}
            total={total}
            itemLabel="definitions"
            keyboardHintText="Use j/k to navigate, x to select, ? for help"
          />

          <div className="space-y-4">
            {definitions.map((definition, index) => (
              <DefinitionReviewCard
                key={definition.id}
                ref={(el) => setCardRef(index, el)}
                definition={definition}
                onUpdated={handleDefinitionUpdated}
                onReviewComplete={handleReviewComplete}
                onViewRegulation={handleViewRegulation}
                state={state}
                isFocused={index === focusedIndex}
                isSelected={selectedIds.includes(definition.id)}
                isExiting={exitingIds.has(definition.id)}
                onSelectionChange={(id, selected) => {
                  if (selected) {
                    setSelectedIds((prev) => [...prev, id]);
                  } else {
                    setSelectedIds((prev) => prev.filter((i) => i !== id));
                  }
                }}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <QueuePagination
                page={page}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </>
      )}

      <BulkActionsBar
        selectedIds={selectedIds}
        totalItems={definitions.length}
        onSelectAll={handleSelectAll}
        onClearSelection={handleClearSelection}
        onBulkComplete={handleBulkComplete}
      />

      {modalRegulationId && (
        <RegulationModal
          regulationId={modalRegulationId}
          onClose={() => setModalRegulationId(null)}
        />
      )}
    </div>
  );
}

export default DefinitionsReviewQueue;
