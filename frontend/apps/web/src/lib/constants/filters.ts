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
  { value: 'false_positive', label: 'False Positive' },
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

// ============================================
// Sort Options
// ============================================

export const REVIEW_SORT_OPTIONS = [
  { value: 'severity', label: 'Severity' },
  { value: 'category', label: 'Category' },
  { value: 'reviewedAt', label: 'Last Reviewed' },
];

export const COMPLIANCE_SORT_OPTIONS = [
  { value: 'createdAt', label: 'Created' },
  { value: 'issueType', label: 'Issue Type' },
  { value: 'reviewedAt', label: 'Last Reviewed' },
];

export const DEVELOPER_SORT_OPTIONS = [
  { value: 'reviewedAt', label: 'Last Reviewed' },
  { value: 'developerCheckedAt', label: 'Developer Checked' },
];
