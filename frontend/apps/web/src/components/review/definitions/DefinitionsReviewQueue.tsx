'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { getDefinitionsForReview, getDefinitionReviewStats, getUniqueScopeTexts } from '@/lib/actions/definitions';
import { DefinitionReviewCard } from './DefinitionReviewCard';
import { DefinitionsReviewFilters } from './DefinitionsReviewFilters';
import { BulkActionsBar } from './BulkActionsBar';
import { QueuePagination } from '../shared';
import { RegulationModal } from '../RegulationModal';
import type { DefinitionWithContext, StateCode } from '@deproceduralizer/database';

interface DefinitionsReviewQueueProps {
  state: StateCode;
}

export function DefinitionsReviewQueue({ state }: DefinitionsReviewQueueProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [definitions, setDefinitions] = useState<DefinitionWithContext[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
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

  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Parse URL params
  const page = parseInt(searchParams.get('page') || '1');
  const pageSize = 10;
  const reviewStatus = searchParams.get('reviewStatus') as 'unreviewed' | 'confirmed' | 'corrected' | 'false_positive' | undefined;
  const scopeLevel = searchParams.get('scopeLevel') || undefined;
  const definitionType = searchParams.get('definitionType') as 'formal' | 'abbreviation' | undefined;
  const sortBy = (searchParams.get('sortBy') || 'document') as 'term' | 'extractedAt' | 'document';
  const isCrossReferenceParam = searchParams.get('isCrossReference');
  const isCrossReference = isCrossReferenceParam === 'true' ? true : isCrossReferenceParam === 'false' ? false : undefined;
  const scopeText = searchParams.get('scopeText') || undefined;
  const scopeRelation = searchParams.get('scopeRelation') as 'self' | 'parent' | undefined;

  // Fetch scope texts for filter dropdown (only once)
  useEffect(() => {
    getUniqueScopeTexts(state).then((result) => {
      if (result.success) {
        setScopeTexts(result.data);
      }
    });
  }, [state]);

  // Fetch definitions
  const fetchDefinitions = useCallback(async () => {
    setIsLoading(true);
    try {
      const [defsResult, statsResult] = await Promise.all([
        getDefinitionsForReview(state, {
          page,
          pageSize,
          reviewStatus,
          scopeLevel,
          definitionType,
          sortBy,
          sortOrder: 'asc',
          isCrossReference,
          scopeText,
          scopeRelation,
        }),
        getDefinitionReviewStats(state),
      ]);

      if (defsResult.success) {
        setDefinitions(defsResult.data.data);
        setTotalPages(defsResult.data.totalPages);
        setTotal(defsResult.data.total);
      }

      if (statsResult.success) {
        setStats(statsResult.data);
      }
    } finally {
      setIsLoading(false);
    }
  }, [state, page, pageSize, reviewStatus, scopeLevel, definitionType, sortBy, isCrossReference, scopeText, scopeRelation]);

  useEffect(() => {
    fetchDefinitions();
  }, [fetchDefinitions]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, definitions.length - 1));
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'x' && focusedIndex >= 0) {
        e.preventDefault();
        const def = definitions[focusedIndex];
        if (def) {
          toggleSelection(def.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [definitions, focusedIndex]);

  // Scroll focused card into view
  useEffect(() => {
    if (focusedIndex >= 0 && cardRefs.current[focusedIndex]) {
      cardRefs.current[focusedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [focusedIndex]);

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

  const toggleSelection = useCallback((id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }, []);

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
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, searchParams]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div>
      <DefinitionsReviewFilters counts={stats} scopeTexts={scopeTexts} />

      {definitions.length === 0 ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">
          No definitions found matching your filters.
        </div>
      ) : (
        <>
          <div className="mb-4 text-sm text-[var(--color-text-secondary)]">
            Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total} definitions
            <span className="ml-4 text-xs">
              (Use j/k or arrows to navigate, x to select)
            </span>
          </div>

          <div className="space-y-4">
            {definitions.map((definition, index) => (
              <DefinitionReviewCard
                key={definition.id}
                ref={(el) => { cardRefs.current[index] = el; }}
                definition={definition}
                onUpdated={handleDefinitionUpdated}
                onViewRegulation={handleViewRegulation}
                state={state}
                isFocused={index === focusedIndex}
                isSelected={selectedIds.includes(definition.id)}
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
