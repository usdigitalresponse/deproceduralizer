/**
 * Regulation-related types and utility functions.
 *
 * Values and types are imported from lib/constants/values.ts (single source of truth).
 * This file provides:
 * - UI options derived from database enums (with labels)
 * - Utility functions for formatting and display
 */

import {
  // Database values
  DB_REVIEW_STATUS_VALUES,
  DB_DEVELOPER_STATUS_VALUES,
  DB_IMPACT_TYPE_VALUES,
  DB_RESOLUTION_TYPE_VALUES,
  DB_DEVELOPER_VALUES,
  DB_ISSUE_TYPE_VALUES,
  // Types
  type ReviewStatus,
  type DeveloperStatus,
  type ImpactType,
  type ResolutionType,
  type Developer,
  type IssueType,
  // UI values
  REVIEW_TYPE_VALUES,
  SEVERITY_THRESHOLDS,
  COMPLEXITY_LEVELS,
  type ComplexityLevel,
  type ReviewTypeValue,
} from '@/lib/constants/values';

// Re-export types for convenience
export type {
  ReviewStatus,
  DeveloperStatus,
  ImpactType,
  ResolutionType,
  Developer,
  IssueType,
  ComplexityLevel,
  ReviewTypeValue,
};

// Re-export values for convenience
export { SEVERITY_THRESHOLDS, COMPLEXITY_LEVELS };

// ============================================
// Utility Functions
// ============================================

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

/**
 * Maps complexity level to Badge variant
 * Used consistently across DataTable, ReviewCard, RedFlagsList, DetailModal
 */
export function getComplexityVariant(complexity: string | null | undefined): 'danger' | 'warning' | 'success' {
  if (complexity === 'HIGH') return 'danger';
  if (complexity === 'MEDIUM' || complexity === 'MEDIUM-HIGH') return 'warning';
  return 'success';
}

// ============================================
// Dropdown options for form UIs (with labels)
// ============================================

export const REVIEW_STATUSES = DB_REVIEW_STATUS_VALUES.map(value => ({
  value,
  label: formatLabel(value),
}));

export const IMPACT_TYPES = DB_IMPACT_TYPE_VALUES.map(value => ({
  value,
  label: formatLabel(value),
}));

// Severity options for compliance issues (1-10 scale, matching model severity)
// Values are strings for Radix Select compatibility - parse with parseInt() when saving
export const UPDATED_SEVERITY_OPTIONS = [
  { value: '1', label: '1 - Minimal' },
  { value: '2', label: '2' },
  { value: '3', label: '3' },
  { value: '4', label: '4 - Low' },
  { value: '5', label: '5' },
  { value: '6', label: '6' },
  { value: '7', label: '7 - Medium' },
  { value: '8', label: '8' },
  { value: '9', label: '9' },
  { value: '10', label: '10 - Critical' },
] as const;

// Priority options for red flags (1-5 scale)
// Values are strings for Radix Select compatibility - parse with parseInt() when saving
export const PRIORITY_OPTIONS = [
  { value: '1', label: '1 - Highest' },
  { value: '2', label: '2 - High' },
  { value: '3', label: '3 - Medium' },
  { value: '4', label: '4 - Low' },
  { value: '5', label: '5 - Lowest' },
] as const;

// Compliance issue types - requirements that add burden
export const COMPLIANCE_ISSUE_TYPES = DB_ISSUE_TYPE_VALUES.map(value => ({
  value,
  label: value === 'reporting_requirement' ? 'Reporting Requirement' : formatLabel(value),
}));

export const ISSUE_TYPE_LABELS: Record<string, string> = {
  ...Object.fromEntries(DB_ISSUE_TYPE_VALUES.map(type => [type, formatLabel(type)])),
  reporting_requirement: 'Reporting',
};

// Review type for the review page tabs
export const REVIEW_TYPES = REVIEW_TYPE_VALUES.map(value => {
  const labels: Record<(typeof REVIEW_TYPE_VALUES)[number], string> = {
    flags: 'Red Flags',
    compliance: 'Compliance Issues',
    definitions: 'Definitions',
    needs_info: 'Needs More Info',
  };
  return { value, label: labels[value] };
});

export type ReviewType = (typeof REVIEW_TYPES)[number]['value'];

// Developer mode constants
export const DEVELOPER_STATUSES = DB_DEVELOPER_STATUS_VALUES.map(value => ({
  value,
  label: formatLabel(value),
}));

export type DeveloperStatusValue = (typeof DEVELOPER_STATUSES)[number]['value'];

export const DEVELOPER_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  DB_DEVELOPER_STATUS_VALUES.map(status => [status, formatLabel(status)])
);

export const RESOLUTION_TYPES = DB_RESOLUTION_TYPE_VALUES.map(value => ({
  value,
  label: formatLabel(value),
}));

export type ResolutionTypeValue = (typeof RESOLUTION_TYPES)[number]['value'];

export const DEVELOPERS = DB_DEVELOPER_VALUES.map(value => ({
  value,
  label: value,
}));

export type DeveloperValue = (typeof DEVELOPERS)[number]['value'];

// Review mode for the toggle
export type ReviewMode = 'review' | 'developer';
