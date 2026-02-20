'use client';

import { useCallback, useMemo, useState } from 'react';
import { useQueryStates } from 'nuqs';
import { ArrowUp, ArrowDown, SlidersHorizontal } from 'lucide-react';
import { Select, Button, SearchInput } from '@/components/ui';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerBody, DrawerClose } from '@/components/ui/Drawer';
import { useResponsive } from '@/hooks';
import {
  definitionsReviewParsers,
  type DefinitionsReviewStatusValue,
  type DefinitionsReviewScopeLevelValue,
  type DefinitionTypeValue,
  type DefinitionsCrossRefValue,
  type DefinitionsInDefSectionValue,
  type DefinitionsScopeRelationValue,
  type DefinitionsScopeMismatchValue,
  type DefinitionsSortByValue,
  type SortOrderValue,
} from '@/lib/url/parsers';
import {
  DEFINITIONS_REVIEW_STATUS_OPTIONS,
  DEFINITIONS_SCOPE_LEVEL_OPTIONS,
  DEFINITIONS_TYPE_OPTIONS,
  DEFINITIONS_CROSS_REFERENCE_OPTIONS,
  DEFINITIONS_IN_DEF_SECTION_OPTIONS,
  DEFINITIONS_SCOPE_RELATION_OPTIONS,
  DEFINITIONS_SCOPE_MISMATCH_OPTIONS,
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

  const { isMobile } = useResponsive();
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  // Local state for ID input (to avoid updating URL on every keystroke)
  const [idInputValue, setIdInputValue] = useState(filters.definitionId?.toString() || '');

  const clearFilters = useCallback(() => {
    setIdInputValue('');
    setFilters({
      reviewStatus: 'all',
      scopeLevel: 'all',
      definitionType: 'all',
      isCrossReference: 'all',
      inDefinitionsSection: 'all',
      scopeRelation: 'all',
      scopeMismatch: 'all',
      scopeText: null,
      termSearch: null,
      definitionId: null,
      sortBy: 'document',
      sortOrder: 'desc',
      page: 1,
    });
  }, [setFilters]);

  // Check if any filters are active (not default)
  const hasActiveFilters = Boolean(
    (filters.reviewStatus && filters.reviewStatus !== 'all') ||
    (filters.scopeLevel && filters.scopeLevel !== 'all') ||
    (filters.definitionType && filters.definitionType !== 'all') ||
    (filters.isCrossReference && filters.isCrossReference !== 'all') ||
    (filters.inDefinitionsSection && filters.inDefinitionsSection !== 'all') ||
    (filters.scopeRelation && filters.scopeRelation !== 'all') ||
    (filters.scopeMismatch && filters.scopeMismatch !== 'all') ||
    filters.scopeText ||
    filters.termSearch ||
    filters.definitionId
  );

  // Count active dropdown filters for badge
  const activeFilterCount = [
    filters.reviewStatus && filters.reviewStatus !== 'all',
    filters.scopeLevel && filters.scopeLevel !== 'all',
    filters.definitionType && filters.definitionType !== 'all',
    filters.isCrossReference && filters.isCrossReference !== 'all',
    filters.inDefinitionsSection && filters.inDefinitionsSection !== 'all',
    filters.scopeRelation && filters.scopeRelation !== 'all',
    filters.scopeMismatch && filters.scopeMismatch !== 'all',
    filters.scopeText,
  ].filter(Boolean).length;

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

  // Handle ID input submission
  const handleIdSubmit = useCallback(() => {
    const id = idInputValue.trim();
    if (id === '') {
      setFilters({ definitionId: null, page: 1 });
    } else {
      const parsed = parseInt(id, 10);
      if (!isNaN(parsed)) {
        setFilters({ definitionId: parsed, page: 1 });
      }
    }
  }, [idInputValue, setFilters]);

  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setFilters({ sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc', page: 1 });
  }, [filters.sortOrder, setFilters]);

  const filterSelects = (
    <>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Review Status</label>
        <Select
          value={filters.reviewStatus || 'all'}
          onValueChange={(value) => setFilters({ reviewStatus: value as DefinitionsReviewStatusValue, page: 1 })}
          options={DEFINITIONS_REVIEW_STATUS_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Scope Level</label>
        <Select
          value={filters.scopeLevel || 'all'}
          onValueChange={(value) => setFilters({ scopeLevel: value as DefinitionsReviewScopeLevelValue, page: 1 })}
          options={DEFINITIONS_SCOPE_LEVEL_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Definition Type</label>
        <Select
          value={filters.definitionType || 'all'}
          onValueChange={(value) => setFilters({ definitionType: value as DefinitionTypeValue, page: 1 })}
          options={DEFINITIONS_TYPE_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Cross Reference</label>
        <Select
          value={filters.isCrossReference || 'all'}
          onValueChange={(value) => setFilters({ isCrossReference: value as DefinitionsCrossRefValue, page: 1 })}
          options={DEFINITIONS_CROSS_REFERENCE_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">In Definitions Section</label>
        <Select
          value={filters.inDefinitionsSection || 'all'}
          onValueChange={(value) => setFilters({ inDefinitionsSection: value as DefinitionsInDefSectionValue, page: 1 })}
          options={DEFINITIONS_IN_DEF_SECTION_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Scope Relation</label>
        <Select
          value={filters.scopeRelation || 'all'}
          onValueChange={(value) => setFilters({ scopeRelation: value as DefinitionsScopeRelationValue, page: 1 })}
          options={DEFINITIONS_SCOPE_RELATION_OPTIONS}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Scope Mismatch</label>
        <Select
          value={filters.scopeMismatch || 'all'}
          onValueChange={(value) => setFilters({ scopeMismatch: value as DefinitionsScopeMismatchValue, page: 1 })}
          options={DEFINITIONS_SCOPE_MISMATCH_OPTIONS}
        />
      </div>
      {scopeTextOptions.length > 1 && (
        <div>
          <label className="block text-xs font-medium text-[var(--color-text-muted)] mb-1 md:hidden">Scope Text</label>
          <Select
            value={filters.scopeText || 'all'}
            onValueChange={(value) => setFilters({ scopeText: value === 'all' ? null : value, page: 1 })}
            options={scopeTextOptions}
          />
        </div>
      )}
    </>
  );

  return (
    <div className="bg-white rounded-lg border border-[var(--color-neutral-200)] p-4 mb-4">
      {/* Search Row */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1">
          <SearchInput
            value={filters.termSearch || ''}
            onSearch={(value) => setFilters({ termSearch: value || null, page: 1 })}
            placeholder="Search by term..."
            size="sm"
            debounceMs={300}
          />
        </div>
        <div className="w-24">
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={idInputValue}
            onChange={(e) => setIdInputValue(e.target.value)}
            onBlur={handleIdSubmit}
            onKeyDown={(e) => e.key === 'Enter' && handleIdSubmit()}
            placeholder="ID"
            className="w-full py-1.5 px-3 text-sm bg-[var(--color-surface)] border border-[var(--color-neutral-300)] rounded-[var(--radius-md)] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] hover:border-[var(--color-neutral-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-focus)] focus:ring-offset-1"
          />
        </div>
      </div>

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

      {/* Mobile: Filters button + Sort controls */}
      {isMobile && (
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setIsFilterDrawerOpen(true)}
          >
            <SlidersHorizontal className="w-4 h-4 mr-1.5" />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-medium bg-[var(--color-primary)] text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {hasActiveFilters && (
            <Button
              variant="secondary"
              size="sm"
              onClick={clearFilters}
            >
              Clear
            </Button>
          )}

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            <div className="min-w-[120px]">
              <Select
                value={filters.sortBy || 'document'}
                onValueChange={(value) => setFilters({ sortBy: value as DefinitionsSortByValue, page: 1 })}
                options={DEFINITIONS_SORT_OPTIONS}
              />
            </div>
            <button
              type="button"
              onClick={toggleSortOrder}
              aria-label={filters.sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
              className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded-[var(--radius-md)] transition-colors"
            >
              {filters.sortOrder === 'asc' ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Mobile Filter Drawer */}
      {isMobile && (
        <Drawer open={isFilterDrawerOpen} onOpenChange={setIsFilterDrawerOpen}>
          <DrawerContent side="right">
            <DrawerHeader>
              <DrawerTitle>Filters</DrawerTitle>
              <DrawerClose />
            </DrawerHeader>
            <DrawerBody>
              <div className="space-y-4">
                {filterSelects}
              </div>
              {hasActiveFilters && (
                <div className="mt-6">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      clearFilters();
                      setIsFilterDrawerOpen(false);
                    }}
                    className="w-full"
                  >
                    Clear All Filters
                  </Button>
                </div>
              )}
            </DrawerBody>
          </DrawerContent>
        </Drawer>
      )}

      {/* Desktop: Inline filter dropdowns */}
      {!isMobile && (
        <>
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

            <div className="flex-1 min-w-[140px] max-w-[200px]">
              <Select
                value={filters.inDefinitionsSection || 'all'}
                onValueChange={(value) => setFilters({ inDefinitionsSection: value as DefinitionsInDefSectionValue, page: 1 })}
                options={DEFINITIONS_IN_DEF_SECTION_OPTIONS}
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

            <div className="flex-1 min-w-[140px] max-w-[170px]">
              <Select
                value={filters.scopeMismatch || 'all'}
                onValueChange={(value) => setFilters({ scopeMismatch: value as DefinitionsScopeMismatchValue, page: 1 })}
                options={DEFINITIONS_SCOPE_MISMATCH_OPTIONS}
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

            {/* Spacer to push sort controls to the right */}
            <div className="flex-1" />

            {/* Sort controls */}
            <div className="flex items-center gap-1">
              <div className="min-w-[140px]">
                <Select
                  value={filters.sortBy || 'document'}
                  onValueChange={(value) => setFilters({ sortBy: value as DefinitionsSortByValue, page: 1 })}
                  options={DEFINITIONS_SORT_OPTIONS}
                />
              </div>
              <button
                type="button"
                onClick={toggleSortOrder}
                aria-label={filters.sortOrder === 'asc' ? 'Sort ascending' : 'Sort descending'}
                className="p-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] hover:bg-[var(--color-neutral-100)] rounded-[var(--radius-md)] transition-colors"
              >
                {filters.sortOrder === 'asc' ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
            </div>

            {hasActiveFilters && (
              <Button
                variant="secondary"
                size="sm"
                onClick={clearFilters}
              >
                Clear
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default DefinitionsReviewFilters;
