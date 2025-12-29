'use client';

import { useCallback, useMemo } from 'react';
import { X, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui';
import { FilterSection } from './FilterSection';
import { FilterCheckboxGroup, FilterRadioGroup } from './FilterCheckboxGroup';
import { ActiveFilterChips } from './ActiveFilterChips';
import {
  SEVERITY_TABLE_OPTIONS,
  SECTION_TYPE_OPTIONS,
  HAS_FLAGS_FILTER_OPTIONS,
  HAS_FORM_FILTER_OPTIONS,
  HAS_IBR_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { COMPLEXITY_LEVELS } from '@/lib/constants/values';

interface FacetedFiltersProps {
  // Current filter values
  severity: string[];
  sectionTypes: string[];
  complexity: string[];
  hasFlags: string | null;
  hasForm: string | null;
  hasIbr: string | null;

  // Callbacks
  onSeverityChange: (values: string[]) => void;
  onSectionTypesChange: (values: string[]) => void;
  onComplexityChange: (values: string[]) => void;
  onHasFlagsChange: (value: string | null) => void;
  onHasFormChange: (value: string | null) => void;
  onHasIbrChange: (value: string | null) => void;
  onClearAll: () => void;

  // Optional: counts for each filter value
  counts?: {
    severity?: Record<string, number>;
    sectionTypes?: Record<string, number>;
    complexity?: Record<string, number>;
  };

  // Mobile drawer state
  isOpen?: boolean;
  onClose?: () => void;
}

/**
 * Faceted filter sidebar for the card grid view.
 * Provides multi-select filters for severity, section type, complexity, and metadata.
 */
export function FacetedFilters({
  severity,
  sectionTypes,
  complexity,
  hasFlags,
  hasForm,
  hasIbr,
  onSeverityChange,
  onSectionTypesChange,
  onComplexityChange,
  onHasFlagsChange,
  onHasFormChange,
  onHasIbrChange,
  onClearAll,
  counts,
  isOpen,
  onClose,
}: FacetedFiltersProps) {
  // Convert filter options to include counts
  const severityOptions = useMemo(() => {
    return SEVERITY_TABLE_OPTIONS
      .filter((opt) => opt.value !== '') // Exclude "All" option
      .map((opt) => ({
        value: opt.value,
        label: opt.label,
        count: counts?.severity?.[opt.value],
      }));
  }, [counts]);

  const sectionTypeOptions = useMemo(() => {
    return SECTION_TYPE_OPTIONS
      .filter((opt) => opt.value !== 'all')
      .map((opt) => ({
        value: opt.value,
        label: opt.label,
        count: counts?.sectionTypes?.[opt.value],
      }));
  }, [counts]);

  const complexityOptions = useMemo(() => {
    return COMPLEXITY_LEVELS.map((level) => ({
      value: level,
      label: level,
      count: counts?.complexity?.[level],
    }));
  }, [counts]);

  const flagsOptions = useMemo(() => {
    return HAS_FLAGS_FILTER_OPTIONS
      .filter((opt) => opt.value !== 'all')
      .map((opt) => ({
        value: opt.value,
        label: opt.label,
      }));
  }, []);

  // Build active filters array for chips display
  const activeFilters = useMemo(() => {
    const filters: { key: string; label: string; value: string }[] = [];

    severity.forEach((s) => {
      const opt = severityOptions.find((o) => o.value === s);
      if (opt) filters.push({ key: 'severity', label: 'Severity', value: opt.label });
    });

    sectionTypes.forEach((t) => {
      const opt = sectionTypeOptions.find((o) => o.value === t);
      if (opt) filters.push({ key: 'sectionType', label: 'Type', value: opt.label });
    });

    complexity.forEach((c) => {
      filters.push({ key: 'complexity', label: 'Complexity', value: c });
    });

    if (hasFlags === 'true') {
      filters.push({ key: 'hasFlags', label: 'Flags', value: 'Has Flags' });
    } else if (hasFlags === 'false') {
      filters.push({ key: 'hasFlags', label: 'Flags', value: 'No Flags' });
    }

    if (hasForm === 'true') {
      filters.push({ key: 'hasForm', label: 'Form', value: 'Has Form' });
    }

    if (hasIbr === 'true') {
      filters.push({ key: 'hasIbr', label: 'IBR', value: 'Has Standards' });
    }

    return filters;
  }, [severity, sectionTypes, complexity, hasFlags, hasForm, hasIbr, severityOptions, sectionTypeOptions]);

  // Handle removing individual filter
  const handleRemoveFilter = useCallback((key: string, value: string) => {
    switch (key) {
      case 'severity': {
        const opt = severityOptions.find((o) => o.label === value);
        if (opt) onSeverityChange(severity.filter((s) => s !== opt.value));
        break;
      }
      case 'sectionType': {
        const opt = sectionTypeOptions.find((o) => o.label === value);
        if (opt) onSectionTypesChange(sectionTypes.filter((t) => t !== opt.value));
        break;
      }
      case 'complexity':
        onComplexityChange(complexity.filter((c) => c !== value));
        break;
      case 'hasFlags':
        onHasFlagsChange(null);
        break;
      case 'hasForm':
        onHasFormChange(null);
        break;
      case 'hasIbr':
        onHasIbrChange(null);
        break;
    }
  }, [
    severity, sectionTypes, complexity,
    severityOptions, sectionTypeOptions,
    onSeverityChange, onSectionTypesChange, onComplexityChange,
    onHasFlagsChange, onHasFormChange, onHasIbrChange,
  ]);

  const activeCount = activeFilters.length;

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--color-neutral-200)]">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[var(--color-text-muted)]" />
          <h2 className="text-sm font-semibold text-[var(--color-text)]">Filters</h2>
          {activeCount > 0 && (
            <span className="px-1.5 py-0.5 text-xs bg-[var(--color-primary)] text-white rounded-full">
              {activeCount}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]"
            aria-label="Close filters"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Active Filters Chips */}
      {activeCount > 0 && (
        <div className="px-4 pt-3">
          <ActiveFilterChips
            filters={activeFilters}
            onRemove={handleRemoveFilter}
            onClearAll={onClearAll}
          />
        </div>
      )}

      {/* Filter Sections */}
      <div className="flex-1 overflow-y-auto p-4">
        <FilterSection title="Severity" count={severity.length}>
          <FilterCheckboxGroup
            options={severityOptions}
            selected={severity}
            onChange={onSeverityChange}
          />
        </FilterSection>

        <FilterSection title="Flags" count={hasFlags ? 1 : 0}>
          <FilterRadioGroup
            options={flagsOptions}
            selected={hasFlags}
            onChange={onHasFlagsChange}
            allowDeselect
          />
        </FilterSection>

        <FilterSection title="Section Type" count={sectionTypes.length} defaultExpanded={false}>
          <FilterCheckboxGroup
            options={sectionTypeOptions}
            selected={sectionTypes}
            onChange={onSectionTypesChange}
            maxVisible={6}
          />
        </FilterSection>

        <FilterSection title="Complexity" count={complexity.length} defaultExpanded={false}>
          <FilterCheckboxGroup
            options={complexityOptions}
            selected={complexity}
            onChange={onComplexityChange}
          />
        </FilterSection>

        <FilterSection title="Metadata" count={(hasForm ? 1 : 0) + (hasIbr ? 1 : 0)} defaultExpanded={false}>
          <div className="space-y-2">
            <FilterRadioGroup
              options={HAS_FORM_FILTER_OPTIONS.filter((opt) => opt.value !== 'all').map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              selected={hasForm}
              onChange={onHasFormChange}
              allowDeselect
            />
            <FilterRadioGroup
              options={HAS_IBR_FILTER_OPTIONS.filter((opt) => opt.value !== 'all').map((opt) => ({
                value: opt.value,
                label: opt.label,
              }))}
              selected={hasIbr}
              onChange={onHasIbrChange}
              allowDeselect
            />
          </div>
        </FilterSection>
      </div>

      {/* Footer */}
      {activeCount > 0 && (
        <div className="p-4 border-t border-[var(--color-neutral-200)]">
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            onClick={onClearAll}
          >
            Clear all filters
          </Button>
        </div>
      )}
    </>
  );

  // Mobile drawer variant
  if (isOpen !== undefined) {
    return (
      <>
        {/* Backdrop */}
        {isOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
        {/* Drawer */}
        <aside
          className={`
            fixed inset-y-0 left-0 z-50 w-[280px] bg-white shadow-lg
            transform transition-transform duration-300 ease-in-out
            lg:relative lg:translate-x-0 lg:shadow-none lg:z-auto
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
            flex flex-col
          `}
        >
          {content}
        </aside>
      </>
    );
  }

  // Desktop static sidebar
  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border border-[var(--color-neutral-200)] rounded-[var(--radius-lg)] flex flex-col max-h-[calc(100vh-200px)] sticky top-4">
      {content}
    </aside>
  );
}
