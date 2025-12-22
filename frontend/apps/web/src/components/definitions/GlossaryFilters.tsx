'use client';

import { useCallback } from 'react';
import { useQueryStates } from 'nuqs';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import {
  glossaryFiltersParsers,
  type DefinitionScopeLevelValue,
  type DefinitionTypeValue,
  type DefinitionQualityValue,
} from '@/lib/url/parsers';

const SCOPE_LEVEL_OPTIONS = [
  { value: 'all', label: 'All Scope Levels' },
  { value: 'section', label: 'Section' },
  { value: 'part', label: 'Part' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'title', label: 'Title' },
];

const DEFINITION_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'formal', label: 'Formal' },
  { value: 'abbreviation', label: 'Abbreviation' },
];

const QUALITY_OPTIONS = [
  { value: 'all', label: 'All Quality' },
  { value: 'high', label: 'High (100%)' },
  { value: 'medium', label: 'Medium (30-99%)' },
  { value: 'low', label: 'Low (<30%)' },
];

interface GlossaryFiltersProps {
  className?: string;
}

export function GlossaryFilters({ className = '' }: GlossaryFiltersProps) {
  const [filters, setFilters] = useQueryStates(glossaryFiltersParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      scopeLevel: 'all',
      definitionType: 'all',
      quality: 'all',
      page: 1,
    });
  }, [setFilters]);

  const hasActiveFilters =
    (filters.scopeLevel && filters.scopeLevel !== 'all') ||
    (filters.definitionType && filters.definitionType !== 'all') ||
    (filters.quality && filters.quality !== 'all');

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Scope Level filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Scope:
        </label>
        <Select
          value={filters.scopeLevel || 'all'}
          onValueChange={(value) => setFilters({
            scopeLevel: value as DefinitionScopeLevelValue,
            page: 1
          })}
          options={SCOPE_LEVEL_OPTIONS}
          aria-label="Filter by scope level"
        />
      </div>

      {/* Definition Type filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Type:
        </label>
        <Select
          value={filters.definitionType || 'all'}
          onValueChange={(value) => setFilters({
            definitionType: value as DefinitionTypeValue,
            page: 1
          })}
          options={DEFINITION_TYPE_OPTIONS}
          aria-label="Filter by definition type"
        />
      </div>

      {/* Quality filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Quality:
        </label>
        <Select
          value={filters.quality || 'all'}
          onValueChange={(value) => setFilters({
            quality: value as DefinitionQualityValue,
            page: 1
          })}
          options={QUALITY_OPTIONS}
          aria-label="Filter by quality"
        />
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

export default GlossaryFilters;
