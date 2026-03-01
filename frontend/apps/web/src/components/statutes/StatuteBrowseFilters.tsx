'use client';

import { useCallback, useTransition } from 'react';
import { useQueryStates } from 'nuqs';
import { Button, Select, SearchInput, FullTextSearchLink } from '@/components/ui';
import { useJurisdictionFromPath } from '@/hooks/useStateFromPath';
import { statuteBrowseParsers } from '@/lib/url/parsers';
import { LINK_TYPE_LABELS, LINK_TYPE_VALUES } from '@/lib/constants/values';
import { typedValue } from '@/lib/url/type-helpers';
import type { LinkTypeValue } from '@/lib/constants/values';
import { X } from 'lucide-react';

// Build link type filter options
const LINK_TYPE_FILTER_OPTIONS = LINK_TYPE_VALUES.map((value) => ({
  value,
  label: value === 'all' ? 'All Types' : LINK_TYPE_LABELS[value] || value,
}));

// Has links filter options
const HAS_LINKS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'With Links' },
  { value: 'false', label: 'Without Links' },
];

interface StatuteBrowseFiltersProps {
  onSearchChange?: (search: string) => void;
  onHasLinksChange?: (hasLinks: boolean | null) => void;
  onLinkTypeChange?: (linkType: string | null) => void;
  className?: string;
}

export function StatuteBrowseFilters({
  onSearchChange,
  onHasLinksChange,
  onLinkTypeChange,
  className = '',
}: StatuteBrowseFiltersProps) {
  const jurisdiction = useJurisdictionFromPath();
  const [isPending, startTransition] = useTransition();

  const [filters, setFilters] = useQueryStates(statuteBrowseParsers, {
    shallow: true,
    startTransition,
  });

  const handleSearchChange = useCallback(
    (value: string) => {
      const searchValue = value || null;
      setFilters({ search: searchValue });
      onSearchChange?.(value);
    },
    [setFilters, onSearchChange]
  );

  const handleHasLinksChange = useCallback(
    (value: string) => {
      const hasLinks = value === 'all' ? null : value === 'true';
      setFilters({ hasLinks });
      onHasLinksChange?.(hasLinks);
    },
    [setFilters, onHasLinksChange]
  );

  const handleLinkTypeChange = useCallback(
    (value: string) => {
      setFilters({ linkType: value as LinkTypeValue });
      onLinkTypeChange?.(value === 'all' ? null : value);
    },
    [setFilters, onLinkTypeChange]
  );

  const clearFilters = useCallback(() => {
    setFilters({
      search: null,
      hasLinks: null,
      linkType: 'all',
    });
    onSearchChange?.('');
    onHasLinksChange?.(null);
    onLinkTypeChange?.(null);
  }, [setFilters, onSearchChange, onHasLinksChange, onLinkTypeChange]);

  // Check if any filters are active
  const hasActiveFilters =
    filters.search !== null ||
    filters.hasLinks !== null ||
    (filters.linkType && filters.linkType !== 'all');

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Search input */}
      <SearchInput
        value={filters.search || ''}
        onSearch={handleSearchChange}
        placeholder="Filter by title..."
        size="sm"
        className="w-56"
        isLoading={isPending}
      />
      <FullTextSearchLink query={filters.search || ''} state={jurisdiction} />

      {/* Has links filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Links:
        </label>
        <Select
          value={filters.hasLinks === true ? 'true' : filters.hasLinks === false ? 'false' : 'all'}
          onValueChange={handleHasLinksChange}
          options={HAS_LINKS_FILTER_OPTIONS}
          aria-label="Filter by linked regulations"
        />
      </div>

      {/* Link type filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Type:
        </label>
        <Select
          value={filters.linkType || 'all'}
          onValueChange={typedValue<LinkTypeValue>(handleLinkTypeChange)}
          options={LINK_TYPE_FILTER_OPTIONS}
          aria-label="Filter by link type"
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
    </div>
  );
}

export default StatuteBrowseFilters;
