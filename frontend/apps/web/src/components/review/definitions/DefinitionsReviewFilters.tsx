'use client';

import { useCallback, useMemo } from 'react';
import { useQueryStates } from 'nuqs';
import { Select, Button } from '@/components/ui';
import {
  definitionsReviewParsers,
  type DefinitionsReviewStatusValue,
  type DefinitionsReviewScopeLevelValue,
  type DefinitionTypeValue,
  type DefinitionsCrossRefValue,
  type DefinitionsScopeRelationValue,
  type DefinitionsSortByValue,
} from '@/lib/url/parsers';
import {
  DEFINITIONS_REVIEW_STATUS_OPTIONS,
  DEFINITIONS_SCOPE_LEVEL_OPTIONS,
  DEFINITIONS_TYPE_OPTIONS,
  DEFINITIONS_CROSS_REFERENCE_OPTIONS,
  DEFINITIONS_SCOPE_RELATION_OPTIONS,
  DEFINITIONS_SORT_OPTIONS,
} from '@/lib/constants/filters';

interface DefinitionsReviewFiltersProps {
  counts: {
    unreviewed: number;
    confirmed: number;
    corrected: number;
    falsePositive: number;
    total: number;
  };
  /** Unique scope texts for filtering */
  scopeTexts?: string[];
}

export function DefinitionsReviewFilters({ counts, scopeTexts = [] }: DefinitionsReviewFiltersProps) {
  const [filters, setFilters] = useQueryStates(definitionsReviewParsers, {
    shallow: false,
  });

  const clearFilters = useCallback(() => {
    setFilters({
      reviewStatus: 'all',
      scopeLevel: 'all',
      definitionType: 'all',
      isCrossReference: 'all',
      scopeRelation: 'all',
      scopeText: null,
      sortBy: 'document',
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (not default)
  const hasActiveFilters =
    (filters.reviewStatus && filters.reviewStatus !== 'all') ||
    (filters.scopeLevel && filters.scopeLevel !== 'all') ||
    (filters.definitionType && filters.definitionType !== 'all') ||
    (filters.isCrossReference && filters.isCrossReference !== 'all') ||
    (filters.scopeRelation && filters.scopeRelation !== 'all') ||
    filters.scopeText;

  // Build scope text options from provided unique values
  const scopeTextOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Scope Texts' }];
    for (const text of scopeTexts) {
      if (text) {
        options.push({
          value: text,
          label: text.length > 30 ? text.substring(0, 30) + '...' : text,
        });
      }
    }
    return options;
  }, [scopeTexts]);

  return (
    <div className="bg-white rounded-lg border border-[var(--color-neutral-200)] p-4 mb-4">
      {/* Stats Row */}
      <div className="flex flex-wrap gap-4 mb-4 text-sm">
        <span className="text-[var(--color-text-secondary)]">
          Total: <span className="font-medium text-[var(--color-text)]">{counts.total}</span>
        </span>
        <span className="text-[var(--color-text-secondary)]">
          Unreviewed: <span className="font-medium text-[var(--color-text)]">{counts.unreviewed}</span>
        </span>
        <span className="text-[var(--color-success)]">
          Confirmed: <span className="font-medium">{counts.confirmed}</span>
        </span>
        <span className="text-[var(--color-warning)]">
          Corrected: <span className="font-medium">{counts.corrected}</span>
        </span>
        <span className="text-[var(--color-danger)]">
          False Positive: <span className="font-medium">{counts.falsePositive}</span>
        </span>
      </div>

      {/* Filters Row 1 */}
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={filters.reviewStatus || 'all'}
            onValueChange={(value) => setFilters({ reviewStatus: value as DefinitionsReviewStatusValue, page: 1 })}
            options={DEFINITIONS_REVIEW_STATUS_OPTIONS}
          />
        </div>

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={filters.scopeLevel || 'all'}
            onValueChange={(value) => setFilters({ scopeLevel: value as DefinitionsReviewScopeLevelValue, page: 1 })}
            options={DEFINITIONS_SCOPE_LEVEL_OPTIONS}
          />
        </div>

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={filters.definitionType || 'all'}
            onValueChange={(value) => setFilters({ definitionType: value as DefinitionTypeValue, page: 1 })}
            options={DEFINITIONS_TYPE_OPTIONS}
          />
        </div>

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={filters.isCrossReference || 'all'}
            onValueChange={(value) => setFilters({ isCrossReference: value as DefinitionsCrossRefValue, page: 1 })}
            options={DEFINITIONS_CROSS_REFERENCE_OPTIONS}
          />
        </div>
      </div>

      {/* Filters Row 2 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={filters.scopeRelation || 'all'}
            onValueChange={(value) => setFilters({ scopeRelation: value as DefinitionsScopeRelationValue, page: 1 })}
            options={DEFINITIONS_SCOPE_RELATION_OPTIONS}
          />
        </div>

        {scopeTextOptions.length > 1 && (
          <div className="flex-1 min-w-[180px] max-w-[250px]">
            <Select
              value={filters.scopeText || 'all'}
              onValueChange={(value) => setFilters({ scopeText: value === 'all' ? null : value, page: 1 })}
              options={scopeTextOptions}
            />
          </div>
        )}

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={filters.sortBy || 'document'}
            onValueChange={(value) => setFilters({ sortBy: value as DefinitionsSortByValue, page: 1 })}
            options={DEFINITIONS_SORT_OPTIONS}
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="secondary"
            size="sm"
            onClick={clearFilters}
          >
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
}

export default DefinitionsReviewFilters;
