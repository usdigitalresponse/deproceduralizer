import {
  REVIEW_STATUSES as DB_REVIEW_STATUSES,
  DEVELOPER_STATUSES as DB_DEVELOPER_STATUSES,
  IMPACT_TYPES as DB_IMPACT_TYPES,
  RESOLUTION_TYPES as DB_RESOLUTION_TYPES,
  DEVELOPERS as DB_DEVELOPERS,
  ISSUE_TYPES as DB_ISSUE_TYPES
} from '@deproceduralizer/database/schema';

/**
 * Humanize a snake_case or kebab-case string for display
 */
export function formatLabel(value: string): string {
  if (!value) return '';
  return value
    .split(/[_-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Dropdown options for the review form UI
// These extend the database constants with display labels

export const REVIEW_STATUSES = DB_REVIEW_STATUSES.map(value => ({
  value,
  label: formatLabel(value)
}));

export const IMPACT_TYPES = DB_IMPACT_TYPES.map(value => ({
  value,
  label: formatLabel(value)
}));

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
export const COMPLIANCE_ISSUE_TYPES = DB_ISSUE_TYPES.map(value => ({
  value,
  label: value === 'reporting_requirement' ? 'Reporting Requirement' : formatLabel(value)
}));

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(DB_ISSUE_TYPES.map(type => [type, formatLabel(type)])),
  reporting_requirement: 'Reporting',
};

// Review type for the review page tabs
export const REVIEW_TYPES = [
  { value: 'flags', label: 'Red Flags' },
  { value: 'compliance', label: 'Compliance Issues' },
  { value: 'definitions', label: 'Definitions' },
  { value: 'needs_info', label: 'Needs More Info' },
] as const;

export type ReviewType = typeof REVIEW_TYPES[number]['value'];

// Developer mode constants
export const DEVELOPER_STATUSES = DB_DEVELOPER_STATUSES.map(value => ({
  value,
  label: formatLabel(value)
}));

export type DeveloperStatusValue = typeof DEVELOPER_STATUSES[number]['value'];

export const DEVELOPER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DB_DEVELOPER_STATUSES.map(status => [status, formatLabel(status)])
);

export const RESOLUTION_TYPES = DB_RESOLUTION_TYPES.map(value => ({
  value,
  label: formatLabel(value)
}));

export type ResolutionTypeValue = typeof RESOLUTION_TYPES[number]['value'];

export const DEVELOPERS = DB_DEVELOPERS.map(value => ({
  value,
  label: value
}));

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
