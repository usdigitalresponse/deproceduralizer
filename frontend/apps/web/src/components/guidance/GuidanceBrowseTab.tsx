'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { GuidanceTable } from './GuidanceTable';
import { getGuidancePaginated } from '@/lib/actions/guidance-documents';
import { guidanceParsers } from '@/lib/url/parsers';
import { GUIDANCE_STATUS_VALUES, GUIDANCE_POLICY_CATEGORY_VALUES } from '@/lib/constants/values';
import { formatLabel } from '@/types/regulation';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { GuidanceDocumentListItem } from '@/lib/actions/guidance-documents';

interface GuidanceBrowseTabProps {
  jurisdiction: JurisdictionCode;
  agencies: string[];
  docTypes: string[];
}

const sortOptions = [
  { value: 'title', label: 'Title' },
  { value: 'agency', label: 'Agency' },
  { value: 'year', label: 'Year' },
  { value: 'status', label: 'Status' },
  { value: 'createdAt', label: 'Date Added' },
];

const statusOptions = GUIDANCE_STATUS_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Statuses' : formatLabel(v),
}));

const policyCategoryOptions = GUIDANCE_POLICY_CATEGORY_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Categories' : formatLabel(v),
}));

export function GuidanceBrowseTab({ jurisdiction, agencies, docTypes }: GuidanceBrowseTabProps) {
  const [params, setParams] = useQueryStates(guidanceParsers, { shallow: true });
  const [data, setData] = useState<GuidanceDocumentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const fetchCounterRef = useRef(0);

  const totalPages = Math.ceil(total / params.pageSize);

  const agencyOptions = [
    { value: 'all', label: 'All Agencies' },
    ...agencies.map(a => ({ value: a, label: a })),
  ];

  const docTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...docTypes.map(dt => ({ value: dt, label: dt })),
  ];

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchCounterRef.current;
    setIsLoading(true);
    try {
      const result = await getGuidancePaginated(jurisdiction, {
        page: params.page,
        pageSize: params.pageSize,
        sortBy: params.sortBy,
        sortOrder: params.sortOrder,
        filters: {
          agency: params.agency && params.agency !== 'all' ? params.agency : undefined,
          docType: params.docType && params.docType !== 'all' ? params.docType : undefined,
          policyCategory: params.policyCategory !== 'all' ? params.policyCategory : undefined,
          status: params.status !== 'all' ? params.status : undefined,
          yearFrom: params.yearFrom || undefined,
          yearTo: params.yearTo || undefined,
          search: params.search || undefined,
        },
      });
      if (fetchId !== fetchCounterRef.current) return; // stale response
      if (result.success) {
        setData(result.data.data);
        setTotal(result.data.total);
      }
    } finally {
      if (fetchId === fetchCounterRef.current) {
        setIsLoading(false);
      }
    }
  }, [jurisdiction, params]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = useCallback((key: string, value: string | number | null) => {
    setParams({ [key]: value, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const hasActiveFilters = Boolean(
    (params.agency && params.agency !== 'all') ||
    (params.docType && params.docType !== 'all') ||
    (params.policyCategory && params.policyCategory !== 'all') ||
    (params.status && params.status !== 'all') ||
    params.yearFrom ||
    params.yearTo ||
    params.search
  );

  const clearFilters = useCallback(() => {
    setParams({
      agency: null,
      docType: null,
      policyCategory: 'all',
      status: 'all',
      yearFrom: null,
      yearTo: null,
      search: null,
      page: 1,
    } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  return (
    <div className="space-y-4">
      <FilterBar
        showSortControls
        sortBy={params.sortBy}
        sortOrder={params.sortOrder}
        sortOptions={sortOptions}
        onSortByChange={(v) => handleFilterChange('sortBy', v)}
        onSortOrderToggle={() => handleFilterChange('sortOrder', params.sortOrder === 'desc' ? 'asc' : 'desc')}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <FilterField label="Agency">
          <Select
            value={params.agency || 'all'}
            onValueChange={(v) => handleFilterChange('agency', v === 'all' ? null : v)}
            options={agencyOptions}
            aria-label="Filter by agency"
          />
        </FilterField>
        <FilterField label="Type">
          <Select
            value={params.docType || 'all'}
            onValueChange={(v) => handleFilterChange('docType', v === 'all' ? null : v)}
            options={docTypeOptions}
            aria-label="Filter by document type"
          />
        </FilterField>
        <FilterField label="Category">
          <Select
            value={params.policyCategory || 'all'}
            onValueChange={(v) => handleFilterChange('policyCategory', v)}
            options={policyCategoryOptions}
            aria-label="Filter by policy category"
          />
        </FilterField>
        <FilterField label="Status">
          <Select
            value={params.status || 'all'}
            onValueChange={(v) => handleFilterChange('status', v)}
            options={statusOptions}
            aria-label="Filter by status"
          />
        </FilterField>
        <FilterField label="Search">
          <SearchInput
            value={params.search || ''}
            onSearch={(v) => handleFilterChange('search', v || null)}
            placeholder="Search title, ref, agency..."
            aria-label="Search guidance documents"
            size="sm"
            isLoading={isLoading}
          />
        </FilterField>
      </FilterBar>

      <Card padding="none">
        <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
          <div className="px-4 py-3 border-b border-[var(--color-neutral-200)]">
            <span className="text-sm text-[var(--color-text-muted)]">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4">
            <GuidanceTable data={data} state={jurisdiction} />
          </div>
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-[var(--color-neutral-200)]">
              <Pagination
                page={params.page}
                totalPages={totalPages}
                total={total}
                pageSize={params.pageSize}
                showItemCount
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
