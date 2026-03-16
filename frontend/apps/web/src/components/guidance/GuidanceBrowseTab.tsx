'use client';

import { useState, useCallback, useEffect, useRef, type ComponentType } from 'react';
import { List, Layers } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { GuidanceTable } from './GuidanceTable';
import { GroupedGuidanceTable } from './GroupedGuidanceTable';
import { getGuidancePaginated, getGuidanceGrouped } from '@/lib/actions/guidance-documents';
import { guidanceParsers } from '@/lib/url/parsers';
import {
  GUIDANCE_STATUS_VALUES,
  GUIDANCE_POLICY_CATEGORY_VALUES,
  GUIDANCE_AUDIENCE_DIRECTION_VALUES,
  SECTION_TYPE_VALUES,
} from '@/lib/constants/values';
import { formatLabel } from '@/types/regulation';
import type { JurisdictionCode } from '@deproceduralizer/database';
import type { GuidanceDocumentListItem, GuidanceGroupRow } from '@/lib/actions/guidance-documents';
import type { GuidanceBrowseModeValue, GuidanceGroupByValue, GuidanceGroupSortByValue } from '@/lib/url/parsers';

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

const browseModeOptions: Array<{ value: GuidanceBrowseModeValue; label: string; icon?: ComponentType<{ className?: string }> }> = [
  { value: 'flat', label: 'Flat', icon: List },
  { value: 'grouped', label: 'Grouped', icon: Layers },
];

const groupByOptions: Array<{ value: GuidanceGroupByValue; label: string }> = [
  { value: 'agency', label: 'Agency' },
  { value: 'docType', label: 'Doc Type' },
  { value: 'policyCategory', label: 'Policy Category' },
];

const statusOptions = GUIDANCE_STATUS_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Statuses' : formatLabel(v),
}));

const policyCategoryOptions = GUIDANCE_POLICY_CATEGORY_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Categories' : formatLabel(v),
}));

const audienceDirectionOptions = GUIDANCE_AUDIENCE_DIRECTION_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Audiences' : formatLabel(v),
}));

const sectionTypeOptions = SECTION_TYPE_VALUES.map(v => ({
  value: v,
  label: v === 'all' ? 'All Section Types' : formatLabel(v),
}));

export function GuidanceBrowseTab({ jurisdiction, agencies, docTypes }: GuidanceBrowseTabProps) {
  const [params, setParams] = useQueryStates(guidanceParsers, { shallow: true });

  // Flat mode state
  const [flatData, setFlatData] = useState<GuidanceDocumentListItem[]>([]);
  const [flatTotal, setFlatTotal] = useState(0);

  // Grouped mode state
  const [groupedData, setGroupedData] = useState<GuidanceGroupRow[]>([]);
  const [groupedTotal, setGroupedTotal] = useState(0);
  const [groupedTotalPages, setGroupedTotalPages] = useState(0);

  const [isLoading, setIsLoading] = useState(false);
  const fetchCounterRef = useRef(0);

  const isGrouped = params.browseMode === 'grouped';
  const total = isGrouped ? groupedTotal : flatTotal;
  const totalPages = isGrouped ? groupedTotalPages : Math.ceil(flatTotal / params.pageSize);

  const agencyOptions = [
    { value: 'all', label: 'All Agencies' },
    ...agencies.map(a => ({ value: a, label: a })),
  ];

  const docTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...docTypes.map(dt => ({ value: dt, label: dt })),
  ];

  const activeFilters = {
    agency: params.agency && params.agency !== 'all' ? params.agency : undefined,
    docType: params.docType && params.docType !== 'all' ? params.docType : undefined,
    policyCategory: params.policyCategory !== 'all' ? params.policyCategory : undefined,
    status: params.status !== 'all' ? params.status : undefined,
    yearFrom: params.yearFrom || undefined,
    yearTo: params.yearTo || undefined,
    search: params.search || undefined,
    audienceDirection: params.audienceDirection !== 'all' ? params.audienceDirection : undefined,
    sectionType: params.sectionType !== 'all' ? params.sectionType : undefined,
    hasForm: params.hasForm || undefined,
    hasIbr: params.hasIbr || undefined,
  };

  const fetchData = useCallback(async () => {
    const fetchId = ++fetchCounterRef.current;
    setIsLoading(true);
    try {
      if (isGrouped) {
        const result = await getGuidanceGrouped(jurisdiction, {
          groupBy: params.groupBy,
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.groupSortBy,
          sortOrder: params.sortOrder,
          filters: activeFilters,
        });
        if (fetchId !== fetchCounterRef.current) return;
        if (result.success) {
          setGroupedData(result.data.data);
          setGroupedTotal(result.data.total);
          setGroupedTotalPages(result.data.totalPages);
        }
      } else {
        const result = await getGuidancePaginated(jurisdiction, {
          page: params.page,
          pageSize: params.pageSize,
          sortBy: params.sortBy,
          sortOrder: params.sortOrder,
          filters: activeFilters,
        });
        if (fetchId !== fetchCounterRef.current) return;
        if (result.success) {
          setFlatData(result.data.data);
          setFlatTotal(result.data.total);
        }
      }
    } finally {
      if (fetchId === fetchCounterRef.current) {
        setIsLoading(false);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleBrowseModeChange = useCallback((mode: GuidanceBrowseModeValue) => {
    setParams({ browseMode: mode, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handleGroupByChange = useCallback((value: string) => {
    setParams({ groupBy: value as GuidanceGroupByValue, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  const handleGroupSort = useCallback((column: GuidanceGroupSortByValue) => {
    const newOrder = params.groupSortBy === column && params.sortOrder === 'desc' ? 'asc' : 'desc';
    setParams({ groupSortBy: column, sortOrder: newOrder, page: 1 } as Parameters<typeof setParams>[0]);
  }, [setParams, params.groupSortBy, params.sortOrder]);

  const activeFilterCount = [
    params.agency && params.agency !== 'all',
    params.docType && params.docType !== 'all',
    params.policyCategory && params.policyCategory !== 'all',
    params.status && params.status !== 'all',
    params.yearFrom,
    params.yearTo,
    params.search,
    params.audienceDirection && params.audienceDirection !== 'all',
    params.sectionType && params.sectionType !== 'all',
    params.hasForm,
    params.hasIbr,
  ].filter(Boolean).length;

  const hasActiveFilters = activeFilterCount > 0;

  const clearFilters = useCallback(() => {
    setParams({
      agency: null,
      docType: null,
      policyCategory: 'all',
      status: 'all',
      yearFrom: null,
      yearTo: null,
      search: null,
      audienceDirection: 'all',
      sectionType: 'all',
      hasForm: null,
      hasIbr: null,
      page: 1,
    } as Parameters<typeof setParams>[0]);
  }, [setParams]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <SegmentedControl
          options={browseModeOptions}
          value={params.browseMode}
          onChange={handleBrowseModeChange}
          variant="filled"
          size="sm"
        />
        {isGrouped && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)]">Group by:</span>
            <Select
              value={params.groupBy}
              onValueChange={handleGroupByChange}
              options={groupByOptions}
              aria-label="Group by dimension"
            />
          </div>
        )}
      </div>

      <FilterBar
        showSortControls={!isGrouped}
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
        <FilterField label="Audience">
          <Select
            value={params.audienceDirection || 'all'}
            onValueChange={(v) => handleFilterChange('audienceDirection', v)}
            options={audienceDirectionOptions}
            aria-label="Filter by audience direction"
          />
        </FilterField>
        <FilterField label="Section Type">
          <Select
            value={params.sectionType || 'all'}
            onValueChange={(v) => handleFilterChange('sectionType', v)}
            options={sectionTypeOptions}
            aria-label="Filter by section type"
          />
        </FilterField>
        <FilterField label="Has Form">
          <Select
            value={params.hasForm ? 'yes' : 'no'}
            onValueChange={(v) => setParams({ hasForm: v === 'yes' ? true : null, page: 1 } as Parameters<typeof setParams>[0])}
            options={[
              { value: 'no', label: 'Any' },
              { value: 'yes', label: 'Has Form' },
            ]}
            aria-label="Filter by has form"
          />
        </FilterField>
        <FilterField label="Has IBR">
          <Select
            value={params.hasIbr ? 'yes' : 'no'}
            onValueChange={(v) => setParams({ hasIbr: v === 'yes' ? true : null, page: 1 } as Parameters<typeof setParams>[0])}
            options={[
              { value: 'no', label: 'Any' },
              { value: 'yes', label: 'Has IBR' },
            ]}
            aria-label="Filter by has IBR"
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
          <div className="px-4 py-3 border-b border-[var(--color-neutral-200)] flex items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">
              {total} {isGrouped ? 'group' : 'result'}{total !== 1 ? 's' : ''}
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] hover:underline transition-colors"
              >
                ({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} applied — clear)
              </button>
            )}
          </div>
          {isGrouped ? (
            <GroupedGuidanceTable
              data={groupedData}
              total={groupedTotal}
              page={params.page}
              pageSize={params.pageSize}
              totalPages={groupedTotalPages}
              sortBy={params.groupSortBy}
              sortOrder={params.sortOrder}
              isLoading={isLoading}
              jurisdiction={jurisdiction}
              groupBy={params.groupBy}
              onPageChange={handlePageChange}
              onSort={handleGroupSort}
              activeFilters={activeFilters}
            />
          ) : (
            <>
              <div className="p-4">
                <GuidanceTable data={flatData} state={jurisdiction} />
              </div>
              {totalPages > 1 && (
                <div className="px-4 py-3 border-t border-[var(--color-neutral-200)]">
                  <Pagination
                    page={params.page}
                    totalPages={totalPages}
                    total={flatTotal}
                    pageSize={params.pageSize}
                    showItemCount
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
