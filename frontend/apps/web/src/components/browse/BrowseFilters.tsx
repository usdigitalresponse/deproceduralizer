'use client';

import { useCallback, useTransition } from 'react';
import { useQueryStates } from 'nuqs';
import { Button, Select, SearchInput, FullTextSearchLink } from '@/components/ui';
import { useJurisdictionFromPath } from '@/hooks/useStateFromPath';
import { browseFiltersParsers } from '@/lib/url/parsers';
import {
  HAS_DEFINITIONS_FILTER_OPTIONS,
  HAS_COMPLIANCE_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { X } from 'lucide-react';

interface BrowseFiltersProps {
  stats: {
    level: string;
    count: number;
  }[];
  className?: string;
}

export function BrowseFilters({
  stats,
  className = '',
}: BrowseFiltersProps) {
  const jurisdiction = useJurisdictionFromPath();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(browseFiltersParsers, {
    shallow: false,
    startTransition,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      hasDefs: null,
      hasCompliance: null,
      search: null,
    });
  }, [setFilters]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.hasDefs !== null ||
    filters.hasCompliance !== null ||
    filters.search !== null;

  // Calculate totals from stats
  const totalDocs = stats.reduce((sum, s) => sum + s.count, 0);

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Search input */}
      <SearchInput
        value={filters.search || ''}
        onSearch={(val) => setFilters({ search: val || null })}
        placeholder="Filter by title..."
        size="sm"
        className="w-48"
        isLoading={isPending}
      />
      <FullTextSearchLink query={filters.search || ''} state={jurisdiction} />

      {/* Has Definitions filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Definitions:
        </label>
        <Select
          value={filters.hasDefs === true ? 'true' : filters.hasDefs === false ? 'false' : 'all'}
          onValueChange={(value) => setFilters({ hasDefs: value === 'all' ? null : value === 'true' })}
          options={HAS_DEFINITIONS_FILTER_OPTIONS}
          aria-label="Filter by definitions"
        />
      </div>

      {/* Compliance Issues filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Compliance:
        </label>
        <Select
          value={filters.hasCompliance === true ? 'true' : filters.hasCompliance === false ? 'false' : 'all'}
          onValueChange={(value) => setFilters({ hasCompliance: value === 'all' ? null : value === 'true' })}
          options={HAS_COMPLIANCE_FILTER_OPTIONS}
          aria-label="Filter by compliance issues"
        />
      </div>

      {/* Clear all button */}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearFilters}
          className="text-[var(--color-text-muted)]"
        >
          <X className="w-4 h-4 mr-1" />
          Clear all
        </Button>
      )}

      {/* Stats summary */}
      <div className="ml-auto text-xs text-[var(--color-text-muted)]">
        {totalDocs.toLocaleString()} documents
      </div>
    </div>
  );
}

export default BrowseFilters;
