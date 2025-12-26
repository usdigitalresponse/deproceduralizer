/**
 * Centralized filter options for consistent UI across components.
 *
 * These options are used by:
 * - BrowseFilters
 * - ReviewFilters
 * - ComplianceFilters
 * - DataTable
 *
 * Any changes here will be reflected across all filter UIs.
 */

// ============================================
// Severity Options
// ============================================

export const SEVERITY_FILTER_OPTIONS = [
  { value: 'all', label: 'All Severities' },
  { value: 'high', label: 'High (7-10)' },
  { value: 'medium', label: 'Medium (4-6)' },
  { value: 'low', label: 'Low (1-3)' },
];

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

export const REVIEW_STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'rejected_clear_fp', label: 'Rejected - Clear FP' },
  { value: 'rejected_not_obvious_bad', label: 'Rejected - Not Obviously Bad' },
  { value: 'needs_context', label: 'Needs Context' },
  { value: 'deferred', label: 'Deferred' },
];

// ============================================
// Boolean Filter Options
// ============================================

export const ANALYZED_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Analyzed' },
  { value: 'false', label: 'Not Analyzed' },
];

export const HAS_FLAGS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Flags' },
  { value: 'false', label: 'No Flags' },
];

export const HAS_DEFINITIONS_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Definitions' },
  { value: 'false', label: 'No Definitions' },
];

export const HAS_COMPLIANCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'Has Compliance Issues' },
  { value: 'false', label: 'No Compliance Issues' },
];

export const STATUTE_SOURCE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'true', label: 'Statute Required' },
  { value: 'false', label: 'Agency Added' },
];

// LLM Requirement Found filter
// Note: requirementFound=false means the regex matched but LLM found nothing of concern.
// Default to 'true' to show only confirmed issues (where LLM verified an actual requirement).
export const REQUIREMENT_FOUND_FILTER_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'true', label: 'LLM Confirmed' },
  { value: 'false', label: 'LLM Rejected' },
];

// ============================================
// Sort Options
// ============================================

export const REVIEW_SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'category', label: 'Category' },
  { value: 'reviewedAt', label: 'Last Reviewed' },
];

export const COMPLIANCE_SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'createdAt', label: 'Created' },
  { value: 'issueType', label: 'Issue Type' },
  { value: 'reviewedAt', label: 'Last Reviewed' },
];

export const DEVELOPER_SORT_OPTIONS = [
  { value: 'reviewedAt', label: 'Last Reviewed' },
  { value: 'developerCheckedAt', label: 'Developer Checked' },
];

// ============================================
// Definitions Review Options
// ============================================

export const DEFINITIONS_REVIEW_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'corrected', label: 'Corrected' },
  { value: 'false_positive', label: 'False Positive' },
];

export const DEFINITIONS_SCOPE_LEVEL_OPTIONS = [
  { value: 'all', label: 'All Scope Levels' },
  { value: 'section', label: 'Section' },
  { value: 'subpart', label: 'Subpart' },
  { value: 'part', label: 'Part' },
  { value: 'subchapter', label: 'Subchapter' },
  { value: 'chapter', label: 'Chapter' },
  { value: 'subtitle', label: 'Subtitle' },
  { value: 'title', label: 'Title' },
];

export const DEFINITIONS_TYPE_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'formal', label: 'Formal' },
  { value: 'abbreviation', label: 'Abbreviation' },
];

export const DEFINITIONS_CROSS_REFERENCE_OPTIONS = [
  { value: 'all', label: 'All Cross-Ref' },
  { value: 'true', label: 'Cross-Reference Only' },
  { value: 'false', label: 'Not Cross-Reference' },
];

export const DEFINITIONS_IN_DEF_SECTION_OPTIONS = [
  { value: 'all', label: 'All Sections' },
  { value: 'true', label: 'In "Definitions" Section' },
  { value: 'false', label: 'Not in "Definitions" Section' },
];

export const DEFINITIONS_SCOPE_RELATION_OPTIONS = [
  { value: 'all', label: 'All Scope Relations' },
  { value: 'self', label: 'Scope = This Section' },
  { value: 'parent', label: 'Scope = Parent' },
];

export const DEFINITIONS_SCOPE_MISMATCH_OPTIONS = [
  { value: 'all', label: 'All Scope Matches' },
  { value: 'true', label: 'Scope Mismatch' },
  { value: 'false', label: 'Scope Matches' },
];

export const DEFINITIONS_SORT_OPTIONS = [
  { value: 'document', label: 'By Document' },
  { value: 'term', label: 'By Term' },
  { value: 'extractedAt', label: 'By Date' },
];

// Cross-reference categorization options (two dimensions)
export const DEFINITIONS_REFERENCE_COMPLETENESS_OPTIONS = [
  { value: 'all', label: 'All Completeness' },
  { value: 'pure_pointer', label: 'Pure Pointer' },
  { value: 'hybrid', label: 'Hybrid' },
];

export const DEFINITIONS_REFERENCE_TARGET_OPTIONS = [
  { value: 'all', label: 'All Targets' },
  { value: 'same_corpus', label: 'Same Corpus (NJ/NY)' },
  { value: 'federal', label: 'Federal (CFR/USC)' },
  { value: 'external_standard', label: 'External Standard' },
  { value: 'other', label: 'Other' },
];
