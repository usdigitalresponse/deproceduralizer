/**
 * Centralized filter options for consistent UI across components.
 *
 * Values are imported from lib/constants/values.ts (single source of truth).
 * This file adds UI labels to create dropdown/select options.
 *
 * These options are used by:
 * - BrowseFilters
 * - ReviewFilters
 * - ComplianceFilters
 * - DataTable
 *
 * Any changes to values should be made in values.ts.
 */

import {
  SEVERITY_VALUES,
  REVIEW_STATUS_VALUES,
  BOOLEAN_FILTER_VALUES,
  FLAG_SORT_BY_VALUES,
  COMPLIANCE_SORT_BY_VALUES,
  DEVELOPER_SORT_BY_VALUES,
  DEFINITIONS_REVIEW_STATUS_VALUES,
  DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES,
  DEFINITION_TYPE_VALUES,
  DEFINITIONS_CROSS_REF_VALUES,
  DEFINITIONS_IN_DEF_SECTION_VALUES,
  DEFINITIONS_SCOPE_RELATION_VALUES,
  DEFINITIONS_SCOPE_MISMATCH_VALUES,
  DEFINITIONS_SORT_BY_VALUES,
  REFERENCE_COMPLETENESS_VALUES,
  REFERENCE_TARGET_VALUES,
} from './values';

// ============================================
// Helper to create filter options from value arrays
// ============================================

type FilterOption = { value: string; label: string };

function createFilterOptions<T extends readonly string[]>(
  values: T,
  labels: Record<T[number], string>
): FilterOption[] {
  return values.map(value => ({
    value,
    label: labels[value as T[number]],
  }));
}

// ============================================
// Severity Options
// ============================================

const SEVERITY_LABELS: Record<(typeof SEVERITY_VALUES)[number], string> = {
  all: 'All Severities',
  high: 'High (7-10)',
  medium: 'Medium (4-6)',
  low: 'Low (1-3)',
};

export const SEVERITY_FILTER_OPTIONS = createFilterOptions(SEVERITY_VALUES, SEVERITY_LABELS);

// Version for table headers with "Not Analyzed" option
export const SEVERITY_TABLE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'high', label: 'High (7-10)' },
  { value: 'medium', label: 'Medium (4-6)' },
  { value: 'low', label: 'Low (1-3)' },
  { value: 'null', label: 'Not Analyzed' },
];

// ============================================
// Review Status Options
// ============================================

const REVIEW_STATUS_LABELS: Record<(typeof REVIEW_STATUS_VALUES)[number], string> = {
  all: 'All Statuses',
  unreviewed: 'Unreviewed',
  confirmed: 'Confirmed',
  rejected_clear_fp: 'Rejected - Clear FP',
  rejected_not_obvious_bad: 'Rejected - Not Obviously Bad',
  needs_context: 'Needs Context',
  deferred: 'Deferred',
};

export const REVIEW_STATUS_FILTER_OPTIONS = createFilterOptions(REVIEW_STATUS_VALUES, REVIEW_STATUS_LABELS);

// ============================================
// Boolean Filter Options
// ============================================

export const ANALYZED_FILTER_OPTIONS = createFilterOptions(BOOLEAN_FILTER_VALUES, {
  all: 'All',
  true: 'Analyzed',
  false: 'Not Analyzed',
});

export const HAS_FLAGS_FILTER_OPTIONS = createFilterOptions(BOOLEAN_FILTER_VALUES, {
  all: 'All',
  true: 'Has Flags',
  false: 'No Flags',
});

export const HAS_DEFINITIONS_FILTER_OPTIONS = createFilterOptions(BOOLEAN_FILTER_VALUES, {
  all: 'All',
  true: 'Has Definitions',
  false: 'No Definitions',
});

export const HAS_COMPLIANCE_FILTER_OPTIONS = createFilterOptions(BOOLEAN_FILTER_VALUES, {
  all: 'All',
  true: 'Has Compliance Issues',
  false: 'No Compliance Issues',
});

export const STATUTE_SOURCE_FILTER_OPTIONS = createFilterOptions(BOOLEAN_FILTER_VALUES, {
  all: 'All Sources',
  true: 'Statute Required',
  false: 'Agency Added',
});

// LLM Requirement Found filter
// Note: requirementFound=false means the regex matched but LLM found nothing of concern.
// Default to 'true' to show only confirmed issues (where LLM verified an actual requirement).
export const REQUIREMENT_FOUND_FILTER_OPTIONS = createFilterOptions(BOOLEAN_FILTER_VALUES, {
  all: 'All',
  true: 'LLM Confirmed',
  false: 'LLM Rejected',
});

// ============================================
// Sort Options
// ============================================

export const REVIEW_SORT_OPTIONS = createFilterOptions(FLAG_SORT_BY_VALUES, {
  severity: 'Severity',
  category: 'Category',
  reviewedAt: 'Last Reviewed',
});

export const COMPLIANCE_SORT_OPTIONS = createFilterOptions(COMPLIANCE_SORT_BY_VALUES, {
  severity: 'Severity',
  createdAt: 'Created',
  issueType: 'Issue Type',
  reviewedAt: 'Last Reviewed',
});

export const DEVELOPER_SORT_OPTIONS = createFilterOptions(DEVELOPER_SORT_BY_VALUES, {
  reviewedAt: 'Last Reviewed',
  developerCheckedAt: 'Developer Checked',
});

// ============================================
// Definitions Review Options
// ============================================

export const DEFINITIONS_REVIEW_STATUS_OPTIONS = createFilterOptions(DEFINITIONS_REVIEW_STATUS_VALUES, {
  all: 'All Statuses',
  unreviewed: 'Unreviewed',
  confirmed: 'Confirmed',
  corrected: 'Corrected',
  false_positive: 'False Positive',
});

export const DEFINITIONS_SCOPE_LEVEL_OPTIONS = createFilterOptions(DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES, {
  all: 'All Scope Levels',
  section: 'Section',
  subpart: 'Subpart',
  part: 'Part',
  subchapter: 'Subchapter',
  chapter: 'Chapter',
  subtitle: 'Subtitle',
  title: 'Title',
});

export const DEFINITIONS_TYPE_OPTIONS = createFilterOptions(DEFINITION_TYPE_VALUES, {
  all: 'All Types',
  formal: 'Formal',
  abbreviation: 'Abbreviation',
});

export const DEFINITIONS_CROSS_REFERENCE_OPTIONS = createFilterOptions(DEFINITIONS_CROSS_REF_VALUES, {
  all: 'All Cross-Ref',
  true: 'Cross-Reference Only',
  false: 'Not Cross-Reference',
});

export const DEFINITIONS_IN_DEF_SECTION_OPTIONS = createFilterOptions(DEFINITIONS_IN_DEF_SECTION_VALUES, {
  all: 'All Sections',
  true: 'In "Definitions" Section',
  false: 'Not in "Definitions" Section',
});

export const DEFINITIONS_SCOPE_RELATION_OPTIONS = createFilterOptions(DEFINITIONS_SCOPE_RELATION_VALUES, {
  all: 'All Scope Relations',
  self: 'Scope = This Section',
  parent: 'Scope = Parent',
});

export const DEFINITIONS_SCOPE_MISMATCH_OPTIONS = createFilterOptions(DEFINITIONS_SCOPE_MISMATCH_VALUES, {
  all: 'All Scope Matches',
  true: 'Scope Mismatch',
  false: 'Scope Matches',
});

export const DEFINITIONS_SORT_OPTIONS = createFilterOptions(DEFINITIONS_SORT_BY_VALUES, {
  document: 'By Document',
  term: 'By Term',
  extractedAt: 'By Date',
});

// Cross-reference categorization options (two dimensions)
export const DEFINITIONS_REFERENCE_COMPLETENESS_OPTIONS = createFilterOptions(REFERENCE_COMPLETENESS_VALUES, {
  all: 'All Completeness',
  pure_pointer: 'Pure Pointer',
  hybrid: 'Hybrid',
});

export const DEFINITIONS_REFERENCE_TARGET_OPTIONS = createFilterOptions(REFERENCE_TARGET_VALUES, {
  all: 'All Targets',
  same_corpus: 'Same Corpus (NJ/NY)',
  federal: 'Federal (CFR/USC)',
  external_standard: 'External Standard',
  other: 'Other',
});
