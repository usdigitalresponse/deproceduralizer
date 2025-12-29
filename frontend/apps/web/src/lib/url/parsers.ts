/**
 * URL query state parsers using nuqs.
 *
 * Values are imported from lib/constants/values.ts (single source of truth).
 * This file only defines the nuqs parsers and combined parser configurations.
 */

import {
  parseAsString,
  parseAsInteger,
  parseAsStringEnum,
  parseAsBoolean,
} from 'nuqs';

import {
  // Review/Developer
  REVIEW_STATUS_VALUES,
  DEVELOPER_STATUS_VALUES,
  SEVERITY_VALUES,
  BOOLEAN_FILTER_VALUES,
  SORT_ORDER_VALUES,
  FLAG_SORT_BY_VALUES,
  DEVELOPER_SORT_BY_VALUES,
  RED_FLAG_DEVELOPER_SORT_BY_VALUES,
  COMPLIANCE_DEVELOPER_SORT_BY_VALUES,
  REVIEW_TYPE_VALUES,
  REVIEW_MODE_VALUES,
  GLOSSARY_VIEW_VALUES,
  // Definitions
  DEFINITION_SCOPE_LEVEL_VALUES,
  DEFINITION_TYPE_VALUES,
  DEFINITION_QUALITY_VALUES,
  DEFINITIONS_REVIEW_STATUS_VALUES,
  DEFINITIONS_SCOPE_RELATION_VALUES,
  DEFINITIONS_CROSS_REF_VALUES,
  DEFINITIONS_IN_DEF_SECTION_VALUES,
  DEFINITIONS_SCOPE_MISMATCH_VALUES,
  DEFINITIONS_SORT_BY_VALUES,
  DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES,
  HAS_NOTES_VALUES,
  COMPLIANCE_SORT_BY_VALUES,
  // Suggestion mode
  QUEUE_MODE_VALUES,
  GROUPING_MODE_VALUES,
} from '@/lib/constants/values';

// Re-export types for convenience
export type {
  ReviewStatusValue,
  DeveloperStatusValue,
  SeverityValue,
  BooleanFilterValue,
  StatuteSourceValue,
  RequirementFoundValue,
  SortOrderValue,
  FlagSortByValue,
  DeveloperSortByValue,
  RedFlagDeveloperSortByValue,
  ComplianceDeveloperSortByValue,
  ReviewTypeValue,
  ReviewModeValue,
  GlossaryViewValue,
  DefinitionScopeLevelValue,
  DefinitionTypeValue,
  DefinitionQualityValue,
  DefinitionsReviewStatusValue,
  DefinitionsScopeRelationValue,
  DefinitionsCrossRefValue,
  DefinitionsInDefSectionValue,
  DefinitionsScopeMismatchValue,
  DefinitionsSortByValue,
  DefinitionsReviewScopeLevelValue,
  HasNotesValue,
  ComplianceSortByValue,
  QueueModeValue,
  GroupingModeValue,
  BatchSizeValue,
} from '@/lib/constants/values';

// Re-export value arrays for backward compatibility
export {
  REVIEW_STATUS_VALUES,
  DEVELOPER_STATUS_VALUES,
  SEVERITY_VALUES,
  BOOLEAN_FILTER_VALUES,
  SORT_ORDER_VALUES,
  REVIEW_TYPE_VALUES,
  REVIEW_MODE_VALUES,
  GLOSSARY_VIEW_VALUES,
  DEFINITION_SCOPE_LEVEL_VALUES,
  DEFINITION_TYPE_VALUES,
  DEFINITION_QUALITY_VALUES,
  DEFINITIONS_REVIEW_STATUS_VALUES,
  DEFINITIONS_SCOPE_RELATION_VALUES,
  DEFINITIONS_CROSS_REF_VALUES,
  DEFINITIONS_IN_DEF_SECTION_VALUES,
  DEFINITIONS_SCOPE_MISMATCH_VALUES,
  DEFINITIONS_SORT_BY_VALUES,
  DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES,
  HAS_NOTES_VALUES,
} from '@/lib/constants/values';

// Legacy aliases for backward compatibility
export const STATUTE_SOURCE_VALUES = BOOLEAN_FILTER_VALUES;
export const REQUIREMENT_FOUND_VALUES = BOOLEAN_FILTER_VALUES;

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
export const statuteSourceParser = parseAsStringEnum([...BOOLEAN_FILTER_VALUES]).withDefault('all');
export const requirementFoundParser = parseAsStringEnum([...BOOLEAN_FILTER_VALUES]).withDefault('true');
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
// Definition filter parsers
// ============================================

export const definitionScopeLevelParser = parseAsStringEnum([...DEFINITION_SCOPE_LEVEL_VALUES]).withDefault('all');
export const definitionTypeParser = parseAsStringEnum([...DEFINITION_TYPE_VALUES]).withDefault('all');
export const definitionQualityParser = parseAsStringEnum([...DEFINITION_QUALITY_VALUES]).withDefault('all');

// Sort by parsers for different contexts
export const flagSortByParser = parseAsStringEnum([...FLAG_SORT_BY_VALUES]).withDefault('severity');

export const complianceSortByParser = parseAsStringEnum([...COMPLIANCE_SORT_BY_VALUES]).withDefault('severity');

export const developerSortByParser = parseAsStringEnum([...DEVELOPER_SORT_BY_VALUES]).withDefault('reviewedAt');
export const redFlagDeveloperSortByParser = parseAsStringEnum([...RED_FLAG_DEVELOPER_SORT_BY_VALUES]).withDefault('severity');
export const complianceDeveloperSortByParser = parseAsStringEnum([...COMPLIANCE_DEVELOPER_SORT_BY_VALUES]).withDefault('severity');

// Definitions review parsers
export const definitionsReviewStatusParser = parseAsStringEnum([...DEFINITIONS_REVIEW_STATUS_VALUES]).withDefault('all');
export const definitionsReviewScopeLevelParser = parseAsStringEnum([...DEFINITIONS_REVIEW_SCOPE_LEVEL_VALUES]).withDefault('all');
export const definitionsScopeRelationParser = parseAsStringEnum([...DEFINITIONS_SCOPE_RELATION_VALUES]).withDefault('all');
export const definitionsCrossRefParser = parseAsStringEnum([...DEFINITIONS_CROSS_REF_VALUES]).withDefault('all');
export const definitionsInDefSectionParser = parseAsStringEnum([...DEFINITIONS_IN_DEF_SECTION_VALUES]).withDefault('all');
export const definitionsScopeMismatchParser = parseAsStringEnum([...DEFINITIONS_SCOPE_MISMATCH_VALUES]).withDefault('all');
export const definitionsSortByParser = parseAsStringEnum([...DEFINITIONS_SORT_BY_VALUES]).withDefault('document');
export const scopeTextParser = parseAsString;
export const termSearchParser = parseAsString;
export const definitionIdParser = parseAsInteger;

export const hasNotesParser = parseAsStringEnum([...HAS_NOTES_VALUES]).withDefault('all');

// ============================================
// Suggestion mode parsers
// ============================================

export const queueModeParser = parseAsStringEnum([...QUEUE_MODE_VALUES]).withDefault('suggestion');
export const groupingModeParser = parseAsStringEnum([...GROUPING_MODE_VALUES]).withDefault('issue_type');
export const batchSizeParser = parseAsInteger.withDefault(3);
export const shownIdsParser = parseAsString; // comma-separated IDs
export const focusTypeParser = parseAsString; // current issue type focus
export const focusSectionParser = parseAsString; // current section focus (hierarchy_path prefix)
export const focusPatternParser = parseAsString; // current matched pattern focus

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
  // AI-generated metadata filters
  sectionType: parseAsString,
  hasForm: booleanParser,
  hasIbr: booleanParser,
  keyword: parseAsString,
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
  inDefinitionsSection: definitionsInDefSectionParser,
  scopeRelation: definitionsScopeRelationParser,
  scopeMismatch: definitionsScopeMismatchParser,
  scopeText: scopeTextParser,
  termSearch: termSearchParser,
  definitionId: definitionIdParser,
  sortBy: definitionsSortByParser,
  sortOrder: sortOrderParser,
};

// Has notes filter values (for filtering by presence of notes)
export const HAS_NOTES_VALUES = ['all', 'yes', 'no'] as const;
export type HasNotesValue = (typeof HAS_NOTES_VALUES)[number];

export const hasNotesParser = parseAsStringEnum([...HAS_NOTES_VALUES]).withDefault('all');

// ============================================
// Section Type (AI-generated metadata) parsers
// ============================================

export const SECTION_TYPE_VALUES = [
  'all',
  'definitions',
  'requirements',
  'procedures',
  'prohibitions',
  'standards',
  'eligibility',
  'penalties',
  'fees',
  'forms',
  'reporting',
  'scope',
  'exemptions',
  'reserved',
] as const;
export type SectionTypeValue = (typeof SECTION_TYPE_VALUES)[number];

export const sectionTypeParser = parseAsStringEnum([...SECTION_TYPE_VALUES]).withDefault('all');
export const hasFormParser = parseAsBoolean;
export const hasIbrParser = parseAsBoolean;
export const keywordSearchParser = parseAsString;

/**
 * Parser configuration for definitions developer queue filters
 */
export const definitionsDeveloperParsers = {
  page: pageParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  reviewStatus: definitionsReviewStatusParser,
  hasJustification: hasNotesParser,
  hasTeamNotes: hasNotesParser,
  sortBy: developerSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for compliance queue filters
 */
export const complianceQueueParsers = {
  page: pageParser,
  reviewStatus: reviewStatusParser,
  severity: severityParser,
  issueType: categoryParser,
  statuteSource: statuteSourceParser,
  requirementFound: requirementFoundParser,
  sortBy: complianceSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for DataTable filters.
 * Note: Uses parseAsString for tri-state fields (hasImplIssues, complexity, techReview, reporting)
 * to support 'true' | 'false' | 'null' values where 'null' means "show items with null value".
 */
export const dataTableFiltersParsers = {
  page: pageParser,
  hasFlags: booleanParser,
  category: parseAsString,
  explanationSearch: parseAsString,
  hasImplIssues: parseAsString, // Tri-state: 'true'|'false'|'null'
  complexity: parseAsString,    // Tri-state: 'true'|'false'|'null'
  severity: parseAsString,
  techReview: parseAsString,    // Tri-state: 'true'|'false'|'null'
  reporting: parseAsString,     // Tri-state: 'true'|'false'|'null'
  summarySearch: parseAsString,
  sortBy: parseAsString.withDefault('maxSeverity'),
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for red flag developer queue filters
 */
export const redFlagDeveloperQueueParsers = {
  page: pageParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  severity: severityParser,
  reviewStatus: reviewStatusParser,
  category: categoryParser,
  sortBy: redFlagDeveloperSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for compliance issue developer queue filters
 */
export const complianceDeveloperQueueParsers = {
  page: pageParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  severity: severityParser,
  reviewStatus: reviewStatusParser,
  issueType: categoryParser,
  sortBy: complianceDeveloperSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for compliance suggestion mode
 * Used when queueMode === 'suggestion' for smart batched review
 */
export const complianceSuggestionParsers = {
  queueMode: queueModeParser,
  groupingMode: groupingModeParser,
  batchSize: batchSizeParser,
  shownIds: shownIdsParser,
  focusType: focusTypeParser,
  focusSection: focusSectionParser,
  focusPattern: focusPatternParser,
};
