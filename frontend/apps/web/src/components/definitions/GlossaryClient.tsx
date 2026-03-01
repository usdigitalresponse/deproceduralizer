'use client';

import { useState, useEffect } from 'react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { EmptyState } from '@/components/ui/EmptyState';
import { GlossarySearch } from './GlossarySearch';
import { GlossaryFilters } from './GlossaryFilters';
import { DefinitionCard } from './DefinitionCard';
import { AggregatedTermCard } from './AggregatedTermCard';
import { ChevronLeft, ChevronRight, List, Layers } from 'lucide-react';
import { getEntityIcon } from '@/lib/constants/entity-types';

const DefinitionIcon = getEntityIcon('definition');
import {
  getDefinitionsPaginated,
  getAlphabeticalIndex,
  getAggregatedTermsPaginated,
} from '@/lib/actions/definitions';
import {
  pageParser,
  searchParser,
  letterParser,
  definitionScopeLevelParser,
  definitionTypeParser,
  definitionQualityParser,
  glossaryViewParser,
  type DefinitionScopeLevelValue,
  type DefinitionTypeValue,
  type DefinitionQualityValue,
} from '@/lib/url/parsers';
import type {
  DefinitionWithContext,
  DefinitionStats,
  AlphabeticalIndex,
  AggregatedTerm,
  JurisdictionCode,
} from '@deproceduralizer/database';

interface GlossaryClientProps {
  jurisdiction: JurisdictionCode;
  initialData: {
    definitions: DefinitionWithContext[];
    aggregatedTerms: AggregatedTerm[];
    total: number;
    totalPages: number;
    stats: DefinitionStats;
    alphabeticalIndex: AlphabeticalIndex[];
  };
}

const PAGE_SIZE = 20;

/**
 * Client component for the glossary page with search, filtering, and pagination.
 * Owns all URL state and passes controlled props to child components.
 */
export function GlossaryClient({ jurisdiction, initialData }: GlossaryClientProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Single source of truth for all URL state (shallow: true for client-side fetching)
  const [params, setParams] = useQueryStates({
    search: searchParser,
    letter: letterParser,
    page: pageParser,
    scopeLevel: definitionScopeLevelParser,
    definitionType: definitionTypeParser,
    quality: definitionQualityParser,
    view: glossaryViewParser,
  }, {
    shallow: true,
  });

  // Local state for definitions and aggregated terms
  const [definitions, setDefinitions] = useState(initialData.definitions);
  const [aggregatedTerms, setAggregatedTerms] = useState(initialData.aggregatedTerms);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [alphabeticalIndex, setAlphabeticalIndex] = useState(initialData.alphabeticalIndex);
  const [error, setError] = useState<string | null>(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // Helper functions (centralized to avoid duplication)
  // ─────────────────────────────────────────────────────────────────────────────

  /** Check if any filters are active (unified across all components) */
  const hasActiveFilters = !!(
    params.search ||
    params.letter ||
    params.scopeLevel !== 'all' ||
    params.definitionType !== 'all' ||
    params.quality !== 'all'
  );

  /** Reset all filters to defaults */
  const handleResetAllFilters = () => {
    setParams({
      search: null,
      letter: null,
      page: 1,
      scopeLevel: 'all',
      definitionType: 'all',
      quality: 'all',
    });
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Event handlers for child components
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSearchChange = (value: string) => {
    setParams({ search: value || null, page: 1, letter: null });
  };

  const handleLetterChange = (letter: string | null) => {
    setParams({ letter, page: 1 });
  };

  const handleScopeLevelChange = (value: DefinitionScopeLevelValue) => {
    setParams({ scopeLevel: value, page: 1 });
  };

  const handleDefinitionTypeChange = (value: DefinitionTypeValue) => {
    setParams({ definitionType: value, page: 1 });
  };

  const handleQualityChange = (value: DefinitionQualityValue) => {
    setParams({ quality: value, page: 1 });
  };

  const handlePageChange = (newPage: number) => {
    setParams({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewChange = (view: 'flat' | 'aggregated') => {
    // Clear filters that don't apply to aggregated view when switching
    if (view === 'aggregated') {
      setParams({
        view,
        page: 1,
        scopeLevel: 'all',
        definitionType: 'all',
        quality: 'all',
      });
    } else {
      setParams({ view, page: 1 });
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Data fetching effects
  // ─────────────────────────────────────────────────────────────────────────────

  // Sync state with server action when URL params change
  useEffect(() => {
    // Skip initial fetch as we have initialData (only when at defaults)
    const isAtDefaults = !params.search && !params.letter && params.page === 1 &&
      params.view === 'flat' && params.scopeLevel === 'all' &&
      params.definitionType === 'all' && params.quality === 'all';

    if (isAtDefaults) return;

    const fetchData = async () => {
      if (params.view === 'aggregated') {
        const result = await getAggregatedTermsPaginated(jurisdiction, {
          page: params.page,
          pageSize: PAGE_SIZE,
          search: params.search || undefined,
          letter: params.letter || undefined,
        });

        if (result.success) {
          setAggregatedTerms(result.data.data);
          setTotal(result.data.total);
          setTotalPages(result.data.totalPages);
          setError(null);
        } else {
          setError(result.error);
        }
      } else {
        const result = await getDefinitionsPaginated(jurisdiction, {
          page: params.page,
          pageSize: PAGE_SIZE,
          search: params.search || undefined,
          letter: params.letter || undefined,
          scopeLevel: params.scopeLevel === 'all' ? undefined : params.scopeLevel,
          definitionType: params.definitionType === 'all' ? undefined : params.definitionType,
          quality: params.quality === 'all' ? undefined : params.quality,
          sortBy: 'term',
          sortOrder: 'asc',
        });

        if (result.success) {
          setDefinitions(result.data.data);
          setTotal(result.data.total);
          setTotalPages(result.data.totalPages);
          setError(null);
        } else {
          setError(result.error);
        }
      }
    };

    setIsLoading(true);
    fetchData().finally(() => setIsLoading(false));
  }, [jurisdiction, params.search, params.letter, params.page, params.view, params.scopeLevel, params.definitionType, params.quality]);

  // Refresh alphabetical index when state changes
  useEffect(() => {
    const refreshIndex = async () => {
      const result = await getAlphabeticalIndex(jurisdiction);
      if (result.success) {
        setAlphabeticalIndex(result.data);
      }
    };
    refreshIndex();
  }, [jurisdiction]);

  const stats = initialData.stats;

  // ─────────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <DefinitionIcon className="w-6 h-6 text-sky-600" />
          <h2 className="text-lg font-semibold text-[var(--color-text)]">
            Definitions Glossary
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {stats.total.toLocaleString()}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Total Definitions</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {stats.uniqueTerms.toLocaleString()}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Unique Terms</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {(stats.averageOverlap * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Avg. Quality</div>
          </div>
          <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-md)] p-3">
            <div className="text-2xl font-bold text-[var(--color-primary)]">
              {Object.keys(stats.byScope).length}
            </div>
            <div className="text-sm text-[var(--color-text-muted)]">Scope Types</div>
          </div>
        </div>
      </Card>

      {/* View toggle and search */}
      <Card>
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">View:</span>
            <div className="flex rounded-[var(--radius-md)] border border-[var(--color-neutral-200)] overflow-hidden">
              <Button
                type="button"
                variant={params.view === 'flat' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('flat')}
                className="rounded-none border-0"
              >
                <List className="w-4 h-4 mr-1" />
                List
              </Button>
              <Button
                type="button"
                variant={params.view === 'aggregated' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleViewChange('aggregated')}
                className="rounded-none border-0 border-l border-[var(--color-neutral-200)]"
              >
                <Layers className="w-4 h-4 mr-1" />
                Grouped
              </Button>
            </div>
          </div>
        </div>
        <GlossarySearch
          search={params.search || ''}
          onSearchChange={handleSearchChange}
          selectedLetter={params.letter}
          onLetterChange={handleLetterChange}
          onClearAll={handleResetAllFilters}
          alphabeticalIndex={alphabeticalIndex}
          isLoading={isLoading}
          hasActiveFilters={hasActiveFilters}
        />
        {params.view === 'flat' && (
          <GlossaryFilters
            className="mt-4"
            scopeLevel={params.scopeLevel}
            definitionType={params.definitionType}
            quality={params.quality}
            onScopeLevelChange={handleScopeLevelChange}
            onDefinitionTypeChange={handleDefinitionTypeChange}
            onQualityChange={handleQualityChange}
            onResetFilters={handleResetAllFilters}
            hasActiveFilters={hasActiveFilters}
          />
        )}
      </Card>

      {/* Error state */}
      {error && (
        <Alert variant="error">
          Failed to load definitions: {error}
        </Alert>
      )}

      {/* Results summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-muted)]">
          Showing {params.view === 'aggregated' ? aggregatedTerms.length : definitions.length} of {total.toLocaleString()}
          {params.view === 'aggregated' ? ' unique term' : ' definition'}{total !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Page {params.page} of {totalPages}
          </p>
        )}
      </div>

      {/* Definition/Term cards */}
      {params.view === 'aggregated' ? (
        aggregatedTerms.length > 0 ? (
          <div className="space-y-4">
            {aggregatedTerms.map((term) => (
              <AggregatedTermCard
                key={term.normalizedTerm}
                term={term}
                jurisdiction={jurisdiction}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={Layers}
              title="No terms found"
              description={
                params.search || params.letter
                  ? `No terms ${params.search ? `matching "${params.search}"` : ''}${params.search && params.letter ? ' and ' : ''}${params.letter ? `starting with "${params.letter}"` : ''}`
                  : undefined
              }
              action={hasActiveFilters ? { label: 'Clear filters', onClick: handleResetAllFilters } : undefined}
            />
          </Card>
        )
      ) : (
        definitions.length > 0 ? (
          <div className="space-y-4">
            {definitions.map((definition) => (
              <DefinitionCard
                key={definition.id}
                definition={definition}
                state={jurisdiction}
                showSource={true}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              icon={DefinitionIcon}
              title="No definitions found"
              description={
                hasActiveFilters
                  ? `No definitions ${params.search ? `matching "${params.search}"` : ''}${params.search && params.letter ? ' and ' : ''}${params.letter ? `starting with "${params.letter}"` : ''}`
                  : undefined
              }
              action={hasActiveFilters ? { label: 'Clear filters', onClick: handleResetAllFilters } : undefined}
            />
          </Card>
        )
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(params.page - 1)}
            disabled={params.page <= 1 || isLoading}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (params.page <= 3) {
                pageNum = i + 1;
              } else if (params.page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = params.page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  type="button"
                  variant={pageNum === params.page ? 'primary' : 'ghost'}
                  size="sm"
                  onClick={() => handlePageChange(pageNum)}
                  disabled={isLoading}
                  className="min-w-[36px]"
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(params.page + 1)}
            disabled={params.page >= totalPages || isLoading}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default GlossaryClient;
