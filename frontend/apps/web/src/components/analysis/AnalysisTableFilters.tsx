'use client';

import { useCallback, useState } from 'react';
import { useQueryStates } from 'nuqs';
import { Star, Sparkles } from 'lucide-react';
import { Select, FilterBar, FilterField, Badge } from '@/components/ui';
import { analysisTableParsers } from '@/lib/url/parsers';
import type {
  ClassificationFilterValue,
  TierFilterValue,
  FederalMandateFilterValue,
  AnalysisSortByValue,
  BooleanFilterValue,
  PipelineSeverityFilterValue,
  SeverityChangedFilterValue,
  Tier3FindingFilterValue,
  Tier3TriggerFilterValue,
  EasyCleanupFilterValue,
} from '@/lib/constants/values';
import {
  TIER_FILTER_OPTIONS,
  CLASSIFICATION_FILTER_OPTIONS,
  FEDERAL_MANDATE_FILTER_OPTIONS,
  ANALYSIS_SORT_OPTIONS,
  PIPELINE_RUN_FILTER_OPTIONS,
  ISSUE_TYPE_FILTER_OPTIONS,
  PIPELINE_SEVERITY_FILTER_OPTIONS,
  SEVERITY_CHANGED_FILTER_OPTIONS,
  FEDERAL_MANDATE_CONFIRMED_FILTER_OPTIONS,
  STATE_DISCRETION_FILTER_OPTIONS,
  ALTERNATIVE_FOUND_FILTER_OPTIONS,
  EVIDENCE_GAP_FILTER_OPTIONS,
  SUPERSEDED_BY_LAW_FILTER_OPTIONS,
  ADVOCACY_FOR_CHANGE_FILTER_OPTIONS,
  TIER3_TRIGGER_FILTER_OPTIONS,
  EASY_CLEANUP_FILTER_OPTIONS,
} from '@/lib/constants/filters';
import { CLASSIFICATION_COLORS } from '@/lib/constants/pipeline';

// Create classification options with color indicators
const COLORED_CLASSIFICATION_OPTIONS = CLASSIFICATION_FILTER_OPTIONS.map(option => ({
  ...option,
  colorClass: CLASSIFICATION_COLORS[option.value as keyof typeof CLASSIFICATION_COLORS],
}));

export function AnalysisTableFilters() {
  const [filters, setFilters] = useQueryStates(analysisTableParsers, {
    shallow: false,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const clearFilters = useCallback(() => {
    setFilters({
      tierCompleted: 'all',
      classification: 'all',
      federalMandate: 'all',
      pipelineRun: 'all',
      issueType: null,
      severity: 'all',
      severityChanged: 'all',
      federalMandateConfirmed: 'all',
      stateDiscretion: 'all',
      alternativeFound: 'all',
      evidenceGap: 'all',
      supersededByLaw: 'all',
      advocacyForChange: 'all',
      tier3Trigger: 'all',
      easyCleanup: 'all',
      bookmarkedOnly: 'all',
      page: 1,
    });
  }, [setFilters]);

  const isBookmarkedOnly = filters.bookmarkedOnly === 'true';
  const isEasyCleanupOnly = filters.easyCleanup === 'any';

  const hasActiveFilters = Boolean(
    filters.tierCompleted !== 'all' ||
    filters.classification !== 'all' ||
    filters.federalMandate !== 'all' ||
    filters.pipelineRun !== 'all' ||
    filters.issueType ||
    filters.severity !== 'all' ||
    filters.severityChanged !== 'all' ||
    filters.federalMandateConfirmed !== 'all' ||
    filters.stateDiscretion !== 'all' ||
    filters.alternativeFound !== 'all' ||
    filters.evidenceGap !== 'all' ||
    filters.supersededByLaw !== 'all' ||
    filters.advocacyForChange !== 'all' ||
    filters.tier3Trigger !== 'all' ||
    filters.easyCleanup !== 'all' ||
    filters.bookmarkedOnly !== 'all'
  );

  // Count how many advanced filters are active
  const advancedFilterCount = [
    filters.severity !== 'all',
    filters.severityChanged !== 'all',
    filters.federalMandateConfirmed !== 'all',
    filters.stateDiscretion !== 'all',
    filters.alternativeFound !== 'all',
    filters.evidenceGap !== 'all',
    filters.supersededByLaw !== 'all',
    filters.advocacyForChange !== 'all',
    filters.tier3Trigger !== 'all',
    filters.easyCleanup !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <FilterBar
        variant="panel"
        showSortControls
        sortBy={filters.sortBy}
        sortOrder={filters.sortOrder}
        sortOptions={ANALYSIS_SORT_OPTIONS}
        onSortByChange={(value) => setFilters({ sortBy: value as AnalysisSortByValue, page: 1 })}
        onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      >
        <FilterField label="Tier">
          <Select
            value={filters.tierCompleted}
            onValueChange={(value) => setFilters({ tierCompleted: value as TierFilterValue, page: 1 })}
            options={TIER_FILTER_OPTIONS}
            aria-label="Filter by tier completed"
          />
        </FilterField>

        <FilterField label="Classification">
          <Select
            value={filters.classification}
            onValueChange={(value) => setFilters({ classification: value as ClassificationFilterValue, page: 1 })}
            options={COLORED_CLASSIFICATION_OPTIONS}
            aria-label="Filter by classification"
            renderOption={(option) => {
              const colorClass = CLASSIFICATION_COLORS[option.value as keyof typeof CLASSIFICATION_COLORS];
              if (!colorClass || option.value === 'all') {
                return <span>{option.label}</span>;
              }
              return (
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${colorClass.bg} border ${colorClass.border}`} />
                  {option.label}
                </span>
              );
            }}
          />
        </FilterField>

        <FilterField label="Issue Type">
          <Select
            value={filters.issueType || 'all'}
            onValueChange={(value) => setFilters({ issueType: value === 'all' ? null : value, page: 1 })}
            options={ISSUE_TYPE_FILTER_OPTIONS}
            aria-label="Filter by issue type"
          />
        </FilterField>

        <FilterField label="Severity">
          <Select
            value={filters.severity}
            onValueChange={(value) => setFilters({ severity: value as PipelineSeverityFilterValue, page: 1 })}
            options={PIPELINE_SEVERITY_FILTER_OPTIONS}
            aria-label="Filter by severity"
          />
        </FilterField>

        <FilterField label="Federal Mandate">
          <Select
            value={filters.federalMandate}
            onValueChange={(value) => setFilters({ federalMandate: value as FederalMandateFilterValue, page: 1 })}
            options={FEDERAL_MANDATE_FILTER_OPTIONS}
            aria-label="Filter by federal mandate"
          />
        </FilterField>

        <FilterField label="Pipeline">
          <Select
            value={filters.pipelineRun}
            onValueChange={(value) => setFilters({ pipelineRun: value as BooleanFilterValue, page: 1 })}
            options={PIPELINE_RUN_FILTER_OPTIONS}
            aria-label="Filter by pipeline run status"
          />
        </FilterField>
      </FilterBar>

      {/* Quick filters row */}
      <div className="flex items-center gap-4">
        {/* Bookmarked Only Toggle */}
        <button
          type="button"
          onClick={() => setFilters({
            bookmarkedOnly: isBookmarkedOnly ? 'all' : 'true',
            page: 1,
          })}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)]
            text-xs font-medium transition-colors
            ${isBookmarkedOnly
              ? 'bg-[var(--color-warning)] text-white'
              : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]'
            }
          `}
          aria-pressed={isBookmarkedOnly}
        >
          <Star className="w-3.5 h-3.5" fill={isBookmarkedOnly ? 'currentColor' : 'none'} />
          Bookmarked
        </button>

        {/* Easy Cleanup Toggle */}
        <button
          type="button"
          onClick={() => setFilters({
            easyCleanup: isEasyCleanupOnly ? 'all' : 'any',
            page: 1,
          })}
          className={`
            inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)]
            text-xs font-medium transition-colors
            ${isEasyCleanupOnly
              ? 'bg-[var(--color-success)] text-white'
              : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]'
            }
          `}
          aria-pressed={isEasyCleanupOnly}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Easy Fix
        </button>

        {/* Advanced Tier 3 Filters Toggle */}
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-[var(--color-primary)] hover:underline flex items-center gap-1"
        >
          {showAdvanced ? '▼' : '▶'} Tier 3 Filters
          {advancedFilterCount > 0 && (
            <Badge variant="info" className="text-xs ml-1">
              {advancedFilterCount}
            </Badge>
          )}
        </button>
      </div>

      {/* Advanced Tier 3 Filters */}
      {showAdvanced && (
        <div className="bg-[var(--color-neutral-50)] border border-[var(--color-neutral-200)] rounded-[var(--radius-sm)] p-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <FilterField label="T3 Trigger">
              <Select
                value={filters.tier3Trigger}
                onValueChange={(value) => setFilters({ tier3Trigger: value as Tier3TriggerFilterValue, page: 1 })}
                options={TIER3_TRIGGER_FILTER_OPTIONS}
                aria-label="Filter by Tier 3 trigger"
              />
            </FilterField>

            <FilterField label="Sev. Changed">
              <Select
                value={filters.severityChanged}
                onValueChange={(value) => setFilters({ severityChanged: value as SeverityChangedFilterValue, page: 1 })}
                options={SEVERITY_CHANGED_FILTER_OPTIONS}
                aria-label="Filter by severity changed"
              />
            </FilterField>

            <FilterField label="Fed. Mandate (T3)">
              <Select
                value={filters.federalMandateConfirmed}
                onValueChange={(value) => setFilters({ federalMandateConfirmed: value as Tier3FindingFilterValue, page: 1 })}
                options={FEDERAL_MANDATE_CONFIRMED_FILTER_OPTIONS}
                aria-label="Filter by federal mandate confirmed"
              />
            </FilterField>

            <FilterField label="State Discretion">
              <Select
                value={filters.stateDiscretion}
                onValueChange={(value) => setFilters({ stateDiscretion: value as Tier3FindingFilterValue, page: 1 })}
                options={STATE_DISCRETION_FILTER_OPTIONS}
                aria-label="Filter by state discretion"
              />
            </FilterField>

            <FilterField label="Alt. Found">
              <Select
                value={filters.alternativeFound}
                onValueChange={(value) => setFilters({ alternativeFound: value as Tier3FindingFilterValue, page: 1 })}
                options={ALTERNATIVE_FOUND_FILTER_OPTIONS}
                aria-label="Filter by alternative found"
              />
            </FilterField>

            <FilterField label="Evidence Gap">
              <Select
                value={filters.evidenceGap}
                onValueChange={(value) => setFilters({ evidenceGap: value as Tier3FindingFilterValue, page: 1 })}
                options={EVIDENCE_GAP_FILTER_OPTIONS}
                aria-label="Filter by evidence gap"
              />
            </FilterField>

            <FilterField label="Superseded">
              <Select
                value={filters.supersededByLaw}
                onValueChange={(value) => setFilters({ supersededByLaw: value as Tier3FindingFilterValue, page: 1 })}
                options={SUPERSEDED_BY_LAW_FILTER_OPTIONS}
                aria-label="Filter by superseded by law"
              />
            </FilterField>

            <FilterField label="Advocacy">
              <Select
                value={filters.advocacyForChange}
                onValueChange={(value) => setFilters({ advocacyForChange: value as Tier3FindingFilterValue, page: 1 })}
                options={ADVOCACY_FOR_CHANGE_FILTER_OPTIONS}
                aria-label="Filter by advocacy for change"
              />
            </FilterField>

            <FilterField label="Easy Cleanup">
              <Select
                value={filters.easyCleanup}
                onValueChange={(value) => setFilters({ easyCleanup: value as EasyCleanupFilterValue, page: 1 })}
                options={EASY_CLEANUP_FILTER_OPTIONS}
                aria-label="Filter by easy cleanup"
              />
            </FilterField>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalysisTableFilters;
