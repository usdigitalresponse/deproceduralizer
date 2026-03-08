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
  RED_FLAG_DEVELOPER_SORT_BY_VALUES,
  COMPLIANCE_DEVELOPER_SORT_BY_VALUES,
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
  TIER_FILTER_VALUES,
  FEDERAL_MANDATE_FILTER_VALUES,
  HAS_ANALYSIS_FILTER_VALUES,
  CLASSIFICATION_FILTER_VALUES,
  ANALYSIS_SORT_BY_VALUES,
  PIPELINE_SEVERITY_FILTER_VALUES,
  SEVERITY_CHANGED_FILTER_VALUES,
  TIER3_FINDING_FILTER_VALUES,
  TIER3_TRIGGER_FILTER_VALUES,
  EASY_CLEANUP_FILTER_VALUES,
  COMPLIANCE_SOURCE_VALUES,
  JENAI_SOURCE_VALUES,
  JENAI_REVIEW_SORT_BY_VALUES,
  JENAI_DEVELOPER_SORT_BY_VALUES,
} from './values';
import { ISSUE_TYPE_LABELS } from '@/types/regulation';

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

// Version for table headers with "No Red Flag Rating" option
export const SEVERITY_TABLE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'high', label: 'High (7-10)' },
  { value: 'medium', label: 'Medium (4-6)' },
  { value: 'low', label: 'Low (1-3)' },
  { value: 'null', label: 'No Red Flag Rating' },
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
  true: 'Has Red Flag Analysis',
  false: 'No Red Flag Analysis',
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

// Compliance source filter (regulation vs guidance)
export const COMPLIANCE_SOURCE_FILTER_OPTIONS = createFilterOptions(COMPLIANCE_SOURCE_VALUES, {
  all: 'All Sources',
  regulation: 'Regulations',
  guidance: 'Guidance',
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
  createdAt: 'Date Created',
  issueType: 'Issue Type',
  reviewedAt: 'Last Reviewed',
});

export const DEVELOPER_SORT_OPTIONS = createFilterOptions(DEVELOPER_SORT_BY_VALUES, {
  reviewedAt: 'Review Date',
  developerCheckedAt: 'Last Updated',
});

export const RED_FLAG_DEVELOPER_SORT_OPTIONS = createFilterOptions(RED_FLAG_DEVELOPER_SORT_BY_VALUES, {
  severity: 'Severity',
  category: 'Category',
  reviewedAt: 'Review Date',
  developerCheckedAt: 'Last Updated',
});

export const COMPLIANCE_DEVELOPER_SORT_OPTIONS = createFilterOptions(COMPLIANCE_DEVELOPER_SORT_BY_VALUES, {
  severity: 'Severity',
  issueType: 'Issue Type',
  reviewedAt: 'Review Date',
  developerCheckedAt: 'Last Updated',
});

// ============================================
// JenAI Filter Options
// ============================================

export const JENAI_SOURCE_FILTER_OPTIONS = createFilterOptions(JENAI_SOURCE_VALUES, {
  all: 'All Sources',
  regulation: 'Regulations',
  guidance: 'Guidance',
});

export const JENAI_REVIEW_SORT_OPTIONS = createFilterOptions(JENAI_REVIEW_SORT_BY_VALUES, {
  severity: 'Severity',
  confidence: 'Confidence',
  category: 'Category',
  reviewedAt: 'Last Reviewed',
});

export const JENAI_DEVELOPER_SORT_OPTIONS = createFilterOptions(JENAI_DEVELOPER_SORT_BY_VALUES, {
  severity: 'Severity',
  confidence: 'Confidence',
  category: 'Category',
  reviewedAt: 'Review Date',
  developerCheckedAt: 'Last Updated',
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

// ============================================
// Section Type Options (AI-generated metadata)
// ============================================

export const SECTION_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'definitions', label: 'Definitions' },
  { value: 'requirements', label: 'Requirements' },
  { value: 'procedures', label: 'Procedures' },
  { value: 'prohibitions', label: 'Prohibitions' },
  { value: 'standards', label: 'Standards' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'penalties', label: 'Penalties' },
  { value: 'fees', label: 'Fees' },
  { value: 'forms', label: 'Forms' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'purpose', label: 'Purpose' },
  { value: 'scope', label: 'Scope' },
  { value: 'exemptions', label: 'Exemptions' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'other', label: 'Other' },
] as const;

// Metadata boolean filters (for has_form and has_ibr)
export const METADATA_FLAG_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
] as const;

export const HAS_FORM_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Form Reference' },
] as const;

export const HAS_IBR_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has External Standards (IBR)' },
] as const;

// ============================================
// Analysis Tier Options (Research Pipeline)
// ============================================

const TIER_FILTER_LABELS: Record<(typeof TIER_FILTER_VALUES)[number], string> = {
  all: 'All Tiers',
  '0': 'Unprocessed',
  '1': 'Tier 1 (Match Filtering)',
  '2': 'Tier 2 (Full Classification)',
  '3': 'Tier 3 (Web Search)',
};

export const TIER_FILTER_OPTIONS = createFilterOptions(TIER_FILTER_VALUES, TIER_FILTER_LABELS);

const FEDERAL_MANDATE_LABELS: Record<(typeof FEDERAL_MANDATE_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Federal Mandate Found',
  false: 'No Federal Mandate',
};

export const FEDERAL_MANDATE_FILTER_OPTIONS = createFilterOptions(FEDERAL_MANDATE_FILTER_VALUES, FEDERAL_MANDATE_LABELS);

const HAS_ANALYSIS_LABELS: Record<(typeof HAS_ANALYSIS_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Has Pipeline Analysis',
  false: 'No Pipeline Analysis',
};

export const HAS_ANALYSIS_FILTER_OPTIONS = createFilterOptions(HAS_ANALYSIS_FILTER_VALUES, HAS_ANALYSIS_LABELS);

// Classification filter options (alphabetized after 'all')
const CLASSIFICATION_LABELS: Record<(typeof CLASSIFICATION_FILTER_VALUES)[number], string> = {
  all: 'All Classifications',
  all_false_positives: 'False Positives',
  burdensome: 'Burdensome',
  justified: 'Justified',
  needs_research: 'Needs Research',
  unrelated: 'Unrelated',
};

export const CLASSIFICATION_FILTER_OPTIONS = createFilterOptions(CLASSIFICATION_FILTER_VALUES, CLASSIFICATION_LABELS);

// Sort options for analysis table
const ANALYSIS_SORT_LABELS: Record<(typeof ANALYSIS_SORT_BY_VALUES)[number], string> = {
  createdAt: 'Date Created',
  severity: 'Severity',
  issueType: 'Issue Type',
  highestTier: 'Highest Tier',
};

export const ANALYSIS_SORT_OPTIONS = createFilterOptions(ANALYSIS_SORT_BY_VALUES, ANALYSIS_SORT_LABELS);

// Pipeline run filter (whether the research pipeline has actually processed the item)
export const PIPELINE_RUN_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Pipeline Run' },
  { value: 'false', label: 'Not Run' },
];

// ============================================
// Issue Type Options (alphabetized by label)
// ============================================

// Generate issue type options sorted alphabetically by label
export const ISSUE_TYPE_FILTER_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All Issue Types' },
  ...Object.entries(ISSUE_TYPE_LABELS)
    .sort(([, a], [, b]) => a.localeCompare(b))
    .map(([value, label]) => ({ value, label })),
];

// ============================================
// Tier 3 Analysis Filters (V5 Pipeline)
// ============================================

// Pipeline severity filter (includes 'none' for null values)
const PIPELINE_SEVERITY_LABELS: Record<(typeof PIPELINE_SEVERITY_FILTER_VALUES)[number], string> = {
  all: 'All Severities',
  high: 'High (7-10)',
  medium: 'Medium (4-6)',
  low: 'Low (1-3)',
  none: 'No Severity',
};

export const PIPELINE_SEVERITY_FILTER_OPTIONS = createFilterOptions(
  PIPELINE_SEVERITY_FILTER_VALUES,
  PIPELINE_SEVERITY_LABELS
);

// Severity changed filter (Tier 3 adjustment)
const SEVERITY_CHANGED_LABELS: Record<(typeof SEVERITY_CHANGED_FILTER_VALUES)[number], string> = {
  all: 'All',
  increased: 'Severity Increased',
  decreased: 'Severity Decreased',
  unchanged: 'No Change',
  no_tier3: 'No Tier 3',
};

export const SEVERITY_CHANGED_FILTER_OPTIONS = createFilterOptions(
  SEVERITY_CHANGED_FILTER_VALUES,
  SEVERITY_CHANGED_LABELS
);

// Federal mandate confirmed filter (Tier 3 flag)
const FEDERAL_MANDATE_CONFIRMED_LABELS: Record<(typeof TIER3_FINDING_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Mandate Confirmed',
  false: 'No Mandate',
  no_tier3: 'No Tier 3',
};

export const FEDERAL_MANDATE_CONFIRMED_FILTER_OPTIONS = createFilterOptions(
  TIER3_FINDING_FILTER_VALUES,
  FEDERAL_MANDATE_CONFIRMED_LABELS
);

// State discretion filter (Tier 3 flag)
const STATE_DISCRETION_LABELS: Record<(typeof TIER3_FINDING_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Has Discretion',
  false: 'No Discretion',
  no_tier3: 'No Tier 3',
};

export const STATE_DISCRETION_FILTER_OPTIONS = createFilterOptions(
  TIER3_FINDING_FILTER_VALUES,
  STATE_DISCRETION_LABELS
);

// Alternative found filter (Tier 3 flag)
const ALTERNATIVE_FOUND_LABELS: Record<(typeof TIER3_FINDING_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Alternative Found',
  false: 'No Alternative',
  no_tier3: 'No Tier 3',
};

export const ALTERNATIVE_FOUND_FILTER_OPTIONS = createFilterOptions(
  TIER3_FINDING_FILTER_VALUES,
  ALTERNATIVE_FOUND_LABELS
);

// Evidence gap filter (Tier 3 flag)
const EVIDENCE_GAP_LABELS: Record<(typeof TIER3_FINDING_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Evidence Gap',
  false: 'Evidence Found',
  no_tier3: 'No Tier 3',
};

export const EVIDENCE_GAP_FILTER_OPTIONS = createFilterOptions(
  TIER3_FINDING_FILTER_VALUES,
  EVIDENCE_GAP_LABELS
);

// Tier 3 trigger filter (based on routing.py triggers)
const TIER3_TRIGGER_LABELS: Record<(typeof TIER3_TRIGGER_FILTER_VALUES)[number], string> = {
  all: 'All',
  high_risk_issue: 'High-Risk Issue Type',
  federal_citation: 'Federal Citation',
  no_alternative: 'No Alternative Claim',
  high_severity: 'High Severity (≥8)',
  controversial: 'Controversial Justified',
  mandate_suspected: 'Mandate Suspected',
  not_triggered: 'Not Triggered',
};

export const TIER3_TRIGGER_FILTER_OPTIONS = createFilterOptions(
  TIER3_TRIGGER_FILTER_VALUES,
  TIER3_TRIGGER_LABELS
);

// V5.1: Easy cleanup filter (for quick cleanup opportunities)
const EASY_CLEANUP_LABELS: Record<(typeof EASY_CLEANUP_FILTER_VALUES)[number], string> = {
  all: 'All',
  any: 'Any Easy Fix',
  trivial: '🎯 Trivial',
  easy: '✨ Easy',
  medium: '📋 Medium',
};

export const EASY_CLEANUP_FILTER_OPTIONS = createFilterOptions(
  EASY_CLEANUP_FILTER_VALUES,
  EASY_CLEANUP_LABELS
);

// Superseded by law filter (Tier 3 flag - new law has replaced this requirement)
const SUPERSEDED_BY_LAW_LABELS: Record<(typeof TIER3_FINDING_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Superseded',
  false: 'Not Superseded',
  no_tier3: 'No Tier 3',
};

export const SUPERSEDED_BY_LAW_FILTER_OPTIONS = createFilterOptions(
  TIER3_FINDING_FILTER_VALUES,
  SUPERSEDED_BY_LAW_LABELS
);

// Advocacy for change filter (Tier 3 flag - journalism/advocacy calling for change)
const ADVOCACY_FOR_CHANGE_LABELS: Record<(typeof TIER3_FINDING_FILTER_VALUES)[number], string> = {
  all: 'All',
  true: 'Advocacy Found',
  false: 'No Advocacy',
  no_tier3: 'No Tier 3',
};

export const ADVOCACY_FOR_CHANGE_FILTER_OPTIONS = createFilterOptions(
  TIER3_FINDING_FILTER_VALUES,
  ADVOCACY_FOR_CHANGE_LABELS
);

// ============================================
// Search Page Filter Options
// ============================================

export const SEARCH_DOC_TYPE_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All types' },
  { value: 'regulation', label: 'Regulations' },
  { value: 'statute', label: 'Statutes' },
  { value: 'guidance', label: 'Guidance' },
];

export const SEARCH_ANALYSIS_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Red Flag Analysis' },
  { value: 'false', label: 'No Red Flag Analysis' },
];

export const SEARCH_CLASSIFICATION_OPTIONS: FilterOption[] = [
  { value: 'all', label: 'All' },
  { value: 'burdensome', label: 'Burdensome' },
  { value: 'justified', label: 'Justified' },
  { value: 'unrelated', label: 'Unrelated' },
];
