import {
  parseAsString,
  parseAsInteger,
  parseAsStringEnum,
  parseAsBoolean,
} from 'nuqs';

// Review status values
export const REVIEW_STATUS_VALUES = [
  'all',
  'unreviewed',
  'confirmed',
  'false_positive',
  'needs_context',
  'deferred',
] as const;
export type ReviewStatusValue = (typeof REVIEW_STATUS_VALUES)[number];

// Developer status values
export const DEVELOPER_STATUS_VALUES = [
  'all',
  'unresolved',
  'resolved',
  'pending',
  'backlogged',
  'need_more_info',
] as const;
export type DeveloperStatusValue = (typeof DEVELOPER_STATUS_VALUES)[number];

// Severity values
export const SEVERITY_VALUES = ['all', 'high', 'medium', 'low'] as const;
export type SeverityValue = (typeof SEVERITY_VALUES)[number];

// Sort order
export const SORT_ORDER_VALUES = ['asc', 'desc'] as const;
export type SortOrderValue = (typeof SORT_ORDER_VALUES)[number];

// Review type values
export const REVIEW_TYPE_VALUES = ['flags', 'compliance', 'needs_info'] as const;
export type ReviewTypeValue = (typeof REVIEW_TYPE_VALUES)[number];

// Review mode values
export const REVIEW_MODE_VALUES = ['review', 'developer'] as const;
export type ReviewModeValue = (typeof REVIEW_MODE_VALUES)[number];

// Glossary view mode values
export const GLOSSARY_VIEW_VALUES = ['flat', 'aggregated'] as const;
export type GlossaryViewValue = (typeof GLOSSARY_VIEW_VALUES)[number];

// ============================================
// Parsers
// ============================================

// Pagination parsers
export const pageParser = parseAsInteger.withDefault(1);
export const pageSizeParser = parseAsInteger.withDefault(20);

// Sort parsers
export const sortOrderParser = parseAsStringEnum([...SORT_ORDER_VALUES]).withDefault('desc');

// Review parsers
export const reviewStatusParser = parseAsStringEnum([...REVIEW_STATUS_VALUES]).withDefault('unreviewed');
export const developerStatusParser = parseAsStringEnum([...DEVELOPER_STATUS_VALUES]).withDefault('all');
export const severityParser = parseAsStringEnum([...SEVERITY_VALUES]).withDefault('all');
export const reviewTypeParser = parseAsStringEnum([...REVIEW_TYPE_VALUES]).withDefault('flags');
export const reviewModeParser = parseAsStringEnum([...REVIEW_MODE_VALUES]).withDefault('review');
export const glossaryViewParser = parseAsStringEnum([...GLOSSARY_VIEW_VALUES]).withDefault('flat');

// Boolean filter parsers
export const booleanParser = parseAsBoolean;

// Generic string parsers with no default (returns null if missing)
export const categoryParser = parseAsString;
export const searchParser = parseAsString;
export const developerAssignedParser = parseAsString;
export const letterParser = parseAsString;
export const reviewerParser = parseAsString;

// ============================================
// Definition filter values and parsers
// ============================================

// Scope level values for definitions
export const DEFINITION_SCOPE_LEVEL_VALUES = [
  'all',
  'section',
  'part',
  'chapter',
  'title',
] as const;
export type DefinitionScopeLevelValue = (typeof DEFINITION_SCOPE_LEVEL_VALUES)[number];

// Definition type values
export const DEFINITION_TYPE_VALUES = ['all', 'formal', 'abbreviation'] as const;
export type DefinitionTypeValue = (typeof DEFINITION_TYPE_VALUES)[number];

// Definition quality values
export const DEFINITION_QUALITY_VALUES = ['all', 'high', 'medium', 'low'] as const;
export type DefinitionQualityValue = (typeof DEFINITION_QUALITY_VALUES)[number];

// Definition filter parsers
export const definitionScopeLevelParser = parseAsStringEnum([...DEFINITION_SCOPE_LEVEL_VALUES]).withDefault('all');
export const definitionTypeParser = parseAsStringEnum([...DEFINITION_TYPE_VALUES]).withDefault('all');
export const definitionQualityParser = parseAsStringEnum([...DEFINITION_QUALITY_VALUES]).withDefault('all');

// Sort by parsers for different contexts
export const flagSortByParser = parseAsStringEnum([
  'severity',
  'category',
  'reviewedAt',
] as const).withDefault('severity');

export const complianceSortByParser = parseAsStringEnum([
  'issueType',
  'createdAt',
  'reviewedAt',
] as const).withDefault('createdAt');

export const developerSortByParser = parseAsStringEnum([
  'reviewedAt',
  'developerCheckedAt',
] as const).withDefault('reviewedAt');

// Definitions review parsers
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

export const DEFINITIONS_SORT_BY_VALUES = ['document', 'term', 'extractedAt'] as const;
export type DefinitionsSortByValue = (typeof DEFINITIONS_SORT_BY_VALUES)[number];

// Extended scope level for definitions review (includes more levels)
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

export const definitionsReviewStatusParser = parseAsStringEnum([...DEFINITIONS_REVIEW_STATUS_VALUES]).withDefault('all');
export const definitionsReviewScopeLevelParser = parseAsStringEnum([...DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES]).withDefault('all');
export const definitionsScopeRelationParser = parseAsStringEnum([...DEFINITIONS_SCOPE_RELATION_VALUES]).withDefault('all');
export const definitionsCrossRefParser = parseAsStringEnum([...DEFINITIONS_CROSS_REF_VALUES]).withDefault('all');
export const definitionsSortByParser = parseAsStringEnum([...DEFINITIONS_SORT_BY_VALUES]).withDefault('document');
export const scopeTextParser = parseAsString;

// ============================================
// Combined parsers for common use cases
// ============================================

/**
 * Parser configuration for the review queue filters
 */
export const reviewQueueParsers = {
  page: pageParser,
  reviewStatus: reviewStatusParser,
  severity: severityParser,
  category: categoryParser,
  sortBy: flagSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for the developer queue filters
 */
export const developerQueueParsers = {
  page: pageParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  sortBy: developerSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for the browse hierarchy filters
 */
export const browseFiltersParsers = {
  analyzed: booleanParser,
  hasFlags: booleanParser,
  severity: severityParser,
  hasDefs: booleanParser,
  hasCompliance: booleanParser,
  search: searchParser,
};

/**
 * Parser configuration for glossary (definitions) page filters
 */
export const glossaryFiltersParsers = {
  page: pageParser,
  search: searchParser,
  letter: letterParser,
  scopeLevel: definitionScopeLevelParser,
  definitionType: definitionTypeParser,
  quality: definitionQualityParser,
};

/**
 * Parser configuration for definitions review queue filters
 */
export const definitionsReviewParsers = {
  page: pageParser,
  reviewStatus: definitionsReviewStatusParser,
  scopeLevel: definitionsReviewScopeLevelParser,
  definitionType: definitionTypeParser,
  isCrossReference: definitionsCrossRefParser,
  scopeRelation: definitionsScopeRelationParser,
  scopeText: scopeTextParser,
  sortBy: definitionsSortByParser,
};
