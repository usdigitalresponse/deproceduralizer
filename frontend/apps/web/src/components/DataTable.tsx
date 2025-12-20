'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  type VisibilityState,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';
import { useQueryStates, parseAsInteger, parseAsString, parseAsBoolean } from 'nuqs';
import type { RegulationWithAnalysis, PaginationOptions, FilterOptions } from '@deproceduralizer/database';
import { RED_FLAG_CATEGORIES } from '@deproceduralizer/database/schema';
import { Badge, SeverityBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { getComplexityVariant, formatLabel } from '@/types/regulation';
import { useResponsive } from '@/hooks';

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
  summary: 'summary',
};

// Available red flag categories for filter dropdown
const CATEGORY_OPTIONS = [
  { value: '', label: 'All' },
  ...RED_FLAG_CATEGORIES.map(cat => ({
    value: cat,
    label: formatLabel(cat)
  }))
];

// Parser configuration for DataTable filters
const dataTableParsers = {
  page: parseAsInteger.withDefault(1),
  hasFlags: parseAsBoolean,
  category: parseAsString,
  explanationSearch: parseAsString,
  hasImplIssues: parseAsString, // Use string to support 'null'
  complexity: parseAsString,    // Use string to support 'null'
  severity: parseAsString,
  techReview: parseAsString,    // Use string to support 'null'
  reporting: parseAsString,     // Use string to support 'null'
  summarySearch: parseAsString,
  sortBy: parseAsString.withDefault('maxSeverity'),
  sortOrder: parseAsString.withDefault('desc'),
};

// Filter configuration for each column
interface ColumnFilterConfig {
  urlParam: keyof typeof dataTableParsers;
  type: 'select' | 'text';
  options?: { value: string; label: string }[];
  placeholder?: string;
}

const COLUMN_FILTERS: Record<string, ColumnFilterConfig> = {
  numFlags: {
    urlParam: 'hasFlags',
    type: 'select',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'With Flags' },
      { value: 'false', label: 'No Flags' },
    ],
  },
  categories: {
    urlParam: 'category',
    type: 'select',
    options: CATEGORY_OPTIONS,
  },
  explanations: {
    urlParam: 'explanationSearch',
    type: 'text',
    placeholder: 'Search...',
  },
  hasImplementationIssues: {
    urlParam: 'hasImplIssues',
    type: 'select',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: 'null', label: 'Not Analyzed' },
    ],
  },
  overallComplexity: {
    urlParam: 'complexity',
    type: 'select',
    options: [
      { value: '', label: 'All' },
      { value: 'HIGH', label: 'High' },
      { value: 'MEDIUM-HIGH', label: 'Medium-High' },
      { value: 'MEDIUM', label: 'Medium' },
      { value: 'LOW', label: 'Low' },
      { value: 'null', label: 'Not Analyzed' },
    ],
  },
  maxSeverity: {
    urlParam: 'severity',
    type: 'select',
    options: [
      { value: '', label: 'All' },
      { value: 'high', label: 'High (≥7)' },
      { value: 'medium', label: 'Medium (4-6)' },
      { value: 'low', label: 'Low (1-3)' },
      { value: 'null', label: 'Not Analyzed' },
    ],
  },
  requiresTechnicalReview: {
    urlParam: 'techReview',
    type: 'select',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: 'null', label: 'Not Analyzed' },
    ],
  },
  hasReportingRequirement: {
    urlParam: 'reporting',
    type: 'select',
    options: [
      { value: '', label: 'All' },
      { value: 'true', label: 'Yes' },
      { value: 'false', label: 'No' },
      { value: 'null', label: 'Not Analyzed' },
    ],
  },
  summary: {
    urlParam: 'summarySearch',
    type: 'text',
    placeholder: 'Search...',
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

      const variant = getComplexityVariant(complexity);
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
}

// Columns to hide on mobile (keep: title, numFlags, maxSeverity)
const MOBILE_HIDDEN_COLUMNS = [
  'categories',
  'explanations',
  'hasImplementationIssues',
  'overallComplexity',
  'requiresTechnicalReview',
  'hasReportingRequirement',
  'summary',
];

export default function DataTable({ data, onRowClick, pagination, search }: DataTableProps) {
  const { isMobile, isTablet } = useResponsive();
  const [queryParams, setQueryParams] = useQueryStates(dataTableParsers, {
    shallow: false,
  });

  // Column visibility based on screen size
  const columnVisibility: VisibilityState = useMemo(() => {
    if (isMobile) {
      return MOBILE_HIDDEN_COLUMNS.reduce((acc, col) => ({ ...acc, [col]: false }), {});
    }
    if (isTablet) {
      // On tablet, hide just the longest columns
      return {
        explanations: false,
        summary: false,
      };
    }
    return {};
  }, [isMobile, isTablet]);

  // Navigate to a new page
  const navigateToPage = (page: number) => {
    setQueryParams({ page });
  };

  // Handle server-side sorting
  const handleSort = (columnId: string) => {
    const serverSortKey = SORTABLE_COLUMNS[columnId];
    if (!serverSortKey) return; // Not a sortable column

    // If clicking the same column, toggle order; otherwise, default to desc
    if (queryParams.sortBy === serverSortKey) {
      setQueryParams({ 
        sortOrder: queryParams.sortOrder === 'desc' ? 'asc' : 'desc',
        page: 1 
      });
    } else {
      setQueryParams({ 
        sortBy: serverSortKey, 
        sortOrder: 'desc',
        page: 1 
      });
    }
  };

  // Handle filter change
  const handleFilter = useCallback((urlParam: keyof typeof dataTableParsers, value: string) => {
    // Special handling for boolean
    if (urlParam === 'hasFlags') {
      const boolValue = value === 'true' ? true : value === 'false' ? false : null;
      setQueryParams({ [urlParam]: boolValue, page: 1 });
    } else {
      setQueryParams({ [urlParam]: value || null, page: 1 });
    }
  }, [setQueryParams]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setQueryParams({
      hasFlags: null,
      hasImplIssues: null,
      complexity: null,
      severity: null,
      techReview: null,
      reporting: null,
      category: null,
      summarySearch: null,
      explanationSearch: null,
      page: 1,
    });
  }, [setQueryParams]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => {
    return (
      queryParams.hasFlags !== null ||
      queryParams.hasImplIssues !== null ||
      queryParams.complexity !== null ||
      queryParams.severity !== null ||
      queryParams.techReview !== null ||
      queryParams.reporting !== null ||
      queryParams.category !== null ||
      queryParams.summarySearch !== null ||
      queryParams.explanationSearch !== null
    );
  }, [queryParams]);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    state: {
      columnVisibility,
    },
  });

  // Helper to get aria-sort value
  const getAriaSort = (columnId: string): 'ascending' | 'descending' | 'none' => {
    const serverSortKey = SORTABLE_COLUMNS[columnId];
    if (!serverSortKey || queryParams.sortBy !== serverSortKey) return 'none';
    return queryParams.sortOrder === 'desc' ? 'descending' : 'ascending';
  };

  // Get sort indicator for a column
  const getSortIndicator = (columnId: string): string => {
    const serverSortKey = SORTABLE_COLUMNS[columnId];
    if (!serverSortKey || queryParams.sortBy !== serverSortKey) return '';
    return queryParams.sortOrder === 'asc' ? ' ↑' : ' ↓';
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="overflow-x-auto">
        <table
          className="text-[var(--color-text)] table-fixed w-full"
          style={{ minWidth: isMobile ? '400px' : isTablet ? '800px' : '1400px' }}
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
                      ${header.id in SORTABLE_COLUMNS ? 'cursor-pointer hover:bg-[var(--color-primary-strong)]' : ''}
                    `}
                    onClick={() => header.id in SORTABLE_COLUMNS && handleSort(header.id)}
                    onKeyDown={(e) => {
                      if (header.id in SORTABLE_COLUMNS && (e.key === 'Enter' || e.key === ' ')) {
                        e.preventDefault();
                        handleSort(header.id);
                      }
                    }}
                    tabIndex={header.id in SORTABLE_COLUMNS ? 0 : undefined}
                    role="columnheader"
                    aria-sort={header.id in SORTABLE_COLUMNS ? getAriaSort(header.id) : undefined}
                    scope="col"
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      {header.id in SORTABLE_COLUMNS && (
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
                if (!filterConfig) return <th key={`filter-${header.id}`} className="px-2 py-2" />;
                
                const currentValue = queryParams[filterConfig.urlParam];
                const displayValue = currentValue === null || currentValue === undefined ? '' : String(currentValue);

                return (
                  <th
                    key={`filter-${header.id}`}
                    style={{ width: header.getSize() }}
                    className="px-2 py-2"
                  >
                    {filterConfig.type === 'select' ? (
                      <select
                        value={displayValue}
                        onChange={(e) => handleFilter(filterConfig.urlParam, e.target.value)}
                        className={`
                          w-full text-xs py-1 px-1.5
                          bg-white/90 text-[var(--color-text)]
                          border-0 rounded
                          cursor-pointer
                          focus:outline-none focus:ring-2 focus:ring-white
                          ${displayValue ? 'bg-[var(--color-warning-bg)] font-medium' : ''}
                        `}
                        aria-label={`Filter ${header.column.columnDef.header}`}
                      >
                        {filterConfig.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) => handleFilter(filterConfig.urlParam, e.target.value)}
                        placeholder={filterConfig.placeholder || 'Search...'}
                        className={`
                          w-full text-xs py-1 px-1.5
                          bg-white/90 text-[var(--color-text)]
                          border-0 rounded
                          focus:outline-none focus:ring-2 focus:ring-white
                          ${displayValue ? 'bg-[var(--color-warning-bg)] font-medium' : ''}
                        `}
                        aria-label={`Search ${header.column.columnDef.header}`}
                      />
                    )}
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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row.original);
                    }
                  }}
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
