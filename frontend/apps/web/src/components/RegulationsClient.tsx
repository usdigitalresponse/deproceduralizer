'use client';

import { useState, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import { SlidersHorizontal } from 'lucide-react';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { Button, SearchInput, FullTextSearchLink } from '@/components/ui';
import { RegulationCardGrid, ViewToggle, FacetedFilters } from '@/components/regulations';
import { useStateFromPath, useResponsive } from '@/hooks';
import {
  searchParser,
  pageParser,
  viewModeParser,
  facetedSeverityParser,
  facetedSectionTypesParser,
  facetedComplexityParser,
  facetedHasFlagsParser,
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
  const state = useStateFromPath();
  const [isPending, startTransition] = useTransition();
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  const [params, setParams] = useQueryStates(
    {
      search: searchParser,
      page: pageParser,
      viewMode: viewModeParser,
      // Faceted filter params
      fSeverity: facetedSeverityParser,
      fSectionTypes: facetedSectionTypesParser,
      fComplexity: facetedComplexityParser,
      fHasFlags: facetedHasFlagsParser,
      fHasForm: facetedHasFormParser,
      fHasIbr: facetedHasIbrParser,
    },
    { shallow: false } // Preserve other query params
  );

  const viewMode = params.viewMode as ViewModeValue;

  // Parse faceted filter values from URL
  const severity = useMemo(() => parseCommaSeparated(params.fSeverity), [params.fSeverity]);
  const sectionTypes = useMemo(() => parseCommaSeparated(params.fSectionTypes), [params.fSectionTypes]);
  const complexity = useMemo(() => parseCommaSeparated(params.fComplexity), [params.fComplexity]);

  // Mobile filter drawer state
  const { isMobile } = useResponsive();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Store local flag patches (optimistic updates) instead of copying all initialData
  const [flagPatches, setFlagPatches] = useState<Map<number, {
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: Date | null;
    justificationNotes?: string;
    teamNotes?: string;
    priority?: number;
    impactType?: string;
  }>>(new Map());

  // Derive data by applying patches to initialData
  const data = useMemo(() => {
    return initialData.map(reg => ({
      ...reg,
      redFlags: reg.redFlags.map(flag => {
        const patch = flagPatches.get(flag.id);
        return patch ? { ...flag, ...patch } : flag;
      })
    }));
  }, [initialData, flagPatches]);

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
    router.push(`/${state}`);
  }, [router, state]);

  // Faceted filter handlers
  const handleSeverityChange = useCallback((values: string[]) => {
    startTransition(() => {
      setParams({ fSeverity: serializeCommaSeparated(values), page: 1 });
    });
  }, [setParams]);

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

  const handleHasFlagsChange = useCallback((value: string | null) => {
    startTransition(() => {
      setParams({ fHasFlags: value, page: 1 });
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
        fSeverity: null,
        fSectionTypes: null,
        fComplexity: null,
        fHasFlags: null,
        fHasForm: null,
        fHasIbr: null,
        page: 1,
      });
    });
  }, [setParams]);

  // Check if any faceted filters are active
  const hasFacetedFilters = severity.length > 0 ||
    sectionTypes.length > 0 ||
    complexity.length > 0 ||
    params.fHasFlags !== null ||
    params.fHasForm !== null ||
    params.fHasIbr !== null;

  // Update flag patches when a flag is updated (optimistic update)
  const handleFlagUpdated = useCallback((updatedFlag: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    justificationNotes?: string;
    teamNotes?: string;
    priority?: number;
    impactType?: string;
  }) => {
    // Convert reviewedAt string back to Date for type compatibility
    const flagUpdate = {
      ...updatedFlag,
      reviewedAt: updatedFlag.reviewedAt ? new Date(updatedFlag.reviewedAt) : null,
    };

    // Store the patch - will be merged with initialData via useMemo
    setFlagPatches(prev => {
      const next = new Map(prev);
      next.set(updatedFlag.id, flagUpdate);
      return next;
    });
  }, []);

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
        <FullTextSearchLink query={search} state={state} />
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
                  {severity.length + sectionTypes.length + complexity.length +
                    (params.fHasFlags ? 1 : 0) + (params.fHasForm ? 1 : 0) + (params.fHasIbr ? 1 : 0)}
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
          ? `Showing ${data.length} results for "${search}"`
          : `Showing ${pagination.total} regulations`}
      </div>

      {/* Data View - Table or Card Grid with Filters */}
      {viewMode === 'table' ? (
        <DataTable
          data={data}
          onRowClick={(reg) => setSelectedRegulationId(reg.id)}
          pagination={pagination}
          search={search}
        />
      ) : (
        <div className="flex gap-6">
          {/* Faceted Filters Sidebar (desktop) */}
          {!isMobile && (
            <FacetedFilters
              severity={severity}
              sectionTypes={sectionTypes}
              complexity={complexity}
              hasFlags={params.fHasFlags}
              hasForm={params.fHasForm}
              hasIbr={params.fHasIbr}
              onSeverityChange={handleSeverityChange}
              onSectionTypesChange={handleSectionTypesChange}
              onComplexityChange={handleComplexityChange}
              onHasFlagsChange={handleHasFlagsChange}
              onHasFormChange={handleHasFormChange}
              onHasIbrChange={handleHasIbrChange}
              onClearAll={handleClearFacetedFilters}
            />
          )}

          {/* Mobile Filter Drawer */}
          {isMobile && (
            <FacetedFilters
              severity={severity}
              sectionTypes={sectionTypes}
              complexity={complexity}
              hasFlags={params.fHasFlags}
              hasForm={params.fHasForm}
              hasIbr={params.fHasIbr}
              onSeverityChange={handleSeverityChange}
              onSectionTypesChange={handleSectionTypesChange}
              onComplexityChange={handleComplexityChange}
              onHasFlagsChange={handleHasFlagsChange}
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
              data={data}
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
        onFlagUpdated={handleFlagUpdated}
      />
    </div>
  );
}
