'use client';

import { useState, useCallback, useEffect, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import { Button, SearchInput } from '@/components/ui';
import { useStateFromPath } from '@/hooks';
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
  const searchParams = useSearchParams();
  const state = useStateFromPath();
  const [isPending, startTransition] = useTransition();
  const [selectedRegulationId, setSelectedRegulationId] = useState<number | null>(null);
  const [data, setData] = useState(initialData);

  // Check if any filters are active
  const hasActiveFilters = Object.keys(filters).length > 0;

  // Handle search - update URL params with transition for loading state
  const handleSearch = useCallback((searchValue: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (searchValue.trim()) {
      params.set('search', searchValue.trim());
      params.set('page', '1');
    } else {
      params.delete('search');
      params.set('page', '1');
    }

    startTransition(() => {
      router.push(`/${state}?${params.toString()}`);
    });
  }, [router, searchParams, state]);

  // Clear all filters - navigate to state's root table view
  const clearFilters = useCallback(() => {
    router.push(`/${state}`);
  }, [router, state]);

  // Sync data when server provides new initialData (e.g., after search/pagination)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Memoized to prevent unnecessary re-renders of DataTable
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

    // Update table data to reflect flag changes
    setData(prevData =>
      prevData.map(reg => ({
        ...reg,
        redFlags: reg.redFlags.map(flag =>
          flag.id === updatedFlag.id
            ? { ...flag, ...flagUpdate }
            : flag
        )
      }))
    );
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
