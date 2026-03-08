'use client';

import { useEffect, useState, useMemo, useTransition, useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Link2, CheckCircle, AlertCircle } from 'lucide-react';
import { Card, StatCard, StatGrid, Select, SegmentedControl } from '@/components/ui';
import { FilterBar, FilterField } from '@/components/ui/FilterBar';
import { crossRefTableParsers } from '@/lib/url/parsers';
import {
  CROSSREF_RESOLVED_VALUES,
  CROSSREF_REF_TYPE_VALUES,
  CROSSREF_REF_TYPE_LABELS,
  CROSSREF_SOURCE_TYPE_VALUES,
} from '@/lib/constants/values';
import {
  getCrossReferenceStats,
  getCrossRefTablePaginated,
  getCrossRefGroupedByDocument,
} from '@/lib/actions/cross-references';
import type {
  PaginatedCrossRefTableResult,
  PaginatedCrossRefGroupResult,
  CrossRefTableOptions,
  CrossRefGroupOptions,
} from '@/lib/actions/cross-references';
import type { CrossRefStats } from '@deproceduralizer/database';
import type { JurisdictionCode } from '@/types/state';
import { FlatCrossRefsTable } from './FlatCrossRefsTable';
import { GroupedCrossRefsTable } from './GroupedCrossRefsTable';
import type { CrossRefSortByValue, CrossRefGroupSortByValue } from '@/lib/url/parsers';

interface CrossReferencesTableViewProps {
  jurisdiction: JurisdictionCode;
}

const TABLE_MODE_OPTIONS = [
  { value: 'flat' as const, label: 'Flat' },
  { value: 'grouped' as const, label: 'By Document' },
];

const RESOLVED_OPTIONS = CROSSREF_RESOLVED_VALUES.map((v) => ({
  value: v,
  label: v === 'all' ? 'All' : v === 'resolved' ? 'Resolved' : 'Unresolved',
}));

const REF_TYPE_OPTIONS = CROSSREF_REF_TYPE_VALUES.map((v) => ({
  value: v,
  label: v === 'all' ? 'All Types' : (CROSSREF_REF_TYPE_LABELS[v] ?? v),
}));

const SOURCE_TYPE_OPTIONS = CROSSREF_SOURCE_TYPE_VALUES.map((v) => ({
  value: v,
  label: v === 'all' ? 'All Sources' : v === 'regulation' ? 'Regulation' : 'Guidance',
}));

function resolvedFilterToOption(value: string): boolean | 'all' {
  if (value === 'resolved') return true;
  if (value === 'unresolved') return false;
  return 'all';
}

export function CrossReferencesTableView({ jurisdiction }: CrossReferencesTableViewProps) {
  const [params, setParams] = useQueryStates(crossRefTableParsers);
  const [isPending, startTransition] = useTransition();

  // Stats
  const [stats, setStats] = useState<CrossRefStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Flat table data
  const [flatResult, setFlatResult] = useState<PaginatedCrossRefTableResult | null>(null);

  // Grouped table data
  const [groupedResult, setGroupedResult] = useState<PaginatedCrossRefGroupResult | null>(null);

  const isFlat = params.crMode === 'flat';

  // Load stats on mount
  useEffect(() => {
    let cancelled = false;
    async function loadStats() {
      const result = await getCrossReferenceStats(jurisdiction);
      if (!cancelled && result.success) {
        setStats(result.data);
      }
    }
    loadStats();
    return () => { cancelled = true; };
  }, [jurisdiction]);

  // Load data on filter/page changes
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setError(null);
      if (isFlat) {
        const options: CrossRefTableOptions = {
          jurisdiction,
          page: params.crPage,
          pageSize: params.crPageSize,
          isResolved: resolvedFilterToOption(params.crResolved),
          refType: params.crRefType,
          sourceType: params.crSourceType,
          sortBy: params.crSortBy,
          sortOrder: params.crSortOrder,
        };
        const result = await getCrossRefTablePaginated(options);
        if (!cancelled) {
          if (result.success) {
            setFlatResult(result.data);
          } else {
            setError(result.error);
          }
        }
      } else {
        const options: CrossRefGroupOptions = {
          jurisdiction,
          page: params.crPage,
          pageSize: params.crPageSize,
          isResolved: resolvedFilterToOption(params.crResolved),
          refType: params.crRefType,
          sourceType: params.crSourceType,
          sortBy: params.crGroupSortBy,
          sortOrder: params.crSortOrder,
        };
        const result = await getCrossRefGroupedByDocument(options);
        if (!cancelled) {
          if (result.success) {
            setGroupedResult(result.data);
          } else {
            setError(result.error);
          }
        }
      }
    }

    startTransition(async () => {
      await loadData();
    });

    return () => { cancelled = true; };
  }, [
    jurisdiction,
    isFlat,
    params.crPage,
    params.crPageSize,
    params.crResolved,
    params.crRefType,
    params.crSourceType,
    params.crSortBy,
    params.crGroupSortBy,
    params.crSortOrder,
  ]);

  const handlePageChange = useCallback(
    (page: number) => {
      setParams({ crPage: page });
    },
    [setParams]
  );

  const handleFlatSort = useCallback(
    (column: CrossRefSortByValue) => {
      if (params.crSortBy === column) {
        setParams({ crSortOrder: params.crSortOrder === 'asc' ? 'desc' : 'asc' });
      } else {
        setParams({ crSortBy: column, crSortOrder: 'asc', crPage: 1 });
      }
    },
    [params.crSortBy, params.crSortOrder, setParams]
  );

  const handleGroupSort = useCallback(
    (column: CrossRefGroupSortByValue) => {
      if (params.crGroupSortBy === column) {
        setParams({ crSortOrder: params.crSortOrder === 'asc' ? 'desc' : 'asc' });
      } else {
        setParams({ crGroupSortBy: column, crSortOrder: 'desc', crPage: 1 });
      }
    },
    [params.crGroupSortBy, params.crSortOrder, setParams]
  );

  const activeFilters = useMemo(() => ({
    isResolved: resolvedFilterToOption(params.crResolved),
    refType: params.crRefType,
  }), [params.crResolved, params.crRefType]);

  const hasActiveFilters =
    params.crResolved !== 'unresolved' ||
    params.crRefType !== 'all' ||
    params.crSourceType !== 'all';

  const handleClearFilters = useCallback(() => {
    setParams({
      crResolved: 'unresolved',
      crRefType: 'all',
      crSourceType: 'all',
      crPage: 1,
    });
  }, [setParams]);

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      {stats && (
        <StatGrid columns={3}>
          <StatCard
            label="Total Cross-References"
            value={stats.total}
            icon={Link2}
            variant="default"
          />
          <StatCard
            label="Resolved"
            value={stats.resolved}
            icon={CheckCircle}
            variant="success"
          />
          <StatCard
            label="Unresolved"
            value={stats.unresolved}
            icon={AlertCircle}
            variant="warning"
          />
        </StatGrid>
      )}

      {/* Mode toggle + Filters */}
      <Card padding="md">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <SegmentedControl
            options={TABLE_MODE_OPTIONS}
            value={params.crMode}
            onChange={(mode) => setParams({ crMode: mode, crPage: 1 })}
            size="sm"
          />
        </div>

        <FilterBar
          hasActiveFilters={hasActiveFilters}
          onClearFilters={handleClearFilters}
        >
          <FilterField label="Status">
            <Select
              options={RESOLVED_OPTIONS}
              value={params.crResolved}
              onValueChange={(v) => setParams({ crResolved: v as typeof params.crResolved, crPage: 1 })}
              aria-label="Filter by resolved status"
            />
          </FilterField>
          <FilterField label="Ref Type">
            <Select
              options={REF_TYPE_OPTIONS}
              value={params.crRefType}
              onValueChange={(v) => setParams({ crRefType: v as typeof params.crRefType, crPage: 1 })}
              aria-label="Filter by reference type"
            />
          </FilterField>
          <FilterField label="Source">
            <Select
              options={SOURCE_TYPE_OPTIONS}
              value={params.crSourceType}
              onValueChange={(v) => setParams({ crSourceType: v as typeof params.crSourceType, crPage: 1 })}
              aria-label="Filter by source type"
            />
          </FilterField>
        </FilterBar>
      </Card>

      {/* Table content */}
      <Card padding="md">
        {error ? (
          <div className="text-center py-12">
            <p className="font-medium text-[var(--color-danger)]">Error loading data</p>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">{error}</p>
          </div>
        ) : isFlat ? (
          flatResult ? (
            <FlatCrossRefsTable
              data={flatResult.data}
              total={flatResult.total}
              page={flatResult.page}
              pageSize={flatResult.pageSize}
              totalPages={flatResult.totalPages}
              sortBy={params.crSortBy}
              sortOrder={params.crSortOrder}
              isPending={isPending}
              jurisdiction={jurisdiction}
              onPageChange={handlePageChange}
              onSort={handleFlatSort}
            />
          ) : (
            <div className="text-center py-12 text-[var(--color-text-muted)] animate-pulse">
              Loading cross-references...
            </div>
          )
        ) : groupedResult ? (
          <GroupedCrossRefsTable
            data={groupedResult.data}
            total={groupedResult.total}
            page={groupedResult.page}
            pageSize={groupedResult.pageSize}
            totalPages={groupedResult.totalPages}
            sortBy={params.crGroupSortBy}
            sortOrder={params.crSortOrder}
            isPending={isPending}
            jurisdiction={jurisdiction}
            onPageChange={handlePageChange}
            onSort={handleGroupSort}
            activeFilters={activeFilters}
          />
        ) : (
          <div className="text-center py-12 text-[var(--color-text-muted)] animate-pulse">
            Loading document groups...
          </div>
        )}
      </Card>
    </div>
  );
}
