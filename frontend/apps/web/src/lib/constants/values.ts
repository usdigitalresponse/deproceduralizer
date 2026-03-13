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

export const COMPLIANCE_SORT_BY_VALUES = ['severity', 'createdAt', 'issueType', 'reviewedAt'] as const;
export type ComplianceSortByValue = (typeof COMPLIANCE_SORT_BY_VALUES)[number];

export const DEVELOPER_SORT_BY_VALUES = ['reviewedAt', 'developerCheckedAt'] as const;
export type DeveloperSortByValue = (typeof DEVELOPER_SORT_BY_VALUES)[number];

// Extended sort options for developer mode with type-specific options
export const COMPLIANCE_DEVELOPER_SORT_BY_VALUES = ['severity', 'issueType', 'reviewedAt', 'developerCheckedAt'] as const;
export type ComplianceDeveloperSortByValue = (typeof COMPLIANCE_DEVELOPER_SORT_BY_VALUES)[number];

// Compliance source filter (regulation vs guidance)
export const COMPLIANCE_SOURCE_VALUES = ['all', 'regulation', 'guidance'] as const;
export type ComplianceSourceValue = (typeof COMPLIANCE_SOURCE_VALUES)[number];

// JenAI source filter
export const JENAI_SOURCE_VALUES = ['all', 'regulation', 'guidance'] as const;
export type JenAISourceValue = (typeof JENAI_SOURCE_VALUES)[number];

// JenAI verbatim filter
export const JENAI_VERBATIM_VALUES = ['all', 'true', 'false'] as const;
export type JenAIVerbatimValue = (typeof JENAI_VERBATIM_VALUES)[number];

// JenAI review mode sort
export const JENAI_REVIEW_SORT_BY_VALUES = ['severity', 'confidence', 'category', 'reviewedAt'] as const;
export type JenAIReviewSortByValue = (typeof JENAI_REVIEW_SORT_BY_VALUES)[number];

// JenAI developer mode sort
export const JENAI_DEVELOPER_SORT_BY_VALUES = ['severity', 'confidence', 'category', 'reviewedAt', 'developerCheckedAt'] as const;
export type JenAIDeveloperSortByValue = (typeof JENAI_DEVELOPER_SORT_BY_VALUES)[number];

// ============================================
// Review page navigation
// ============================================

export const REVIEW_TYPE_VALUES = ['compliance', 'jenai', 'definitions', 'needs_info'] as const;
export type ReviewTypeValue = (typeof REVIEW_TYPE_VALUES)[number];

// Pipeline source tabs (regulations vs guidance)
export const PIPELINE_SOURCE_VALUES = ['regulations', 'guidance'] as const;
export type PipelineSourceValue = (typeof PIPELINE_SOURCE_VALUES)[number];

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
// IBR Page
// ============================================

export const IBR_TAB_VALUES = ['overview', 'browse'] as const;
export type IbrTabValue = (typeof IBR_TAB_VALUES)[number];

export const IBR_SORT_BY_VALUES = ['sourceOrganization', 'incorporatedDocument', 'createdAt'] as const;
export type IbrSortByValue = (typeof IBR_SORT_BY_VALUES)[number];

// ============================================
// Fines & Fees Page
// ============================================

export const FINES_TAB_VALUES = ['overview', 'browse'] as const;
export type FinesTabValue = (typeof FINES_TAB_VALUES)[number];

export const FINES_SORT_BY_VALUES = ['penaltyType', 'amount', 'responsibleAgency', 'createdAt'] as const;
export type FinesSortByValue = (typeof FINES_SORT_BY_VALUES)[number];

export const SOURCE_TYPE_FILTER_VALUES = ['regulation', 'guidance'] as const;
export type SourceTypeFilterValue = (typeof SOURCE_TYPE_FILTER_VALUES)[number];

// ============================================
// Cross-References Table View
// ============================================

export const CROSSREF_VIEW_MODE_VALUES = ['graph', 'table'] as const;
export type CrossRefViewModeValue = (typeof CROSSREF_VIEW_MODE_VALUES)[number];

export const CROSSREF_TABLE_MODE_VALUES = ['flat', 'grouped'] as const;
export type CrossRefTableModeValue = (typeof CROSSREF_TABLE_MODE_VALUES)[number];

export const CROSSREF_RESOLVED_VALUES = ['all', 'resolved', 'unresolved'] as const;
export type CrossRefResolvedValue = (typeof CROSSREF_RESOLVED_VALUES)[number];

export const CROSSREF_REF_TYPE_VALUES = ['all', 'njac', 'nycrr', 'ny_short_form', 'same_section', 'guidance', 'form', 'ssl', 'ny_statute'] as const;
export type CrossRefRefTypeValue = (typeof CROSSREF_REF_TYPE_VALUES)[number];

export const CROSSREF_REF_TYPE_LABELS: Record<string, string> = {
  nycrr: 'NYCRR',
  njac: 'NJAC',
  ny_short_form: 'Short Form',
  same_section: 'Same Section',
  guidance: 'Guidance',
  form: 'Form',
  ssl: 'SSL',
  ny_statute: 'NY Statute',
};

export const CROSSREF_SOURCE_TYPE_VALUES = ['all', 'regulation', 'guidance'] as const;
export type CrossRefSourceTypeValue = (typeof CROSSREF_SOURCE_TYPE_VALUES)[number];

export const CROSSREF_TARGET_TYPE_VALUES = ['all', 'regulation', 'guidance', 'none'] as const;
export type CrossRefTargetTypeValue = (typeof CROSSREF_TARGET_TYPE_VALUES)[number];

export const CROSSREF_SORT_BY_VALUES = ['sourceDocument', 'refType', 'normalizedCitation', 'isResolved'] as const;
export type CrossRefSortByValue = (typeof CROSSREF_SORT_BY_VALUES)[number];

export const CROSSREF_GROUP_SORT_BY_VALUES = ['documentName', 'totalRefs', 'unresolvedCount'] as const;
export type CrossRefGroupSortByValue = (typeof CROSSREF_GROUP_SORT_BY_VALUES)[number];

// ============================================
// Analytics Page
// ============================================

export const ANALYTICS_TAB_VALUES = ['overview', 'crossrefs', 'issues', 'keywords', 'definitions', 'statutes', 'guidance', 'pipeline'] as const;
export type AnalyticsTabValue = (typeof ANALYTICS_TAB_VALUES)[number];

export const PIPELINE_SUBTAB_VALUES = ['overview', 'context', 'verification'] as const;
export type PipelineSubTabValue = (typeof PIPELINE_SUBTAB_VALUES)[number];

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

// ============================================
// Analysis Tier Filter (Research Pipeline)
// ============================================

// Filter by highest tier completed in research pipeline
export const TIER_FILTER_VALUES = ['all', '0', '1', '2', '3'] as const;
export type TierFilterValue = (typeof TIER_FILTER_VALUES)[number];

// Filter for federal mandate found
export const FEDERAL_MANDATE_FILTER_VALUES = ['all', 'true', 'false'] as const;
export type FederalMandateFilterValue = (typeof FEDERAL_MANDATE_FILTER_VALUES)[number];

// Filter for has analysis (whether issue has been processed by research pipeline)
export const HAS_ANALYSIS_FILTER_VALUES = ['all', 'true', 'false'] as const;
export type HasAnalysisFilterValue = (typeof HAS_ANALYSIS_FILTER_VALUES)[number];

// Classification filter values for analysis table (alphabetized after 'all')
export const CLASSIFICATION_FILTER_VALUES = [
  'all',
  'all_false_positives',
  'burdensome',
  'justified',
  'needs_research',
  'unrelated',
] as const;
export type ClassificationFilterValue = (typeof CLASSIFICATION_FILTER_VALUES)[number];

// ============================================
// Tier 3 Analysis Filters (V5 Pipeline)
// ============================================

// Severity filter with 'none' for null severity
export const PIPELINE_SEVERITY_FILTER_VALUES = ['all', 'high', 'medium', 'low', 'none'] as const;
export type PipelineSeverityFilterValue = (typeof PIPELINE_SEVERITY_FILTER_VALUES)[number];

// Tier 3 severity change filter
export const SEVERITY_CHANGED_FILTER_VALUES = ['all', 'increased', 'decreased', 'unchanged', 'no_tier3'] as const;
export type SeverityChangedFilterValue = (typeof SEVERITY_CHANGED_FILTER_VALUES)[number];

// Tier 3 finding filter (for boolean flags with no_tier3 option)
export const TIER3_FINDING_FILTER_VALUES = ['all', 'true', 'false', 'no_tier3'] as const;
export type Tier3FindingFilterValue = (typeof TIER3_FINDING_FILTER_VALUES)[number];

// Tier 3 trigger filter (based on routing.py triggers)
export const TIER3_TRIGGER_FILTER_VALUES = [
  'all',
  'high_risk_issue',      // High-risk type + severity >= 6
  'federal_citation',     // cites_federal_statute = true
  'no_alternative',       // claims_no_alternative + severity >= 7
  'high_severity',        // burdensome + severity >= 8
  'controversial',        // justified + potentially_controversial
  'mandate_suspected',    // federal_mandate_suspected
  'not_triggered',        // Did not escalate to Tier 3
] as const;
export type Tier3TriggerFilterValue = (typeof TIER3_TRIGGER_FILTER_VALUES)[number];

// V5.1: Easy cleanup filter
export const EASY_CLEANUP_FILTER_VALUES = [
  'all',
  'any',                  // Any easy cleanup candidate
  'trivial',              // Trivial effort (alternative_in_practice)
  'easy',                 // Easy effort (alternative_authorized)
  'medium',               // Medium effort (peer_state_solution)
] as const;
export type EasyCleanupFilterValue = (typeof EASY_CLEANUP_FILTER_VALUES)[number];

// Sort by options for analysis table
export const ANALYSIS_SORT_BY_VALUES = ['issueType', 'severity', 'highestTier', 'createdAt'] as const;
export type AnalysisSortByValue = (typeof ANALYSIS_SORT_BY_VALUES)[number];

// ============================================
// Section Type (AI-generated metadata)
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
  'purpose',
  'scope',
  'exemptions',
  'reserved',
  'other',
] as const;
export type SectionTypeValue = (typeof SECTION_TYPE_VALUES)[number];

// ============================================
// Statute Link Types
// ============================================

export const LINK_TYPE_VALUES = ['all', 'enabling_authority', 'requirement', 'definition', 'reference'] as const;
export type LinkTypeValue = (typeof LINK_TYPE_VALUES)[number];

export const LINK_TYPE_LABELS: Record<string, string> = {
  enabling_authority: 'Enabling Authority',
  requirement: 'Requirement',
  definition: 'Definition',
  reference: 'Reference',
};

export const MATCH_STATUS_VALUES = ['all', 'matched', 'corrected', 'unmatched', 'obsolete'] as const;
export type MatchStatusValue = (typeof MATCH_STATUS_VALUES)[number];

export const MATCH_STATUS_LABELS: Record<string, string> = {
  matched: 'Matched',
  corrected: 'Corrected',
  unmatched: 'Unmatched',
  obsolete: 'Obsolete',
};

// ============================================
// Prompts Page
// ============================================

export const PROMPTS_TAB_VALUES = ['overview', 'research', 'jenai', 'fines', 'catalog'] as const;
export type PromptsTabValue = (typeof PROMPTS_TAB_VALUES)[number];

// ============================================
// Guidance Documents Page
// ============================================

export const GUIDANCE_TAB_VALUES = ['overview', 'browse'] as const;
export type GuidanceTabValue = (typeof GUIDANCE_TAB_VALUES)[number];

export const GUIDANCE_SORT_BY_VALUES = ['title', 'agency', 'year', 'status', 'createdAt'] as const;
export type GuidanceSortByValue = (typeof GUIDANCE_SORT_BY_VALUES)[number];

export const GUIDANCE_STATUS_VALUES = ['all', 'active', 'superseded', 'canceled', 'expired'] as const;
export type GuidanceStatusValue = (typeof GUIDANCE_STATUS_VALUES)[number];

export const GUIDANCE_POLICY_CATEGORY_VALUES = [
  'all', 'policy_directive', 'legal_interpretation', 'tax_guidance',
  'informational', 'reference_material', 'non_policy', 'data_dump', 'unclassified'
] as const;
export type GuidancePolicyCategoryValue = (typeof GUIDANCE_POLICY_CATEGORY_VALUES)[number];
