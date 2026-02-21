import { eq, and, desc, asc, sql, count, or, isNull, isNotNull, ne, gte, lt, like, notInArray, inArray, type SQL } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { normalizeState } from '../schema/constants';
import { complianceIssues, ComplianceIssue, IssueType } from '../schema/compliance-issues';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import {
  complianceIssueAnalyses,
  ContextEntry,
  ContextRequest,
  DismissedMatch,
  Tier1ArgumentFraming,
  Tier1Recommendations,
  Tier2ContextRequestMade,
  Tier3Flags,
} from '../schema/compliance-issue-analyses';
import { bookmarks } from '../schema/bookmarks';
import { ReviewStatus, ImpactType, DeveloperStatus, ResolutionType, Developer } from '../schema/red-flags';
import { StateCode } from '../schema/constants';
import { DeveloperStatusCounts } from './red-flags.repository';

/**
 * ComplianceIssue with analysis-sourced fields joined from compliance_issue_analyses.
 * Used by getByDocumentId which needs to return these fields for UI rendering.
 * PR 6.3: review/developer fields now also come from analyses.
 */
export interface ComplianceIssueWithAnalysisFields extends ComplianceIssue {
  requirementFound: boolean | null;
  verbatimSupportingText: string[] | null;
  isVerbatim: boolean | null;
  requiredByStatute: boolean | null;
  statuteCitation: string | null;
  decisionRationale: string | null;
  // Review fields (from analyses, aliased for frontend compat)
  severity: number | null;
  originalSeverity: number | null;
  reviewStatus: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  justificationNotes: string | null;
  teamNotes: string | null;
  impactType: string | null;
  // Developer fields (from analyses)
  developerStatus: string | null;
  developerAssigned: string | null;
  developerNotes: string | null;
  resolutionType: string | null;
  resolutionComments: string | null;
  developerQuestion: string | null;
  developerCheckedAt: Date | null;
}

export interface UpdateComplianceIssueReviewInput {
  reviewStatus: ReviewStatus;
  reviewedBy?: string;
  justificationNotes?: string;
  teamNotes?: string;
  severity?: number;
  impactType?: string;
}

export interface UpdateComplianceIssueDeveloperInput {
  developerStatus: DeveloperStatus;
  developerAssigned: Developer;
  developerNotes?: string;
  resolutionType?: ResolutionType;
  resolutionComments?: string;
  developerQuestion?: string;
}

export interface ComplianceIssueWithContext extends ComplianceIssue {
  // Analysis-sourced fields (PR 6.2: moved from compliance_issues to compliance_issue_analyses)
  requirementFound: boolean | null;
  verbatimSupportingText: string[] | null;
  isVerbatim: boolean | null;
  requiredByStatute: boolean | null;
  statuteCitation: string | null;
  decisionRationale: string | null;
  // Review fields (PR 6.3: moved to analyses, aliased for frontend compat)
  severity: number | null;
  originalSeverity: number | null;
  reviewStatus: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  justificationNotes: string | null;
  teamNotes: string | null;
  impactType: string | null;
  // Developer fields (PR 6.3: moved to analyses)
  developerStatus: string | null;
  developerAssigned: string | null;
  developerNotes: string | null;
  resolutionType: string | null;
  resolutionComments: string | null;
  developerQuestion: string | null;
  developerCheckedAt: Date | null;

  regulation: {
    id: number;
    title: string | null;
    content?: string | null;
    nycrrTitle: number | null;
    nycrrPart: string | null;
    nycrrSection: string | null;
    njacTitle: string | null;
    njacChapter: string | null;
    njacSubchapter: string | null;
    url: string | null;
    // Summary metadata
    summary: string | null;
    sectionType: string | null;
    hasForm: boolean | null;
    hasIbr: boolean | null;
  };
}

export interface ComplianceIssueFilterOptions {
  state: StateCode;
  status?: ReviewStatus | 'all';
  issueType?: IssueType | 'all';
  severity?: 'high' | 'medium' | 'low' | 'all';
  requiredByStatute?: boolean | 'all';
  requirementFound?: boolean | 'all';
  /** Filter by highest tier completed in research pipeline (0-3, or 'all') */
  tierCompleted?: '0' | '1' | '2' | '3' | 'all';
  /** Filter by federal mandate found in analysis */
  federalMandate?: boolean | 'all';
  /** Filter by whether analysis exists */
  hasAnalysis?: boolean | 'all';
}

export interface ComplianceIssuePaginationOptions {
  state: StateCode;
  page: number;
  pageSize: number;
  sortBy?: 'issueType' | 'createdAt' | 'reviewedAt' | 'severity' | 'developerCheckedAt';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<ComplianceIssueFilterOptions, 'state'>;
}

export interface PaginatedComplianceIssuesResult {
  data: ComplianceIssueWithAnalysis[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ComplianceIssueStatusCounts {
  unreviewed: number;
  confirmed: number;
  rejected_clear_fp: number;
  rejected_not_obvious_bad: number;
  needs_context: number;
  deferred: number;
  total: number;
}

export interface ComplianceIssueStats {
  total: number;
  byType: Record<string, number>;
  unreviewed: number;
}

/**
 * Tier analysis data from compliance_issue_analyses table.
 * Represents the results of the 3-tier research pipeline.
 */
export interface TierAnalysis {
  highestTierCompleted: number;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  tier3TriggerReason: string | null;
  finalSeverity: number | null;
  verbatimRequirements: string[];
  argumentForRegulation: string | null;
  argumentAgainstRegulation: string | null;
  contextUsed: ContextEntry[] | null;
  webSearchSummary: string | null;
  federalMandateFound: boolean;
  stateHasDiscretion: boolean;
  isJustified: boolean;
  pipelineVersion: string;
  easyCleanupCandidate: boolean;
  cleanupType: string | null;
  cleanupEffort: string | null;
}

/**
 * Compliance issue with analysis data from the research pipeline.
 * Analysis may be null for legacy issues not processed by the pipeline.
 */
export interface ComplianceIssueWithAnalysis extends ComplianceIssueWithContext {
  analysis: TierAnalysis | null;
}

/**
 * Tier completion counts for analytics.
 */
export interface TierCompletionCounts {
  tier0: number; // Not analyzed by pipeline
  tier1: number;
  tier2: number;
  tier3: number;
}

/**
 * Classification breakdown by tier for analytics.
 */
export interface ClassificationBreakdown {
  tier1: Record<string, number>;
  tier2: Record<string, number>;
  tier3: Record<string, number>;
}

/**
 * Full analysis record with all tier data for detail page.
 */
export interface FullAnalysisRecord {
  documentId: number;
  issueType: string;
  state: string;
  groupedMatchCount: number;

  // Document info
  document: {
    id: number;
    title: string | null;
    citation: string | null;
    content: string | null;
    url: string | null;
    summary: string | null;
    keywords: string[] | null;
    appliesTo: string[] | null;
    hierarchyLevel: string | null;
  };

  // Tier 1 data
  tier1: {
    classification: string | null;
    confidence: number | null;
    reasoning: string | null;
    relevantMatchIds: number[] | null;
    dismissedMatchIds: number[] | null;
    dismissedReasons: DismissedMatch[] | null;
    contextRequests: ContextRequest[] | null;
    completedAt: Date | null;
    // V5 fields
    argumentFraming: Tier1ArgumentFraming | null;
    recommendations: Tier1Recommendations | null;
  } | null;

  // Tier 2 data
  tier2: {
    classification: string | null;
    confidence: number | null;
    reasoning: string | null;
    severity: number | null;
    severityBaseline: number | null;
    severityCalculation: string | null;
    verbatimRequirements: string[];
    argumentForRegulation: string | null;
    argumentAgainstRegulation: string | null;
    contextUsed: ContextEntry[] | null;
    fullTextRequests: ContextRequest[] | null;
    needsWebSearch: boolean;
    webSearchTopics: string[];
    potentiallyControversial: boolean;
    federalMandateSuspected: boolean;
    ambiguityType: string | null;
    completedAt: Date | null;
    // V5 fields
    rerunCount: number;
    contextRequestsMade: Tier2ContextRequestMade[] | null;
    forcedClassification: boolean;
    citesFederalStatute: boolean;
    federalCitation: string | null;
    claimsNoAlternative: boolean;
    // V5.2: Web search disambiguation
    programContext: string | null;
    notToConfuseWith: string[] | null;
    searchScopeGuidance: string | null;
  } | null;

  // Tier 3 data
  tier3: {
    classification: string | null;
    confidence: number | null;
    reasoning: string | null;
    severityAdjustment: number | null;
    severityAdjustmentReasoning: string | null;
    completedAt: Date | null;
    triggerReason: string | null;  // V5.1: Why escalated to Tier 3
    // V5 fields
    flags: Tier3Flags | null;
    evidenceGap: boolean;
    // Web search results
    webSearchSummary: string | null;
    federalMandateFound: boolean;
    stateHasDiscretion: boolean;
  } | null;

  // Final derived fields
  highestTierCompleted: number;
  classificationTier: number | null;
  requirementFound: boolean | null;
  isJustified: boolean;
  finalSeverity: number | null;
  pipelineVersion: string;
  createdAt: Date | null;
  updatedAt: Date | null;

  // V5.1: Easy Cleanup Detection
  easyCleanupCandidate: boolean;
  cleanupType: string | null;
  cleanupEvidence: string | null;
  cleanupRecommendation: string | null;
  cleanupEffort: string | null;
}

/** Shared SELECT columns for compliance issue list/queue queries (excludes regulationContent). */
const issueListSelectColumns = {
  // Compliance issue fields
  id: complianceIssues.id,
  documentId: complianceIssues.documentId,
  issueType: complianceIssues.issueType,
  regexMatchPattern: complianceIssues.regexMatchPattern,
  regexMatchContext: complianceIssues.regexMatchContext,
  url: complianceIssues.url,
  analysisId: complianceIssues.analysisId,
  runId: complianceIssues.runId,
  // Analysis fields — sourced from compliance_issue_analyses (PR 6.2)
  requirementFound: complianceIssueAnalyses.requirementFound,
  verbatimSupportingText: complianceIssueAnalyses.verbatimRequirements,
  isVerbatim: complianceIssueAnalyses.isVerbatim,
  requiredByStatute: complianceIssueAnalyses.citesFederalStatute,
  severity: complianceIssueAnalyses.reviewerSeverity,
  occurrenceNumber: complianceIssues.occurrenceNumber,
  statuteCitation: complianceIssueAnalyses.federalCitation,
  decisionRationale: complianceIssueAnalyses.tier1Reasoning,
  // Review fields — PR 6.3: from analyses
  reviewStatus: complianceIssueAnalyses.reviewStatus,
  reviewedBy: complianceIssueAnalyses.reviewedBy,
  reviewedAt: complianceIssueAnalyses.reviewedAt,
  justificationNotes: complianceIssueAnalyses.justificationNotes,
  teamNotes: complianceIssueAnalyses.teamNotes,
  originalSeverity: complianceIssueAnalyses.reviewerOriginalSeverity,
  impactType: complianceIssueAnalyses.impactType,
  // Developer fields — PR 6.3: from analyses
  developerStatus: complianceIssueAnalyses.developerStatus,
  developerAssigned: complianceIssueAnalyses.developerAssigned,
  developerNotes: complianceIssueAnalyses.developerNotes,
  resolutionType: complianceIssueAnalyses.resolutionType,
  resolutionComments: complianceIssueAnalyses.resolutionComments,
  developerQuestion: complianceIssueAnalyses.developerQuestion,
  developerCheckedAt: complianceIssueAnalyses.developerCheckedAt,
  state: complianceIssues.state,
  createdAt: complianceIssues.createdAt,
  // Analysis pipeline fields — for building TierAnalysis in mapRowToIssue
  analysisHighestTier: complianceIssueAnalyses.highestTierCompleted,
  analysisTier1: complianceIssueAnalyses.tier1Classification,
  analysisTier2: complianceIssueAnalyses.tier2Classification,
  analysisTier3: complianceIssueAnalyses.tier3Classification,
  analysisTier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
  analysisFinalSeverity: complianceIssueAnalyses.finalSeverity,
  analysisVerbatimReqs: complianceIssueAnalyses.verbatimRequirements,
  analysisArgFor: complianceIssueAnalyses.argumentForRegulation,
  analysisArgAgainst: complianceIssueAnalyses.argumentAgainstRegulation,
  analysisContextUsed: complianceIssueAnalyses.contextUsed,
  analysisWebSummary: complianceIssueAnalyses.webSearchSummary,
  analysisFederalMandate: complianceIssueAnalyses.federalMandateFound,
  analysisStateDiscretion: complianceIssueAnalyses.stateHasDiscretion,
  analysisIsJustified: complianceIssueAnalyses.isJustified,
  analysisPipelineVersion: complianceIssueAnalyses.pipelineVersion,
  analysisEasyCleanup: complianceIssueAnalyses.easyCleanupCandidate,
  analysisCleanupType: complianceIssueAnalyses.cleanupType,
  analysisCleanupEffort: complianceIssueAnalyses.cleanupEffort,
  // Regulation context (no content — too large for list views)
  regulationId: regulatoryDocuments.id,
  regulationTitle: regulatoryDocuments.title,
  regulationNycrrTitle: regulatoryDocuments.nycrrTitle,
  regulationNycrrPart: regulatoryDocuments.nycrrPart,
  regulationNycrrSection: regulatoryDocuments.nycrrSection,
  regulationNjacTitle: regulatoryDocuments.njacTitle,
  regulationNjacChapter: regulatoryDocuments.njacChapter,
  regulationNjacSubchapter: regulatoryDocuments.njacSubchapter,
  regulationUrl: regulatoryDocuments.url,
  regulationSummary: regulatoryDocuments.summary,
  regulationSectionType: regulatoryDocuments.sectionType,
  regulationHasForm: regulatoryDocuments.hasForm,
  regulationHasIbr: regulatoryDocuments.hasIbr,
} as const;

/** Map a DB row from issueListSelectColumns to ComplianceIssueWithAnalysis.
 *  Automatically builds TierAnalysis from the analysis pipeline columns in the row. */
function mapRowToIssue(
  row: {
    id: number;
    documentId: number;
    issueType: string;
    regexMatchPattern: string | null;
    regexMatchContext: string;
    url: string | null;
    analysisId: number | null;
    runId: string | null;
    requirementFound: boolean | null;
    verbatimSupportingText: string[] | null;
    isVerbatim: boolean | null;
    requiredByStatute: boolean | null;
    severity: number | null;
    occurrenceNumber: number;
    statuteCitation: string | null;
    decisionRationale: string | null;
    reviewStatus: string | null;
    reviewedBy: string | null;
    reviewedAt: Date | null;
    justificationNotes: string | null;
    teamNotes: string | null;
    originalSeverity: number | null;
    impactType: string | null;
    developerStatus: string | null;
    developerAssigned: string | null;
    developerNotes: string | null;
    resolutionType: string | null;
    resolutionComments: string | null;
    developerQuestion: string | null;
    developerCheckedAt: Date | null;
    state: string;
    createdAt: Date | null;
    // Analysis pipeline fields
    analysisHighestTier: number | null;
    analysisTier1: string | null;
    analysisTier2: string | null;
    analysisTier3: string | null;
    analysisTier3TriggerReason: string | null;
    analysisFinalSeverity: number | null;
    analysisVerbatimReqs: string[] | null;
    analysisArgFor: string | null;
    analysisArgAgainst: string | null;
    analysisContextUsed: unknown;
    analysisWebSummary: string | null;
    analysisFederalMandate: boolean | null;
    analysisStateDiscretion: boolean | null;
    analysisIsJustified: boolean | null;
    analysisPipelineVersion: string | null;
    analysisEasyCleanup: boolean | null;
    analysisCleanupType: string | null;
    analysisCleanupEffort: string | null;
    // Regulation context
    regulationId: number;
    regulationTitle: string | null;
    regulationNycrrTitle: number | null;
    regulationNycrrPart: string | null;
    regulationNycrrSection: string | null;
    regulationNjacTitle: string | null;
    regulationNjacChapter: string | null;
    regulationNjacSubchapter: string | null;
    regulationUrl: string | null;
    regulationSummary: string | null;
    regulationSectionType: string | null;
    regulationHasForm: boolean | null;
    regulationHasIbr: boolean | null;
    regulationContent?: string | null;
  },
): ComplianceIssueWithAnalysis {
  const analysis: TierAnalysis | null = row.analysisHighestTier !== null ? {
    highestTierCompleted: row.analysisHighestTier,
    tier1Classification: row.analysisTier1,
    tier2Classification: row.analysisTier2,
    tier3Classification: row.analysisTier3,
    tier3TriggerReason: row.analysisTier3TriggerReason,
    finalSeverity: row.analysisFinalSeverity,
    verbatimRequirements: row.analysisVerbatimReqs ?? [],
    argumentForRegulation: row.analysisArgFor,
    argumentAgainstRegulation: row.analysisArgAgainst,
    contextUsed: row.analysisContextUsed as ContextEntry[] | null,
    webSearchSummary: row.analysisWebSummary,
    federalMandateFound: row.analysisFederalMandate ?? false,
    stateHasDiscretion: row.analysisStateDiscretion ?? false,
    isJustified: row.analysisIsJustified ?? false,
    pipelineVersion: row.analysisPipelineVersion ?? '',
    easyCleanupCandidate: row.analysisEasyCleanup ?? false,
    cleanupType: row.analysisCleanupType,
    cleanupEffort: row.analysisCleanupEffort,
  } : null;

  return {
    id: Number(row.id),
    documentId: Number(row.documentId),
    issueType: row.issueType,
    regexMatchPattern: row.regexMatchPattern,
    regexMatchContext: row.regexMatchContext,
    url: row.url,
    analysisId: row.analysisId ?? null,
    runId: row.runId ?? null,
    requirementFound: row.requirementFound ?? false,
    verbatimSupportingText: row.verbatimSupportingText ?? [],
    isVerbatim: row.isVerbatim ?? null,
    requiredByStatute: row.requiredByStatute ?? false,
    severity: row.severity,
    occurrenceNumber: row.occurrenceNumber,
    statuteCitation: row.statuteCitation ?? null,
    decisionRationale: row.decisionRationale ?? null,
    reviewStatus: row.reviewStatus,
    reviewedBy: row.reviewedBy,
    reviewedAt: row.reviewedAt,
    justificationNotes: row.justificationNotes,
    teamNotes: row.teamNotes,
    originalSeverity: row.originalSeverity,
    impactType: row.impactType,
    developerStatus: row.developerStatus,
    developerAssigned: row.developerAssigned,
    developerNotes: row.developerNotes,
    resolutionType: row.resolutionType,
    resolutionComments: row.resolutionComments,
    developerQuestion: row.developerQuestion,
    developerCheckedAt: row.developerCheckedAt,
    state: row.state,
    createdAt: row.createdAt,
    regulation: {
      id: row.regulationId,
      title: row.regulationTitle,
      content: row.regulationContent ?? null,
      nycrrTitle: row.regulationNycrrTitle,
      nycrrPart: row.regulationNycrrPart,
      nycrrSection: row.regulationNycrrSection,
      njacTitle: row.regulationNjacTitle,
      njacChapter: row.regulationNjacChapter,
      njacSubchapter: row.regulationNjacSubchapter,
      url: row.regulationUrl,
      summary: row.regulationSummary,
      sectionType: row.regulationSectionType,
      hasForm: row.regulationHasForm,
      hasIbr: row.regulationHasIbr,
    },
    analysis,
  };
}

// ═══════════════════════════════════════════════════════════════════
// Extracted helpers for getAnalysisListPaginated
// Pure functions that can be tested without class instantiation.
// ═══════════════════════════════════════════════════════════════════

/**
 * Filter parameters for getAnalysisListPaginated.
 * Extracted so the type can be referenced by buildAnalysisListFilters.
 */
export interface AnalysisListFilters {
  tierCompleted?: number;
  classification?: string;
  federalMandate?: boolean;
  pipelineRun?: boolean;
  issueType?: string;
  severity?: 'high' | 'medium' | 'low' | 'none';
  severityChanged?: 'increased' | 'decreased' | 'unchanged' | 'no_tier3';
  federalMandateConfirmed?: 'true' | 'false' | 'no_tier3';
  stateDiscretion?: 'true' | 'false' | 'no_tier3';
  alternativeFound?: 'true' | 'false' | 'no_tier3';
  evidenceGap?: 'true' | 'false' | 'no_tier3';
  supersededByLaw?: 'true' | 'false' | 'no_tier3';
  advocacyForChange?: 'true' | 'false' | 'no_tier3';
  tier3Trigger?: string;
  easyCleanup?: 'any' | 'trivial' | 'easy' | 'medium';
  bookmarkedOnly?: boolean;
}

/**
 * Build a single SQL condition for a Tier 3 JSONB flag filter.
 *
 * The tier3_flags JSONB column stores structured flags like:
 *   { "federal_mandate_confirmed": { "value": true, ... }, ... }
 *
 * Each flag has 3 possible filter values:
 * - 'true'    → flag value is true
 * - 'false'   → completed Tier 3 but flag is false or missing
 * - 'no_tier3' → hasn't reached Tier 3 yet
 */
export function buildTier3FlagFilter(
  flagName: string,
  value: 'true' | 'false' | 'no_tier3' | undefined,
): SQL | undefined {
  if (value === undefined) return undefined;

  if (value === 'true') {
    return sql`(${complianceIssueAnalyses.tier3Flags}->${flagName}->>'value')::boolean = true`;
  }
  if (value === 'false') {
    return sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND (
      (${complianceIssueAnalyses.tier3Flags}->${flagName}->>'value')::boolean = false
      OR ${complianceIssueAnalyses.tier3Flags}->${flagName} IS NULL
    )`;
  }
  // 'no_tier3'
  return sql`${complianceIssueAnalyses.tier3Classification} IS NULL`;
}

/**
 * Build an array of SQL conditions for the analysis list query.
 * Always includes the state condition as the first element.
 */
export function buildAnalysisListFilters(params: {
  state: StateCode;
  filters?: AnalysisListFilters;
}): SQL[] {
  const { state, filters } = params;

  const conditions: SQL[] = [
    eq(complianceIssueAnalyses.state, normalizeState(state)),
  ];

  if (!filters) return conditions;

  if (filters.tierCompleted !== undefined) {
    conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, filters.tierCompleted));
  }

  if (filters.classification) {
    conditions.push(
      or(
        eq(complianceIssueAnalyses.tier3Classification, filters.classification),
        and(
          isNull(complianceIssueAnalyses.tier3Classification),
          eq(complianceIssueAnalyses.tier2Classification, filters.classification)
        ),
        and(
          isNull(complianceIssueAnalyses.tier3Classification),
          isNull(complianceIssueAnalyses.tier2Classification),
          eq(complianceIssueAnalyses.tier1Classification, filters.classification)
        )
      )!
    );
  }

  if (filters.federalMandate !== undefined) {
    conditions.push(eq(complianceIssueAnalyses.federalMandateFound, filters.federalMandate));
  }

  if (filters.pipelineRun !== undefined) {
    if (filters.pipelineRun) {
      conditions.push(gte(complianceIssueAnalyses.highestTierCompleted, 1));
    } else {
      conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, 0));
    }
  }

  if (filters.issueType) {
    conditions.push(eq(complianceIssueAnalyses.issueType, filters.issueType));
  }

  // Severity filter (high=7-10, medium=4-6, low=1-3, none=null)
  if (filters.severity) {
    const severityExpr = sql`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`;
    if (filters.severity === 'high') {
      conditions.push(sql`${severityExpr} >= 7`);
    } else if (filters.severity === 'medium') {
      conditions.push(sql`${severityExpr} >= 4 AND ${severityExpr} < 7`);
    } else if (filters.severity === 'low') {
      conditions.push(sql`${severityExpr} >= 1 AND ${severityExpr} < 4`);
    } else if (filters.severity === 'none') {
      conditions.push(sql`${severityExpr} IS NULL`);
    }
  }

  // Severity changed filter
  if (filters.severityChanged) {
    if (filters.severityChanged === 'increased') {
      conditions.push(sql`${complianceIssueAnalyses.tier3SeverityAdjustment} > 0`);
    } else if (filters.severityChanged === 'decreased') {
      conditions.push(sql`${complianceIssueAnalyses.tier3SeverityAdjustment} < 0`);
    } else if (filters.severityChanged === 'unchanged') {
      conditions.push(
        or(
          eq(complianceIssueAnalyses.tier3SeverityAdjustment, 0),
          and(
            sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL`,
            isNull(complianceIssueAnalyses.tier3SeverityAdjustment)
          )
        )!
      );
    } else if (filters.severityChanged === 'no_tier3') {
      conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
    }
  }

  // Tier 3 JSONB flag filters
  const federalMandateFilter = buildTier3FlagFilter('federal_mandate_confirmed', filters.federalMandateConfirmed);
  if (federalMandateFilter) conditions.push(federalMandateFilter);

  const stateDiscretionFilter = buildTier3FlagFilter('state_discretion_found', filters.stateDiscretion);
  if (stateDiscretionFilter) conditions.push(stateDiscretionFilter);

  const alternativeFilter = buildTier3FlagFilter('modernized_alternative_found', filters.alternativeFound);
  if (alternativeFilter) conditions.push(alternativeFilter);

  const supersededFilter = buildTier3FlagFilter('superseded_by_law', filters.supersededByLaw);
  if (supersededFilter) conditions.push(supersededFilter);

  const advocacyFilter = buildTier3FlagFilter('advocacy_for_change', filters.advocacyForChange);
  if (advocacyFilter) conditions.push(advocacyFilter);

  // Evidence gap filter (boolean column, not JSONB)
  if (filters.evidenceGap) {
    if (filters.evidenceGap === 'true') {
      conditions.push(eq(complianceIssueAnalyses.tier3EvidenceGap, true));
    } else if (filters.evidenceGap === 'false') {
      conditions.push(
        sql`(${complianceIssueAnalyses.tier3EvidenceGap} = false OR (
          ${complianceIssueAnalyses.tier3Classification} IS NOT NULL
          AND ${complianceIssueAnalyses.tier3EvidenceGap} IS NULL
        ))`
      );
    } else if (filters.evidenceGap === 'no_tier3') {
      conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
    }
  }

  // Tier 3 trigger filter
  if (filters.tier3Trigger) {
    // IMPORTANT: These thresholds must match backend/scripts/research_pipeline/routing.py
    const HIGH_RISK_ISSUE_TYPES = ['newspaper', 'notarization', 'wet_signature', 'witness', 'mandated_reports'];
    const IN_PERSON_PREFIX = 'in_person';

    if (filters.tier3Trigger === 'high_risk_issue') {
      conditions.push(
        and(
          or(
            inArray(complianceIssueAnalyses.issueType, HIGH_RISK_ISSUE_TYPES),
            like(complianceIssueAnalyses.issueType, `${IN_PERSON_PREFIX}%`)
          )!,
          gte(complianceIssueAnalyses.severity, 7)
        )!
      );
    } else if (filters.tier3Trigger === 'federal_citation') {
      conditions.push(eq(complianceIssueAnalyses.citesFederalStatute, true));
    } else if (filters.tier3Trigger === 'no_alternative') {
      conditions.push(
        and(
          eq(complianceIssueAnalyses.claimsNoAlternative, true),
          gte(complianceIssueAnalyses.severity, 7)
        )!
      );
    } else if (filters.tier3Trigger === 'high_severity') {
      conditions.push(
        and(
          eq(complianceIssueAnalyses.tier2Classification, 'burdensome'),
          gte(complianceIssueAnalyses.severity, 8)
        )!
      );
    } else if (filters.tier3Trigger === 'controversial') {
      conditions.push(
        and(
          eq(complianceIssueAnalyses.tier2Classification, 'justified'),
          eq(complianceIssueAnalyses.potentiallyControversial, true)
        )!
      );
    } else if (filters.tier3Trigger === 'mandate_suspected') {
      conditions.push(eq(complianceIssueAnalyses.federalMandateSuspected, true));
    } else if (filters.tier3Trigger === 'not_triggered') {
      conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
    }
  }

  // Easy cleanup filter
  if (filters.easyCleanup) {
    if (filters.easyCleanup === 'any') {
      conditions.push(eq(complianceIssueAnalyses.easyCleanupCandidate, true));
    } else {
      conditions.push(
        and(
          eq(complianceIssueAnalyses.easyCleanupCandidate, true),
          eq(complianceIssueAnalyses.cleanupEffort, filters.easyCleanup)
        )!
      );
    }
  }

  // Bookmarked only filter
  if (filters.bookmarkedOnly) {
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${bookmarks}
        WHERE ${bookmarks.analysisId} = ${complianceIssueAnalyses.id}
      )`
    );
  }

  return conditions;
}

/**
 * Build order-by clauses for the analysis list query.
 * Returns an array of SQL/drizzle order expressions.
 *
 * For severity sorting: NULLS LAST, then easy cleanup candidates first,
 * then by effort level, then group by issue type, then stable id tiebreaker.
 *
 * For other sorts: primary sort + stable id tiebreaker.
 */
export function buildAnalysisListSort(
  sortBy: string,
  sortDirection: string,
): SQL[] {
  const sortColumn = {
    issueType: complianceIssueAnalyses.issueType,
    severity: sql`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
    highestTier: complianceIssueAnalyses.highestTierCompleted,
    createdAt: complianceIssueAnalyses.createdAt,
  }[sortBy] ?? complianceIssueAnalyses.createdAt;

  // For severity sorting, put nulls at the end
  const primarySort = sortBy === 'severity' && sortDirection === 'desc'
    ? sql`${sortColumn} DESC NULLS LAST`
    : sortDirection === 'asc' ? asc(sortColumn) : desc(sortColumn);

  // For severity: easy cleanup candidates first, then by effort level,
  // then group by issue type, then stable id tiebreaker
  if (sortBy === 'severity') {
    return [
      primarySort,
      sql`${complianceIssueAnalyses.easyCleanupCandidate} DESC NULLS LAST`,
      sql`CASE ${complianceIssueAnalyses.cleanupEffort}
        WHEN 'trivial' THEN 1
        WHEN 'easy' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
      END ASC`,
      asc(complianceIssueAnalyses.issueType),
      asc(complianceIssueAnalyses.id),
    ];
  }

  return [primarySort, asc(complianceIssueAnalyses.id)];
}

/** Raw row shape from the analysis list query (before mapping). */
export interface AnalysisListRawRow {
  documentId: number | string;
  issueType: string;
  highestTierCompleted: number | null;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  finalSeverity: number | null;
  federalMandateFound: boolean | null;
  isJustified: boolean | null;
  tier2RerunCount: number | null;
  createdAt: Date | null;
  easyCleanupCandidate: boolean | null;
  cleanupType: string | null;
  cleanupEffort: string | null;
  tier3TriggerReason: string | null;
  docTitle: string | null;
  docShortTitle: string | null;
  docNjacTitle: string | null;       // varchar in schema
  docNjacChapter: string | null;
  docNjacSubchapter: string | null;
  docNycrrTitle: number | null;       // integer in schema
  docNycrrPart: string | null;
  docNycrrSection: string | null;
}

/**
 * Transform a raw analysis list query row into an AnalysisListItem.
 * Builds citation strings from NJAC/NYCRR fields and applies default values.
 */
export function mapAnalysisListRow(row: AnalysisListRawRow): AnalysisListItem {
  // Build citation
  let citation: string | null = null;
  if (row.docNjacTitle) {
    citation = `N.J.A.C. ${row.docNjacTitle}:${row.docNjacChapter || ''}${row.docNjacSubchapter ? `-${row.docNjacSubchapter}` : ''}`;
  } else if (row.docNycrrTitle) {
    citation = `${row.docNycrrTitle} NYCRR ${row.docNycrrPart || ''}${row.docNycrrSection ? `.${row.docNycrrSection}` : ''}`;
  }

  return {
    documentId: Number(row.documentId),
    issueType: row.issueType,
    documentTitle: row.docShortTitle || row.docTitle,
    citation,
    highestTierCompleted: row.highestTierCompleted ?? 0,
    tier1Classification: row.tier1Classification,
    tier2Classification: row.tier2Classification,
    tier3Classification: row.tier3Classification,
    finalSeverity: row.finalSeverity,
    federalMandateFound: row.federalMandateFound ?? false,
    isJustified: row.isJustified ?? false,
    rerunCount: row.tier2RerunCount ?? 0,
    createdAt: row.createdAt,
    easyCleanupCandidate: row.easyCleanupCandidate ?? false,
    cleanupType: row.cleanupType,
    cleanupEffort: row.cleanupEffort,
    tier3TriggerReason: row.tier3TriggerReason,
  };
}

export class ComplianceIssuesRepository extends BaseRepository {
  async getById(id: number): Promise<ComplianceIssue | undefined> {
    const result = await this.db
      .select()
      .from(complianceIssues)
      .where(eq(complianceIssues.id, id))
      .limit(1);

    return result[0];
  }

  /**
   * Find the analysis row corresponding to a compliance issue.
   * PR 6.5: Reads analysis_id FK directly; falls back to composite lookup for NULL analysis_id.
   * PR 6.3: Used by mutations that accept compliance_issues.id but now update analyses.
   */
  private async findAnalysisForIssue(issueId: number): Promise<{ analysisId: number; documentId: number; issueType: string } | null> {
    const issue = await this.getById(issueId);
    if (!issue) return null;

    // PR 6.5: Direct FK read when analysis_id is populated
    if (issue.analysisId) {
      return { analysisId: issue.analysisId, documentId: issue.documentId, issueType: issue.issueType };
    }

    // Fallback: composite lookup for rows where analysis_id is still NULL
    const [analysis] = await this.db
      .select({ id: complianceIssueAnalyses.id })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.documentId, issue.documentId),
        eq(complianceIssueAnalyses.issueType, issue.issueType)
      ))
      .limit(1);

    if (!analysis) return null;
    return { analysisId: analysis.id, documentId: issue.documentId, issueType: issue.issueType };
  }

  async getByDocumentId(documentId: number): Promise<ComplianceIssueWithAnalysisFields[]> {
    const results = await this.db
      .select({
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        issueType: complianceIssues.issueType,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        url: complianceIssues.url,
        regexMatchPattern: complianceIssues.regexMatchPattern,
        regexMatchContext: complianceIssues.regexMatchContext,
        state: complianceIssues.state,
        createdAt: complianceIssues.createdAt,
        analysisId: complianceIssues.analysisId,
        runId: complianceIssues.runId,
        // Analysis-sourced fields (PR 6.2)
        requirementFound: complianceIssueAnalyses.requirementFound,
        verbatimSupportingText: complianceIssueAnalyses.verbatimRequirements,
        isVerbatim: complianceIssueAnalyses.isVerbatim,
        requiredByStatute: complianceIssueAnalyses.citesFederalStatute,
        statuteCitation: complianceIssueAnalyses.federalCitation,
        decisionRationale: complianceIssueAnalyses.tier1Reasoning,
        // Review/developer fields (PR 6.3: from analyses)
        severity: complianceIssueAnalyses.reviewerSeverity,
        originalSeverity: complianceIssueAnalyses.reviewerOriginalSeverity,
        reviewStatus: complianceIssueAnalyses.reviewStatus,
        reviewedBy: complianceIssueAnalyses.reviewedBy,
        reviewedAt: complianceIssueAnalyses.reviewedAt,
        justificationNotes: complianceIssueAnalyses.justificationNotes,
        teamNotes: complianceIssueAnalyses.teamNotes,
        impactType: complianceIssueAnalyses.impactType,
        developerStatus: complianceIssueAnalyses.developerStatus,
        developerAssigned: complianceIssueAnalyses.developerAssigned,
        developerNotes: complianceIssueAnalyses.developerNotes,
        resolutionType: complianceIssueAnalyses.resolutionType,
        resolutionComments: complianceIssueAnalyses.resolutionComments,
        developerQuestion: complianceIssueAnalyses.developerQuestion,
        developerCheckedAt: complianceIssueAnalyses.developerCheckedAt,
      })
      .from(complianceIssues)
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(eq(complianceIssues.documentId, documentId))
      .orderBy(asc(complianceIssues.issueType));

    return results.map(row => ({
      ...row,
      id: Number(row.id),
      documentId: Number(row.documentId),
      requirementFound: row.requirementFound ?? false,
      verbatimSupportingText: row.verbatimSupportingText ?? [],
      isVerbatim: row.isVerbatim ?? null,
      requiredByStatute: row.requiredByStatute ?? false,
      statuteCitation: row.statuteCitation ?? null,
      decisionRationale: row.decisionRationale ?? null,
    }));
  }

  /**
   * Gets all compliance issues (regex matches) for a specific document and issue type.
   * Used for print mode to show original regex match contexts.
   */
  async getByDocumentIdAndIssueType(documentId: number, issueType: string): Promise<ComplianceIssue[]> {
    return this.db
      .select()
      .from(complianceIssues)
      .where(
        and(
          eq(complianceIssues.documentId, documentId),
          eq(complianceIssues.issueType, issueType)
        )
      )
      .orderBy(asc(complianceIssues.occurrenceNumber));
  }

  async updateReview(id: number, data: UpdateComplianceIssueReviewInput): Promise<ComplianceIssueWithAnalysisFields | undefined> {
    // PR 6.3: Review fields now live on compliance_issue_analyses
    const analysisInfo = await this.findAnalysisForIssue(id);
    if (!analysisInfo) return undefined;

    // Get current analysis to check if we need to preserve original severity
    const [currentAnalysis] = await this.db
      .select({
        reviewerSeverity: complianceIssueAnalyses.reviewerSeverity,
        reviewerOriginalSeverity: complianceIssueAnalyses.reviewerOriginalSeverity,
      })
      .from(complianceIssueAnalyses)
      .where(eq(complianceIssueAnalyses.id, analysisInfo.analysisId))
      .limit(1);

    // Build update data for the analysis row
    const updateData: Record<string, unknown> = {
      reviewStatus: data.reviewStatus,
      reviewedBy: data.reviewedBy ?? null,
      reviewedAt: new Date(),
      justificationNotes: data.justificationNotes ?? null,
      teamNotes: data.teamNotes ?? null,
      impactType: data.impactType ?? null,
    };

    // If reviewer is changing severity and original hasn't been preserved yet, save it
    if (data.severity !== undefined && currentAnalysis?.reviewerOriginalSeverity === null && currentAnalysis?.reviewerSeverity !== null) {
      updateData.reviewerOriginalSeverity = currentAnalysis.reviewerSeverity;
    }

    // Update severity if provided
    if (data.severity !== undefined) {
      updateData.reviewerSeverity = data.severity;
    }

    await this.db
      .update(complianceIssueAnalyses)
      .set(updateData)
      .where(eq(complianceIssueAnalyses.id, analysisInfo.analysisId));

    // Return via getByDocumentId to get the full shape with aliased fields
    const issues = await this.getByDocumentId(analysisInfo.documentId);
    return issues.find(i => i.id === id);
  }

  /**
   * Get all unique issue types for filter dropdown
   */
  async getIssueTypes(state: StateCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ issueType: complianceIssues.issueType })
      .from(complianceIssues)
      .where(eq(complianceIssues.state, normalizeState(state)))
      .orderBy(asc(complianceIssues.issueType));

    return result.map(r => r.issueType);
  }

  /**
   * Get counts by review status for progress display.
   * PR 6.3: Counts analysis rows (one per document+issue_type) instead of match rows.
   * Only counts LLM-confirmed issues (requirement_found = TRUE) to exclude regex-only matches.
   */
  async getCountsByStatus(state: StateCode): Promise<ComplianceIssueStatusCounts> {
    const result = await this.db
      .select({
        status: complianceIssueAnalyses.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        eq(complianceIssueAnalyses.requirementFound, true)
      ))
      .groupBy(complianceIssueAnalyses.reviewStatus);

    // Initialize counts with zeros
    const counts: ComplianceIssueStatusCounts = {
      unreviewed: 0,
      confirmed: 0,
      rejected_clear_fp: 0,
      rejected_not_obvious_bad: 0,
      needs_context: 0,
      deferred: 0,
      total: 0,
    };

    // Fill in counts from query results
    for (const row of result) {
      const status = (row.status ?? 'unreviewed') as ReviewStatus;
      if (status in counts) {
        counts[status as keyof Omit<ComplianceIssueStatusCounts, 'total'>] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get counts by issue type.
   * PR 6.3: Counts confirmed analyses (requirement_found = TRUE) instead of raw regex matches.
   */
  async getCountsByType(state: StateCode): Promise<Record<string, number>> {
    const result = await this.db
      .select({
        issueType: complianceIssueAnalyses.issueType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        eq(complianceIssueAnalyses.requirementFound, true)
      ))
      .groupBy(complianceIssueAnalyses.issueType);

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.issueType] = row.count;
    }

    return counts;
  }

  /**
   * Get aggregate stats for dashboard
   * PR 6.3: All counts query compliance_issue_analyses with requirementFound = true
   * to be consistent (analytics should use analyses table per architecture).
   */
  async getStatsByState(state?: StateCode): Promise<ComplianceIssueStats> {
    const baseConditions = [
      eq(complianceIssueAnalyses.requirementFound, true),
      ...(state ? [eq(complianceIssueAnalyses.state, normalizeState(state))] : []),
    ];

    // Get total count (from analyses with requirementFound = true)
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssueAnalyses)
      .where(and(...baseConditions));

    // Get unreviewed count (from analyses with requirementFound = true)
    const [unreviewedResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssueAnalyses)
      .where(and(
        ...baseConditions,
        or(
          eq(complianceIssueAnalyses.reviewStatus, 'unreviewed'),
          isNull(complianceIssueAnalyses.reviewStatus)
        )
      ));

    // Get counts by type (from analyses with requirementFound = true)
    const typeResults = await this.db
      .select({
        issueType: complianceIssueAnalyses.issueType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(...baseConditions))
      .groupBy(complianceIssueAnalyses.issueType);

    const byType: Record<string, number> = {};
    for (const row of typeResults) {
      if (row.issueType) {
        byType[row.issueType] = row.count;
      }
    }

    return {
      total: totalResult?.count ?? 0,
      byType,
      unreviewed: unreviewedResult?.count ?? 0,
    };
  }

  /**
   * Get paginated compliance issues with regulation context and pipeline analysis for review queue
   */
  async getAllPaginated(
    options: ComplianceIssuePaginationOptions
  ): Promise<PaginatedComplianceIssuesResult> {
    const { state, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssues.state, normalizeState(state)),
    ];

    if (filters) {
      // Status filter — PR 6.3: reads from analyses
      if (filters.status && filters.status !== 'all') {
        if (filters.status === 'unreviewed') {
          conditions.push(
            or(
              eq(complianceIssueAnalyses.reviewStatus, 'unreviewed'),
              isNull(complianceIssueAnalyses.reviewStatus)
            )!
          );
        } else {
          conditions.push(eq(complianceIssueAnalyses.reviewStatus, filters.status));
        }
      }

      // Issue type filter
      if (filters.issueType && filters.issueType !== 'all') {
        conditions.push(eq(complianceIssues.issueType, filters.issueType));
      }

      // Severity filter (high=7-10, medium=4-6, low=1-3) — reads from analyses
      if (filters.severity && filters.severity !== 'all') {
        if (filters.severity === 'high') {
          conditions.push(gte(complianceIssueAnalyses.finalSeverity, 7));
        } else if (filters.severity === 'medium') {
          conditions.push(and(gte(complianceIssueAnalyses.finalSeverity, 4), lt(complianceIssueAnalyses.finalSeverity, 7))!);
        } else if (filters.severity === 'low') {
          conditions.push(lt(complianceIssueAnalyses.finalSeverity, 4));
        }
      }

      // Required by statute filter — reads from analyses
      if (filters.requiredByStatute !== undefined && filters.requiredByStatute !== 'all') {
        conditions.push(eq(complianceIssueAnalyses.citesFederalStatute, filters.requiredByStatute));
      }

      // Requirement found filter (LLM confirmation) — reads from analyses
      if (filters.requirementFound !== undefined && filters.requirementFound !== 'all') {
        conditions.push(eq(complianceIssueAnalyses.requirementFound, filters.requirementFound));
      }

      // Tier completed filter (research pipeline)
      if (filters.tierCompleted !== undefined && filters.tierCompleted !== 'all') {
        const tier = parseInt(filters.tierCompleted, 10);
        if (tier === 0) {
          // No analysis = null join result
          conditions.push(isNull(complianceIssueAnalyses.highestTierCompleted));
        } else {
          conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, tier));
        }
      }

      // Federal mandate filter
      if (filters.federalMandate !== undefined && filters.federalMandate !== 'all') {
        conditions.push(eq(complianceIssueAnalyses.federalMandateFound, filters.federalMandate));
      }

      // Has analysis filter
      if (filters.hasAnalysis !== undefined && filters.hasAnalysis !== 'all') {
        if (filters.hasAnalysis === true) {
          conditions.push(sql`${complianceIssueAnalyses.highestTierCompleted} IS NOT NULL`);
        } else {
          conditions.push(isNull(complianceIssueAnalyses.highestTierCompleted));
        }
      }
    }

    const whereClause = and(...conditions);

    // Get total count (includes LEFT JOIN to analyses for tier filter support)
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause);

    // Build sort column — severity and review fields now come from analyses
    const sortColumn = {
      issueType: complianceIssues.issueType,
      createdAt: complianceIssues.createdAt,
      reviewedAt: complianceIssueAnalyses.reviewedAt,
      severity: complianceIssueAnalyses.finalSeverity,
      developerCheckedAt: complianceIssueAnalyses.developerCheckedAt,
    }[sortBy] ?? complianceIssues.createdAt;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(complianceIssues.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context and analysis data
    const results = await this.db
      .select({
        ...issueListSelectColumns,
        regulationContent: regulatoryDocuments.content,
      })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform results — mapRowToIssue now builds TierAnalysis automatically
    const data: ComplianceIssueWithAnalysis[] = results.map(row => mapRowToIssue(row));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Update developer tracking fields for a compliance issue.
   * PR 6.3: Developer fields now live on compliance_issue_analyses.
   */
  async updateDeveloperStatus(id: number, data: UpdateComplianceIssueDeveloperInput): Promise<ComplianceIssueWithAnalysisFields | undefined> {
    const analysisInfo = await this.findAnalysisForIssue(id);
    if (!analysisInfo) return undefined;

    await this.db
      .update(complianceIssueAnalyses)
      .set({
        developerStatus: data.developerStatus,
        developerAssigned: data.developerAssigned,
        developerNotes: data.developerNotes ?? null,
        resolutionType: data.resolutionType ?? null,
        resolutionComments: data.resolutionComments ?? null,
        developerQuestion: data.developerQuestion ?? null,
        developerCheckedAt: new Date(),
      })
      .where(eq(complianceIssueAnalyses.id, analysisInfo.analysisId));

    // Return via getByDocumentId to get the full shape with aliased fields
    const issues = await this.getByDocumentId(analysisInfo.documentId);
    return issues.find(i => i.id === id);
  }

  /**
   * Get counts by developer status for progress display.
   * PR 6.3: Counts analysis rows (one per document+issue_type) instead of match rows.
   */
  async getDeveloperStatusCounts(state: StateCode): Promise<DeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: complianceIssueAnalyses.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        // Only count reviewed items
        ne(complianceIssueAnalyses.reviewStatus, 'unreviewed')
      ))
      .groupBy(complianceIssueAnalyses.developerStatus);

    // Initialize counts with zeros
    const counts: DeveloperStatusCounts = {
      unresolved: 0,
      resolved: 0,
      pending: 0,
      backlogged: 0,
      need_more_info: 0,
      total: 0,
    };

    // Fill in counts from query results
    for (const row of result) {
      const status = (row.status ?? 'unresolved') as DeveloperStatus;
      if (status in counts) {
        counts[status] = row.count;
      }
      counts.total += row.count;
    }

    return counts;
  }

  /**
   * Get paginated reviewed compliance issues for developer mode.
   * PR 6.3: Review/developer filters and fields now come from analyses.
   */
  async getReviewedPaginated(
    options: ComplianceIssuePaginationOptions & {
      developerStatus?: DeveloperStatus | 'all';
      developerAssigned?: Developer;
    }
  ): Promise<PaginatedComplianceIssuesResult> {
    const { state, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions - only reviewed items (from analyses)
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssues.state, normalizeState(state)),
      ne(complianceIssueAnalyses.reviewStatus, 'unreviewed'),
    ];

    // Developer status filter (from analyses)
    if (developerStatus && developerStatus !== 'all') {
      conditions.push(eq(complianceIssueAnalyses.developerStatus, developerStatus));
    }

    // Developer assigned filter (from analyses)
    if (developerAssigned) {
      conditions.push(eq(complianceIssueAnalyses.developerAssigned, developerAssigned));
    }

    if (filters) {
      // Status filter (from analyses)
      if (filters.status && filters.status !== 'all') {
        conditions.push(eq(complianceIssueAnalyses.reviewStatus, filters.status));
      }

      // Issue type filter
      if (filters.issueType && filters.issueType !== 'all') {
        conditions.push(eq(complianceIssues.issueType, filters.issueType));
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause);

    // Build sort column — review/dev fields now come from analyses
    const sortColumn = {
      issueType: complianceIssues.issueType,
      createdAt: complianceIssues.createdAt,
      reviewedAt: complianceIssueAnalyses.reviewedAt,
      severity: complianceIssueAnalyses.finalSeverity,
      developerCheckedAt: complianceIssueAnalyses.developerCheckedAt,
    }[sortBy] ?? complianceIssues.createdAt;

    const primarySort = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);
    const secondarySort = asc(complianceIssues.id); // Tiebreaker for consistent ordering

    // Get paginated results with regulation context and analysis fields
    const results = await this.db
      .select(issueListSelectColumns)
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause)
      .orderBy(primarySort, secondarySort)
      .limit(pageSize)
      .offset(offset);

    const data: ComplianceIssueWithAnalysis[] = results.map(row => mapRowToIssue(row));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get compliance issues that need more info.
   * PR 6.3: Developer status filter now from analyses.
   */
  async getNeedMoreInfoIssues(
    state: StateCode,
    options: {
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedComplianceIssuesResult> {
    const { page, pageSize } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(complianceIssues.state, normalizeState(state)),
      eq(complianceIssueAnalyses.developerStatus, 'need_more_info'),
    ];

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause);

    // Order by developerCheckedAt desc (from analyses)
    const orderBy = [desc(complianceIssueAnalyses.developerCheckedAt)];

    // Get paginated results with analysis fields
    const results = await this.db
      .select(issueListSelectColumns)
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause)
      .orderBy(...orderBy)
      .limit(pageSize)
      .offset(offset);

    const data: ComplianceIssueWithAnalysis[] = results.map(row => mapRowToIssue(row));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get count of need_more_info issues.
   * PR 6.3: Developer status now on analyses.
   */
  async getNeedMoreInfoCount(state: StateCode): Promise<{ total: number }> {
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        eq(complianceIssueAnalyses.developerStatus, 'need_more_info'),
      ));

    return { total };
  }

  /**
   * Clear all review and developer fields, returning item to unreviewed queue.
   * Restores severity to original value if it was changed.
   * PR 6.3: These fields now live on compliance_issue_analyses.
   */
  async clearForReview(id: number): Promise<ComplianceIssueWithAnalysisFields | undefined> {
    const analysisInfo = await this.findAnalysisForIssue(id);
    if (!analysisInfo) return undefined;

    // Get current analysis to check original severity
    const [currentAnalysis] = await this.db
      .select({
        reviewerSeverity: complianceIssueAnalyses.reviewerSeverity,
        reviewerOriginalSeverity: complianceIssueAnalyses.reviewerOriginalSeverity,
      })
      .from(complianceIssueAnalyses)
      .where(eq(complianceIssueAnalyses.id, analysisInfo.analysisId))
      .limit(1);

    // Restore severity from originalSeverity if it was changed
    const restoredSeverity = currentAnalysis?.reviewerOriginalSeverity ?? currentAnalysis?.reviewerSeverity;

    await this.db
      .update(complianceIssueAnalyses)
      .set({
        // Review fields
        reviewStatus: 'unreviewed',
        reviewedBy: null,
        reviewedAt: null,
        justificationNotes: null,
        teamNotes: null,
        reviewerSeverity: restoredSeverity ?? null,
        reviewerOriginalSeverity: null,
        impactType: null,
        // Developer fields
        developerStatus: 'unresolved',
        developerAssigned: null,
        developerNotes: null,
        resolutionType: null,
        resolutionComments: null,
        developerQuestion: null,
        developerCheckedAt: null,
      })
      .where(eq(complianceIssueAnalyses.id, analysisInfo.analysisId));

    // Return via getByDocumentId to get the full shape with aliased fields
    const issues = await this.getByDocumentId(analysisInfo.documentId);
    return issues.find(i => i.id === id);
  }

  /**
   * Get a smart batch of compliance issues for suggestion mode.
   * Groups items by the specified grouping mode and returns a batch with metadata.
   */
  async getSuggestionBatch(options: {
    state: StateCode;
    batchSize: number;
    excludeIds: number[];
    groupingMode: 'issue_type' | 'section' | 'combined';
    focus?: {
      issueType?: string;
      section?: string;
      pattern?: string;
    };
    /** Issue types to avoid when selecting a new group (for diversity) */
    recentIssueTypes?: string[];
  }): Promise<{
    data: ComplianceIssueWithAnalysis[];
    groupingMode: 'issue_type' | 'section' | 'combined';
    focus: { issueType?: string; section?: string; pattern?: string };
    remainingInFocus: number;
    nextGroupingMode: 'issue_type' | 'section' | 'combined';
    totalUnreviewed: number;
  }> {
    const { state, batchSize, excludeIds, groupingMode, focus, recentIssueTypes } = options;

    // Base conditions: LLM confirmed (from analyses) + unreviewed + exclude shown IDs
    const baseConditions = [
      eq(complianceIssues.state, normalizeState(state)),
      eq(complianceIssueAnalyses.requirementFound, true),
      or(
        eq(complianceIssueAnalyses.reviewStatus, 'unreviewed'),
        isNull(complianceIssueAnalyses.reviewStatus)
      )!,
    ];

    // Exclude already-shown IDs
    if (excludeIds.length > 0) {
      baseConditions.push(
        notInArray(complianceIssues.id, excludeIds)
      );
    }

    // Get total unreviewed count (for progress display) — needs analyses join for requirementFound filter
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(and(...baseConditions));
    const totalUnreviewed = totalResult?.count ?? 0;

    // Determine the next grouping mode in the cycle
    const modeOrder: Array<'issue_type' | 'section' | 'combined'> = ['issue_type', 'section', 'combined'];
    const currentIndex = modeOrder.indexOf(groupingMode);
    const nextGroupingMode = modeOrder[(currentIndex + 1) % modeOrder.length];

    // If no items left, return empty
    if (totalUnreviewed === 0) {
      return {
        data: [],
        groupingMode,
        focus: {},
        remainingInFocus: 0,
        nextGroupingMode,
        totalUnreviewed: 0,
      };
    }

    // Determine focus based on grouping mode
    let selectedFocus: { issueType?: string; section?: string; pattern?: string } = {};
    let focusConditions = [...baseConditions];

    if (groupingMode === 'issue_type') {
      // Group by issue_type, pick randomly from top groups (weighted by count)
      if (focus?.issueType) {
        selectedFocus.issueType = focus.issueType;
      } else {
        // Build conditions for group selection, excluding recent issue types for diversity
        const groupSelectionConditions = [...baseConditions];
        if (recentIssueTypes && recentIssueTypes.length > 0) {
          groupSelectionConditions.push(
            notInArray(complianceIssues.issueType, recentIssueTypes)
          );
        }

        // Get top 5 issue types by count for random selection — needs analyses join
        let typeGroups = await this.db
          .select({
            issueType: complianceIssues.issueType,
            count: sql<number>`count(*)::int`,
          })
          .from(complianceIssues)
          .leftJoin(
            complianceIssueAnalyses,
            eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
          )
          .where(and(...groupSelectionConditions))
          .groupBy(complianceIssues.issueType)
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        // If no results (all types were recent), fall back to any type
        if (typeGroups.length === 0 && recentIssueTypes && recentIssueTypes.length > 0) {
          typeGroups = await this.db
            .select({
              issueType: complianceIssues.issueType,
              count: sql<number>`count(*)::int`,
            })
            .from(complianceIssues)
            .leftJoin(
              complianceIssueAnalyses,
              eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
            )
            .where(and(...baseConditions))
            .groupBy(complianceIssues.issueType)
            .orderBy(desc(sql`count(*)`))
            .limit(5);
        }

        if (typeGroups.length > 0) {
          // Weighted random selection: larger groups have higher probability
          const totalCount = typeGroups.reduce((sum, g) => sum + g.count, 0);
          const random = Math.random() * totalCount;
          let cumulative = 0;
          for (const group of typeGroups) {
            cumulative += group.count;
            if (random <= cumulative) {
              selectedFocus.issueType = group.issueType;
              break;
            }
          }
          // Fallback to first if somehow not selected
          if (!selectedFocus.issueType) {
            selectedFocus.issueType = typeGroups[0].issueType;
          }
        }
      }

      if (selectedFocus.issueType) {
        focusConditions.push(eq(complianceIssues.issueType, selectedFocus.issueType));
      }
    } else if (groupingMode === 'section') {
      // Group by section (using njacTitle or nycrrTitle as section identifier)
      if (focus?.section) {
        selectedFocus.section = focus.section;
      } else {
        // Get top 5 sections by count for random selection — needs analyses join
        const sectionGroups = await this.db
          .select({
            section: sql<string>`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`,
            count: sql<number>`count(*)::int`,
          })
          .from(complianceIssues)
          .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
          .leftJoin(
            complianceIssueAnalyses,
            eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
          )
          .where(and(...baseConditions))
          .groupBy(sql`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`)
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        if (sectionGroups.length > 0) {
          // Weighted random selection: larger sections have higher probability
          const validGroups = sectionGroups.filter(g => g.section != null);
          if (validGroups.length > 0) {
            const totalCount = validGroups.reduce((sum, g) => sum + g.count, 0);
            const random = Math.random() * totalCount;
            let cumulative = 0;
            for (const group of validGroups) {
              cumulative += group.count;
              if (random <= cumulative) {
                selectedFocus.section = group.section;
                break;
              }
            }
            // Fallback to first if somehow not selected
            if (!selectedFocus.section) {
              selectedFocus.section = validGroups[0].section;
            }
          }
        }
      }

      if (selectedFocus.section) {
        focusConditions.push(
          or(
            eq(regulatoryDocuments.njacTitle, selectedFocus.section),
            sql`${regulatoryDocuments.nycrrTitle}::text = ${selectedFocus.section}`
          )!
        );
      }
    } else {
      // Combined: group by section + issue_type
      if (focus?.issueType && focus?.section) {
        selectedFocus = { issueType: focus.issueType, section: focus.section };
      } else {
        // Build conditions for group selection, excluding recent issue types for diversity
        const groupSelectionConditions = [...baseConditions];
        if (recentIssueTypes && recentIssueTypes.length > 0) {
          groupSelectionConditions.push(
            notInArray(complianceIssues.issueType, recentIssueTypes)
          );
        }

        // Get top 5 section + issue_type combos for random selection — needs analyses join
        let combinedGroups = await this.db
          .select({
            issueType: complianceIssues.issueType,
            section: sql<string>`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`,
            count: sql<number>`count(*)::int`,
          })
          .from(complianceIssues)
          .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
          .leftJoin(
            complianceIssueAnalyses,
            eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
          )
          .where(and(...groupSelectionConditions))
          .groupBy(
            complianceIssues.issueType,
            sql`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`
          )
          .orderBy(desc(sql`count(*)`))
          .limit(5);

        // If no results (all types were recent), fall back to any type
        if (combinedGroups.length === 0 && recentIssueTypes && recentIssueTypes.length > 0) {
          combinedGroups = await this.db
            .select({
              issueType: complianceIssues.issueType,
              section: sql<string>`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`,
              count: sql<number>`count(*)::int`,
            })
            .from(complianceIssues)
            .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
            .leftJoin(
              complianceIssueAnalyses,
              eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
            )
            .where(and(...baseConditions))
            .groupBy(
              complianceIssues.issueType,
              sql`COALESCE(${regulatoryDocuments.njacTitle}, ${regulatoryDocuments.nycrrTitle}::text)`
            )
            .orderBy(desc(sql`count(*)`))
            .limit(5);
        }

        if (combinedGroups.length > 0) {
          // Weighted random selection: larger combos have higher probability
          const totalCount = combinedGroups.reduce((sum, g) => sum + g.count, 0);
          const random = Math.random() * totalCount;
          let cumulative = 0;
          for (const group of combinedGroups) {
            cumulative += group.count;
            if (random <= cumulative) {
              selectedFocus = {
                issueType: group.issueType,
                section: group.section ?? undefined,
              };
              break;
            }
          }
          // Fallback to first if somehow not selected
          if (!selectedFocus.issueType) {
            selectedFocus = {
              issueType: combinedGroups[0].issueType,
              section: combinedGroups[0].section ?? undefined,
            };
          }
        }
      }

      if (selectedFocus.issueType) {
        focusConditions.push(eq(complianceIssues.issueType, selectedFocus.issueType));
      }
      if (selectedFocus.section) {
        focusConditions.push(
          or(
            eq(regulatoryDocuments.njacTitle, selectedFocus.section),
            sql`${regulatoryDocuments.nycrrTitle}::text = ${selectedFocus.section}`
          )!
        );
      }
    }

    // Get count of items matching the focus (for "remaining" display) — needs analyses join
    const whereClause = and(...focusConditions);
    const [focusCountResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause);
    const remainingInFocus = focusCountResult?.count ?? 0;

    // Get the batch of items with analysis fields
    const results = await this.db
      .select(issueListSelectColumns)
      .from(complianceIssues)
      .innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(whereClause)
      // Order by severity from analyses (high first) with deterministic tiebreaker
      .orderBy(desc(complianceIssueAnalyses.finalSeverity), desc(complianceIssueAnalyses.id))
      .limit(batchSize);

    const data: ComplianceIssueWithAnalysis[] = results.map(row => mapRowToIssue(row));

    return {
      data,
      groupingMode,
      focus: selectedFocus,
      remainingInFocus,
      nextGroupingMode,
      totalUnreviewed,
    };
  }

  /**
   * Get tier completion counts for analysis pipeline progress
   */
  async getAnalysisTierCounts(state: StateCode): Promise<TierCompletionCounts> {
    // Count issues by highest tier completed in their analysis
    const results = await this.db
      .select({
        tier: complianceIssueAnalyses.highestTierCompleted,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(eq(complianceIssues.state, normalizeState(state)))
      .groupBy(complianceIssueAnalyses.highestTierCompleted);

    // Build the counts object
    const counts: TierCompletionCounts = {
      tier0: 0, // Not analyzed (null tier)
      tier1: 0,
      tier2: 0,
      tier3: 0,
    };

    for (const row of results) {
      if (row.tier === null) {
        counts.tier0 = row.count;
      } else if (row.tier === 1) {
        counts.tier1 = row.count;
      } else if (row.tier === 2) {
        counts.tier2 = row.count;
      } else if (row.tier === 3) {
        counts.tier3 = row.count;
      }
    }

    return counts;
  }

  /**
   * Get classification breakdown by tier for analytics charts.
   * Shows distribution of classifications at each tier level.
   */
  async getClassificationBreakdown(state: StateCode): Promise<ClassificationBreakdown> {
    const breakdown: ClassificationBreakdown = {
      tier1: {},
      tier2: {},
      tier3: {},
    };

    // Tier 1 classifications
    const tier1Results = await this.db
      .select({
        classification: complianceIssueAnalyses.tier1Classification,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        sql`${complianceIssueAnalyses.tier1Classification} IS NOT NULL`
      ))
      .groupBy(complianceIssueAnalyses.tier1Classification);

    for (const row of tier1Results) {
      if (row.classification) {
        breakdown.tier1[row.classification] = row.count;
      }
    }

    // Tier 2 classifications
    const tier2Results = await this.db
      .select({
        classification: complianceIssueAnalyses.tier2Classification,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        sql`${complianceIssueAnalyses.tier2Classification} IS NOT NULL`
      ))
      .groupBy(complianceIssueAnalyses.tier2Classification);

    for (const row of tier2Results) {
      if (row.classification) {
        breakdown.tier2[row.classification] = row.count;
      }
    }

    // Tier 3 classifications
    const tier3Results = await this.db
      .select({
        classification: complianceIssueAnalyses.tier3Classification,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.state, normalizeState(state)),
        sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL`
      ))
      .groupBy(complianceIssueAnalyses.tier3Classification);

    for (const row of tier3Results) {
      if (row.classification) {
        breakdown.tier3[row.classification] = row.count;
      }
    }

    return breakdown;
  }

  /**
   * Get full analysis record for detail page.
   * Returns all tier data with document context.
   */
  async getFullAnalysis(
    documentId: number,
    issueType: string
  ): Promise<FullAnalysisRecord | null> {
    const results = await this.db
      .select({
        // Analysis fields
        documentId: complianceIssueAnalyses.documentId,
        issueType: complianceIssueAnalyses.issueType,
        state: complianceIssueAnalyses.state,
        groupedMatchCount: complianceIssueAnalyses.groupedMatchCount,

        // Tier 1
        tier1Classification: complianceIssueAnalyses.tier1Classification,
        tier1Confidence: complianceIssueAnalyses.tier1Confidence,
        tier1Reasoning: complianceIssueAnalyses.tier1Reasoning,
        tier1RelevantMatchIds: complianceIssueAnalyses.tier1RelevantMatchIds,
        tier1DismissedMatchIds: complianceIssueAnalyses.tier1DismissedMatchIds,
        tier1DismissedReasons: complianceIssueAnalyses.tier1DismissedReasons,
        tier1ContextRequests: complianceIssueAnalyses.tier1ContextRequests,
        tier1CompletedAt: complianceIssueAnalyses.tier1CompletedAt,
        // Tier 1 V5 fields
        tier1ArgumentFraming: complianceIssueAnalyses.tier1ArgumentFraming,
        tier1Recommendations: complianceIssueAnalyses.tier1Recommendations,

        // Tier 2
        tier2Classification: complianceIssueAnalyses.tier2Classification,
        tier2Confidence: complianceIssueAnalyses.tier2Confidence,
        tier2Reasoning: complianceIssueAnalyses.tier2Reasoning,
        severity: complianceIssueAnalyses.severity,
        severityBaseline: complianceIssueAnalyses.severityBaseline,
        severityCalculation: complianceIssueAnalyses.severityCalculation,
        verbatimRequirements: complianceIssueAnalyses.verbatimRequirements,
        argumentForRegulation: complianceIssueAnalyses.argumentForRegulation,
        argumentAgainstRegulation: complianceIssueAnalyses.argumentAgainstRegulation,
        contextUsed: complianceIssueAnalyses.contextUsed,
        tier2FullTextRequests: complianceIssueAnalyses.tier2FullTextRequests,
        needsWebSearch: complianceIssueAnalyses.needsWebSearch,
        webSearchTopics: complianceIssueAnalyses.webSearchTopics,
        potentiallyControversial: complianceIssueAnalyses.potentiallyControversial,
        federalMandateSuspected: complianceIssueAnalyses.federalMandateSuspected,
        ambiguityType: complianceIssueAnalyses.ambiguityType,
        tier2CompletedAt: complianceIssueAnalyses.tier2CompletedAt,
        // Tier 2 V5 fields
        tier2RerunCount: complianceIssueAnalyses.tier2RerunCount,
        tier2ContextRequestsMade: complianceIssueAnalyses.tier2ContextRequestsMade,
        tier2ForcedClassification: complianceIssueAnalyses.tier2ForcedClassification,
        citesFederalStatute: complianceIssueAnalyses.citesFederalStatute,
        federalCitation: complianceIssueAnalyses.federalCitation,
        claimsNoAlternative: complianceIssueAnalyses.claimsNoAlternative,
        // V5.2: Web search disambiguation
        programContext: complianceIssueAnalyses.programContext,
        notToConfuseWith: complianceIssueAnalyses.notToConfuseWith,
        searchScopeGuidance: complianceIssueAnalyses.searchScopeGuidance,

        // Tier 3
        tier3Classification: complianceIssueAnalyses.tier3Classification,
        tier3Confidence: complianceIssueAnalyses.tier3Confidence,
        tier3Reasoning: complianceIssueAnalyses.tier3Reasoning,
        tier3SeverityAdjustment: complianceIssueAnalyses.tier3SeverityAdjustment,
        tier3SeverityAdjustmentReasoning: complianceIssueAnalyses.tier3SeverityAdjustmentReasoning,
        tier3CompletedAt: complianceIssueAnalyses.tier3CompletedAt,
        tier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,  // V5.1: Why escalated to Tier 3
        // Tier 3 V5 fields
        tier3Flags: complianceIssueAnalyses.tier3Flags,
        tier3EvidenceGap: complianceIssueAnalyses.tier3EvidenceGap,

        // Web search results (Tier 3)
        webSearchSummary: complianceIssueAnalyses.webSearchSummary,
        federalMandateFound: complianceIssueAnalyses.federalMandateFound,
        stateHasDiscretion: complianceIssueAnalyses.stateHasDiscretion,

        // Final derived fields
        highestTierCompleted: complianceIssueAnalyses.highestTierCompleted,
        classificationTier: complianceIssueAnalyses.classificationTier,
        requirementFound: complianceIssueAnalyses.requirementFound,
        isJustified: complianceIssueAnalyses.isJustified,
        finalSeverity: complianceIssueAnalyses.finalSeverity,
        pipelineVersion: complianceIssueAnalyses.pipelineVersion,
        createdAt: complianceIssueAnalyses.createdAt,
        updatedAt: complianceIssueAnalyses.updatedAt,

        // V5.1: Easy Cleanup fields
        easyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEvidence: complianceIssueAnalyses.cleanupEvidence,
        cleanupRecommendation: complianceIssueAnalyses.cleanupRecommendation,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,

        // Document fields
        docId: regulatoryDocuments.id,
        docTitle: regulatoryDocuments.title,
        docContent: regulatoryDocuments.content,
        docUrl: regulatoryDocuments.url,
        docNjacTitle: regulatoryDocuments.njacTitle,
        docNjacChapter: regulatoryDocuments.njacChapter,
        docNjacSubchapter: regulatoryDocuments.njacSubchapter,
        docNycrrTitle: regulatoryDocuments.nycrrTitle,
        docNycrrPart: regulatoryDocuments.nycrrPart,
        docNycrrSection: regulatoryDocuments.nycrrSection,
        docSummary: regulatoryDocuments.summary,
        docKeywords: regulatoryDocuments.keywords,
        docAppliesTo: regulatoryDocuments.appliesTo,
        docHierarchyLevel: regulatoryDocuments.hierarchyLevel,
        docCitation: regulatoryDocuments.citation,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(
        regulatoryDocuments,
        eq(complianceIssueAnalyses.documentId, regulatoryDocuments.id)
      )
      .where(and(
        eq(complianceIssueAnalyses.documentId, documentId),
        eq(complianceIssueAnalyses.issueType, issueType)
      ))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    const row = results[0];

    // Build citation string based on state
    let citation: string | null = null;
    if (row.docNjacTitle) {
      citation = `N.J.A.C. ${row.docNjacTitle}:${row.docNjacChapter || ''}${row.docNjacSubchapter ? `-${row.docNjacSubchapter}` : ''}`;
    } else if (row.docNycrrTitle) {
      citation = `${row.docNycrrTitle} NYCRR Part ${row.docNycrrPart || ''}${row.docNycrrSection ? ` § ${row.docNycrrSection}` : ''}`;
    }

    return {
      documentId: Number(row.documentId),
      issueType: row.issueType,
      state: row.state,
      groupedMatchCount: row.groupedMatchCount,

      document: {
        id: row.docId,
        title: row.docTitle,
        citation: row.docCitation || citation,
        content: row.docContent,
        url: row.docUrl,
        summary: row.docSummary,
        keywords: row.docKeywords,
        appliesTo: row.docAppliesTo,
        hierarchyLevel: row.docHierarchyLevel,
      },

      tier1: row.tier1Classification ? {
        classification: row.tier1Classification,
        confidence: row.tier1Confidence,
        reasoning: row.tier1Reasoning,
        relevantMatchIds: row.tier1RelevantMatchIds,
        dismissedMatchIds: row.tier1DismissedMatchIds,
        dismissedReasons: row.tier1DismissedReasons as DismissedMatch[] | null,
        contextRequests: row.tier1ContextRequests as ContextRequest[] | null,
        completedAt: row.tier1CompletedAt,
        // V5 fields
        argumentFraming: row.tier1ArgumentFraming as Tier1ArgumentFraming | null,
        recommendations: row.tier1Recommendations as Tier1Recommendations | null,
      } : null,

      tier2: row.tier2Classification ? {
        classification: row.tier2Classification,
        confidence: row.tier2Confidence,
        reasoning: row.tier2Reasoning,
        severity: row.severity,
        severityBaseline: row.severityBaseline,
        severityCalculation: row.severityCalculation,
        verbatimRequirements: row.verbatimRequirements ?? [],
        argumentForRegulation: row.argumentForRegulation,
        argumentAgainstRegulation: row.argumentAgainstRegulation,
        contextUsed: row.contextUsed as ContextEntry[] | null,
        fullTextRequests: row.tier2FullTextRequests as ContextRequest[] | null,
        needsWebSearch: row.needsWebSearch ?? false,
        webSearchTopics: row.webSearchTopics ?? [],
        potentiallyControversial: row.potentiallyControversial ?? false,
        federalMandateSuspected: row.federalMandateSuspected ?? false,
        ambiguityType: row.ambiguityType,
        completedAt: row.tier2CompletedAt,
        // V5 fields
        rerunCount: row.tier2RerunCount ?? 0,
        contextRequestsMade: row.tier2ContextRequestsMade as Tier2ContextRequestMade[] | null,
        forcedClassification: row.tier2ForcedClassification ?? false,
        citesFederalStatute: row.citesFederalStatute ?? false,
        federalCitation: row.federalCitation,
        claimsNoAlternative: row.claimsNoAlternative ?? false,
        // V5.2: Web search disambiguation
        programContext: row.programContext,
        notToConfuseWith: row.notToConfuseWith,
        searchScopeGuidance: row.searchScopeGuidance,
      } : null,

      tier3: row.tier3Classification ? {
        classification: row.tier3Classification,
        confidence: row.tier3Confidence,
        reasoning: row.tier3Reasoning,
        severityAdjustment: row.tier3SeverityAdjustment,
        severityAdjustmentReasoning: row.tier3SeverityAdjustmentReasoning,
        completedAt: row.tier3CompletedAt,
        triggerReason: row.tier3TriggerReason,  // V5.1: Why escalated to Tier 3
        // V5 fields
        flags: row.tier3Flags as Tier3Flags | null,
        evidenceGap: row.tier3EvidenceGap ?? false,
        // Web search results
        webSearchSummary: row.webSearchSummary,
        federalMandateFound: row.federalMandateFound ?? false,
        stateHasDiscretion: row.stateHasDiscretion ?? true,
      } : null,

      highestTierCompleted: row.highestTierCompleted ?? 0,
      classificationTier: row.classificationTier,
      requirementFound: row.requirementFound,
      isJustified: row.isJustified ?? false,
      finalSeverity: row.finalSeverity,
      pipelineVersion: row.pipelineVersion ?? 'v5',
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,

      // V5.1: Easy Cleanup fields
      easyCleanupCandidate: row.easyCleanupCandidate ?? false,
      cleanupType: row.cleanupType,
      cleanupEvidence: row.cleanupEvidence,
      cleanupRecommendation: row.cleanupRecommendation,
      cleanupEffort: row.cleanupEffort,
    };
  }

  /**
   * Get paginated analysis list for table view.
   * Returns simplified analysis records with document info.
   *
   * Filter building, sort assembly, and row mapping are extracted into
   * module-level helpers: buildAnalysisListFilters, buildAnalysisListSort,
   * and mapAnalysisListRow.
   */
  async getAnalysisListPaginated(
    state: StateCode,
    options: {
      page: number;
      pageSize: number;
      sortBy?: 'issueType' | 'severity' | 'highestTier' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      filters?: AnalysisListFilters;
    }
  ): Promise<{
    data: AnalysisListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const conditions = buildAnalysisListFilters({ state, filters });
    const whereClause = and(...conditions);
    const orderClauses = buildAnalysisListSort(sortBy, sortOrder);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssueAnalyses)
      .innerJoin(regulatoryDocuments, eq(complianceIssueAnalyses.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Get paginated results
    const results = await this.db
      .select({
        documentId: complianceIssueAnalyses.documentId,
        issueType: complianceIssueAnalyses.issueType,
        highestTierCompleted: complianceIssueAnalyses.highestTierCompleted,
        tier1Classification: complianceIssueAnalyses.tier1Classification,
        tier2Classification: complianceIssueAnalyses.tier2Classification,
        tier3Classification: complianceIssueAnalyses.tier3Classification,
        tier2RerunCount: complianceIssueAnalyses.tier2RerunCount,
        finalSeverity: sql<number | null>`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
        federalMandateFound: complianceIssueAnalyses.federalMandateFound,
        isJustified: complianceIssueAnalyses.isJustified,
        createdAt: complianceIssueAnalyses.createdAt,
        easyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,
        tier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
        docTitle: regulatoryDocuments.title,
        docShortTitle: regulatoryDocuments.shortTitle,
        docNjacTitle: regulatoryDocuments.njacTitle,
        docNjacChapter: regulatoryDocuments.njacChapter,
        docNjacSubchapter: regulatoryDocuments.njacSubchapter,
        docNycrrTitle: regulatoryDocuments.nycrrTitle,
        docNycrrPart: regulatoryDocuments.nycrrPart,
        docNycrrSection: regulatoryDocuments.nycrrSection,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(regulatoryDocuments, eq(complianceIssueAnalyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(...orderClauses)
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map(mapAnalysisListRow),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * Get analysis data for CSV export.
   * Same filters as getAnalysisListPaginated but with export-specific columns
   * and no pagination. Capped at 5000 rows as a safety valve.
   */
  async getAnalysisExportData(
    state: StateCode,
    options: {
      sortBy?: string;
      sortOrder?: string;
      filters?: AnalysisListFilters;
    } = {}
  ): Promise<AnalysisExportRow[]> {
    const { sortBy = 'severity', sortOrder = 'desc', filters } = options;

    const conditions = buildAnalysisListFilters({ state, filters });
    const whereClause = and(...conditions);
    const orderClauses = buildAnalysisListSort(sortBy, sortOrder);

    const results = await this.db
      .select({
        docShortTitle: regulatoryDocuments.shortTitle,
        docTitle: regulatoryDocuments.title,
        docCitation: regulatoryDocuments.citation,
        docNycrrTitle: regulatoryDocuments.nycrrTitle,
        docNjacTitle: regulatoryDocuments.njacTitle,
        docNjacChapter: regulatoryDocuments.njacChapter,
        docNjacSubchapter: regulatoryDocuments.njacSubchapter,
        docNycrrPart: regulatoryDocuments.nycrrPart,
        docNycrrSection: regulatoryDocuments.nycrrSection,
        issueType: complianceIssueAnalyses.issueType,
        argumentAgainstRegulation: complianceIssueAnalyses.argumentAgainstRegulation,
        verbatimRequirements: complianceIssueAnalyses.verbatimRequirements,
        finalSeverity: sql<number | null>`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(regulatoryDocuments, eq(complianceIssueAnalyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(...orderClauses)
      .limit(5000);

    return results.map((row) => {
      // Build citation from structured fields (same logic as mapAnalysisListRow)
      let citation: string | null = row.docCitation ?? null;
      if (!citation) {
        if (row.docNjacTitle) {
          citation = `N.J.A.C. ${row.docNjacTitle}:${row.docNjacChapter || ''}${row.docNjacSubchapter ? `-${row.docNjacSubchapter}` : ''}`;
        } else if (row.docNycrrTitle) {
          citation = `${row.docNycrrTitle} NYCRR ${row.docNycrrPart || ''}${row.docNycrrSection ? `.${row.docNycrrSection}` : ''}`;
        }
      }

      return {
        documentTitle: row.docShortTitle || row.docTitle,
        citation,
        issueType: row.issueType,
        nycrrTitle: row.docNycrrTitle,
        njacTitle: row.docNjacTitle,
        argumentAgainstRegulation: row.argumentAgainstRegulation,
        verbatimRequirements: row.verbatimRequirements,
        finalSeverity: row.finalSeverity,
        cleanupType: row.cleanupType,
        cleanupEffort: row.cleanupEffort,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Severity Distribution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get severity distribution (high/medium/low) for compliance issue analyses.
   * Uses COALESCE(final_severity, severity) to get the best available severity.
   */
  async getSeverityDistribution(state: StateCode): Promise<SeverityDistribution> {
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) >= 7)::int AS "high",
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) >= 4 AND COALESCE(final_severity, severity) < 7)::int AS "medium",
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) >= 1 AND COALESCE(final_severity, severity) < 4)::int AS "low",
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) IS NOT NULL)::int AS "total"
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND requirement_found = TRUE
    `);

    const row = result.rows[0] as { high: number; medium: number; low: number; total: number };
    return { high: row.high, medium: row.medium, low: row.low, total: row.total };
  }

  // ═══════════════════════════════════════════════════════════════════
  // Pipeline Analytics Methods
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get funnel statistics across all 3 pipeline tiers.
   * Counts analyses at each stage with classification breakdowns.
   */
  async getPipelineFunnelStats(state: StateCode, issueType?: string): Promise<PipelineFunnelData> {
    const conditions = [
      eq(complianceIssueAnalyses.state, normalizeState(state)),
      isNotNull(complianceIssueAnalyses.tier1Classification),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }

    const result = await this.db
      .select({
        totalAnalyses: sql<number>`count(*)::int`,
        tier1FalsePositives: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier1Classification} = 'all_false_positives')::int`,
        tier1NeedsResearch: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier1Classification} = 'needs_research')::int`,
        tier2Completed: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier2Classification} IS NOT NULL)::int`,
        tier2Burdensome: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier2Classification} = 'burdensome')::int`,
        tier2Justified: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier2Classification} = 'justified')::int`,
        tier2Unrelated: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier2Classification} = 'unrelated')::int`,
        tier3Completed: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier3Classification} IS NOT NULL)::int`,
        tier3Burdensome: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier3Classification} = 'burdensome')::int`,
        tier3Justified: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier3Classification} = 'justified')::int`,
        tier3Unrelated: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier3Classification} = 'unrelated')::int`,
        classificationChangedInTier3: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND ${complianceIssueAnalyses.tier2Classification} != ${complianceIssueAnalyses.tier3Classification})::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(...conditions));

    const row = result[0];
    return {
      totalAnalyses: row.totalAnalyses,
      tier1: {
        total: row.totalAnalyses,
        falsePositives: row.tier1FalsePositives,
        needsResearch: row.tier1NeedsResearch,
      },
      tier2: {
        total: row.tier2Completed,
        burdensome: row.tier2Burdensome,
        justified: row.tier2Justified,
        unrelated: row.tier2Unrelated,
      },
      tier3: {
        total: row.tier3Completed,
        burdensome: row.tier3Burdensome,
        justified: row.tier3Justified,
        unrelated: row.tier3Unrelated,
        classificationChangedFromTier2: row.classificationChangedInTier3,
      },
    };
  }

  /**
   * Get Tier 1 context request distribution from tier1_recommendations JSONB.
   */
  async getTier1ContextRequestStats(state: StateCode, issueType?: string): Promise<Tier1ContextRequestStats> {
    const conditions = [
      eq(complianceIssueAnalyses.state, normalizeState(state)),
      isNotNull(complianceIssueAnalyses.tier1Recommendations),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }

    // Unpack the JSONB context_requests array
    const contextTypeResults = await this.db.execute(sql`
      SELECT
        cr->>'context_type' AS context_type,
        cr->>'need_level' AS need_level,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(tier1_recommendations->'context_requests') AS cr
      WHERE state = ${normalizeState(state)}
        AND tier1_recommendations IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY cr->>'context_type', cr->>'need_level'
      ORDER BY count DESC
    `);

    // Context requests by issue type (top 15)
    const byIssueTypeResults = await this.db.execute(sql`
      SELECT
        a.issue_type,
        cr->>'context_type' AS context_type,
        count(*)::int AS count
      FROM compliance_issue_analyses a,
        jsonb_array_elements(a.tier1_recommendations->'context_requests') AS cr
      WHERE a.state = ${normalizeState(state)}
        AND a.tier1_recommendations IS NOT NULL
        ${issueType ? sql`AND a.issue_type = ${issueType}` : sql``}
      GROUP BY a.issue_type, cr->>'context_type'
      ORDER BY count DESC
    `);

    // Total analyses vs those with context requests
    const summaryResult = await this.db
      .select({
        totalWithTier1: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier1Classification} IS NOT NULL)::int`,
        totalWithRequests: sql<number>`count(*) FILTER (WHERE ${complianceIssueAnalyses.tier1Recommendations} IS NOT NULL AND jsonb_array_length(${complianceIssueAnalyses.tier1Recommendations}->'context_requests') > 0)::int`,
        totalRequests: sql<number>`COALESCE(sum(jsonb_array_length(${complianceIssueAnalyses.tier1Recommendations}->'context_requests')) FILTER (WHERE ${complianceIssueAnalyses.tier1Recommendations} IS NOT NULL), 0)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(...conditions.slice(0, issueType ? 2 : 1), isNotNull(complianceIssueAnalyses.tier1Classification)));

    const rows = contextTypeResults.rows as Array<{ context_type: string; need_level: string; count: number }>;
    const byIssueRows = byIssueTypeResults.rows as Array<{ issue_type: string; context_type: string; count: number }>;
    const summary = summaryResult[0];

    return {
      byContextType: rows.map(r => ({
        contextType: r.context_type,
        needLevel: r.need_level,
        count: r.count,
      })),
      byIssueType: byIssueRows.map(r => ({
        issueType: r.issue_type,
        contextType: r.context_type,
        count: r.count,
      })),
      summary: {
        totalAnalyses: summary.totalWithTier1,
        analysesWithRequests: summary.totalWithRequests,
        totalRequests: summary.totalRequests,
        avgRequestsPerAnalysis: summary.totalWithTier1 > 0
          ? Number((summary.totalRequests / summary.totalWithTier1).toFixed(2))
          : 0,
      },
    };
  }

  /**
   * Get tier transition statistics: classification changes between tiers,
   * confidence distributions, and trigger reasons.
   */
  async getTierTransitionStats(state: StateCode, issueType?: string): Promise<TierTransitionData> {
    const conditions = [
      eq(complianceIssueAnalyses.state, normalizeState(state)),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }

    // Tier 2→3 classification cross-tab
    const crossTabResults = await this.db.execute(sql`
      SELECT
        tier2_classification AS tier2_class,
        tier3_classification AS tier3_class,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier2_classification IS NOT NULL
        AND tier3_classification IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY tier2_classification, tier3_classification
      ORDER BY count DESC
    `);

    // Confidence bucket distributions for each tier
    const confidenceResults = await this.db.execute(sql`
      SELECT
        'tier1' AS tier,
        CASE
          WHEN tier1_confidence < 0.2 THEN '0-0.2'
          WHEN tier1_confidence < 0.4 THEN '0.2-0.4'
          WHEN tier1_confidence < 0.6 THEN '0.4-0.6'
          WHEN tier1_confidence < 0.8 THEN '0.6-0.8'
          ELSE '0.8-1.0'
        END AS bucket,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier1_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY bucket
      UNION ALL
      SELECT
        'tier2' AS tier,
        CASE
          WHEN tier2_confidence < 0.2 THEN '0-0.2'
          WHEN tier2_confidence < 0.4 THEN '0.2-0.4'
          WHEN tier2_confidence < 0.6 THEN '0.4-0.6'
          WHEN tier2_confidence < 0.8 THEN '0.6-0.8'
          ELSE '0.8-1.0'
        END AS bucket,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier2_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY bucket
      UNION ALL
      SELECT
        'tier3' AS tier,
        CASE
          WHEN tier3_confidence < 0.2 THEN '0-0.2'
          WHEN tier3_confidence < 0.4 THEN '0.2-0.4'
          WHEN tier3_confidence < 0.6 THEN '0.4-0.6'
          WHEN tier3_confidence < 0.8 THEN '0.6-0.8'
          ELSE '0.8-1.0'
        END AS bucket,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier3_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY bucket
      ORDER BY tier, bucket
    `);

    // Tier 3 trigger reason distribution
    const triggerResults = await this.db
      .select({
        triggerReason: complianceIssueAnalyses.tier3TriggerReason,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        ...conditions,
        isNotNull(complianceIssueAnalyses.tier3TriggerReason),
      ))
      .groupBy(complianceIssueAnalyses.tier3TriggerReason)
      .orderBy(desc(sql`count(*)`));

    const crossTabRows = crossTabResults.rows as Array<{ tier2_class: string; tier3_class: string; count: number }>;
    const confRows = confidenceResults.rows as Array<{ tier: string; bucket: string; count: number }>;

    return {
      classificationCrossTab: crossTabRows.map(r => ({
        tier2Classification: r.tier2_class,
        tier3Classification: r.tier3_class,
        count: r.count,
      })),
      confidenceDistributions: {
        tier1: confRows.filter(r => r.tier === 'tier1').map(r => ({ bucket: r.bucket, count: r.count })),
        tier2: confRows.filter(r => r.tier === 'tier2').map(r => ({ bucket: r.bucket, count: r.count })),
        tier3: confRows.filter(r => r.tier === 'tier3').map(r => ({ bucket: r.bucket, count: r.count })),
      },
      triggerReasons: triggerResults.map(r => ({
        reason: r.triggerReason ?? 'unknown',
        count: r.count,
      })),
    };
  }

  /**
   * Get trigger reasons for classification transitions (off-diagonal cells).
   * Groups by tier2→tier3 classification pair and trigger reason.
   */
  async getTransitionReasons(state: StateCode, issueType?: string): Promise<TransitionReasonData> {
    const results = await this.db.execute(sql`
      SELECT
        tier2_classification AS tier2_class,
        tier3_classification AS tier3_class,
        tier3_trigger_reason AS trigger_reason,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier2_classification IS NOT NULL
        AND tier3_classification IS NOT NULL
        AND tier2_classification != tier3_classification
        AND tier3_trigger_reason IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY tier2_classification, tier3_classification, tier3_trigger_reason
      ORDER BY count DESC
    `);

    const rows = results.rows as Array<{
      tier2_class: string;
      tier3_class: string;
      trigger_reason: string;
      count: number;
    }>;

    return {
      transitions: rows.map(r => ({
        tier2Classification: r.tier2_class,
        tier3Classification: r.tier3_class,
        triggerReason: r.trigger_reason,
        count: r.count,
      })),
    };
  }

  /**
   * Get average confidence grouped by classification for each tier.
   * Used for "Confidence by Classification" grouped bar charts.
   */
  async getConfidenceByClassification(state: StateCode, issueType?: string): Promise<ConfidenceByClassificationData> {
    const results = await this.db.execute(sql`
      SELECT
        'tier1' AS tier,
        tier1_classification AS classification,
        round(avg(tier1_confidence)::numeric, 3)::float AS avg_confidence,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier1_classification IS NOT NULL
        AND tier1_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY tier1_classification
      UNION ALL
      SELECT
        'tier2' AS tier,
        tier2_classification AS classification,
        round(avg(tier2_confidence)::numeric, 3)::float AS avg_confidence,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier2_classification IS NOT NULL
        AND tier2_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY tier2_classification
      UNION ALL
      SELECT
        'tier3' AS tier,
        tier3_classification AS classification,
        round(avg(tier3_confidence)::numeric, 3)::float AS avg_confidence,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier3_classification IS NOT NULL
        AND tier3_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
      GROUP BY tier3_classification
      ORDER BY tier, classification
    `);

    const rows = results.rows as Array<{ tier: string; classification: string; avg_confidence: number; count: number }>;

    const tierMap = new Map<string, Array<{ classification: string; avgConfidence: number; count: number }>>();
    for (const row of rows) {
      if (!tierMap.has(row.tier)) {
        tierMap.set(row.tier, []);
      }
      tierMap.get(row.tier)!.push({
        classification: row.classification,
        avgConfidence: row.avg_confidence,
        count: row.count,
      });
    }

    const tiers: ConfidenceByClassificationData['tiers'] = (['tier1', 'tier2', 'tier3'] as const).map(tier => ({
      tier,
      classifications: tierMap.get(tier) ?? [],
    }));

    return { tiers };
  }

  /**
   * Get Tier 3 evidence statistics: flag distributions, severity adjustments, cleanup stats.
   */
  async getTier3EvidenceStats(state: StateCode, issueType?: string): Promise<Tier3EvidenceStats> {
    const conditions = [
      eq(complianceIssueAnalyses.state, normalizeState(state)),
      isNotNull(complianceIssueAnalyses.tier3Classification),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }

    // Flag distribution from tier3_flags JSONB
    const flagResults = await this.db.execute(sql`
      SELECT
        count(*) FILTER (WHERE (tier3_flags->>'federal_mandate_confirmed')::jsonb->>'value' = 'true')::int AS federal_mandate_true,
        count(*) FILTER (WHERE tier3_flags ? 'federal_mandate_confirmed' AND (tier3_flags->>'federal_mandate_confirmed')::jsonb->>'value' != 'true')::int AS federal_mandate_false,
        count(*) FILTER (WHERE (tier3_flags->>'state_discretion_found')::jsonb->>'value' = 'true')::int AS state_discretion_true,
        count(*) FILTER (WHERE tier3_flags ? 'state_discretion_found' AND (tier3_flags->>'state_discretion_found')::jsonb->>'value' != 'true')::int AS state_discretion_false,
        count(*) FILTER (WHERE (tier3_flags->>'modernized_alternative_found')::jsonb->>'value' = 'true')::int AS alternative_true,
        count(*) FILTER (WHERE tier3_flags ? 'modernized_alternative_found' AND (tier3_flags->>'modernized_alternative_found')::jsonb->>'value' != 'true')::int AS alternative_false,
        count(*) FILTER (WHERE (tier3_flags->>'superseded_by_law')::jsonb->>'value' = 'true')::int AS superseded_true,
        count(*) FILTER (WHERE tier3_flags ? 'superseded_by_law' AND (tier3_flags->>'superseded_by_law')::jsonb->>'value' != 'true')::int AS superseded_false,
        count(*) FILTER (WHERE (tier3_flags->>'advocacy_for_change')::jsonb->>'value' = 'true')::int AS advocacy_true,
        count(*) FILTER (WHERE tier3_flags ? 'advocacy_for_change' AND (tier3_flags->>'advocacy_for_change')::jsonb->>'value' != 'true')::int AS advocacy_false,
        count(*)::int AS total_tier3
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier3_classification IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
    `);

    // Severity adjustment distribution
    const severityResults = await this.db
      .select({
        adjustment: complianceIssueAnalyses.tier3SeverityAdjustment,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        ...conditions,
        isNotNull(complianceIssueAnalyses.tier3SeverityAdjustment),
      ))
      .groupBy(complianceIssueAnalyses.tier3SeverityAdjustment)
      .orderBy(asc(complianceIssueAnalyses.tier3SeverityAdjustment));

    // Easy cleanup stats
    const cleanupResults = await this.db
      .select({
        cleanupType: complianceIssueAnalyses.cleanupType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        ...conditions,
        eq(complianceIssueAnalyses.easyCleanupCandidate, true),
      ))
      .groupBy(complianceIssueAnalyses.cleanupType)
      .orderBy(desc(sql`count(*)`));

    const totalCleanup = cleanupResults.reduce((sum, r) => sum + r.count, 0);
    const flags = flagResults.rows[0] as Record<string, number>;

    return {
      flags: {
        federalMandateConfirmed: { true: flags.federal_mandate_true, false: flags.federal_mandate_false },
        stateDiscretionFound: { true: flags.state_discretion_true, false: flags.state_discretion_false },
        modernizedAlternativeFound: { true: flags.alternative_true, false: flags.alternative_false },
        supersededByLaw: { true: flags.superseded_true, false: flags.superseded_false },
        advocacyForChange: { true: flags.advocacy_true, false: flags.advocacy_false },
      },
      totalTier3: flags.total_tier3,
      severityAdjustments: severityResults.map(r => ({
        adjustment: r.adjustment ?? 0,
        count: r.count,
      })),
      cleanup: {
        totalCandidates: totalCleanup,
        byType: cleanupResults.map(r => ({
          cleanupType: r.cleanupType ?? 'unknown',
          count: r.count,
        })),
      },
    };
  }

  /**
   * Get Tier 2 context request stats from tier2_context_requests_made JSONB.
   * These track additional context requests made during Tier 2 re-runs.
   */
  async getTier2ContextRequestsStats(state: StateCode, issueType?: string): Promise<Tier2ContextRequestsStats> {
    const issueTypeClause = issueType ? sql`AND issue_type = ${issueType}` : sql``;

    const byTypeResults = await this.db.execute(sql`
      SELECT
        cr->>'context_type' AS context_type,
        cr->>'need_level' AS need_level,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(tier2_context_requests_made) AS cr
      WHERE state = ${normalizeState(state)}
        AND tier2_context_requests_made IS NOT NULL
        AND jsonb_array_length(tier2_context_requests_made) > 0
        ${issueTypeClause}
      GROUP BY cr->>'context_type', cr->>'need_level'
      ORDER BY count DESC
    `);

    const summaryResult = await this.db.execute(sql`
      SELECT
        count(*) FILTER (WHERE tier2_context_requests_made IS NOT NULL AND jsonb_array_length(tier2_context_requests_made) > 0)::int AS analyses_with_requests,
        COALESCE(sum(jsonb_array_length(tier2_context_requests_made)) FILTER (WHERE tier2_context_requests_made IS NOT NULL AND jsonb_array_length(tier2_context_requests_made) > 0), 0)::int AS total_requests
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier1_classification IS NOT NULL
        ${issueTypeClause}
    `);

    const rows = byTypeResults.rows as Array<{ context_type: string; need_level: string; count: number }>;
    const summary = summaryResult.rows[0] as { analyses_with_requests: number; total_requests: number };

    return {
      byContextType: rows.map(r => ({
        contextType: r.context_type,
        needLevel: r.need_level,
        count: r.count,
      })),
      summary: {
        totalAnalysesWithRequests: summary.analyses_with_requests,
        totalRequests: summary.total_requests,
        avgRequestsPerAnalysis: summary.analyses_with_requests > 0
          ? Number((summary.total_requests / summary.analyses_with_requests).toFixed(2))
          : 0,
      },
    };
  }

  /**
   * Get context_used breakdown by source type and web sub-types.
   */
  async getContextUsedStats(state: StateCode, issueType?: string): Promise<ContextUsedStats> {
    const issueTypeClause = issueType ? sql`AND issue_type = ${issueType}` : sql``;

    const bySourceResults = await this.db.execute(sql`
      SELECT
        ce->>'type' AS source_type,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(context_used) AS ce
      WHERE state = ${normalizeState(state)}
        AND context_used IS NOT NULL
        AND jsonb_array_length(context_used) > 0
        ${issueTypeClause}
      GROUP BY ce->>'type'
      ORDER BY count DESC
    `);

    const webSubResults = await this.db.execute(sql`
      SELECT
        COALESCE(ce->>'sourceType', 'unknown') AS source_type,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(context_used) AS ce
      WHERE state = ${normalizeState(state)}
        AND context_used IS NOT NULL
        AND ce->>'type' = 'web'
        ${issueTypeClause}
      GROUP BY COALESCE(ce->>'sourceType', 'unknown')
      ORDER BY count DESC
    `);

    const summaryResult = await this.db.execute(sql`
      SELECT
        count(*) FILTER (WHERE context_used IS NOT NULL AND jsonb_array_length(context_used) > 0)::int AS analyses_with_context,
        COALESCE(sum(jsonb_array_length(context_used)) FILTER (WHERE context_used IS NOT NULL AND jsonb_array_length(context_used) > 0), 0)::int AS total_entries
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier1_classification IS NOT NULL
        ${issueTypeClause}
    `);

    const sourceRows = bySourceResults.rows as Array<{ source_type: string; count: number }>;
    const webRows = webSubResults.rows as Array<{ source_type: string; count: number }>;
    const summary = summaryResult.rows[0] as { analyses_with_context: number; total_entries: number };

    return {
      bySourceType: sourceRows.map(r => ({ sourceType: r.source_type, count: r.count })),
      webBySourceType: webRows.map(r => ({ sourceType: r.source_type, count: r.count })),
      summary: {
        totalAnalysesWithContext: summary.analyses_with_context,
        totalContextEntries: summary.total_entries,
        avgContextPerAnalysis: summary.analyses_with_context > 0
          ? Number((summary.total_entries / summary.analyses_with_context).toFixed(2))
          : 0,
      },
    };
  }

  /**
   * Get research funnel aggregate stats: Tier 1 requested → Tier 2 additional → context cited.
   */
  async getResearchFunnelStats(state: StateCode, issueType?: string): Promise<ResearchFunnelStats> {
    const issueTypeClause = issueType ? sql`AND issue_type = ${issueType}` : sql``;

    const result = await this.db.execute(sql`
      SELECT
        COALESCE(sum(
          CASE WHEN tier1_recommendations IS NOT NULL
               AND tier1_recommendations->'context_requests' IS NOT NULL
          THEN jsonb_array_length(tier1_recommendations->'context_requests')
          ELSE 0 END
        ), 0)::int AS tier1_requested,
        COALESCE(sum(
          CASE WHEN tier2_context_requests_made IS NOT NULL
          THEN jsonb_array_length(tier2_context_requests_made)
          ELSE 0 END
        ), 0)::int AS tier2_fetched,
        COALESCE(sum(
          CASE WHEN context_used IS NOT NULL
          THEN (
            SELECT count(*)::int FROM jsonb_array_elements(context_used) ce
            WHERE ce->>'type' != 'self'
          )
          ELSE 0 END
        ), 0)::int AS context_cited
      FROM compliance_issue_analyses
      WHERE state = ${normalizeState(state)}
        AND tier1_classification IS NOT NULL
        ${issueTypeClause}
    `);

    const row = result.rows[0] as { tier1_requested: number; tier2_fetched: number; context_cited: number };
    return {
      tier1Requested: row.tier1_requested,
      tier2Fetched: row.tier2_fetched,
      contextCited: row.context_cited,
    };
  }
}

/**
 * Simplified analysis record for table view.
 */
export interface AnalysisListItem {
  documentId: number;
  issueType: string;
  documentTitle: string | null;
  citation: string | null;
  highestTierCompleted: number;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  finalSeverity: number | null;
  federalMandateFound: boolean;
  isJustified: boolean;
  rerunCount: number;  // Tier 2 re-run count (0-2)
  createdAt: Date | null;
  // V5.1: Easy Cleanup fields
  easyCleanupCandidate: boolean;
  cleanupType: string | null;
  cleanupEffort: string | null;
  // V5.1: Tier 3 trigger reason
  tier3TriggerReason: string | null;
}

export interface AnalysisExportRow {
  documentTitle: string | null;
  citation: string | null;
  issueType: string;
  nycrrTitle: number | null;
  njacTitle: string | null;
  argumentAgainstRegulation: string | null;
  verbatimRequirements: string[] | null;
  finalSeverity: number | null;
  cleanupType: string | null;
  cleanupEffort: string | null;
}

// ═══════════════════════════════════════════════════════════════════
// Severity Distribution Type
// ═══════════════════════════════════════════════════════════════════

export interface SeverityDistribution {
  high: number;
  medium: number;
  low: number;
  total: number;
}

// ═══════════════════════════════════════════════════════════════════
// Pipeline Analytics Types
// ═══════════════════════════════════════════════════════════════════

export interface PipelineFunnelData {
  totalAnalyses: number;
  tier1: {
    total: number;
    falsePositives: number;
    needsResearch: number;
  };
  tier2: {
    total: number;
    burdensome: number;
    justified: number;
    unrelated: number;
  };
  tier3: {
    total: number;
    burdensome: number;
    justified: number;
    unrelated: number;
    classificationChangedFromTier2: number;
  };
}

export interface Tier1ContextRequestStats {
  byContextType: Array<{
    contextType: string;
    needLevel: string;
    count: number;
  }>;
  byIssueType: Array<{
    issueType: string;
    contextType: string;
    count: number;
  }>;
  summary: {
    totalAnalyses: number;
    analysesWithRequests: number;
    totalRequests: number;
    avgRequestsPerAnalysis: number;
  };
}

export interface TierTransitionData {
  classificationCrossTab: Array<{
    tier2Classification: string;
    tier3Classification: string;
    count: number;
  }>;
  confidenceDistributions: {
    tier1: Array<{ bucket: string; count: number }>;
    tier2: Array<{ bucket: string; count: number }>;
    tier3: Array<{ bucket: string; count: number }>;
  };
  triggerReasons: Array<{
    reason: string;
    count: number;
  }>;
}

export interface TransitionReasonData {
  transitions: Array<{
    tier2Classification: string;
    tier3Classification: string;
    triggerReason: string;
    count: number;
  }>;
}

export interface ConfidenceByClassificationData {
  tiers: Array<{
    tier: 'tier1' | 'tier2' | 'tier3';
    classifications: Array<{
      classification: string;
      avgConfidence: number;
      count: number;
    }>;
  }>;
}

export interface Tier3EvidenceStats {
  flags: {
    federalMandateConfirmed: { true: number; false: number };
    stateDiscretionFound: { true: number; false: number };
    modernizedAlternativeFound: { true: number; false: number };
    supersededByLaw: { true: number; false: number };
    advocacyForChange: { true: number; false: number };
  };
  totalTier3: number;
  severityAdjustments: Array<{
    adjustment: number;
    count: number;
  }>;
  cleanup: {
    totalCandidates: number;
    byType: Array<{
      cleanupType: string;
      count: number;
    }>;
  };
}

export interface Tier2ContextRequestsStats {
  byContextType: Array<{ contextType: string; needLevel: string; count: number }>;
  summary: { totalAnalysesWithRequests: number; totalRequests: number; avgRequestsPerAnalysis: number };
}

export interface ContextUsedStats {
  bySourceType: Array<{ sourceType: string; count: number }>;
  webBySourceType: Array<{ sourceType: string; count: number }>;
  summary: { totalAnalysesWithContext: number; totalContextEntries: number; avgContextPerAnalysis: number };
}

export interface ResearchFunnelStats {
  tier1Requested: number;
  tier2Fetched: number;
  contextCited: number;
}
