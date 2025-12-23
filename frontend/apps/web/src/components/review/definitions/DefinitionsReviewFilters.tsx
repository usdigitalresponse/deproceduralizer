'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Select, Button, Input } from '@/components/ui';
import { useMemo } from 'react';

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

const REVIEW_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'false_positive', label: 'False Positive' },
];

const SCOPE_LEVEL_OPTIONS = [
  { value: 'all', label: 'All Scope Levels' },
  { value: 'section', label: 'Section' },
  { value: 'subpart', label: 'Subpart' },
  { value: 'part', label: 'Part' },
  { value: 'subchapter', label: 'Subchapter' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'title', label: 'Title' },
];

const DEFINITION_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'formal', label: 'Formal' },
  { value: 'abbreviation', label: 'Abbreviation' },
];

const CROSS_REFERENCE_OPTIONS = [
  { value: 'all', label: 'All Cross-Ref' },
  { value: 'true', label: 'Cross-Reference Only' },
  { value: 'false', label: 'Not Cross-Reference' },
];

const SCOPE_RELATION_OPTIONS = [
  { value: 'all', label: 'All Scope Relations' },
  { value: 'self', label: 'Scope = This Section' },
  { value: 'parent', label: 'Scope = Parent' },
];

const SORT_OPTIONS = [
  { value: 'document', label: 'By Document' },
  { value: 'term', label: 'By Term' },
  { value: 'extractedAt', label: 'By Date' },
];

export function DefinitionsReviewFilters({ counts, scopeTexts = [] }: DefinitionsReviewFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get('reviewStatus') || 'all';
  const currentScopeLevel = searchParams.get('scopeLevel') || 'all';
  const currentType = searchParams.get('definitionType') || 'all';
  const currentSort = searchParams.get('sortBy') || 'document';
  const currentCrossRef = searchParams.get('isCrossReference') || 'all';
  const currentScopeRelation = searchParams.get('scopeRelation') || 'all';
  const currentScopeText = searchParams.get('scopeText') || 'all';

  // Build scope text options from provided unique values
  const scopeTextOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'All Scope Texts' }];
    for (const text of scopeTexts) {
      if (text) {
        options.push({ value: text, label: text.length > 30 ? text.substring(0, 30) + '...' : text });
      }
    }
    return options;
  }, [scopeTexts]);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.set('page', '1'); // Reset to page 1 on filter change
    router.push(`${pathname}?${params.toString()}`);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    params.set('type', 'definitions');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
  };

  const hasFilters = (currentStatus && currentStatus !== 'all') ||
                     (currentScopeLevel && currentScopeLevel !== 'all') ||
                     (currentType && currentType !== 'all') ||
                     (currentCrossRef && currentCrossRef !== 'all') ||
                     (currentScopeRelation && currentScopeRelation !== 'all') ||
                     (currentScopeText && currentScopeText !== 'all');

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
            value={currentStatus}
            onValueChange={(value) => updateFilter('reviewStatus', value)}
            options={REVIEW_STATUS_OPTIONS}
          />
        </div>

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={currentScopeLevel}
            onValueChange={(value) => updateFilter('scopeLevel', value)}
            options={SCOPE_LEVEL_OPTIONS}
          />
        </div>

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={currentType}
            onValueChange={(value) => updateFilter('definitionType', value)}
            options={DEFINITION_TYPE_OPTIONS}
          />
        </div>

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={currentCrossRef}
            onValueChange={(value) => updateFilter('isCrossReference', value)}
            options={CROSS_REFERENCE_OPTIONS}
          />
        </div>
      </div>

      {/* Filters Row 2 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={currentScopeRelation}
            onValueChange={(value) => updateFilter('scopeRelation', value)}
            options={SCOPE_RELATION_OPTIONS}
          />
        </div>

        {scopeTextOptions.length > 1 && (
          <div className="flex-1 min-w-[180px] max-w-[250px]">
            <Select
              value={currentScopeText}
              onValueChange={(value) => updateFilter('scopeText', value)}
              options={scopeTextOptions}
            />
          </div>
        )}

        <div className="flex-1 min-w-[140px] max-w-[170px]">
          <Select
            value={currentSort}
            onValueChange={(value) => updateFilter('sortBy', value)}
            options={SORT_OPTIONS}
          />
        </div>

        {hasFilters && (
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
