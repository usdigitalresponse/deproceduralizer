'use client';

import { useState, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { SlidersHorizontal } from 'lucide-react';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { Button, SearchInput, FullTextSearchLink } from '@/components/ui';
import { RegulationCardGrid, ViewToggle, FacetedFilters } from '@/components/regulations';
import { useJurisdictionFromPath, useResponsive } from '@/hooks';
import {
  searchParser,
  pageParser,
  viewModeParser,
  facetedSectionTypesParser,
  facetedComplexityParser,
  facetedHasFormParser,
  facetedHasIbrParser,
  parseCommaSeparated,
  serializeCommaSeparated,
} from '@/lib/url/parsers';
import type { ViewModeValue } from '@/lib/constants/values';
import type { RegulationWithAnalysis, FilterOptions } from '@deproceduralizer/database';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

interface RegulationsClientProps {
  initialData: RegulationWithAnalysis[];
  pagination: PaginationInfo;
  search: string;
  filters: FilterOptions;
}

export default function RegulationsClient({ initialData, pagination, search, filters }: RegulationsClientProps) {
  const router = useRouter();
  const jurisdiction = useJurisdictionFromPath();
  const [isPending, startTransition] = useTransition();
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  const [params, setParams] = useQueryStates(
    {
      search: searchParser,
      page: pageParser,
      viewMode: viewModeParser,
      // Faceted filter params
      fSectionTypes: facetedSectionTypesParser,
      fComplexity: facetedComplexityParser,
      fHasForm: facetedHasFormParser,
      fHasIbr: facetedHasIbrParser,
    },
    { shallow: false } // Preserve other query params
  );

  const viewMode = params.viewMode as ViewModeValue;

  // Parse faceted filter values from URL
  const sectionTypes = useMemo(() => parseCommaSeparated(params.fSectionTypes), [params.fSectionTypes]);
  const complexity = useMemo(() => parseCommaSeparated(params.fComplexity), [params.fComplexity]);

  // Mobile filter drawer state
  const { isMobile } = useResponsive();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = Object.keys(filters).length > 0;

  // Handle search - update URL params with transition for loading state
  const handleSearch = useCallback((searchValue: string) => {
    startTransition(() => {
      setParams({
        search: searchValue.trim() || null,
        page: 1,
      });
    });
  }, [setParams]);

  // Handle view mode change
  const handleViewModeChange = useCallback((mode: ViewModeValue) => {
    startTransition(() => {
      setParams({ viewMode: mode, page: 1 });
    });
  }, [setParams]);

  // Handle page change for card grid
  const handlePageChange = useCallback((newPage: number) => {
    startTransition(() => {
      setParams({ page: newPage });
    });
  }, [setParams]);

  // Clear all filters - navigate to state's root table view
  const clearFilters = useCallback(() => {
    router.push(`/${jurisdiction}`);
  }, [router, jurisdiction]);

  // Faceted filter handlers
  const handleSectionTypesChange = useCallback((values: string[]) => {
    startTransition(() => {
      setParams({ fSectionTypes: serializeCommaSeparated(values), page: 1 });
    });
  }, [setParams]);

  const handleComplexityChange = useCallback((values: string[]) => {
    startTransition(() => {
      setParams({ fComplexity: serializeCommaSeparated(values), page: 1 });
    });
  }, [setParams]);

  const handleHasFormChange = useCallback((value: string | null) => {
    startTransition(() => {
      setParams({ fHasForm: value, page: 1 });
    });
  }, [setParams]);

  const handleHasIbrChange = useCallback((value: string | null) => {
    startTransition(() => {
      setParams({ fHasIbr: value, page: 1 });
    });
  }, [setParams]);

  const handleClearFacetedFilters = useCallback(() => {
    startTransition(() => {
      setParams({
        fSectionTypes: null,
        fComplexity: null,
        fHasForm: null,
        fHasIbr: null,
        page: 1,
      });
    });
  }, [setParams]);

  // Check if any faceted filters are active
  const hasFacetedFilters =
    sectionTypes.length > 0 ||
    complexity.length > 0 ||
    params.fHasForm !== null ||
    params.fHasIbr !== null;

  // Memoized to prevent unnecessary re-renders of DetailModal
  const handleClose = useCallback(() => {
    setSelectedRegulationId(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Search Bar, View Toggle, and Clear Filters */}
      <div className="flex justify-between items-center gap-4">
        <SearchInput
          value={search}
          onSearch={handleSearch}
          placeholder="Filter by title..."
          isLoading={isPending}
        />
        <FullTextSearchLink query={search} state={jurisdiction} />
        <div className="flex items-center gap-4">
          {/* Mobile filter toggle (only in cards mode) */}
          {viewMode === 'cards' && isMobile && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsFilterDrawerOpen(true)}
            >
              <SlidersHorizontal className="w-4 h-4 mr-1.5" />
              Filters
              {hasFacetedFilters && (
                <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-[var(--color-primary)] text-white rounded-full">
                  {sectionTypes.length + complexity.length +
                    (params.fHasForm ? 1 : 0) + (params.fHasIbr ? 1 : 0)}
                </span>
              )}
            </Button>
          )}
          <ViewToggle viewMode={viewMode} onChange={handleViewModeChange} />
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {/* Live region for screen reader announcements */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {search
          ? `Showing ${initialData.length} results for "${search}"`
          : `Showing ${pagination.total} regulations`}
      </div>

      {/* Data View - Table or Card Grid with Filters */}
      {viewMode === 'table' ? (
        <DataTable
          data={initialData}
          onRowClick={(reg) => setSelectedRegulationId(reg.id)}
          pagination={pagination}
          search={search}
        />
      ) : (
        <div className="flex gap-6">
          {/* Faceted Filters Sidebar (desktop) */}
          {!isMobile && (
            <FacetedFilters
              sectionTypes={sectionTypes}
              complexity={complexity}
              hasForm={params.fHasForm}
              hasIbr={params.fHasIbr}
              onSectionTypesChange={handleSectionTypesChange}
              onComplexityChange={handleComplexityChange}
              onHasFormChange={handleHasFormChange}
              onHasIbrChange={handleHasIbrChange}
              onClearAll={handleClearFacetedFilters}
            />
          )}

          {/* Mobile Filter Drawer */}
          {isMobile && (
            <FacetedFilters
              sectionTypes={sectionTypes}
              complexity={complexity}
              hasForm={params.fHasForm}
              hasIbr={params.fHasIbr}
              onSectionTypesChange={handleSectionTypesChange}
              onComplexityChange={handleComplexityChange}
              onHasFormChange={handleHasFormChange}
              onHasIbrChange={handleHasIbrChange}
              onClearAll={handleClearFacetedFilters}
              isOpen={isFilterDrawerOpen}
              onClose={() => setIsFilterDrawerOpen(false)}
            />
          )}

          {/* Card Grid */}
          <div className="flex-1 min-w-0">
            <RegulationCardGrid
              data={initialData}
              pagination={pagination}
              onCardClick={(reg) => setSelectedRegulationId(reg.id)}
              onPageChange={handlePageChange}
            />
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <DetailModal
        regulationId={selectedRegulationId}
        onClose={handleClose}
      />
    </div>
  );
}
