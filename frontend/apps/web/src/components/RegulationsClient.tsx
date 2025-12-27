'use client';

import { useState, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryStates } from 'nuqs';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { Button, SearchInput } from '@/components/ui';
import { useStateFromPath } from '@/hooks';
import { searchParser, pageParser } from '@/lib/url/parsers';
import type { RegulationWithAnalysis, FilterOptions, PaginationOptions } from '@deproceduralizer/database';

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
  sortBy: PaginationOptions['sortBy'];
  sortOrder: PaginationOptions['sortOrder'];
}

export default function RegulationsClient({ initialData, pagination, search, filters, sortBy, sortOrder }: RegulationsClientProps) {
  const router = useRouter();
  const state = useStateFromPath();
  const [isPending, startTransition] = useTransition();
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);

  const [, setParams] = useQueryStates(
    {
      search: searchParser,
      page: pageParser,
    },
    { shallow: false } // Preserve other query params
  );

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

  // Clear all filters - navigate to state's root table view
  const clearFilters = useCallback(() => {
    router.push(`/${state}`);
  }, [router, state]);

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
      {/* Search Bar and Clear Filters */}
      <div className="flex justify-between items-center gap-4">
        <SearchInput
          value={search}
          onSearch={handleSearch}
          placeholder="Search regulations..."
          isLoading={isPending}
        />
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

      {/* Data Table - always render to keep headers/filters visible */}
      <DataTable
        data={data}
        onRowClick={(reg) => setSelectedRegulationId(reg.id)}
        pagination={pagination}
        search={search}
      />

      {/* Detail Modal */}
      <DetailModal
        regulationId={selectedRegulationId}
        onClose={handleClose}
        onFlagUpdated={handleFlagUpdated}
      />
    </div>
  );
}
