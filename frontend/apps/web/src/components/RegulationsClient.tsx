'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DataTable from '@/components/DataTable';
import DetailModal from '@/components/DetailModal';
import SearchInput from '@/components/SearchInput';
import { Button } from '@/components/ui/Button';
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
  const [selectedRegulation, setSelectedRegulation] = useState<RegulationWithAnalysis | null>(null);
  const [data, setData] = useState(initialData);

  // Check if any filters are active
  const hasActiveFilters = Object.keys(filters).length > 0;

  // Clear all filters
  const clearFilters = useCallback(() => {
    router.push('/');
  }, [router]);

  // Sync data when server provides new initialData (e.g., after search/pagination)
  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  // Memoized to prevent unnecessary re-renders of DataTable and DetailModal
  const handleFlagUpdated = useCallback((updatedFlag: {
    id: number;
    reviewStatus?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewerNotes?: string;
    priority?: number;
    impactType?: string;
  }) => {
    // Convert reviewedAt string back to Date for type compatibility
    const flagUpdate = {
      ...updatedFlag,
      reviewedAt: updatedFlag.reviewedAt ? new Date(updatedFlag.reviewedAt) : null,
    };

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

    setSelectedRegulation(prev => prev ? {
      ...prev,
      redFlags: prev.redFlags.map(flag =>
        flag.id === updatedFlag.id
          ? { ...flag, ...flagUpdate }
          : flag
      )
    } : null);
  }, []);

  // Memoized to prevent unnecessary re-renders of DetailModal
  const handleClose = useCallback(() => {
    setSelectedRegulation(null);
  }, []);

  return (
    <div className="space-y-4">
      {/* Search Bar and Clear Filters */}
      <div className="flex justify-between items-center gap-4">
        <SearchInput initialValue={search} />
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
        onRowClick={setSelectedRegulation}
        pagination={pagination}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        filters={filters}
      />

      {/* Detail Modal */}
      <DetailModal
        regulation={selectedRegulation}
        onClose={handleClose}
        onFlagUpdated={handleFlagUpdated}
      />
    </div>
  );
}
