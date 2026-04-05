'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQueryStates } from 'nuqs';
import { Bookmark, Sparkles, Tag } from 'lucide-react';
import type { MarkerGroup } from '@deproceduralizer/database';
import { MultiSelect, FilterField } from '@/components/ui';
import { TieredFilterBar } from '@/components/ui/FilterBar';
import { analysisTableParsers } from '@/lib/url/parsers';
import { parseCommaSeparated, serializeCommaSeparated } from '@/lib/url/filter-helpers';
import { getMarkerGroups } from '@/lib/actions/marker-groups';
import type {
  AnalysisSortByValue,
} from '@/lib/constants/values';
import {
  TIER_FILTER_OPTIONS,
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
  CLASSIFICATION_FILTER_OPTIONS,
  toMultiSelectOptions,
} from '@/lib/constants/filters';
import type { AnalysisFilterStats } from '@/lib/actions/analysis';

interface AnalysisTableFiltersProps {
  jurisdiction?: string;
  filterStats?: AnalysisFilterStats;
}

export function AnalysisTableFilters({ jurisdiction, filterStats }: AnalysisTableFiltersProps) {
  const [filters, setFilters] = useQueryStates(analysisTableParsers, {
    shallow: false,
  });

  const [markerGroupsList, setMarkerGroupsList] = useState<MarkerGroup[]>([]);

  // Fetch marker groups for the filter dropdown
  useEffect(() => {
    if (!jurisdiction) return;
    getMarkerGroups(jurisdiction).then(result => {
      if (result.success) setMarkerGroupsList(result.data);
    });
  }, [jurisdiction]);

  const selectedMarkerIds = filters.marker ? parseCommaSeparated(filters.marker) : [];

  // On first load, apply default classification if no URL param is set
  const didApplyDefaults = useRef(false);
  useEffect(() => {
    if (!didApplyDefaults.current && filters.classification === null) {
      didApplyDefaults.current = true;
      setFilters({ classification: 'burdensome,justified,needs_research' });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const clearFilters = useCallback(() => {
    setFilters({
      tierCompleted: null,
      classification: 'burdensome,justified,needs_research',
      federalMandate: null,
      pipelineRun: null,
      issueType: null,
      severity: null,
      severityChanged: null,
      federalMandateConfirmed: null,
      stateDiscretion: null,
      alternativeFound: null,
      evidenceGap: null,
      supersededByLaw: null,
      advocacyForChange: null,
      tier3Trigger: null,
      easyCleanup: null,
      bookmarkedOnly: null,
      marker: null,
      page: 1,
    });
  }, [setFilters]);

  // Build filter options with counts from stats
  const classificationOptions = useMemo(() => {
    const countMap = new Map(filterStats?.byClassification?.map(d => [d.classification, d.count]) ?? []);
    return toMultiSelectOptions(CLASSIFICATION_FILTER_OPTIONS).map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [filterStats?.byClassification]);

  const tierOptions = useMemo(() => {
    const countMap = new Map(filterStats?.byTier?.map(d => [String(d.tier), d.count]) ?? []);
    return toMultiSelectOptions(TIER_FILTER_OPTIONS).map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [filterStats?.byTier]);

  const severityOptions = useMemo(() => {
    const countMap = new Map(filterStats?.bySeverity?.map(d => [d.severity, d.count]) ?? []);
    return toMultiSelectOptions(PIPELINE_SEVERITY_FILTER_OPTIONS).map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [filterStats?.bySeverity]);

  const issueTypeOptions = useMemo(() => {
    const countMap = new Map(filterStats?.byIssueType?.map(d => [d.issueType, d.count]) ?? []);
    return toMultiSelectOptions(ISSUE_TYPE_FILTER_OPTIONS).map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [filterStats?.byIssueType]);

  const federalMandateOptions = useMemo(() => {
    const countMap = new Map(filterStats?.byFederalMandate?.map(d => [d.federalMandate, d.count]) ?? []);
    return toMultiSelectOptions(FEDERAL_MANDATE_FILTER_OPTIONS).map(opt => ({
      ...opt,
      count: countMap.get(opt.value),
    }));
  }, [filterStats?.byFederalMandate]);

  const isBookmarkedOnly = filters.bookmarkedOnly === 'true';
  const isEasyCleanupOnly = parseCommaSeparated(filters.easyCleanup).includes('any');

  const hasActiveFilters = Boolean(
    filters.tierCompleted ||
    (filters.classification && filters.classification !== 'burdensome,justified,needs_research') ||
    filters.federalMandate ||
    filters.pipelineRun ||
    filters.issueType ||
    filters.severity ||
    filters.severityChanged ||
    filters.federalMandateConfirmed ||
    filters.stateDiscretion ||
    filters.alternativeFound ||
    filters.evidenceGap ||
    filters.supersededByLaw ||
    filters.advocacyForChange ||
    filters.tier3Trigger ||
    filters.easyCleanup ||
    filters.bookmarkedOnly ||
    filters.marker
  );

  // Count how many advanced filters are active
  const advancedFilterCount = [
    filters.severityChanged,
    filters.federalMandateConfirmed,
    filters.stateDiscretion,
    filters.alternativeFound,
    filters.evidenceGap,
    filters.supersededByLaw,
    filters.advocacyForChange,
    filters.tier3Trigger,
    filters.easyCleanup,
  ].filter(Boolean).length;

  const clearTier3Filters = useCallback(() => {
    setFilters({
      severityChanged: null,
      federalMandateConfirmed: null,
      stateDiscretion: null,
      alternativeFound: null,
      evidenceGap: null,
      supersededByLaw: null,
      advocacyForChange: null,
      tier3Trigger: null,
      easyCleanup: null,
      page: 1,
    });
  }, [setFilters]);

  return (
    <TieredFilterBar
      variant="panel"
      showSortControls
      sortBy={filters.sortBy}
      sortOrder={filters.sortOrder}
      sortOptions={ANALYSIS_SORT_OPTIONS}
      onSortByChange={(value) => setFilters({ sortBy: value as AnalysisSortByValue, page: 1 })}
      onSortOrderToggle={() => setFilters({ sortOrder: filters.sortOrder === 'desc' ? 'asc' : 'desc', page: 1 })}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={clearFilters}
      clearFiltersLabel="Reset Filters"
      advancedLabel="Tier 3 Filters"
      advancedCount={advancedFilterCount}
      onClearAdvanced={clearTier3Filters}
      primaryFilters={
        <>
          <FilterField label="Tier">
            <MultiSelect
              label="Tier"
              value={parseCommaSeparated(filters.tierCompleted)}
              onChange={(values) => setFilters({ tierCompleted: serializeCommaSeparated(values), page: 1 })}
              options={tierOptions}
            />
          </FilterField>

          <FilterField label="Classification">
            <MultiSelect
              label="Classification"
              value={parseCommaSeparated(filters.classification)}
              onChange={(values) => setFilters({ classification: serializeCommaSeparated(values), page: 1 })}
              options={classificationOptions}
            />
          </FilterField>

          <FilterField label="Issue Type">
            <MultiSelect
              label="Issue Type"
              value={parseCommaSeparated(filters.issueType)}
              onChange={(values) => setFilters({ issueType: serializeCommaSeparated(values), page: 1 })}
              options={issueTypeOptions}
              searchable
            />
          </FilterField>

          <FilterField label="Severity">
            <MultiSelect
              label="Severity"
              value={parseCommaSeparated(filters.severity)}
              onChange={(values) => setFilters({ severity: serializeCommaSeparated(values), page: 1 })}
              options={severityOptions}
            />
          </FilterField>

          <FilterField label="Federal Mandate">
            <MultiSelect
              label="Federal Mandate"
              value={parseCommaSeparated(filters.federalMandate)}
              onChange={(values) => setFilters({ federalMandate: serializeCommaSeparated(values), page: 1 })}
              options={federalMandateOptions}
            />
          </FilterField>

          <FilterField label="Pipeline">
            <MultiSelect
              label="Pipeline"
              value={parseCommaSeparated(filters.pipelineRun)}
              onChange={(values) => setFilters({ pipelineRun: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(PIPELINE_RUN_FILTER_OPTIONS)}
            />
          </FilterField>
        </>
      }
      quickToggles={
        <>
          <button
            type="button"
            onClick={() => setFilters({
              bookmarkedOnly: isBookmarkedOnly ? null : 'true',
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
            <Bookmark className="w-3.5 h-3.5" fill={isBookmarkedOnly ? 'currentColor' : 'none'} />
            Saved
          </button>

          <button
            type="button"
            onClick={() => setFilters({
              easyCleanup: isEasyCleanupOnly ? null : 'any',
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

          {markerGroupsList.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
              <MultiSelect
                label="Labels"
                value={selectedMarkerIds}
                onChange={(values: string[]) => setFilters({
                  marker: values.length > 0 ? serializeCommaSeparated(values) : null,
                  page: 1,
                })}
                options={markerGroupsList.map(g => ({ value: String(g.id), label: g.name }))}
                placeholder="All"
                className="min-w-[120px]"
              />
            </div>
          )}
        </>
      }
      advancedFilters={
        <>
          <FilterField label="T3 Trigger">
            <MultiSelect
              label="T3 Trigger"
              value={parseCommaSeparated(filters.tier3Trigger)}
              onChange={(values) => setFilters({ tier3Trigger: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(TIER3_TRIGGER_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Sev. Changed">
            <MultiSelect
              label="Sev. Changed"
              value={parseCommaSeparated(filters.severityChanged)}
              onChange={(values) => setFilters({ severityChanged: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(SEVERITY_CHANGED_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Fed. Mandate (T3)">
            <MultiSelect
              label="Fed. Mandate (T3)"
              value={parseCommaSeparated(filters.federalMandateConfirmed)}
              onChange={(values) => setFilters({ federalMandateConfirmed: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(FEDERAL_MANDATE_CONFIRMED_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="State Discretion">
            <MultiSelect
              label="State Discretion"
              value={parseCommaSeparated(filters.stateDiscretion)}
              onChange={(values) => setFilters({ stateDiscretion: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(STATE_DISCRETION_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Alt. Found">
            <MultiSelect
              label="Alt. Found"
              value={parseCommaSeparated(filters.alternativeFound)}
              onChange={(values) => setFilters({ alternativeFound: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(ALTERNATIVE_FOUND_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Evidence Gap">
            <MultiSelect
              label="Evidence Gap"
              value={parseCommaSeparated(filters.evidenceGap)}
              onChange={(values) => setFilters({ evidenceGap: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(EVIDENCE_GAP_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Superseded">
            <MultiSelect
              label="Superseded"
              value={parseCommaSeparated(filters.supersededByLaw)}
              onChange={(values) => setFilters({ supersededByLaw: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(SUPERSEDED_BY_LAW_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Advocacy">
            <MultiSelect
              label="Advocacy"
              value={parseCommaSeparated(filters.advocacyForChange)}
              onChange={(values) => setFilters({ advocacyForChange: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(ADVOCACY_FOR_CHANGE_FILTER_OPTIONS)}
            />
          </FilterField>

          <FilterField label="Easy Cleanup">
            <MultiSelect
              label="Easy Cleanup"
              value={parseCommaSeparated(filters.easyCleanup)}
              onChange={(values) => setFilters({ easyCleanup: serializeCommaSeparated(values), page: 1 })}
              options={toMultiSelectOptions(EASY_CLEANUP_FILTER_OPTIONS)}
            />
          </FilterField>
        </>
      }
    />
  );
}

export default AnalysisTableFilters;
