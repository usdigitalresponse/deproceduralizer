/**
 * URL query state parsers using nuqs.
 *
 * Values are imported from lib/constants/values.ts (single source of truth).
 * This file only defines the nuqs parsers and combined parser configurations.
 */

import {
  parseAsString,
  parseAsInteger,
  parseAsFloat,
  parseAsStringEnum,
  parseAsBoolean,
} from 'nuqs';

import {
  // Statute link types
  LINK_TYPE_VALUES,
  // Review/Developer
  REVIEW_STATUS_VALUES,
  DEVELOPER_STATUS_VALUES,
  SEVERITY_VALUES,
  BOOLEAN_FILTER_VALUES,
  SORT_ORDER_VALUES,
  DEVELOPER_SORT_BY_VALUES,
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
  // IBR
  IBR_TAB_VALUES,
  IBR_SORT_BY_VALUES,
  // Fines
  FINES_TAB_VALUES,
  FINES_SORT_BY_VALUES,
  SOURCE_TYPE_FILTER_VALUES,
  FINES_CLASSIFICATION_FILTER_VALUES,
  // Analytics
  ANALYTICS_TAB_VALUES,
  TREEMAP_SIZE_METRIC_VALUES,
  TREEMAP_COLOR_METRIC_VALUES,
  PIPELINE_SUBTAB_VALUES,
  // Cross-references table
  CROSSREF_VIEW_MODE_VALUES,
  CROSSREF_TABLE_MODE_VALUES,
  CROSSREF_RESOLVED_VALUES,
  CROSSREF_REF_TYPE_VALUES,
  CROSSREF_SOURCE_TYPE_VALUES,
  CROSSREF_TARGET_TYPE_VALUES,
  CROSSREF_SORT_BY_VALUES,
  CROSSREF_GROUP_SORT_BY_VALUES,
  // View mode
  VIEW_MODE_VALUES,
  // Analysis tier filters
  TIER_FILTER_VALUES,
  FEDERAL_MANDATE_FILTER_VALUES,
  HAS_ANALYSIS_FILTER_VALUES,
  CLASSIFICATION_FILTER_VALUES,
  ANALYSIS_SORT_BY_VALUES,
  // V5 Tier 3 filters
  PIPELINE_SEVERITY_FILTER_VALUES,
  SEVERITY_CHANGED_FILTER_VALUES,
  TIER3_FINDING_FILTER_VALUES,
  TIER3_TRIGGER_FILTER_VALUES,
  // V5.1 Easy Cleanup filter
  EASY_CLEANUP_FILTER_VALUES,
  // Section Type
  SECTION_TYPE_VALUES,
  // Prompts
  PROMPTS_TAB_VALUES,
  // Guidance
  GUIDANCE_TAB_VALUES,
  GUIDANCE_BROWSE_MODE_VALUES,
  GUIDANCE_GROUP_BY_VALUES,
  GUIDANCE_GROUP_SORT_BY_VALUES,
  GUIDANCE_SORT_BY_VALUES,
  GUIDANCE_STATUS_VALUES,
  GUIDANCE_POLICY_CATEGORY_VALUES,
  GUIDANCE_AUDIENCE_DIRECTION_VALUES,
  GUIDANCE_READABILITY_VALUES,
  GUIDANCE_AUDIENCE_EXPERTISE_VALUES,
  // Pipeline source
  PIPELINE_SOURCE_VALUES,
  // Compliance source
  COMPLIANCE_SOURCE_VALUES,
  // JenAI
  JENAI_SOURCE_VALUES,
  JENAI_REVIEW_SORT_BY_VALUES,
  JENAI_DEVELOPER_SORT_BY_VALUES,
  JENAI_VERBATIM_VALUES,
  // Markers (formerly Bookmarks)
  MARKER_TAB_VALUES,
  // Burden Index
  BURDEN_SORT_BY_VALUES,
  BURDEN_SOURCE_VALUES,
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
  DeveloperSortByValue,
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
  AnalyticsTabValue,
  TreemapSizeMetricValue,
  TreemapColorMetricValue,
  ViewModeValue,
  TierFilterValue,
  FederalMandateFilterValue,
  HasAnalysisFilterValue,
  ClassificationFilterValue,
  AnalysisSortByValue,
  PipelineSeverityFilterValue,
  SeverityChangedFilterValue,
  Tier3FindingFilterValue,
  Tier3TriggerFilterValue,
  PipelineSubTabValue,
  PromptsTabValue,
  GuidanceTabValue,
  GuidanceBrowseModeValue,
  GuidanceGroupByValue,
  GuidanceGroupSortByValue,
  GuidanceSortByValue,
  GuidanceStatusValue,
  GuidancePolicyCategoryValue,
  GuidanceAudienceDirectionValue,
  GuidanceReadabilityValue,
  GuidanceAudienceExpertiseValue,
  GuidanceTargetAudienceValue,
  ComplianceSourceValue,
  JenAISourceValue,
  JenAIVerbatimValue,
  JenAIReviewSortByValue,
  JenAIDeveloperSortByValue,
  CrossRefViewModeValue,
  CrossRefTableModeValue,
  CrossRefResolvedValue,
  CrossRefRefTypeValue,
  CrossRefSourceTypeValue,
  CrossRefSortByValue,
  CrossRefGroupSortByValue,
  MarkerTabValue,
  BookmarkTabValue,
  BurdenSortByValue,
  BurdenSourceValue,
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
export const severityParser = parseAsString;
export const statuteSourceParser = parseAsStringEnum([...BOOLEAN_FILTER_VALUES]).withDefault('all');
export const requirementFoundParser = parseAsStringEnum([...BOOLEAN_FILTER_VALUES]).withDefault('true');
export const reviewTypeParser = parseAsStringEnum([...REVIEW_TYPE_VALUES]).withDefault('compliance');
export const reviewModeParser = parseAsStringEnum([...REVIEW_MODE_VALUES]).withDefault('review');

// Pipeline source parser (regulations vs guidance)
export const pipelineSourceParser = parseAsStringEnum([...PIPELINE_SOURCE_VALUES]).withDefault('regulations');
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
export const complianceSortByParser = parseAsStringEnum([...COMPLIANCE_SORT_BY_VALUES]).withDefault('severity');

export const developerSortByParser = parseAsStringEnum([...DEVELOPER_SORT_BY_VALUES]).withDefault('reviewedAt');
export const complianceDeveloperSortByParser = parseAsStringEnum([...COMPLIANCE_DEVELOPER_SORT_BY_VALUES]).withDefault('reviewedAt');

// Compliance source parser (regulation vs guidance vs all)
export const complianceSourceParser = parseAsStringEnum([...COMPLIANCE_SOURCE_VALUES]).withDefault('all');

// JenAI parsers
export const jenaiSourceParser = parseAsStringEnum([...JENAI_SOURCE_VALUES]).withDefault('all');
export const jenaiReviewSortByParser = parseAsStringEnum([...JENAI_REVIEW_SORT_BY_VALUES]).withDefault('severity');
export const jenaiDeveloperSortByParser = parseAsStringEnum([...JENAI_DEVELOPER_SORT_BY_VALUES]).withDefault('reviewedAt');
export const jenaiVerbatimParser = parseAsStringEnum([...JENAI_VERBATIM_VALUES]).withDefault('all');

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

export const queueModeParser = parseAsStringEnum([...QUEUE_MODE_VALUES]).withDefault('filter');
export const groupingModeParser = parseAsStringEnum([...GROUPING_MODE_VALUES]).withDefault('issue_type');
export const batchSizeParser = parseAsInteger.withDefault(3);
export const shownIdsParser = parseAsString; // comma-separated IDs
export const focusTypeParser = parseAsString; // current issue type focus
export const focusSectionParser = parseAsString; // current section focus (hierarchy_path prefix)
export const focusPatternParser = parseAsString; // current matched pattern focus

// ============================================
// Analysis tier filter parsers (Research Pipeline)
// ============================================

export const tierFilterParser = parseAsStringEnum([...TIER_FILTER_VALUES]).withDefault('all');
export const federalMandateFilterParser = parseAsStringEnum([...FEDERAL_MANDATE_FILTER_VALUES]).withDefault('all');
export const hasAnalysisFilterParser = parseAsStringEnum([...HAS_ANALYSIS_FILTER_VALUES]).withDefault('all');
export const classificationFilterParser = parseAsStringEnum([...CLASSIFICATION_FILTER_VALUES]).withDefault('all');
export const analysisSortByParser = parseAsStringEnum([...ANALYSIS_SORT_BY_VALUES]).withDefault('severity');
export const pipelineRunParser = parseAsStringEnum([...BOOLEAN_FILTER_VALUES]).withDefault('all');
export type PipelineRunValue = (typeof BOOLEAN_FILTER_VALUES)[number];

// V5 Tier 3 filter parsers
export const pipelineSeverityParser = parseAsStringEnum([...PIPELINE_SEVERITY_FILTER_VALUES]).withDefault('all');
export const severityChangedParser = parseAsStringEnum([...SEVERITY_CHANGED_FILTER_VALUES]).withDefault('all');
export const tier3FindingParser = parseAsStringEnum([...TIER3_FINDING_FILTER_VALUES]).withDefault('all');
export const tier3TriggerParser = parseAsStringEnum([...TIER3_TRIGGER_FILTER_VALUES]).withDefault('all');

// V5.1 Easy Cleanup filter parser
export const easyCleanupParser = parseAsStringEnum([...EASY_CLEANUP_FILTER_VALUES]).withDefault('all');

// ============================================
// Analysis table parsers
// ============================================

// Bookmarked only filter parser
export const bookmarkedOnlyParser = parseAsStringEnum([...BOOLEAN_FILTER_VALUES]).withDefault('all');

/**
 * Parser configuration for analysis table filters
 */
export const analysisTableParsers = {
  page: pageParser,
  pageSize: pageSizeParser,
  tierCompleted: parseAsString,
  classification: parseAsString,
  federalMandate: parseAsString,
  pipelineRun: parseAsString,
  issueType: categoryParser,
  sortBy: analysisSortByParser,
  sortOrder: sortOrderParser,
  // V5 Tier 3 filters (comma-separated for multi-select)
  severity: parseAsString,
  severityChanged: parseAsString,
  federalMandateConfirmed: parseAsString,
  stateDiscretion: parseAsString,
  alternativeFound: parseAsString,
  evidenceGap: parseAsString,
  supersededByLaw: parseAsString,
  advocacyForChange: parseAsString,
  tier3Trigger: parseAsString,
  // V5.1 Easy Cleanup filter
  easyCleanup: parseAsString,
  // Bookmarks filter
  bookmarkedOnly: bookmarkedOnlyParser,
  // Marker group filter (comma-separated IDs)
  marker: parseAsString,
  // Guidance-specific filters (null = no filter)
  agency: parseAsString,
  docType: parseAsString,
};

// ============================================
// Combined parsers for common use cases
// ============================================

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

// ============================================
// Section Type (AI-generated metadata) parsers
// ============================================

export type { SectionTypeValue } from '@/lib/constants/values';
export { SECTION_TYPE_VALUES } from '@/lib/constants/values';

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
  source: complianceSourceParser,
  statuteSource: statuteSourceParser,
  requirementFound: requirementFoundParser,
  tierCompleted: tierFilterParser,
  federalMandate: federalMandateFilterParser,
  hasAnalysis: hasAnalysisFilterParser,
  sortBy: complianceSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for DataTable filters.
 */
export const dataTableFiltersParsers = {
  page: pageParser,
  category: parseAsString,
  explanationSearch: parseAsString,
  sectionType: parseAsString,   // AI-generated section type filter
  sortBy: parseAsString.withDefault('complianceIssueCount'),
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
 * Merged parser for JenAIQueue — a single hook replaces the former dual-hook
 * pattern (review + developer) that caused URL race conditions on shared params
 * like `source`.  Mode-specific defaults for `sortBy` are handled in the component.
 */
export const jenaiQueueParsers = {
  page: pageParser,
  // Review-specific
  reviewStatus: reviewStatusParser,
  // Developer-specific
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  // Shared
  severity: severityParser,
  category: categoryParser,
  source: jenaiSourceParser,
  part: parseAsString,
  sectionType: parseAsString,
  search: searchParser,
  complexity: parseAsString,
  verbatim: jenaiVerbatimParser,
  sortBy: parseAsString, // no default — mode decides ('severity' vs 'reviewedAt')
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for JenAI review queue filters.
 * Used by JenAIReviewFilters (conditionally rendered, no dual-hook issue).
 */
export const jenaiReviewQueueParsers = {
  page: pageParser,
  reviewStatus: reviewStatusParser,
  severity: severityParser,
  category: categoryParser,
  source: jenaiSourceParser,
  part: parseAsString,
  sectionType: parseAsString,
  search: searchParser,
  complexity: parseAsString,
  verbatim: jenaiVerbatimParser,
  sortBy: jenaiReviewSortByParser,
  sortOrder: sortOrderParser,
};

/**
 * Parser configuration for JenAI developer queue filters.
 * Used by JenAIDeveloperFilters (conditionally rendered, no dual-hook issue).
 */
export const jenaiDeveloperQueueParsers = {
  page: pageParser,
  developerStatus: developerStatusParser,
  developerAssigned: developerAssignedParser,
  severity: severityParser,
  category: categoryParser,
  source: jenaiSourceParser,
  part: parseAsString,
  sectionType: parseAsString,
  search: searchParser,
  complexity: parseAsString,
  verbatim: jenaiVerbatimParser,
  sortBy: jenaiDeveloperSortByParser,
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

// ============================================
// Analytics page parsers
// ============================================

export const analyticsTabParser = parseAsStringEnum([...ANALYTICS_TAB_VALUES]).withDefault('overview');
export const pipelineSubTabParser = parseAsStringEnum([...PIPELINE_SUBTAB_VALUES]).withDefault('overview');
export const treemapSizeMetricParser = parseAsStringEnum([...TREEMAP_SIZE_METRIC_VALUES]).withDefault('flags');
export const treemapColorMetricParser = parseAsStringEnum([...TREEMAP_COLOR_METRIC_VALUES]).withDefault('severity');
export const treemapDepthParser = parseAsInteger.withDefault(2);

/**
 * Parser configuration for analytics page
 */
export const analyticsParsers = {
  tab: analyticsTabParser,
  sizeMetric: treemapSizeMetricParser,
  colorMetric: treemapColorMetricParser,
  depth: treemapDepthParser,
  pIssueType: parseAsString,
  pSubTab: pipelineSubTabParser,
};

// ============================================
// View mode parser (table vs cards)
// ============================================

export const viewModeParser = parseAsStringEnum([...VIEW_MODE_VALUES]).withDefault('table');

// ============================================
// Print mode parser
// ============================================

export const printParser = parseAsBoolean.withDefault(false);

// ============================================
// Faceted filter parsers (for card grid view)
// ============================================

// Multi-value parsers store comma-separated values in URL
// e.g., ?severity=high,medium or ?sectionTypes=definitions,requirements
export const facetedSectionTypesParser = parseAsString; // comma-separated: "definitions,requirements"
export const facetedComplexityParser = parseAsString; // comma-separated: "LOW,MEDIUM"
export const facetedHasFormParser = parseAsString; // 'true' | null
export const facetedHasIbrParser = parseAsString; // 'true' | null

/**
 * Parser configuration for card grid faceted filters
 */
export const facetedFiltersParsers = {
  viewMode: viewModeParser,
  fSectionTypes: facetedSectionTypesParser,
  fComplexity: facetedComplexityParser,
  fHasForm: facetedHasFormParser,
  fHasIbr: facetedHasIbrParser,
};

// ============================================
// Statute browse parsers
// ============================================

export const statuteLinkTypeParser = parseAsStringEnum([...LINK_TYPE_VALUES]).withDefault('all');

/**
 * Parser configuration for statute browse page
 */
export const statuteBrowseParsers = {
  search: searchParser,
  hasLinks: booleanParser,
  linkType: statuteLinkTypeParser,
};

// Re-export statute-related types
export type { LinkTypeValue, MatchStatusValue } from '@/lib/constants/values';
export { LINK_TYPE_VALUES, MATCH_STATUS_VALUES } from '@/lib/constants/values';

// ============================================
// Full-text search parsers
// ============================================

/**
 * Parser configuration for full-text search results page
 */
export const searchResultsParsers = {
  q: parseAsString,
  page: pageParser,
  docType: parseAsString,
  sectionType: parseAsString,
  hierarchyLevel: parseAsString,
  parentPath: parseAsString,
  issueSystem: parseAsString,
  issueType: parseAsString,
  issueCategory: parseAsString,
  issueSeverity: parseAsString,
  classification: parseAsString,
};

// ============================================
// IBR page parsers
// ============================================

export const ibrTabParser = parseAsStringEnum([...IBR_TAB_VALUES]).withDefault('overview');
export const ibrSortByParser = parseAsStringEnum([...IBR_SORT_BY_VALUES]).withDefault('sourceOrganization');
export const sourceOrganizationParser = parseAsString;

/**
 * Parser configuration for IBR page
 */
export const ibrParsers = {
  tab: ibrTabParser,
  page: pageParser,
  pageSize: pageSizeParser,
  sortBy: ibrSortByParser,
  sortOrder: sortOrderParser,
  sourceOrganization: sourceOrganizationParser,
  search: searchParser,
};

// Re-export IBR types
export type { IbrTabValue, IbrSortByValue } from '@/lib/constants/values';

// ============================================
// Fines & Fees page parsers
// ============================================

export const finesTabParser = parseAsStringEnum([...FINES_TAB_VALUES]).withDefault('overview');
export const finesSortByParser = parseAsStringEnum([...FINES_SORT_BY_VALUES]).withDefault('severity');
export const penaltyTypeParser = parseAsString;
export const agencyParser = parseAsString;
export const sourceTypeParser = parseAsStringEnum([...SOURCE_TYPE_FILTER_VALUES]);
export const amountMinParser = parseAsFloat;
export const amountMaxParser = parseAsFloat;
export const whoPaysParser = parseAsString;
export const perUnitParser = parseAsString;
export const agencyLevelParser = parseAsString;
export const finesClassificationParser = parseAsStringEnum([...FINES_CLASSIFICATION_FILTER_VALUES]).withDefault('all');

/**
 * Parser configuration for Fines & Fees page
 */
export const finesParsers = {
  tab: finesTabParser,
  page: pageParser,
  pageSize: pageSizeParser,
  sortBy: finesSortByParser,
  sortOrder: sortOrderParser,
  penaltyType: penaltyTypeParser,
  agency: agencyParser,
  search: searchParser,
  sourceType: sourceTypeParser,
  amountMin: amountMinParser,
  amountMax: amountMaxParser,
  whoPays: whoPaysParser,
  perUnit: perUnitParser,
  agencyLevel: agencyLevelParser,
  classification: finesClassificationParser,
  // Bookmarked only filter
  bookmarkedOnly: bookmarkedOnlyParser,
  // Marker group filter (comma-separated IDs)
  marker: parseAsString,
  severity: parseAsString,
  estimatedImpact: parseAsString,
};

// Re-export Fines types
export type { FinesTabValue, FinesSortByValue, SourceTypeFilterValue, FinesClassificationFilterValue } from '@/lib/constants/values';

// ============================================
// Prompts page parsers
// ============================================

export const promptsTabParser = parseAsStringEnum([...PROMPTS_TAB_VALUES]).withDefault('overview');

/**
 * Parser configuration for Prompts page
 */
export const promptsParsers = {
  tab: promptsTabParser,
};

// ============================================
// Guidance page parsers
// ============================================

export const guidanceTabParser = parseAsStringEnum([...GUIDANCE_TAB_VALUES]).withDefault('overview');
export const guidanceBrowseModeParser = parseAsStringEnum([...GUIDANCE_BROWSE_MODE_VALUES]).withDefault('flat');
export const guidanceGroupByParser = parseAsStringEnum([...GUIDANCE_GROUP_BY_VALUES]).withDefault('agency');
export const guidanceGroupSortByParser = parseAsStringEnum([...GUIDANCE_GROUP_SORT_BY_VALUES]).withDefault('documentCount');
export const guidanceSortByParser = parseAsStringEnum([...GUIDANCE_SORT_BY_VALUES]).withDefault('year');
export const guidanceStatusParser = parseAsStringEnum([...GUIDANCE_STATUS_VALUES]).withDefault('all');
export const guidancePolicyCategoryParser = parseAsStringEnum([...GUIDANCE_POLICY_CATEGORY_VALUES]).withDefault('all');
export const guidanceAgencyParser = parseAsString;
export const guidanceDocTypeParser = parseAsString;
export const guidanceYearFromParser = parseAsInteger;
export const guidanceYearToParser = parseAsInteger;
export const guidanceAudienceDirectionParser = parseAsStringEnum([...GUIDANCE_AUDIENCE_DIRECTION_VALUES]).withDefault('all');
export const guidanceSectionTypeParser = parseAsStringEnum([...SECTION_TYPE_VALUES]).withDefault('all');
export const guidanceReadabilityParser = parseAsStringEnum([...GUIDANCE_READABILITY_VALUES]).withDefault('all');
export const guidanceAudienceExpertiseParser = parseAsStringEnum([...GUIDANCE_AUDIENCE_EXPERTISE_VALUES]).withDefault('all');
export const guidanceTargetAudienceParser = parseAsString; // comma-separated for MultiSelect

/**
 * Parser configuration for Guidance page
 */
export const guidanceParsers = {
  tab: guidanceTabParser,
  browseMode: guidanceBrowseModeParser,
  groupBy: guidanceGroupByParser,
  groupSortBy: guidanceGroupSortByParser,
  page: pageParser,
  pageSize: pageSizeParser,
  sortBy: guidanceSortByParser,
  sortOrder: sortOrderParser,
  agency: guidanceAgencyParser,
  docType: guidanceDocTypeParser,
  policyCategory: guidancePolicyCategoryParser,
  status: guidanceStatusParser,
  yearFrom: guidanceYearFromParser,
  yearTo: guidanceYearToParser,
  search: searchParser,
  audienceDirection: guidanceAudienceDirectionParser,
  sectionType: guidanceSectionTypeParser,
  readability: guidanceReadabilityParser,
  audienceExpertise: guidanceAudienceExpertiseParser,
  targetAudience: guidanceTargetAudienceParser,
  hasForm: parseAsBoolean,
  hasIbr: parseAsBoolean,
  // Bookmarked only filter
  bookmarkedOnly: bookmarkedOnlyParser,
  // Marker group filter (comma-separated IDs)
  marker: parseAsString,
};

// ============================================
// Cross-references table parsers
// ============================================

export const crossRefViewModeParser = parseAsStringEnum([...CROSSREF_VIEW_MODE_VALUES]).withDefault('graph');
export const crossRefTableModeParser = parseAsStringEnum([...CROSSREF_TABLE_MODE_VALUES]).withDefault('flat');
export const crossRefResolvedParser = parseAsStringEnum([...CROSSREF_RESOLVED_VALUES]).withDefault('unresolved');
export const crossRefRefTypeParser = parseAsStringEnum([...CROSSREF_REF_TYPE_VALUES]).withDefault('all');
export const crossRefSourceTypeParser = parseAsStringEnum([...CROSSREF_SOURCE_TYPE_VALUES]).withDefault('all');
export const crossRefTargetTypeParser = parseAsStringEnum([...CROSSREF_TARGET_TYPE_VALUES]).withDefault('all');
export const crossRefSearchParser = parseAsString.withDefault('');
export const crossRefSortByParser = parseAsStringEnum([...CROSSREF_SORT_BY_VALUES]).withDefault('sourceDocument');
export const crossRefGroupSortByParser = parseAsStringEnum([...CROSSREF_GROUP_SORT_BY_VALUES]).withDefault('unresolvedCount');

/**
 * Parser configuration for cross-references table view.
 * Uses 'cr'-prefixed params to avoid collisions with other tab parsers.
 */
export const crossRefAgencyParser = parseAsString.withDefault('all');
export const crossRefDocTypeParser = parseAsString.withDefault('all');
export const crossRefNycrrTitleParser = parseAsString.withDefault('all');

export const crossRefTableParsers = {
  crView: crossRefViewModeParser,
  crMode: crossRefTableModeParser,
  crPage: pageParser,
  crPageSize: pageSizeParser,
  crResolved: crossRefResolvedParser,
  crRefType: crossRefRefTypeParser,
  crSourceType: crossRefSourceTypeParser,
  crTargetType: crossRefTargetTypeParser,
  crSearch: crossRefSearchParser,
  crSortBy: crossRefSortByParser,
  crGroupSortBy: crossRefGroupSortByParser,
  crSortOrder: sortOrderParser,
  crAgency: crossRefAgencyParser,
  crDocType: crossRefDocTypeParser,
  crNycrrTitle: crossRefNycrrTitleParser,
};

// ============================================
// Markers page parsers (formerly Bookmarks)
// ============================================

export const markerTabParser = parseAsStringEnum([...MARKER_TAB_VALUES]).withDefault('analysis');

/**
 * Parser configuration for Markers page
 */
export const markersParsers = {
  tab: markerTabParser,
};

// Backward compat aliases
export const bookmarkTabParser = markerTabParser;
export const bookmarksParsers = markersParsers;

// ============================================
// Tags page parsers
// ============================================

import { TAGS_TAB_VALUES } from '@/lib/constants/tags';

export const tagsTabParser = parseAsStringEnum([...TAGS_TAB_VALUES]).withDefault('overview');
export const tagDomainParser = parseAsString;
export const tagFieldParser = parseAsString;
export const tagTypeParser = parseAsString;
export const tagSearchParser = parseAsString;
export const tagFieldAParser = parseAsString;
export const tagFieldBParser = parseAsString;
export const readabilityFieldParser = parseAsString;

export const tagsParsers = {
  tab: tagsTabParser,
  domains: tagDomainParser,
  fields: tagFieldParser,
  types: tagTypeParser,
  search: tagSearchParser,
  fieldA: tagFieldAParser,
  fieldB: tagFieldBParser,
  readField: readabilityFieldParser,
};

// ============================================
// Burden Index page parsers
// ============================================

export const burdenSortByParser = parseAsStringEnum([...BURDEN_SORT_BY_VALUES]).withDefault('adjustedBurden');
export const burdenSourceParser = parseAsStringEnum([...BURDEN_SOURCE_VALUES]).withDefault('all');

/**
 * Parser configuration for Burden Index page
 */
export const burdenParsers = {
  page: pageParser,
  pageSize: pageSizeParser,
  sortBy: burdenSortByParser,
  sortOrder: sortOrderParser,
  source: burdenSourceParser,
  severity: parseAsString,     // comma-separated: "high,medium"
  category: parseAsString,     // comma-separated: "CAT1,CAT2"
  part: parseAsString,         // comma-separated part numbers
  sectionType: parseAsString,  // comma-separated section types
  search: searchParser,
};

// Re-export server-safe parsing helpers so client components can import from parsers.ts
export { parseCommaSeparated, serializeCommaSeparated, parseSeverities, type SeverityLevel } from './filter-helpers';
