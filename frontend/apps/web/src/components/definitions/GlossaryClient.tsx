'use client';

import { useState, useEffect, useTransition } from 'react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { GlossarySearch } from './GlossarySearch';
import { DefinitionCard } from './DefinitionCard';
import { AggregatedTermCard } from './AggregatedTermCard';
import { ChevronLeft, ChevronRight, BookOpen, List, Layers } from 'lucide-react';
import {
  getDefinitionsPaginated,
  getAlphabeticalIndex,
  getAggregatedTermsPaginated,
} from '@/lib/actions/definitions';
import { pageParser, searchParser, letterParser, glossaryViewParser } from '@/lib/url/parsers';
import type {
  DefinitionWithContext,
  DefinitionStats,
  AlphabeticalIndex,
  AggregatedTerm,
  StateCode,
} from '@deproceduralizer/database';

interface GlossaryClientProps {
  state: StateCode;
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
 * Client component for the glossary page with search, filtering, and pagination
 */
export function GlossaryClient({ state, initialData }: GlossaryClientProps) {
  const [isPending, startTransition] = useTransition();

  // URL state management with nuqs
  const [params, setParams] = useQueryStates({
    search: searchParser,
    letter: letterParser,
    page: pageParser,
    view: glossaryViewParser,
  }, {
    shallow: false,
    startTransition,
  });

  // Local state for definitions and aggregated terms (updated on transitions)
  const [definitions, setDefinitions] = useState(initialData.definitions);
  const [aggregatedTerms, setAggregatedTerms] = useState(initialData.aggregatedTerms);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [alphabeticalIndex, setAlphabeticalIndex] = useState(initialData.alphabeticalIndex);
  const [error, setError] = useState<string | null>(null);

  // Sync state with server action when URL params change
  useEffect(() => {
    // Skip initial fetch as we have initialData (only when at defaults)
    if (!params.search && !params.letter && params.page === 1 && params.view === 'flat') return;

    const fetchData = async () => {
      if (params.view === 'aggregated') {
        const result = await getAggregatedTermsPaginated(state, {
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
        const result = await getDefinitionsPaginated(state, {
          page: params.page,
          pageSize: PAGE_SIZE,
          search: params.search || undefined,
          letter: params.letter || undefined,
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

    startTransition(fetchData);
  }, [state, params.search, params.letter, params.page, params.view]);

  // Handle search change
  const handleSearchChange = (value: string) => {
    setParams({ search: value || null, page: 1, letter: null });
  };

  // Handle letter change
  const handleLetterChange = (letter: string | null) => {
    setParams({ letter, page: 1 });
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setParams({ page: newPage });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Refresh alphabetical index when state changes
  useEffect(() => {
    const refreshIndex = async () => {
      const result = await getAlphabeticalIndex(state);
      if (result.success) {
        setAlphabeticalIndex(result.data);
      }
    };
    refreshIndex();
  }, [state]);

  const stats = initialData.stats;

  return (
    <div className="space-y-6">
      {/* Stats header */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <BookOpen className="w-6 h-6 text-[var(--color-info)]" />
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
                onClick={() => setParams({ view: 'flat', page: 1 })}
                className="rounded-none border-0"
              >
                <List className="w-4 h-4 mr-1" />
                List
              </Button>
              <Button
                type="button"
                variant={params.view === 'aggregated' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setParams({ view: 'aggregated', page: 1 })}
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
          alphabeticalIndex={alphabeticalIndex}
          isLoading={isPending}
        />
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
          {(params.search || params.letter) && ' (filtered)'}
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
                state={state}
              />
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <Layers className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-[var(--color-text-muted)]">
                No terms found
                {params.search && ` matching "${params.search}"`}
                {params.letter && ` starting with "${params.letter}"`}
              </p>
              {(params.search || params.letter) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setParams({ search: null, letter: null, page: 1 });
                  }}
                  className="mt-3"
                >
                  Clear filters
                </Button>
              )}
            </div>
          </Card>
        )
      ) : (
        definitions.length > 0 ? (
          <div className="space-y-4">
            {definitions.map((definition) => (
              <DefinitionCard
                key={definition.id}
                definition={definition}
                state={state}
                showSource={true}
              />
            ))}
          </div>
        ) : (
          <Card>
            <div className="text-center py-8">
              <BookOpen className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-3" />
              <p className="text-[var(--color-text-muted)]">
                No definitions found
                {params.search && ` matching "${params.search}"`}
                {params.letter && ` starting with "${params.letter}"`}
              </p>
              {(params.search || params.letter) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setParams({ search: null, letter: null, page: 1 });
                  }}
                  className="mt-3"
                >
                  Clear filters
                </Button>
              )}
            </div>
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
            disabled={params.page <= 1 || isPending}
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
                  disabled={isPending}
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
            disabled={params.page >= totalPages || isPending}
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
