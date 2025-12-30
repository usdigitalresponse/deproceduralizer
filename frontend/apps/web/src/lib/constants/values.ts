/**
 * Single source of truth for enum values used across the application.
 *
 * This file contains all canonical value arrays that are used by:
 * - lib/url/parsers.ts (for nuqs URL state)
 * - lib/constants/filters.ts (for UI filter options)
 * - types/regulation.ts (for type definitions)
 *
 * Database enums are imported from @deproceduralizer/database/schema
 * and re-exported here for convenience.
 */

import {
  REVIEW_STATUSES as DB_REVIEW_STATUSES,
  DEVELOPER_STATUSES as DB_DEVELOPER_STATUSES,
  IMPACT_TYPES as DB_IMPACT_TYPES,
  RESOLUTION_TYPES as DB_RESOLUTION_TYPES,
  DEVELOPERS as DB_DEVELOPERS,
  ISSUE_TYPES as DB_ISSUE_TYPES,
} from '@deproceduralizer/database/schema';

// ============================================
// Re-export database enums
// ============================================

export const DB_REVIEW_STATUS_VALUES = DB_REVIEW_STATUSES;
export const DB_DEVELOPER_STATUS_VALUES = DB_DEVELOPER_STATUSES;
export const DB_IMPACT_TYPE_VALUES = DB_IMPACT_TYPES;
export const DB_RESOLUTION_TYPE_VALUES = DB_RESOLUTION_TYPES;
export const DB_DEVELOPER_VALUES = DB_DEVELOPERS;
export const DB_ISSUE_TYPE_VALUES = DB_ISSUE_TYPES;

// Type exports from database
export type ReviewStatus = (typeof DB_REVIEW_STATUSES)[number];
export type DeveloperStatus = (typeof DB_DEVELOPER_STATUSES)[number];
export type ImpactType = (typeof DB_IMPACT_TYPES)[number];
export type ResolutionType = (typeof DB_RESOLUTION_TYPES)[number];
export type Developer = (typeof DB_DEVELOPERS)[number];
export type IssueType = (typeof DB_ISSUE_TYPES)[number];

// ============================================
// Filter values (includes 'all' option for UI)
// ============================================

// Review status values (for URL state and filters)
export const REVIEW_STATUS_VALUES = [
  'all',
  ...DB_REVIEW_STATUSES,
] as const;
export type ReviewStatusValue = (typeof REVIEW_STATUS_VALUES)[number];

// Developer status values
export const DEVELOPER_STATUS_VALUES = [
  'all',
  ...DB_DEVELOPER_STATUS_VALUES,
] as const;
export type DeveloperStatusValue = (typeof DEVELOPER_STATUS_VALUES)[number];

// ============================================
// Severity
// ============================================

export const SEVERITY_VALUES = ['all', 'high', 'medium', 'low'] as const;
export type SeverityValue = (typeof SEVERITY_VALUES)[number];

export const SEVERITY_THRESHOLDS = {
  HIGH: 7, // severity >= 7 → danger (red)
  MEDIUM: 4, // severity >= 4 → warning (yellow)
  LOW: 1, // severity >= 1 → success (green)
} as const;

// ============================================
// Boolean filter values (for URL state)
// ============================================

export const BOOLEAN_FILTER_VALUES = ['all', 'true', 'false'] as const;
export type BooleanFilterValue = (typeof BOOLEAN_FILTER_VALUES)[number];

// Aliases for semantic clarity
export const STATUTE_SOURCE_VALUES = BOOLEAN_FILTER_VALUES;
export type StatuteSourceValue = BooleanFilterValue;

export const REQUIREMENT_FOUND_VALUES = BOOLEAN_FILTER_VALUES;
export type RequirementFoundValue = BooleanFilterValue;

// ============================================
// Sort
// ============================================

export const SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type SortOrderValue = (typeof SORT_ORDER_VALUES)[number];

export const FLAG_SORT_BY_VALUES = ['severity', 'category', 'reviewedAt'] as const;
export type FlagSortByValue = (typeof FLAG_SORT_BY_VALUES)[number];

export const COMPLIANCE_SORT_BY_VALUES = ['severity', 'createdAt', 'issueType', 'reviewedAt'] as const;
export type ComplianceSortByValue = (typeof COMPLIANCE_SORT_BY_VALUES)[number];

export const DEVELOPER_SORT_BY_VALUES = ['reviewedAt', 'developerCheckedAt'] as const;
export type DeveloperSortByValue = (typeof DEVELOPER_SORT_BY_VALUES)[number];

// Extended sort options for developer mode with type-specific options
export const RED_FLAG_DEVELOPER_SORT_BY_VALUES = ['severity', 'category', 'reviewedAt', 'developerCheckedAt'] as const;
export type RedFlagDeveloperSortByValue = (typeof RED_FLAG_DEVELOPER_SORT_BY_VALUES)[number];

export const COMPLIANCE_DEVELOPER_SORT_BY_VALUES = ['severity', 'issueType', 'reviewedAt', 'developerCheckedAt'] as const;
export type ComplianceDeveloperSortByValue = (typeof COMPLIANCE_DEVELOPER_SORT_BY_VALUES)[number];

// ============================================
// Review page navigation
// ============================================

export const REVIEW_TYPE_VALUES = ['flags', 'compliance', 'definitions', 'needs_info'] as const;
export type ReviewTypeValue = (typeof REVIEW_TYPE_VALUES)[number];

export const REVIEW_MODE_VALUES = ['review', 'developer'] as const;
export type ReviewModeValue = (typeof REVIEW_MODE_VALUES)[number];

// ============================================
// Glossary
// ============================================

export const GLOSSARY_VIEW_VALUES = ['flat', 'aggregated'] as const;
export type GlossaryViewValue = (typeof GLOSSARY_VIEW_VALUES)[number];

// ============================================
// Definition filter values
// ============================================

export const DEFINITION_SCOPE_LEVEL_VALUES = [
  'all',
  'section',
  'part',
  'chapter',
  'title',
] as const;
export type DefinitionScopeLevelValue = (typeof DEFINITION_SCOPE_LEVEL_VALUES)[number];

export const DEFINITION_TYPE_VALUES = ['all', 'formal', 'abbreviation'] as const;
export type DefinitionTypeValue = (typeof DEFINITION_TYPE_VALUES)[number];

export const DEFINITION_QUALITY_VALUES = ['all', 'high', 'medium', 'low'] as const;
export type DefinitionQualityValue = (typeof DEFINITION_QUALITY_VALUES)[number];

// ============================================
// Definitions review values
// ============================================

export const DEFINITIONS_REVIEW_STATUS_VALUES = [
  'all',
  'unreviewed',
  'confirmed',
  'corrected',
  'false_positive',
] as const;
export type DefinitionsReviewStatusValue = (typeof DEFINITIONS_REVIEW_STATUS_VALUES)[number];

export const DEFINITIONS_SCOPE_RELATION_VALUES = ['all', 'self', 'parent'] as const;
export type DefinitionsScopeRelationValue = (typeof DEFINITIONS_SCOPE_RELATION_VALUES)[number];

export const DEFINITIONS_CROSS_REF_VALUES = ['all', 'true', 'false'] as const;
export type DefinitionsCrossRefValue = (typeof DEFINITIONS_CROSS_REF_VALUES)[number];

export const DEFINITIONS_IN_DEF_SECTION_VALUES = ['all', 'true', 'false'] as const;
export type DefinitionsInDefSectionValue = (typeof DEFINITIONS_IN_DEF_SECTION_VALUES)[number];

export const DEFINITIONS_SCOPE_MISMATCH_VALUES = ['all', 'true', 'false'] as const;
export type DefinitionsScopeMismatchValue = (typeof DEFINITIONS_SCOPE_MISMATCH_VALUES)[number];

export const DEFINITIONS_SORT_BY_VALUES = ['document', 'term', 'extractedAt'] as const;
export type DefinitionsSortByValue = (typeof DEFINITIONS_SORT_BY_VALUES)[number];

// Extended scope level for definitions review (includes more hierarchy levels)
export const DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES = [
  'all',
  'section',
  'subpart',
  'part',
  'subchapter',
  'chapter',
  'subtitle',
  'title',
] as const;
export type DefinitionsReviewScopeLevelValue = (typeof DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES)[number];

// Has notes filter values
export const HAS_NOTES_VALUES = ['all', 'yes', 'no'] as const;
export type HasNotesValue = (typeof HAS_NOTES_VALUES)[number];

// Cross-reference categorization
export const REFERENCE_COMPLETENESS_VALUES = ['all', 'pure_pointer', 'hybrid'] as const;
export type ReferenceCompletenessValue = (typeof REFERENCE_COMPLETENESS_VALUES)[number];

export const REFERENCE_TARGET_VALUES = [
  'all',
  'same_corpus',
  'federal',
  'external_standard',
  'other',
] as const;
export type ReferenceTargetValue = (typeof REFERENCE_TARGET_VALUES)[number];

// ============================================
// Priority
// ============================================

export const PRIORITY_VALUES = ['1', '2', '3', '4', '5'] as const;
export type PriorityValue = (typeof PRIORITY_VALUES)[number];

// ============================================
// Complexity
// ============================================

export const COMPLEXITY_LEVELS = ['LOW', 'MEDIUM', 'MEDIUM-HIGH', 'HIGH'] as const;
export type ComplexityLevel = (typeof COMPLEXITY_LEVELS)[number];

// ============================================
// Suggestion Mode (Smart Review Queue)
// ============================================

export const QUEUE_MODE_VALUES = ['filter', 'suggestion'] as const;
export type QueueModeValue = (typeof QUEUE_MODE_VALUES)[number];

export const GROUPING_MODE_VALUES = ['issue_type', 'section', 'combined'] as const;
export type GroupingModeValue = (typeof GROUPING_MODE_VALUES)[number];

export const BATCH_SIZE_VALUES = [2, 3, 4, 5] as const;
export type BatchSizeValue = (typeof BATCH_SIZE_VALUES)[number];

// ============================================
// Analytics Page
// ============================================

export const ANALYTICS_TAB_VALUES = ['overview', 'hierarchy', 'crossrefs', 'issues', 'keywords', 'definitions'] as const;
export type AnalyticsTabValue = (typeof ANALYTICS_TAB_VALUES)[number];

export const TREEMAP_SIZE_METRIC_VALUES = ['flags', 'documents', 'compliance'] as const;
export type TreemapSizeMetricValue = (typeof TREEMAP_SIZE_METRIC_VALUES)[number];

export const TREEMAP_COLOR_METRIC_VALUES = ['severity', 'reviewStatus', 'none'] as const;
export type TreemapColorMetricValue = (typeof TREEMAP_COLOR_METRIC_VALUES)[number];

export const TREEMAP_DEPTH_VALUES = [1, 2, 3] as const;
export type TreemapDepthValue = (typeof TREEMAP_DEPTH_VALUES)[number];

// ============================================
// View Mode (Table vs Cards)
// ============================================

export const VIEW_MODE_VALUES = ['table', 'cards'] as const;
export type ViewModeValue = (typeof VIEW_MODE_VALUES)[number];
