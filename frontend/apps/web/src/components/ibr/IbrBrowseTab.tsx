'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { IbrTable } from './IbrTable';
import { IbrDetailDrawer } from './IbrDetailDrawer';
import { getIbrsPaginated } from '@/lib/actions/ibr';
import { ibrParsers } from '@/lib/url/parsers';
import type { StateCode } from '@deproceduralizer/database';
import type { IbrWithContext } from '@/lib/actions/ibr';

interface IbrBrowseTabProps {
  state: StateCode;
  organizations: string[];
}

const sortOptions = [
  { value: 'sourceOrganization', label: 'Organization' },
  { value: 'incorporatedDocument', label: 'Standard Name' },
  { value: 'createdAt', label: 'Date Added' },
];

export function IbrBrowseTab({ state, organizations }: IbrBrowseTabProps) {
  const [params, setParams] = useQueryStates(ibrParsers, { shallow: true });
  const [data, setData] = useState<IbrWithContext[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIbr, setSelectedIbr] = useState<IbrWithContext | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const orgOptions = [
    { value: 'all', label: 'All Organizations' },
    ...organizations.map(org => ({ value: org, label: org })),
  ];

  // Initial data fetch on mount
  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async (overrides: Record<string, unknown> = {}) => {
    setIsLoading(true);
    try {
      // Use 'in' check instead of ?? so null overrides actually clear the value
      const resolve = <T,>(key: string, fallback: T): T =>
        key in overrides ? (overrides[key] as T) : fallback;

      const page = resolve('page', params.page) as number;
      const sourceOrg = resolve('sourceOrganization', params.sourceOrganization) as string | null;
      const search = resolve('search', params.search) as string | null;

      const result = await getIbrsPaginated(state, {
        page,
        pageSize: params.pageSize,
        sortBy: resolve('sortBy', params.sortBy) as 'sourceOrganization' | 'incorporatedDocument' | 'createdAt',
        sortOrder: resolve('sortOrder', params.sortOrder) as 'asc' | 'desc',
        filters: {
          sourceOrganization: sourceOrg === 'all' ? undefined : sourceOrg || undefined,
          search: search || undefined,
        },
      });
      if (result.success) {
        setData(result.data.data);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      }
    } finally {
      setIsLoading(false);
    }
  }, [state, params]);

  const handleFilterChange = useCallback((key: string, value: string | null) => {
    const newParams = { [key]: value, page: 1 };
    setParams(newParams as Parameters<typeof setParams>[0]);
    fetchData({ ...newParams });
  }, [setParams, fetchData]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage } as Parameters<typeof setParams>[0]);
    fetchData({ page: newPage });
  }, [setParams, fetchData]);

  const hasActiveFilters = Boolean(
    params.sourceOrganization ||
    params.search
  );

  const clearFilters = useCallback(() => {
    const defaults = { sourceOrganization: null, search: null, page: 1 };
    setParams(defaults as Parameters<typeof setParams>[0]);
    fetchData(defaults);
  }, [setParams, fetchData]);

  const handleRowClick = useCallback((ibr: IbrWithContext) => {
    setSelectedIbr(ibr);
    setDrawerOpen(true);
  }, []);

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
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
        <FilterField label="Organization">
          <Select
            value={params.sourceOrganization || 'all'}
            onValueChange={(v) => handleFilterChange('sourceOrganization', v === 'all' ? null : v)}
            options={orgOptions}
            aria-label="Filter by organization"
          />
        </FilterField>
        <FilterField label="Search">
          <SearchInput
            value={params.search || ''}
            onSearch={(v) => handleFilterChange('search', v || null)}
            placeholder="Search standards, context..."
            aria-label="Search IBRs"
            size="sm"
            isLoading={isLoading}
          />
        </FilterField>
      </FilterBar>

      {/* Results */}
      <Card padding="none">
        <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
          <div className="px-4 py-3 border-b border-[var(--color-neutral-200)]">
            <span className="text-sm text-[var(--color-text-muted)]">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4">
            <IbrTable data={data} state={state} onRowClick={handleRowClick} />
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

      {/* Detail Drawer */}
      <IbrDetailDrawer
        ibr={selectedIbr}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        state={state}
      />
    </div>
  );
}
