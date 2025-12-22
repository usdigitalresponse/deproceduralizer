'use client';

import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import type {
  DefinitionScopeLevelValue,
  DefinitionTypeValue,
  DefinitionQualityValue,
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
  scopeLevel: DefinitionScopeLevelValue;
  definitionType: DefinitionTypeValue;
  quality: DefinitionQualityValue;
  onScopeLevelChange: (value: DefinitionScopeLevelValue) => void;
  onDefinitionTypeChange: (value: DefinitionTypeValue) => void;
  onQualityChange: (value: DefinitionQualityValue) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
}

/**
 * Controlled filter component for the glossary page.
 * Receives filter state and callbacks from parent (GlossaryClient).
 */
export function GlossaryFilters({
  className = '',
  scopeLevel,
  definitionType,
  quality,
  onScopeLevelChange,
  onDefinitionTypeChange,
  onQualityChange,
  onResetFilters,
  hasActiveFilters,
}: GlossaryFiltersProps) {
  // Check if any filter-specific values are active (not 'all')
  const hasFilterValues =
    scopeLevel !== 'all' ||
    definitionType !== 'all' ||
    quality !== 'all';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Scope Level filter */}
      <div className="flex items-center gap-2">
        <label className="text-sm text-[var(--color-text-secondary)]">
          Scope:
        </label>
        <Select
          value={scopeLevel}
          onValueChange={(value) => onScopeLevelChange(value as DefinitionScopeLevelValue)}
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
          value={definitionType}
          onValueChange={(value) => onDefinitionTypeChange(value as DefinitionTypeValue)}
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
          value={quality}
          onValueChange={(value) => onQualityChange(value as DefinitionQualityValue)}
          options={QUALITY_OPTIONS}
          aria-label="Filter by quality"
        />
      </div>

      {/* Clear filters button - only show when filter dropdowns have non-default values */}
      {hasFilterValues && (
        <Button variant="ghost" size="sm" onClick={onResetFilters}>
          Clear filters
        </Button>
      )}
    </div>
  );
}

export default GlossaryFilters;
