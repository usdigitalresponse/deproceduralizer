'use client';

import { useCallback, useMemo, useTransition } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { Search } from 'lucide-react';
import { SearchInput, Pagination, EmptyState, StickyContainer } from '@/components/ui';
import { SearchResultCard } from './SearchResultCard';
import { CommentarySidebar } from './CommentarySidebar';
import { SearchFilters } from './SearchFilters';
import { searchResultsParsers } from '@/lib/url/parsers';
import type { SearchResults, SearchFilterOptions } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@deproceduralizer/database';

interface SearchResultsClientProps {
  jurisdiction: JurisdictionCode;
  initialResults: SearchResults | null;
  initialQuery: string;
  filterOptions?: SearchFilterOptions;
}

export function SearchResultsClient({
  jurisdiction,
  initialResults,
  initialQuery,
  filterOptions,
}: SearchResultsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [queryState, setQueryState] = useQueryStates(searchResultsParsers);

  const pathname = usePathname();
  const currentSearchParams = useSearchParams();

  const currentQuery = queryState.q || initialQuery;
  const currentPage = queryState.page || 1;

  // Current search URL for back navigation from detail pages
  const searchUrl = useMemo(() => {
    const qs = currentSearchParams.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }, [pathname, currentSearchParams]);

  const handleSearch = useCallback((value: string) => {
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    startTransition(() => {
      router.push(`/${jurisdiction}/search?q=${encodeURIComponent(trimmed)}`);
    });
  }, [jurisdiction, router]);

  const handlePageChange = useCallback((page: number) => {
    startTransition(() => {
      setQueryState({ page });
      router.refresh();
    });
  }, [setQueryState, router]);

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <SearchInput
        value={currentQuery}
        onSearch={handleSearch}
        placeholder="Search regulations, statutes, guidance, and analyses..."
        size="md"
        isLoading={isPending}
        aria-label="Search regulations"
        className="max-w-2xl"
      />

      {/* No query state */}
      {!initialResults && (
        <EmptyState
          icon={Search}
          title="Search regulations"
          description="Enter a search term to find regulations, statutes, guidance, policy documents, and analyses across the corpus"
        />
      )}

      {/* Results */}
      {initialResults && (
        <>
          {/* Filters + result count */}
          <div className="flex items-center justify-between gap-4">
            <SearchFilters filterOptions={filterOptions} />
            <p className="text-sm text-[var(--color-text-muted)] shrink-0">
              <span className="font-medium text-[var(--color-text)]">
                {initialResults.total.toLocaleString()}
              </span>{' '}
              {initialResults.total === 1 ? 'result' : 'results'} for &ldquo;{currentQuery}&rdquo;
            </p>
          </div>

          {/* Main content: results + commentary sidebar */}
          {initialResults.items.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              description="Try different search terms, adjusting filters, or broadening your query"
            />
          ) : (
            <div className="flex gap-6">
              {/* Primary results */}
              <div className="flex-1 min-w-0 space-y-3">
                {initialResults.items.map((item) => (
                  <SearchResultCard
                    key={`${item.type}-${item.id}`}
                    result={item}
                    state={jurisdiction}
                    query={currentQuery}
                    searchUrl={searchUrl}
                  />
                ))}

                {/* Pagination */}
                <Pagination
                  page={currentPage}
                  totalPages={initialResults.totalPages}
                  total={initialResults.total}
                  pageSize={initialResults.pageSize}
                  showItemCount
                  onPageChange={handlePageChange}
                  className="mt-6"
                />
              </div>

              {/* Commentary sidebar */}
              <div className="hidden lg:block">
                <StickyContainer offset="1rem">
                  <div className="max-h-[calc(100vh-2rem)] overflow-y-auto">
                    <CommentarySidebar
                      hits={initialResults.commentary}
                      state={jurisdiction}
                      query={currentQuery}
                      searchUrl={searchUrl}
                    />
                  </div>
                </StickyContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
