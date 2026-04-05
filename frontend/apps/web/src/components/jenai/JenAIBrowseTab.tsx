'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { MultiSelect } from '@/components/ui';
import { SearchInput } from '@/components/ui/SearchInput';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { Pagination } from '@/components/ui/Pagination';
import { JenAIStrategyTable } from './JenAIStrategyTable';
import { getJenAIStrategyPaginated } from '@/lib/actions/jenai-strategies';
import type { JenAIIssueWithContext, JenAIStrategyStats, StrategyKey } from '@/lib/actions/jenai-strategies';
import { jenaiStrategyParsers } from '@/lib/url/parsers';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';
import { JENAI_CATEGORY_LABELS } from '@deproceduralizer/database/schema';
import type { JurisdictionCode } from '@deproceduralizer/database';

interface JenAIBrowseTabProps {
  jurisdiction: JurisdictionCode;
  strategy: StrategyKey;
  stats: JenAIStrategyStats | null;
}

const sortOptions = [
  { value: 'severity', label: 'Severity' },
  { value: 'category', label: 'Category' },
  { value: 'createdAt', label: 'Date Added' },
];

const severityOptions = [
  { value: 'all', label: 'All Severities' },
  ...Array.from({ length: 10 }, (_, i) => ({
    value: String(10 - i),
    label: String(10 - i),
  })),
];

const STRATEGY_DESCRIPTIONS: Record<StrategyKey, string> = {
  'best-stories': 'High severity findings with strong narrative potential -- administrative burdens, dead references, frozen technology, fee burdens, missing digital authorization, and access barriers.',
  'surprises': 'Unexpected findings in areas like unclear delegation, dead references, frozen technology, missing digital authorization, and access barriers.',
  'pahlka': 'All non-OTHER findings with severity 5 or higher, aligned with the Pahlka framework for identifying government technology and process issues.',
  'action-plan': 'The broadest view -- all non-OTHER findings sorted by category, providing a comprehensive action plan.',
};

export function JenAIBrowseTab({ jurisdiction, strategy, stats }: JenAIBrowseTabProps) {
  const [params, setParams] = useQueryStates(jenaiStrategyParsers, { shallow: true });
  const [data, setData] = useState<JenAIIssueWithContext[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedCategories = useMemo(() => parseCommaSeparated(params.category), [params.category]);

  // Build category options from stats
  const categoryOptions = useMemo(() => {
    const countMap = new Map(stats?.byCategory?.map(d => [d.category, d.count]) ?? []);
    return Object.entries(JENAI_CATEGORY_LABELS)
      .filter(([key]) => key !== 'OTHER')
      .map(([value, label]) => ({
        value,
        label,
        count: countMap.get(value),
      }));
  }, [stats?.byCategory]);

  const fetchData = useCallback(async (overrides: Record<string, unknown> = {}) => {
    setIsLoading(true);
    try {
      const resolve = <T,>(key: string, fallback: T): T =>
        key in overrides ? (overrides[key] as T) : fallback;

      const page = resolve('page', params.page) as number;
      const category = resolve('category', params.category) as string | null;
      const severity = resolve('severity', params.severity) as string | null;
      const search = resolve('search', params.search) as string | null;

      const result = await getJenAIStrategyPaginated(jurisdiction, {
        page,
        pageSize: params.pageSize,
        sortBy: resolve('sortBy', params.sortBy) as 'severity' | 'category' | 'createdAt',
        sortOrder: resolve('sortOrder', params.sortOrder) as 'asc' | 'desc',
        filters: {
          strategy,
          category: category || undefined,
          severity: severity && severity !== 'all' ? severity : undefined,
          search: search || undefined,
        },
      });
      if (result.success) {
        setError(null);
        setData(result.data.data);
        setTotal(result.data.total);
        setTotalPages(result.data.totalPages);
      } else {
        setError(result.error || 'Failed to load findings');
        setData([]);
        setTotal(0);
        setTotalPages(0);
      }
    } finally {
      setIsLoading(false);
    }
  }, [jurisdiction, params, strategy]);

  useEffect(() => {
    fetchData();
  }, [strategy]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterChange = useCallback((key: string, value: string | number | null) => {
    const newParams = { [key]: value, page: 1 };
    setParams(newParams as Parameters<typeof setParams>[0]);
    fetchData({ ...newParams });
  }, [setParams, fetchData]);

  const handleMultiFilterChange = useCallback((key: string, values: string[]) => {
    const serialized = serializeCommaSeparated(values);
    const newParams = { [key]: serialized, page: 1 };
    setParams(newParams as Parameters<typeof setParams>[0]);
    fetchData({ ...newParams });
  }, [setParams, fetchData]);

  const handlePageChange = useCallback((newPage: number) => {
    setParams({ page: newPage } as Parameters<typeof setParams>[0]);
    fetchData({ page: newPage });
  }, [setParams, fetchData]);

  const hasActiveFilters = Boolean(
    params.category ||
    (params.severity && params.severity !== 'all') ||
    params.search
  );

  const clearFilters = useCallback(() => {
    const defaults = {
      category: null,
      severity: null,
      search: null,
      page: 1,
    };
    setParams(defaults as Parameters<typeof setParams>[0]);
    fetchData(defaults);
  }, [setParams, fetchData]);

  return (
    <div className="space-y-4">
      {/* Strategy description */}
      <div className="px-4 py-3 bg-[var(--color-primary-weaker)] border border-[var(--color-primary-weak)] rounded-[var(--radius-md)]">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {STRATEGY_DESCRIPTIONS[strategy]}
        </p>
      </div>

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
        <FilterField label="Category">
          <MultiSelect
            label="Category"
            value={selectedCategories}
            onChange={(values) => handleMultiFilterChange('category', values)}
            options={categoryOptions}
            placeholder="All Categories"
            data-testid="category-filter"
          />
        </FilterField>
        <FilterField label="Severity">
          <Select
            value={params.severity || 'all'}
            onValueChange={(v) => handleFilterChange('severity', v === 'all' ? null : v)}
            options={severityOptions}
            aria-label="Filter by severity"
          />
        </FilterField>
        <FilterField label="Search">
          <SearchInput
            value={params.search || ''}
            onSearch={(v) => handleFilterChange('search', v || null)}
            placeholder="Search findings..."
            aria-label="Search findings"
            size="sm"
            isLoading={isLoading}
          />
        </FilterField>
      </FilterBar>

      {error && (
        <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)]">
          <p className="text-sm text-[var(--color-danger)]">{error}</p>
        </div>
      )}

      {/* Results */}
      <Card padding="none">
        <div className={`${isLoading ? 'opacity-50 pointer-events-none' : ''} transition-opacity`}>
          <div className="px-4 py-3 border-b border-[var(--color-neutral-200)] flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-muted)]">
              {total} result{total !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="p-4">
            <JenAIStrategyTable
              data={data}
              state={jurisdiction}
            />
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
