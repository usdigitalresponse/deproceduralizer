'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import type { RegulationWithAnalysis, PaginationOptions, FilterOptions } from '@deproceduralizer/database';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// Map column IDs to server sort keys
const SORTABLE_COLUMNS: Record<string, PaginationOptions['sortBy']> = {
  title: 'title',
  numFlags: 'numFlags',
  maxSeverity: 'maxSeverity',
  overallComplexity: 'overallComplexity',
  hasImplementationIssues: 'hasImplementationIssues',
  requiresTechnicalReview: 'requiresTechnicalReview',
  hasReportingRequirement: 'hasReportingRequirement',
};

// Filter configuration for each column
interface ColumnFilterConfig {
  urlParam: string;
  options: { value: string; label: string }[];
  getValue: (filters: FilterOptions) => string;
}

const COLUMN_FILTERS: Record<string, ColumnFilterConfig> = {
  numFlags: {
    urlParam: 'hasFlags',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'With Flags' },
      { value: 'false', label: 'No Flags' },
    ],
    getValue: (f) => f.hasFlags === undefined ? '' : f.hasFlags.toString(),
  },
  hasImplementationIssues: {
    urlParam: 'hasImplIssues',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: 'null', label: 'Not Analyzed' },
    ],
    getValue: (f) => {
      if (f.hasImplementationIssues === undefined) return '';
      if (f.hasImplementationIssues === null) return 'null';
      return f.hasImplementationIssues.toString();
    },
  },
  overallComplexity: {
    urlParam: 'complexity',
    options: [
      { value: '', label: 'All' },
      { value: 'HIGH', label: 'High' },
      { value: 'MEDIUM-HIGH', label: 'Medium-High' },
      { value: 'MEDIUM', label: 'Medium' },
      { value: 'LOW', label: 'Low' },
      { value: 'null', label: 'Not Analyzed' },
    ],
    getValue: (f) => {
      if (f.complexity === undefined) return '';
      if (f.complexity === null) return 'null';
      return f.complexity;
    },
  },
  maxSeverity: {
    urlParam: 'severity',
    options: [
      { value: '', label: 'All' },
      { value: 'high', label: 'High (≥7)' },
      { value: 'medium', label: 'Medium (4-6)' },
      { value: 'low', label: 'Low (1-3)' },
      { value: 'null', label: 'Not Analyzed' },
    ],
    getValue: (f) => f.severity || '',
  },
  requiresTechnicalReview: {
    urlParam: 'techReview',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: 'null', label: 'Not Analyzed' },
    ],
    getValue: (f) => {
      if (f.requiresTechnicalReview === undefined) return '';
      if (f.requiresTechnicalReview === null) return 'null';
      return f.requiresTechnicalReview.toString();
    },
  },
  hasReportingRequirement: {
    urlParam: 'reporting',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: 'null', label: 'Not Analyzed' },
    ],
    getValue: (f) => {
      if (f.hasReportingRequirement === undefined) return '';
      if (f.hasReportingRequirement === null) return 'null';
      return f.hasReportingRequirement.toString();
    },
  },
};

const columnHelper = createColumnHelper<RegulationWithAnalysis>();

const columns = [
  columnHelper.accessor('title', {
    header: 'Title',
    size: 220,
    cell: (info) => (
      <div className="font-medium text-sm text-[var(--color-text)] line-clamp-2">
        {info.getValue()}
      </div>
    ),
  }),
  columnHelper.accessor('numFlags', {
    header: '# Flags',
    size: 80,
    cell: (info) => {
      const count = info.getValue() || 0;
      return (
        <Badge variant={count > 0 ? 'danger' : 'default'}>
          {count}
        </Badge>
      );
    },
  }),
  columnHelper.accessor('categories', {
    header: 'Categories',
    size: 180,
    cell: (info) => (
      <div className="text-xs text-[var(--color-text-secondary)] line-clamp-2">
        {info.getValue() || '–'}
      </div>
    ),
  }),
  columnHelper.accessor('explanations', {
    header: 'Explanations',
    size: 300,
    cell: (info) => {
      const text = info.getValue() || '';
      return (
        <div className="text-xs text-[var(--color-text-secondary)] line-clamp-3">
          {text || '–'}
        </div>
      );
    },
  }),
  columnHelper.accessor('hasImplementationIssues', {
    header: 'Impl Issues',
    size: 90,
    cell: (info) => (
      <span className="text-[var(--color-text)]">
        {info.getValue() ? (
          <span className="text-[var(--color-danger)]">●</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">–</span>
        )}
      </span>
    ),
  }),
  columnHelper.accessor('overallComplexity', {
    header: 'Complexity',
    size: 100,
    cell: (info) => {
      const complexity = info.getValue();
      if (!complexity) return <span className="text-[var(--color-text-muted)]">–</span>;

      const variant = complexity === 'HIGH' ? 'danger' : complexity === 'MEDIUM' || complexity === 'MEDIUM-HIGH' ? 'warning' : 'success';
      return <Badge variant={variant}>{complexity}</Badge>;
    },
  }),
  columnHelper.accessor('maxSeverity', {
    header: 'Severity',
    size: 90,
    cell: (info) => {
      const severity = info.getValue();
      if (!severity) return <span className="text-[var(--color-text-muted)]">–</span>;
      return <SeverityBadge severity={severity} />;
    },
  }),
  columnHelper.accessor('requiresTechnicalReview', {
    header: 'Tech Review',
    size: 95,
    cell: (info) => (
      <span>
        {info.getValue() ? (
          <span className="text-[var(--color-info)]">●</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">–</span>
        )}
      </span>
    ),
  }),
  columnHelper.accessor('hasReportingRequirement', {
    header: 'Reporting',
    size: 85,
    cell: (info) => (
      <span>
        {info.getValue() ? (
          <span className="text-[var(--color-warning)]">●</span>
        ) : (
          <span className="text-[var(--color-text-muted)]">–</span>
        )}
      </span>
    ),
  }),
  columnHelper.accessor('summary', {
    header: 'Summary',
    size: 350,
    cell: (info) => {
      const text = info.getValue() || '';
      return (
        <div className="text-xs text-[var(--color-text-secondary)] line-clamp-3">
          {text || '–'}
        </div>
      );
    },
  }),
];

interface DataTableProps {
  data: RegulationWithAnalysis[];
  onRowClick: (regulation: RegulationWithAnalysis) => void;
  pagination: PaginationInfo;
  search: string;
  sortBy?: PaginationOptions['sortBy'];
  sortOrder?: PaginationOptions['sortOrder'];
  filters: FilterOptions;
}

export default function DataTable({ data, onRowClick, pagination, search, sortBy = 'maxSeverity', sortOrder = 'desc', filters }: DataTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Navigate to a new page while preserving other params
  const navigateToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', page.toString());
    router.push(`?${params.toString()}`);
  };

  // Handle server-side sorting
  const handleSort = (columnId: string) => {
    const serverSortKey = SORTABLE_COLUMNS[columnId];
    if (!serverSortKey) return; // Not a sortable column

    const params = new URLSearchParams(searchParams.toString());

    // If clicking the same column, toggle order; otherwise, default to desc
    if (sortBy === serverSortKey) {
      params.set('sortOrder', sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      params.set('sortBy', serverSortKey);
      params.set('sortOrder', 'desc');
    }
    params.set('page', '1'); // Reset to first page on sort change

    router.push(`?${params.toString()}`);
  };

  // Handle filter change
  const handleFilter = useCallback((urlParam: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(urlParam, value);
    } else {
      params.delete(urlParam);
    }
    params.set('page', '1'); // Reset to first page on filter change
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    // Remove all filter params
    params.delete('hasFlags');
    params.delete('hasImplIssues');
    params.delete('complexity');
    params.delete('severity');
    params.delete('techReview');
    params.delete('reporting');
    params.set('page', '1');
    router.push(`?${params.toString()}`);
  }, [router, searchParams]);

  // Check if any filter is active
  const hasActiveFilters = Object.keys(filters).length > 0;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    // No client-side sorting/pagination - server handles it
  });

  // Helper to get aria-sort value based on server sort state
  const getAriaSort = (columnId: string): 'ascending' | 'descending' | 'none' => {
    const serverSortKey = SORTABLE_COLUMNS[columnId];
    if (!serverSortKey || sortBy !== serverSortKey) return 'none';
    return sortOrder === 'desc' ? 'descending' : 'ascending';
  };

  // Check if a column is sortable
  const isSortable = (columnId: string): boolean => {
    return columnId in SORTABLE_COLUMNS;
  };

  // Get sort indicator for a column
  const getSortIndicator = (columnId: string): string => {
    const serverSortKey = SORTABLE_COLUMNS[columnId];
    if (!serverSortKey || sortBy !== serverSortKey) return '';
    return sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  // Handle keyboard navigation on rows
  const handleRowKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>, row: RegulationWithAnalysis) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row);
    }
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="text-[var(--color-text)] table-fixed w-full"
          style={{ minWidth: '1400px' }}
          aria-label="Regulations data table"
          role="grid"
        >
          <thead className="bg-[var(--color-primary)]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} role="row">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{ width: header.getSize() }}
                    className={`
                      px-3 py-3
                      text-left text-xs font-semibold text-white
                      uppercase tracking-wider
                      transition-colors duration-[var(--duration-fast)]
                      focus:outline-none focus:ring-2 focus:ring-white focus:ring-inset
                      ${isSortable(header.id) ? 'cursor-pointer hover:bg-[var(--color-primary-strong)]' : ''}
                    `}
                    onClick={() => isSortable(header.id) && handleSort(header.id)}
                    onKeyDown={(e) => {
                      if (isSortable(header.id) && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleSort(header.id);
                      }
                    }}
                    tabIndex={isSortable(header.id) ? 0 : undefined}
                    role="columnheader"
                    aria-sort={isSortable(header.id) ? getAriaSort(header.id) : undefined}
                    scope="col"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {isSortable(header.id) && (
                        <span className="text-white/70" aria-hidden="true">
                          {getSortIndicator(header.id)}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
            {/* Filter row */}
            <tr className="bg-[var(--color-primary-strong)]">
              {table.getHeaderGroups()[0]?.headers.map((header) => {
                const filterConfig = COLUMN_FILTERS[header.id];
                return (
                  <th
                    key={`filter-${header.id}`}
                    style={{ width: header.getSize() }}
                    className="px-2 py-2"
                  >
                    {filterConfig ? (
                      <select
                        value={filterConfig.getValue(filters)}
                        onChange={(e) => handleFilter(filterConfig.urlParam, e.target.value)}
                        className={`
                          w-full text-xs py-1 px-1.5
                          bg-white/90 text-[var(--color-text)]
                          border-0 rounded
                          cursor-pointer
                          focus:outline-none focus:ring-2 focus:ring-white
                          ${filterConfig.getValue(filters) ? 'bg-[var(--color-warning-bg)] font-medium' : ''}
                        `}
                        aria-label={`Filter ${header.column.columnDef.header}`}
                      >
                        {filterConfig.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="bg-[var(--color-surface)] divide-y divide-[var(--color-neutral-200)]">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-[var(--color-text-muted)]"
                >
                  <p className="text-lg font-medium">No results found</p>
                  <p className="text-sm mt-1">
                    {search
                      ? `No regulations match "${search}"`
                      : hasActiveFilters
                      ? 'No regulations match the selected filters'
                      : 'No regulations available'}
                  </p>
                  {hasActiveFilters && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllFilters}
                      className="mt-4"
                    >
                      Clear all filters
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="
                    hover:bg-[var(--color-primary-faint)]
                    cursor-pointer
                    transition-colors duration-[var(--duration-fast)]
                    focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-inset
                  "
                  onClick={() => onRowClick(row.original)}
                  onKeyDown={(e) => handleRowKeyDown(e, row.original)}
                  tabIndex={0}
                  role="row"
                  aria-label={`${row.original.title || 'Untitled'}, ${row.original.numFlags || 0} flags`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      style={{ width: cell.column.getSize() }}
                      className="px-3 py-3 align-top overflow-hidden"
                      role="gridcell"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 bg-[var(--color-neutral-50)] border-t border-[var(--color-neutral-200)]">
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--color-text-secondary)]">
            Showing{' '}
            <span className="font-medium text-[var(--color-text)]">
              {(pagination.page - 1) * pagination.pageSize + 1}
            </span>
            {' '}to{' '}
            <span className="font-medium text-[var(--color-text)]">
              {Math.min(pagination.page * pagination.pageSize, pagination.total)}
            </span>
            {' '}of{' '}
            <span className="font-medium text-[var(--color-text)]">{pagination.total}</span>
            {' '}entries
            {search && (
              <span className="text-[var(--color-text-muted)]">
                {' '}for &quot;{search}&quot;
              </span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToPage(pagination.page - 1)}
            disabled={pagination.page <= 1}
          >
            Previous
          </Button>
          <span className="text-sm text-[var(--color-text-secondary)]">
            Page{' '}
            <span className="font-medium text-[var(--color-text)]">
              {pagination.page}
            </span>
            {' '}of{' '}
            <span className="font-medium text-[var(--color-text)]">
              {pagination.totalPages}
            </span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateToPage(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </Card>
  );
}
