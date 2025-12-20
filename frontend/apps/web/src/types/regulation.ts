// Dropdown options for the review form UI
// These extend the database constants with display labels

export const REVIEW_STATUSES = [
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'needs_context', label: 'Needs Context' },
  { value: 'deferred', label: 'Deferred' },
] as const;

export const IMPACT_TYPES = [
  { value: 'cost_savings', label: 'Cost Savings' },
  { value: 'time_savings', label: 'Time Savings' },
  { value: 'accessibility', label: 'Accessibility' },
  { value: 'compliance_risk', label: 'Compliance Risk' },
  { value: 'operational_efficiency', label: 'Operational Efficiency' },
  { value: 'citizen_experience', label: 'Citizen Experience' },
  { value: 'other', label: 'Other' },
] as const;

// Note: values are strings for Radix Select compatibility
// Parse with parseInt() when saving to database
export const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Highest' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - Low' },
  { value: '5', label: '5 - Lowest' },
] as const;

// Compliance issue types - requirements that add burden
export const COMPLIANCE_ISSUE_TYPES = [
  { value: 'wet_signature', label: 'Wet Signature Required' },
  { value: 'in_person', label: 'In-Person Required' },
  { value: 'paper_form', label: 'Paper Form Required' },
  { value: 'notarized', label: 'Notarization Required' },
  { value: 'certified', label: 'Certification Required' },
  { value: 'reporting_requirement', label: 'Reporting Requirement' },
  { value: 'other', label: 'Other' },
] as const;

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  wet_signature: 'Wet Signature',
  in_person: 'In-Person',
  paper_form: 'Paper Form',
  notarized: 'Notarized',
  certified: 'Certified',
  reporting_requirement: 'Reporting',
  other: 'Other',
};

// Review type for the review page tabs
export const REVIEW_TYPES = [
  { value: 'flags', label: 'Red Flags' },
  { value: 'compliance', label: 'Compliance Issues' },
  { value: 'needs_info', label: 'Needs More Info' },
] as const;

export type ReviewType = typeof REVIEW_TYPES[number]['value'];

// Developer mode constants
export const DEVELOPER_STATUSES = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'pending', label: 'Pending' },
  { value: 'backlogged', label: 'Backlogged' },
  { value: 'need_more_info', label: 'Need More Info' },
] as const;

export type DeveloperStatusValue = typeof DEVELOPER_STATUSES[number]['value'];

export const DEVELOPER_STATUS_LABELS: Record<string, string> = {
  unresolved: 'Unresolved',
  resolved: 'Resolved',
  pending: 'Pending',
  backlogged: 'Backlogged',
  need_more_info: 'Need More Info',
};

export const RESOLUTION_TYPES = [
  { value: 'implemented', label: 'Implemented' },
  { value: 'not_implemented', label: 'Not Implemented' },
] as const;

export type ResolutionTypeValue = typeof RESOLUTION_TYPES[number]['value'];

export const DEVELOPERS = [
  { value: 'Michael', label: 'Michael' },
  { value: 'Abigail', label: 'Abigail' },
] as const;

export type DeveloperValue = typeof DEVELOPERS[number]['value'];

// Review mode for the toggle
export type ReviewMode = 'review' | 'developer';

// Complexity levels
export const COMPLEXITY_LEVELS = ['LOW', 'MEDIUM', 'MEDIUM-HIGH', 'HIGH'] as const;
export type ComplexityLevel = typeof COMPLEXITY_LEVELS[number];

/**
 * Maps complexity level to Badge variant
 * Used consistently across DataTable, ReviewCard, RedFlagsList, DetailModal
 */
export function getComplexityVariant(complexity: string | null | undefined): 'danger' | 'warning' | 'success' {
  if (complexity === 'HIGH') return 'danger';
  if (complexity === 'MEDIUM' || complexity === 'MEDIUM-HIGH') return 'warning';
  return 'success';
}

// Severity thresholds for badge coloring
export const SEVERITY_THRESHOLDS = {
  HIGH: 7,    // severity >= 7 → danger (red)
  MEDIUM: 4,  // severity >= 4 → warning (yellow)
  LOW: 1,     // severity >= 1 → success (green)
} as const;

/**
 * Maps severity (1-10) to Badge variant
 */
export function getSeverityVariant(severity: number): 'danger' | 'warning' | 'success' | 'default' {
  if (severity >= SEVERITY_THRESHOLDS.HIGH) return 'danger';
  if (severity >= SEVERITY_THRESHOLDS.MEDIUM) return 'warning';
  if (severity >= SEVERITY_THRESHOLDS.LOW) return 'success';
  return 'default';
}
