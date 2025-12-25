'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQueryStates } from 'nuqs';
import {
  getReviewedDefinitionsPaginated,
  getDefinitionDeveloperStatusCounts,
} from '@/lib/actions/definitions';
import { DefinitionDeveloperCard } from './DefinitionDeveloperCard';
import { DefinitionsDeveloperFilters } from './DefinitionsDeveloperFilters';
import { DefinitionsDeveloperProgress } from './DefinitionsDeveloperProgress';
import {
  QueuePagination,
  QueueResultsInfo,
  QueueEmptyState,
  KeyboardHelpModal,
} from '../shared';
import { RegulationModal } from '../RegulationModal';
import { useQueueNavigation } from '@/hooks';
import { definitionsDeveloperParsers } from '@/lib/url/parsers';
import type { DefinitionWithContext, StateCode, DefinitionDeveloperStatusCounts } from '@deproceduralizer/database';

interface DefinitionsDeveloperQueueProps {
  state: StateCode;
}

export function DefinitionsDeveloperQueue({ state }: DefinitionsDeveloperQueueProps) {
  // Use nuqs for URL state
  const [filters, setFilters] = useQueryStates(definitionsDeveloperParsers, { shallow: false });

  const [definitions, setDefinitions] = useState<DefinitionWithContext[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [counts, setCounts] = useState<DefinitionDeveloperStatusCounts>({
    unresolved: 0,
    resolved: 0,
    pending: 0,
    backlogged: 0,
    need_more_info: 0,
    total: 0,
  });

  // Modal state
  const [modalRegulationId, setModalRegulationId] = useState<number | null>(null);

  // Derived values from filters
  const page = filters.page;
  const pageSize = 10;

  // Keyboard navigation hook
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
    getItemId: (d) => `definition-${d.id}`,
    onViewRegulation: (d) => {
      if (d.regulation) {
        setModalRegulationId(d.regulation.id);
      }
    },
    enableHelpModal: true,
    itemLabel: 'definition',
  });

  // Fetch definitions and counts
  const fetchDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const developerStatus = filters.developerStatus === 'all' ? undefined : filters.developerStatus;
      const developerAssigned = filters.developerAssigned || undefined;
      const reviewStatus = filters.reviewStatus === 'all' ? undefined : filters.reviewStatus;
      const hasJustification = filters.hasJustification === 'all' ? undefined : filters.hasJustification;
      const hasTeamNotes = filters.hasTeamNotes === 'all' ? undefined : filters.hasTeamNotes;

      const [defsResult, countsResult] = await Promise.all([
        getReviewedDefinitionsPaginated(state, {
          page,
          pageSize,
          developerStatus,
          developerAssigned,
          reviewStatus,
          hasJustification,
          hasTeamNotes,
          sortBy: filters.sortBy || 'reviewedAt',
          sortOrder: filters.sortOrder || 'desc',
        }),
        getDefinitionDeveloperStatusCounts(state),
      ]);

      if (defsResult.success) {
        setDefinitions(defsResult.data.data);
        setTotalPages(defsResult.data.totalPages);
        setTotal(defsResult.data.total);
      }

      if (countsResult.success) {
        setCounts(countsResult.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [state, page, pageSize, filters.developerStatus, filters.developerAssigned, filters.reviewStatus, filters.hasJustification, filters.hasTeamNotes, filters.sortBy, filters.sortOrder]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  const handleDefinitionUpdated = useCallback((updated: DefinitionWithContext) => {
    setDefinitions((prev) =>
      prev.map((d) => (d.id === updated.id ? updated : d))
    );
    // Refresh counts
    getDefinitionDeveloperStatusCounts(state).then((result) => {
      if (result.success) {
        setCounts(result.data);
      }
    });
  }, [state]);

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
      {/* Progress */}
      <DefinitionsDeveloperProgress counts={counts} />

      {/* Filters */}
      <DefinitionsDeveloperFilters />

      {/* Keyboard help modal */}
      <KeyboardHelpModal
        open={showHelp}
        onOpenChange={setShowHelp}
        shortcuts={shortcuts}
      />

      {definitions.length === 0 ? (
        <QueueEmptyState
          title="No reviewed definitions found"
          description="Definitions will appear here after they have been reviewed in Review Mode."
        />
      ) : (
        <>
          <QueueResultsInfo
            startItem={(page - 1) * pageSize + 1}
            endItem={Math.min(page * pageSize, total)}
            total={total}
            itemLabel="definitions"
            keyboardHintText="Use j/k to navigate, ? for help"
          />

          <div className="space-y-4">
            {definitions.map((definition, index) => (
              <DefinitionDeveloperCard
                key={definition.id}
                ref={(el) => setCardRef(index, el)}
                definition={definition}
                state={state}
                onUpdated={handleDefinitionUpdated}
                onViewRegulation={handleViewRegulation}
                isFocused={index === focusedIndex}
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

      {modalRegulationId && (
        <RegulationModal
          regulationId={modalRegulationId}
          onClose={() => setModalRegulationId(null)}
        />
      )}
    </div>
  );
}

export default DefinitionsDeveloperQueue;
