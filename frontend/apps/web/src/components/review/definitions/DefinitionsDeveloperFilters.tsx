'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { DEVELOPER_STATUSES, DEVELOPERS } from '@/types/regulation';
import { definitionsDeveloperParsers } from '@/lib/url/parsers';

interface DefinitionsDeveloperFiltersProps {
  className?: string;
}

const DEV_STATUS_OPTIONS = [
  { value: 'all', label: 'All Dev Statuses' },
  ...DEVELOPER_STATUSES,
];

const DEVELOPER_OPTIONS = [
  { value: 'all', label: 'All Developers' },
  ...DEVELOPERS,
];

const REVIEW_STATUS_OPTIONS = [
  { value: 'all', label: 'All Review Statuses' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'false_positive', label: 'False Positive' },
];

const HAS_NOTES_OPTIONS = [
  { value: 'all', label: 'Any' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const SORT_OPTIONS = [
  { value: 'reviewedAt', label: 'Review Date' },
  { value: 'developerCheckedAt', label: 'Dev Check Date' },
];

export function DefinitionsDeveloperFilters({
  className = '',
}: DefinitionsDeveloperFiltersProps) {
  const [filters, setFilters] = useQueryStates(definitionsDeveloperParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      developerStatus: 'all',
      developerAssigned: null,
      reviewStatus: 'all',
      hasJustification: 'all',
      hasTeamNotes: 'all',
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (filters.developerStatus && filters.developerStatus !== 'all') ||
    filters.developerAssigned ||
    (filters.reviewStatus && filters.reviewStatus !== 'all') ||
    (filters.hasJustification && filters.hasJustification !== 'all') ||
    (filters.hasTeamNotes && filters.hasTeamNotes !== 'all');

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Developer Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Dev Status:
        </label>
        <Select
          value={filters.developerStatus || 'all'}
          onValueChange={(value) => setFilters({ developerStatus: value as 'all' | 'unresolved' | 'resolved' | 'pending' | 'backlogged' | 'need_more_info', page: 1 })}
          options={DEV_STATUS_OPTIONS}
          aria-label="Filter by developer status"
        />
      </div>

      {/* Developer Assigned filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Developer:
        </label>
        <Select
          value={filters.developerAssigned || 'all'}
          onValueChange={(value) => setFilters({ developerAssigned: value === 'all' ? null : value, page: 1 })}
          options={DEVELOPER_OPTIONS}
          aria-label="Filter by developer"
        />
      </div>

      {/* Review Status filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Review:
        </label>
        <Select
          value={filters.reviewStatus || 'all'}
          onValueChange={(value) => setFilters({ reviewStatus: value as 'all' | 'confirmed' | 'corrected' | 'false_positive', page: 1 })}
          options={REVIEW_STATUS_OPTIONS}
          aria-label="Filter by review status"
        />
      </div>

      {/* Has Justification filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Justification:
        </label>
        <Select
          value={filters.hasJustification || 'all'}
          onValueChange={(value) => setFilters({ hasJustification: value as 'all' | 'yes' | 'no', page: 1 })}
          options={HAS_NOTES_OPTIONS}
          aria-label="Filter by justification notes"
        />
      </div>

      {/* Has Team Notes filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Team Notes:
        </label>
        <Select
          value={filters.hasTeamNotes || 'all'}
          onValueChange={(value) => setFilters({ hasTeamNotes: value as 'all' | 'yes' | 'no', page: 1 })}
          options={HAS_NOTES_OPTIONS}
          aria-label="Filter by team notes"
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}

      {/* Sort controls */}
      <div className="flex items-center gap-2 ml-auto">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Sort by:
        </label>
        <Select
          value={filters.sortBy || 'reviewedAt'}
          onValueChange={(value) => setFilters({ sortBy: value as 'reviewedAt' | 'developerCheckedAt' })}
          options={SORT_OPTIONS}
          aria-label="Sort by"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' })}
          aria-label={`Sort ${filters.sortOrder === 'asc' ? 'descending' : 'ascending'}`}
        >
          {filters.sortOrder === 'asc' ? '↑' : '↓'}
        </Button>
      </div>
    </div>
  );
}

export default DefinitionsDeveloperFilters;
