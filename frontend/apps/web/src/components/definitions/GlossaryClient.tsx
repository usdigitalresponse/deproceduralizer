'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { GlossarySearch } from './GlossarySearch';
import { DefinitionCard } from './DefinitionCard';
import { ChevronLeft, ChevronRight, BookOpen } from 'lucide-react';
import {
  getDefinitionsPaginated,
  getAlphabeticalIndex,
  getDefinitionStats,
} from '@/lib/actions/definitions';
import type {
  DefinitionWithContext,
  DefinitionStats,
  AlphabeticalIndex,
  StateCode,
} from '@deproceduralizer/database';

interface GlossaryClientProps {
  state: StateCode;
  initialData: {
    definitions: DefinitionWithContext[];
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // State from URL params
  const initialSearch = searchParams.get('search') || '';
  const initialLetter = searchParams.get('letter') || null;
  const initialPage = parseInt(searchParams.get('page') || '1', 10);

  // Local state
  const [search, setSearch] = useState(initialSearch);
  const [selectedLetter, setSelectedLetter] = useState<string | null>(initialLetter);
  const [page, setPage] = useState(initialPage);
  const [definitions, setDefinitions] = useState(initialData.definitions);
  const [total, setTotal] = useState(initialData.total);
  const [totalPages, setTotalPages] = useState(initialData.totalPages);
  const [alphabeticalIndex, setAlphabeticalIndex] = useState(initialData.alphabeticalIndex);
  const [stats] = useState(initialData.stats);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Update URL when filters change
  const updateUrl = useCallback(
    (newSearch: string, newLetter: string | null, newPage: number) => {
      const params = new URLSearchParams();
      if (newSearch) params.set('search', newSearch);
      if (newLetter) params.set('letter', newLetter);
      if (newPage > 1) params.set('page', newPage.toString());

      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router]
  );

  // Fetch definitions when filters change
  const fetchDefinitions = useCallback(
    async (newSearch: string, newLetter: string | null, newPage: number) => {
      startTransition(async () => {
        const result = await getDefinitionsPaginated(state, {
          page: newPage,
          pageSize: PAGE_SIZE,
          search: newSearch || undefined,
          letter: newLetter || undefined,
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
      });
    },
    [state]
  );

  // Handle search change
  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
    updateUrl(value, selectedLetter, 1);
    fetchDefinitions(value, selectedLetter, 1);
  };

  // Handle letter change
  const handleLetterChange = (letter: string | null) => {
    setSelectedLetter(letter);
    setPage(1);
    updateUrl(search, letter, 1);
    fetchDefinitions(search, letter, 1);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    updateUrl(search, selectedLetter, newPage);
    fetchDefinitions(search, selectedLetter, newPage);
    // Scroll to top of results
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Refresh alphabetical index when search changes
  useEffect(() => {
    const refreshIndex = async () => {
      const result = await getAlphabeticalIndex(state);
      if (result.success) {
        setAlphabeticalIndex(result.data);
      }
    };
    refreshIndex();
  }, [state]);

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

      {/* Search and filters */}
      <Card>
        <GlossarySearch
          search={search}
          onSearchChange={handleSearchChange}
          selectedLetter={selectedLetter}
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
          Showing {definitions.length} of {total.toLocaleString()} definition{total !== 1 ? 's' : ''}
          {(search || selectedLetter) && ' (filtered)'}
        </p>
        {totalPages > 1 && (
          <p className="text-sm text-[var(--color-text-muted)]">
            Page {page} of {totalPages}
          </p>
        )}
      </div>

      {/* Definition cards */}
      {definitions.length > 0 ? (
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
              {search && ` matching "${search}"`}
              {selectedLetter && ` starting with "${selectedLetter}"`}
            </p>
            {(search || selectedLetter) && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setSelectedLetter(null);
                  setPage(1);
                  updateUrl('', null, 1);
                  fetchDefinitions('', null, 1);
                }}
                className="mt-3"
              >
                Clear filters
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isPending}
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
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }

              return (
                <Button
                  key={pageNum}
                  type="button"
                  variant={pageNum === page ? 'primary' : 'ghost'}
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
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= totalPages || isPending}
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
