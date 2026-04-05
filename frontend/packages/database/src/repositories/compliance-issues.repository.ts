import { eq, and, desc, asc, sql, count, or, isNull, isNotNull, ne, gte, lt, like, notInArray, inArray, type SQL } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
import { normalizeJurisdiction } from '../schema/constants';
import { complianceIssues, ComplianceIssue, IssueType } from '../schema/compliance-issues';
import { regulatoryDocuments } from '../schema/regulatory-documents';
import { guidanceDocuments } from '../schema/guidance-documents';
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
import { bookmarkMarkers } from '../schema/marker-groups';
import { ReviewStatus, ImpactType, DeveloperStatus, ResolutionType, Developer } from '../schema/review-constants';
import { JurisdictionCode } from '../schema/constants';

export interface DeveloperStatusCounts {
  unresolved: number;
  resolved: number;
  pending: number;
  backlogged: number;
  need_more_info: number;
  total: number;
}

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
  tier1Reasoning: string | null;
  tier2Reasoning: string | null;
  tier3Reasoning: string | null;
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
  tier1Reasoning: string | null;
  tier2Reasoning: string | null;
  tier3Reasoning: string | null;
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

  guidance: {
    id: number;
    title: string | null;
    url: string | null;
    agency: string | null;
    docType: string | null;
    year: number | null;
  } | null;
}

export interface ComplianceIssueFilterOptions {
  jurisdiction: JurisdictionCode;
  status?: ReviewStatus | 'all';
  issueType?: IssueType | 'all';
  /** Filter by multiple issue types (multi-select). Takes precedence over issueType when provided. */
  issueTypes?: IssueType[];
  severity?: 'high' | 'medium' | 'low' | 'all';
  /** Filter by multiple severity levels (multi-select). Takes precedence over severity when provided. */
  severities?: ('high' | 'medium' | 'low')[];
  requiredByStatute?: boolean | 'all';
  requirementFound?: boolean | 'all';
  /** Filter by highest tier completed in research pipeline (0-3, or 'all') */
  tierCompleted?: '0' | '1' | '2' | '3' | 'all';
  /** Filter by federal mandate found in analysis */
  federalMandate?: boolean | 'all';
  /** Filter by whether analysis exists */
  hasAnalysis?: boolean | 'all';
  /** Filter by document source (regulation, guidance, or all) */
  source?: 'regulation' | 'guidance' | 'all';
}

export interface ComplianceIssuePaginationOptions {
  jurisdiction: JurisdictionCode;
  page: number;
  pageSize: number;
  sortBy?: 'issueType' | 'createdAt' | 'reviewedAt' | 'severity' | 'developerCheckedAt';
  sortOrder?: 'asc' | 'desc';
  filters?: Omit<ComplianceIssueFilterOptions, 'jurisdiction'>;
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
  /** COALESCE(tier3, tier2, tier1) — each record counted once at its highest tier. */
  coalesced: Record<string, number>;
}

/**
 * Full analysis record with all tier data for detail page.
 */
export interface FullAnalysisRecord {
  documentId: number | null;
  issueType: string;
  jurisdiction: string;
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
  severity: sql<number | null>`COALESCE(${complianceIssueAnalyses.reviewerSeverity}, ${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
  occurrenceNumber: complianceIssues.occurrenceNumber,
  statuteCitation: complianceIssueAnalyses.federalCitation,
  tier1Reasoning: complianceIssueAnalyses.tier1Reasoning,
  tier2Reasoning: complianceIssueAnalyses.tier2Reasoning,
  tier3Reasoning: complianceIssueAnalyses.tier3Reasoning,
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
  jurisdiction: complianceIssues.jurisdiction,
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
  // Guidance document context
  guidanceDocId: guidanceDocuments.id,
  guidanceDocTitle: guidanceDocuments.title,
  guidanceDocUrl: guidanceDocuments.url,
  guidanceDocAgency: guidanceDocuments.agency,
  guidanceDocType: guidanceDocuments.docType,
  guidanceDocYear: guidanceDocuments.year,
} as const;

/** Map a DB row from issueListSelectColumns to ComplianceIssueWithAnalysis.
 *  Automatically builds TierAnalysis from the analysis pipeline columns in the row. */
function mapRowToIssue(
  row: {
    id: number;
    documentId: number | null;
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
    tier1Reasoning: string | null;
    tier2Reasoning: string | null;
    tier3Reasoning: string | null;
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
    jurisdiction: string;
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
    regulationId: number | null;
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
    // Guidance document context
    guidanceDocId: number | null;
    guidanceDocTitle: string | null;
    guidanceDocUrl: string | null;
    guidanceDocAgency: string | null;
    guidanceDocType: string | null;
    guidanceDocYear: number | null;
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
    documentId: row.documentId != null ? Number(row.documentId) : null,
    guidanceDocumentId: row.guidanceDocId ? Number(row.guidanceDocId) : null,
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
    tier1Reasoning: row.tier1Reasoning ?? null,
    tier2Reasoning: row.tier2Reasoning ?? null,
    tier3Reasoning: row.tier3Reasoning ?? null,
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
    jurisdiction: row.jurisdiction,
    createdAt: row.createdAt,
    regulation: {
      id: row.regulationId ?? 0,
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
    guidance: row.guidanceDocId ? {
      id: Number(row.guidanceDocId),
      title: row.guidanceDocTitle ?? null,
      url: row.guidanceDocUrl ?? null,
      agency: row.guidanceDocAgency ?? null,
      docType: row.guidanceDocType ?? null,
      year: row.guidanceDocYear ?? null,
    } : null,
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
  // Legacy single-value filters (kept for getPriorityPicks compatibility)
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

  // Multi-select arrays (take precedence over single-value when provided)
  tiersCompleted?: number[];
  classifications?: string[];
  federalMandates?: string[];     // 'true'/'false' as strings
  pipelineRuns?: string[];        // 'true'/'false' as strings
  issueTypes?: string[];
  severities?: ('high' | 'medium' | 'low' | 'none')[];
  severityChanges?: string[];
  federalMandatesConfirmed?: string[];
  stateDiscretions?: string[];
  alternativesFound?: string[];
  evidenceGaps?: string[];
  supersededByLaws?: string[];
  advocacyForChanges?: string[];
  tier3Triggers?: string[];
  easyCleanups?: string[];

  bookmarkedOnly?: boolean;
  markerGroupIds?: number[];
}

/** Analysis source: regulations (default) or guidance documents. */
export type AnalysisSource = 'regulation' | 'guidance';

/** Build a Drizzle ORM condition to filter by analysis source. Returns undefined if no filter needed. */
export function buildSourceCondition(source?: AnalysisSource) {
  if (source === 'guidance') return isNotNull(complianceIssueAnalyses.guidanceDocumentId);
  if (source === 'regulation') return isNull(complianceIssueAnalyses.guidanceDocumentId);
  return undefined;
}

/** Build a raw SQL fragment to filter by analysis source. Returns empty string if no filter needed. */
export function buildSourceSqlFragment(source?: AnalysisSource): string {
  if (source === 'guidance') return 'AND guidance_document_id IS NOT NULL';
  if (source === 'regulation') return 'AND guidance_document_id IS NULL';
  return '';
}

/**
 * Build a SQL condition for a severity range (high=7+, medium=4-6, low=1-3).
 * Used by both single-select and multi-select severity filters.
 */
function buildSeverityRangeCondition(severity: 'high' | 'medium' | 'low', column: typeof complianceIssueAnalyses.finalSeverity) {
  if (severity === 'high') return gte(column, 7);
  if (severity === 'medium') return and(gte(column, 4), lt(column, 7))!;
  return lt(column, 4);
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
 * Always includes the jurisdiction condition as the first element.
 */
export function buildAnalysisListFilters(params: {
  jurisdiction: JurisdictionCode;
  filters?: AnalysisListFilters;
  source?: AnalysisSource;
}): SQL[] {
  const { jurisdiction, filters, source } = params;

  const conditions: SQL[] = [
    eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
  ];

  // Source filter: guidance requires guidanceDocumentId, regulation requires documentId
  if (source === 'guidance') {
    conditions.push(isNotNull(complianceIssueAnalyses.guidanceDocumentId));
  } else {
    // Default to regulation — excludes guidance rows for backward compatibility
    conditions.push(isNotNull(complianceIssueAnalyses.documentId));
  }

  if (!filters) return conditions;

  // --- Tier completed ---
  if (filters.tiersCompleted?.length) {
    conditions.push(inArray(complianceIssueAnalyses.highestTierCompleted, filters.tiersCompleted));
  } else if (filters.tierCompleted !== undefined) {
    conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, filters.tierCompleted));
  }

  // --- Classification ---
  if (filters.classifications?.length) {
    const classConditions = filters.classifications.map(c =>
      or(
        eq(complianceIssueAnalyses.tier3Classification, c),
        and(
          isNull(complianceIssueAnalyses.tier3Classification),
          eq(complianceIssueAnalyses.tier2Classification, c)
        ),
        and(
          isNull(complianceIssueAnalyses.tier3Classification),
          isNull(complianceIssueAnalyses.tier2Classification),
          eq(complianceIssueAnalyses.tier1Classification, c)
        )
      )!
    );
    conditions.push(or(...classConditions)!);
  } else if (filters.classification) {
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

  // --- Federal mandate (boolean) ---
  if (filters.federalMandates?.length) {
    const mandateConditions = filters.federalMandates.map(v =>
      eq(complianceIssueAnalyses.federalMandateFound, v === 'true')
    );
    conditions.push(or(...mandateConditions)!);
  } else if (filters.federalMandate !== undefined) {
    conditions.push(eq(complianceIssueAnalyses.federalMandateFound, filters.federalMandate));
  }

  // --- Pipeline run (boolean) ---
  if (filters.pipelineRuns?.length) {
    const runConditions = filters.pipelineRuns.map(v =>
      v === 'true'
        ? gte(complianceIssueAnalyses.highestTierCompleted, 1)
        : eq(complianceIssueAnalyses.highestTierCompleted, 0)
    );
    conditions.push(or(...runConditions)!);
  } else if (filters.pipelineRun !== undefined) {
    if (filters.pipelineRun) {
      conditions.push(gte(complianceIssueAnalyses.highestTierCompleted, 1));
    } else {
      conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, 0));
    }
  }

  // --- Issue type ---
  if (filters.issueTypes?.length) {
    conditions.push(inArray(complianceIssueAnalyses.issueType, filters.issueTypes));
  } else if (filters.issueType) {
    conditions.push(eq(complianceIssueAnalyses.issueType, filters.issueType));
  }

  // --- Severity (high=7-10, medium=4-6, low=1-3, none=null) ---
  if (filters.severities?.length) {
    const severityExpr = sql`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`;
    const sevConditions = filters.severities.map(s => {
      if (s === 'high') return sql`${severityExpr} >= 7`;
      if (s === 'medium') return sql`(${severityExpr} >= 4 AND ${severityExpr} < 7)`;
      if (s === 'low') return sql`(${severityExpr} >= 1 AND ${severityExpr} < 4)`;
      // 'none'
      return sql`${severityExpr} IS NULL`;
    });
    conditions.push(sql`(${sql.join(sevConditions, sql` OR `)})`);
  } else if (filters.severity) {
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

  // --- Severity changed ---
  if (filters.severityChanges?.length) {
    const sevChangedConditions = filters.severityChanges.map(v => {
      if (v === 'increased') return sql`${complianceIssueAnalyses.tier3SeverityAdjustment} > 0`;
      if (v === 'decreased') return sql`${complianceIssueAnalyses.tier3SeverityAdjustment} < 0`;
      if (v === 'unchanged') return sql`(${complianceIssueAnalyses.tier3SeverityAdjustment} = 0 OR (${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND ${complianceIssueAnalyses.tier3SeverityAdjustment} IS NULL))`;
      // 'no_tier3'
      return sql`${complianceIssueAnalyses.tier3Classification} IS NULL`;
    });
    conditions.push(sql`(${sql.join(sevChangedConditions, sql` OR `)})`);
  } else if (filters.severityChanged) {
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

  // --- Tier 3 JSONB flag filters ---
  // Federal mandate confirmed
  if (filters.federalMandatesConfirmed?.length) {
    const flagConditions = filters.federalMandatesConfirmed.map(v =>
      buildTier3FlagFilter('federal_mandate_confirmed', v as 'true' | 'false' | 'no_tier3')
    ).filter((c): c is SQL => c !== undefined);
    if (flagConditions.length) conditions.push(sql`(${sql.join(flagConditions, sql` OR `)})`);
  } else {
    const federalMandateFilter = buildTier3FlagFilter('federal_mandate_confirmed', filters.federalMandateConfirmed);
    if (federalMandateFilter) conditions.push(federalMandateFilter);
  }

  // State discretion
  if (filters.stateDiscretions?.length) {
    const flagConditions = filters.stateDiscretions.map(v =>
      buildTier3FlagFilter('state_discretion_found', v as 'true' | 'false' | 'no_tier3')
    ).filter((c): c is SQL => c !== undefined);
    if (flagConditions.length) conditions.push(sql`(${sql.join(flagConditions, sql` OR `)})`);
  } else {
    const stateDiscretionFilter = buildTier3FlagFilter('state_discretion_found', filters.stateDiscretion);
    if (stateDiscretionFilter) conditions.push(stateDiscretionFilter);
  }

  // Alternative found
  if (filters.alternativesFound?.length) {
    const flagConditions = filters.alternativesFound.map(v =>
      buildTier3FlagFilter('modernized_alternative_found', v as 'true' | 'false' | 'no_tier3')
    ).filter((c): c is SQL => c !== undefined);
    if (flagConditions.length) conditions.push(sql`(${sql.join(flagConditions, sql` OR `)})`);
  } else {
    const alternativeFilter = buildTier3FlagFilter('modernized_alternative_found', filters.alternativeFound);
    if (alternativeFilter) conditions.push(alternativeFilter);
  }

  // Superseded by law
  if (filters.supersededByLaws?.length) {
    const flagConditions = filters.supersededByLaws.map(v =>
      buildTier3FlagFilter('superseded_by_law', v as 'true' | 'false' | 'no_tier3')
    ).filter((c): c is SQL => c !== undefined);
    if (flagConditions.length) conditions.push(sql`(${sql.join(flagConditions, sql` OR `)})`);
  } else {
    const supersededFilter = buildTier3FlagFilter('superseded_by_law', filters.supersededByLaw);
    if (supersededFilter) conditions.push(supersededFilter);
  }

  // Advocacy for change
  if (filters.advocacyForChanges?.length) {
    const flagConditions = filters.advocacyForChanges.map(v =>
      buildTier3FlagFilter('advocacy_for_change', v as 'true' | 'false' | 'no_tier3')
    ).filter((c): c is SQL => c !== undefined);
    if (flagConditions.length) conditions.push(sql`(${sql.join(flagConditions, sql` OR `)})`);
  } else {
    const advocacyFilter = buildTier3FlagFilter('advocacy_for_change', filters.advocacyForChange);
    if (advocacyFilter) conditions.push(advocacyFilter);
  }

  // --- Evidence gap (boolean column, not JSONB) ---
  if (filters.evidenceGaps?.length) {
    const gapConditions = filters.evidenceGaps.map(v => {
      if (v === 'true') return sql`${complianceIssueAnalyses.tier3EvidenceGap} = true`;
      if (v === 'false') return sql`(${complianceIssueAnalyses.tier3EvidenceGap} = false OR (${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND ${complianceIssueAnalyses.tier3EvidenceGap} IS NULL))`;
      // 'no_tier3'
      return sql`${complianceIssueAnalyses.tier3Classification} IS NULL`;
    });
    conditions.push(sql`(${sql.join(gapConditions, sql` OR `)})`);
  } else if (filters.evidenceGap) {
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

  // --- Tier 3 trigger ---
  if (filters.tier3Triggers?.length) {
    // IMPORTANT: These thresholds must match backend/scripts/research_pipeline/routing.py
    const HIGH_RISK_ISSUE_TYPES = ['newspaper', 'notarization', 'wet_signature', 'witness', 'mandated_reports'];
    const IN_PERSON_PREFIX = 'in_person';

    const triggerConditions = filters.tier3Triggers.map(trigger => {
      if (trigger === 'high_risk_issue') {
        return sql`(${or(
          inArray(complianceIssueAnalyses.issueType, HIGH_RISK_ISSUE_TYPES),
          like(complianceIssueAnalyses.issueType, `${IN_PERSON_PREFIX}%`)
        )!} AND ${complianceIssueAnalyses.severity} >= 7)`;
      }
      if (trigger === 'federal_citation') return sql`${complianceIssueAnalyses.citesFederalStatute} = true`;
      if (trigger === 'no_alternative') return sql`(${complianceIssueAnalyses.claimsNoAlternative} = true AND ${complianceIssueAnalyses.severity} >= 7)`;
      if (trigger === 'high_severity') return sql`(${complianceIssueAnalyses.tier2Classification} = 'burdensome' AND ${complianceIssueAnalyses.severity} >= 8)`;
      if (trigger === 'controversial') return sql`(${complianceIssueAnalyses.tier2Classification} = 'justified' AND ${complianceIssueAnalyses.potentiallyControversial} = true)`;
      if (trigger === 'mandate_suspected') return sql`${complianceIssueAnalyses.federalMandateSuspected} = true`;
      // 'not_triggered'
      return sql`${complianceIssueAnalyses.tier3Classification} IS NULL`;
    });
    conditions.push(sql`(${sql.join(triggerConditions, sql` OR `)})`);
  } else if (filters.tier3Trigger) {
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

  // --- Easy cleanup ---
  if (filters.easyCleanups?.length) {
    const cleanupConditions = filters.easyCleanups.map(v => {
      if (v === 'any') return sql`${complianceIssueAnalyses.easyCleanupCandidate} = true`;
      return sql`(${complianceIssueAnalyses.easyCleanupCandidate} = true AND ${complianceIssueAnalyses.cleanupEffort} = ${v})`;
    });
    conditions.push(sql`(${sql.join(cleanupConditions, sql` OR `)})`);
  } else if (filters.easyCleanup) {
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

  // Marker group filter
  if (filters.markerGroupIds && filters.markerGroupIds.length > 0) {
    const ids = filters.markerGroupIds;
    conditions.push(
      sql`EXISTS (
        SELECT 1 FROM ${bookmarkMarkers}
        JOIN ${bookmarks} ON ${bookmarkMarkers.bookmarkId} = ${bookmarks.id}
        WHERE ${bookmarks.analysisId} = ${complianceIssueAnalyses.id}
          AND ${bookmarkMarkers.markerGroupId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})
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
  documentId: number | string | null;
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
   * Fetch a single compliance issue by ID with full context including regulation content.
   * Uses the same issueListSelectColumns + mapRowToIssue as list queries, but also
   * selects regulatoryDocuments.content (suitable for detail pages, not lists).
   * Uses leftJoin for regulatoryDocuments since guidance-sourced issues may have documentId = null.
   */
  async getByIdWithFullContext(id: number): Promise<ComplianceIssueWithAnalysis | null> {
    const results = await this.db
      .select({ ...issueListSelectColumns, regulationContent: regulatoryDocuments.content })
      .from(complianceIssues)
      .leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(complianceIssueAnalyses, eq(complianceIssues.analysisId, complianceIssueAnalyses.id))
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
      .where(eq(complianceIssues.id, id))
      .limit(1);

    if (results.length === 0) return null;
    return mapRowToIssue(results[0]);
  }

  /**
   * Find the analysis row corresponding to a compliance issue.
   * PR 6.5: Reads analysis_id FK directly; falls back to composite lookup for NULL analysis_id.
   * PR 6.3: Used by mutations that accept compliance_issues.id but now update analyses.
   */
  private async findAnalysisForIssue(issueId: number): Promise<{ analysisId: number; documentId: number | null; guidanceDocumentId: number | null; issueType: string } | null> {
    const issue = await this.getById(issueId);
    if (!issue) return null;

    // PR 6.5: Direct FK read when analysis_id is populated
    if (issue.analysisId) {
      return { analysisId: issue.analysisId, documentId: issue.documentId, guidanceDocumentId: issue.guidanceDocumentId, issueType: issue.issueType };
    }

    // Fallback: composite lookup for rows where analysis_id is still NULL
    if (issue.documentId != null) {
      const [analysis] = await this.db
        .select({ id: complianceIssueAnalyses.id })
        .from(complianceIssueAnalyses)
        .where(and(
          eq(complianceIssueAnalyses.documentId, issue.documentId),
          eq(complianceIssueAnalyses.issueType, issue.issueType)
        ))
        .limit(1);

      if (analysis) return { analysisId: analysis.id, documentId: issue.documentId, guidanceDocumentId: null, issueType: issue.issueType };
    }

    // Fallback for guidance-sourced issues
    if (issue.guidanceDocumentId != null) {
      const [analysis] = await this.db
        .select({ id: complianceIssueAnalyses.id })
        .from(complianceIssueAnalyses)
        .where(and(
          eq(complianceIssueAnalyses.guidanceDocumentId, issue.guidanceDocumentId),
          eq(complianceIssueAnalyses.issueType, issue.issueType)
        ))
        .limit(1);

      if (analysis) return { analysisId: analysis.id, documentId: null, guidanceDocumentId: issue.guidanceDocumentId, issueType: issue.issueType };
    }

    return null;
  }

  async getByDocumentId(documentId: number): Promise<ComplianceIssueWithAnalysisFields[]> {
    const results = await this.db
      .select({
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        guidanceDocumentId: complianceIssues.guidanceDocumentId,
        issueType: complianceIssues.issueType,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        url: complianceIssues.url,
        regexMatchPattern: complianceIssues.regexMatchPattern,
        regexMatchContext: complianceIssues.regexMatchContext,
        jurisdiction: complianceIssues.jurisdiction,
        createdAt: complianceIssues.createdAt,
        analysisId: complianceIssues.analysisId,
        runId: complianceIssues.runId,
        // Analysis-sourced fields (PR 6.2)
        requirementFound: complianceIssueAnalyses.requirementFound,
        verbatimSupportingText: complianceIssueAnalyses.verbatimRequirements,
        isVerbatim: complianceIssueAnalyses.isVerbatim,
        requiredByStatute: complianceIssueAnalyses.citesFederalStatute,
        statuteCitation: complianceIssueAnalyses.federalCitation,
        tier1Reasoning: complianceIssueAnalyses.tier1Reasoning,
        tier2Reasoning: complianceIssueAnalyses.tier2Reasoning,
        tier3Reasoning: complianceIssueAnalyses.tier3Reasoning,
        // Review/developer fields (PR 6.3: from analyses)
        severity: sql<number | null>`COALESCE(${complianceIssueAnalyses.reviewerSeverity}, ${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
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
      documentId: row.documentId != null ? Number(row.documentId) : null,
      guidanceDocumentId: row.guidanceDocumentId ?? null,
      requirementFound: row.requirementFound ?? false,
      verbatimSupportingText: row.verbatimSupportingText ?? [],
      isVerbatim: row.isVerbatim ?? null,
      requiredByStatute: row.requiredByStatute ?? false,
      statuteCitation: row.statuteCitation ?? null,
      tier1Reasoning: row.tier1Reasoning ?? null,
      tier2Reasoning: row.tier2Reasoning ?? null,
      tier3Reasoning: row.tier3Reasoning ?? null,
    }));
  }

  /**
   * Re-fetch a single issue after mutation, using whichever source ID is available.
   */
  private async refetchIssue(
    issueId: number,
    analysisInfo: { documentId: number | null; guidanceDocumentId: number | null }
  ): Promise<ComplianceIssueWithAnalysisFields | undefined> {
    if (analysisInfo.documentId != null) {
      const issues = await this.getByDocumentId(analysisInfo.documentId);
      return issues.find(i => i.id === issueId);
    }
    if (analysisInfo.guidanceDocumentId != null) {
      const issues = await this.getByGuidanceDocumentId(analysisInfo.guidanceDocumentId);
      return issues.find(i => i.id === issueId);
    }
    return undefined;
  }

  async getByGuidanceDocumentId(guidanceDocumentId: number): Promise<ComplianceIssueWithAnalysisFields[]> {
    const results = await this.db
      .select({
        id: complianceIssues.id,
        documentId: complianceIssues.documentId,
        guidanceDocumentId: complianceIssues.guidanceDocumentId,
        issueType: complianceIssues.issueType,
        occurrenceNumber: complianceIssues.occurrenceNumber,
        url: complianceIssues.url,
        regexMatchPattern: complianceIssues.regexMatchPattern,
        regexMatchContext: complianceIssues.regexMatchContext,
        jurisdiction: complianceIssues.jurisdiction,
        createdAt: complianceIssues.createdAt,
        analysisId: complianceIssues.analysisId,
        runId: complianceIssues.runId,
        requirementFound: complianceIssueAnalyses.requirementFound,
        verbatimSupportingText: complianceIssueAnalyses.verbatimRequirements,
        isVerbatim: complianceIssueAnalyses.isVerbatim,
        requiredByStatute: complianceIssueAnalyses.citesFederalStatute,
        statuteCitation: complianceIssueAnalyses.federalCitation,
        tier1Reasoning: complianceIssueAnalyses.tier1Reasoning,
        tier2Reasoning: complianceIssueAnalyses.tier2Reasoning,
        tier3Reasoning: complianceIssueAnalyses.tier3Reasoning,
        severity: sql<number | null>`COALESCE(${complianceIssueAnalyses.reviewerSeverity}, ${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
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
      .where(eq(complianceIssues.guidanceDocumentId, guidanceDocumentId))
      .orderBy(asc(complianceIssues.issueType));

    return results.map(row => ({
      ...row,
      id: Number(row.id),
      documentId: row.documentId != null ? Number(row.documentId) : null,
      guidanceDocumentId: row.guidanceDocumentId ?? null,
      requirementFound: row.requirementFound ?? false,
      verbatimSupportingText: row.verbatimSupportingText ?? [],
      isVerbatim: row.isVerbatim ?? null,
      requiredByStatute: row.requiredByStatute ?? false,
      statuteCitation: row.statuteCitation ?? null,
      tier1Reasoning: row.tier1Reasoning ?? null,
      tier2Reasoning: row.tier2Reasoning ?? null,
      tier3Reasoning: row.tier3Reasoning ?? null,
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

    return this.refetchIssue(id, analysisInfo);
  }

  /**
   * Get all unique issue types for filter dropdown
   */
  async getIssueTypes(jurisdiction: JurisdictionCode): Promise<string[]> {
    const result = await this.db
      .selectDistinct({ issueType: complianceIssues.issueType })
      .from(complianceIssues)
      .where(eq(complianceIssues.jurisdiction, normalizeJurisdiction(jurisdiction)))
      .orderBy(asc(complianceIssues.issueType));

    return result.map(r => r.issueType);
  }

  /**
   * Get counts by review status for progress display.
   * PR 6.3: Counts analysis rows (one per document+issue_type) instead of match rows.
   * Only counts LLM-confirmed issues (requirement_found = TRUE) to exclude regex-only matches.
   */
  async getCountsByStatus(
    jurisdiction: JurisdictionCode,
    options?: { source?: 'regulation' | 'guidance' | 'all' }
  ): Promise<ComplianceIssueStatusCounts> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      eq(complianceIssueAnalyses.requirementFound, true),
    ];

    if (options?.source === 'guidance') {
      conditions.push(isNotNull(complianceIssueAnalyses.guidanceDocumentId));
    } else if (options?.source === 'regulation') {
      conditions.push(isNull(complianceIssueAnalyses.guidanceDocumentId));
    }

    const result = await this.db
      .select({
        status: complianceIssueAnalyses.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(...conditions))
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
  async getCountsByType(jurisdiction: JurisdictionCode, source?: AnalysisSource): Promise<Record<string, number>> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      eq(complianceIssueAnalyses.requirementFound, true),
    ];
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);

    const result = await this.db
      .select({
        issueType: complianceIssueAnalyses.issueType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(...conditions))
      .groupBy(complianceIssueAnalyses.issueType);

    const counts: Record<string, number> = {};
    for (const row of result) {
      counts[row.issueType] = row.count;
    }

    return counts;
  }

  /**
   * Get counts by issue type broken down by classification (burdensome/justified/unrelated).
   * Uses COALESCE(tier3, tier2) for best available classification.
   */
  async getCountsByTypeAndClassification(
    jurisdiction: JurisdictionCode,
    source?: AnalysisSource
  ): Promise<Record<string, { burdensome: number; justified: number; unrelated: number; total: number }>> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      eq(complianceIssueAnalyses.requirementFound, true),
    ];
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);

    const result = await this.db
      .select({
        issueType: complianceIssueAnalyses.issueType,
        classification: sql<string>`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(...conditions))
      .groupBy(
        complianceIssueAnalyses.issueType,
        sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`
      );

    const counts: Record<string, { burdensome: number; justified: number; unrelated: number; total: number }> = {};
    for (const row of result) {
      if (!counts[row.issueType]) {
        counts[row.issueType] = { burdensome: 0, justified: 0, unrelated: 0, total: 0 };
      }
      const classification = row.classification as string | null;
      if (classification === 'burdensome') {
        counts[row.issueType].burdensome = row.count;
      } else if (classification === 'justified') {
        counts[row.issueType].justified = row.count;
      } else if (classification === 'unrelated') {
        counts[row.issueType].unrelated = row.count;
      }
      counts[row.issueType].total += row.count;
    }

    return counts;
  }

  /**
   * Get aggregate stats for dashboard
   * PR 6.3: All counts query compliance_issue_analyses with requirementFound = true
   * to be consistent (analytics should use analyses table per architecture).
   */
  async getStatsByJurisdiction(jurisdiction?: JurisdictionCode): Promise<ComplianceIssueStats> {
    const baseConditions = [
      eq(complianceIssueAnalyses.requirementFound, true),
      ...(jurisdiction ? [eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction))] : []),
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
    const { jurisdiction, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssues.jurisdiction, normalizeJurisdiction(jurisdiction)),
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

      // Issue type filter (multi-select takes precedence)
      if (filters.issueTypes && filters.issueTypes.length > 0) {
        conditions.push(inArray(complianceIssues.issueType, filters.issueTypes));
      } else if (filters.issueType && filters.issueType !== 'all') {
        conditions.push(eq(complianceIssues.issueType, filters.issueType));
      }

      // Severity filter (high=7-10, medium=4-6, low=1-3) — reads from analyses
      // Multi-select severities takes precedence over single severity
      if (filters.severities && filters.severities.length > 0) {
        const severityConditions = filters.severities.map(s => buildSeverityRangeCondition(s, complianceIssueAnalyses.finalSeverity));
        conditions.push(or(...severityConditions)!);
      } else if (filters.severity && filters.severity !== 'all') {
        conditions.push(buildSeverityRangeCondition(filters.severity, complianceIssueAnalyses.finalSeverity));
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

    // When source='all', use leftJoin so guidance-only issues (documentId IS NULL) are included
    const useLeftJoinForRegulations = filters?.source === 'all';

    // Build count query with appropriate join strategy
    const countQuery = this.db
      .select({ count: count() })
      .from(complianceIssues);
    if (useLeftJoinForRegulations) {
      countQuery.leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id));
    } else {
      countQuery.innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id));
    }
    countQuery.leftJoin(
      complianceIssueAnalyses,
      eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
    );
    countQuery.leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id));
    const [{ count: total }] = await countQuery.where(whereClause);

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
    const dataQuery = this.db
      .select({
        ...issueListSelectColumns,
        regulationContent: regulatoryDocuments.content,
      })
      .from(complianceIssues);
    if (useLeftJoinForRegulations) {
      dataQuery.leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id));
    } else {
      dataQuery.innerJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id));
    }
    dataQuery.leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id));
    const results = await dataQuery
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

    return this.refetchIssue(id, analysisInfo);
  }

  /**
   * Get counts by developer status for progress display.
   * PR 6.3: Counts analysis rows (one per document+issue_type) instead of match rows.
   */
  async getDeveloperStatusCounts(jurisdiction: JurisdictionCode): Promise<DeveloperStatusCounts> {
    const result = await this.db
      .select({
        status: complianceIssueAnalyses.developerStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
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
    const { jurisdiction, page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters, developerStatus, developerAssigned } = options;
    const offset = (page - 1) * pageSize;

    // Build where conditions - only reviewed items (from analyses)
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssues.jurisdiction, normalizeJurisdiction(jurisdiction)),
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

      // Issue type filter (multi-select takes precedence)
      if (filters.issueTypes && filters.issueTypes.length > 0) {
        conditions.push(inArray(complianceIssues.issueType, filters.issueTypes));
      } else if (filters.issueType && filters.issueType !== 'all') {
        conditions.push(eq(complianceIssues.issueType, filters.issueType));
      }

      // Severity filter (multi-select severities takes precedence)
      if (filters.severities && filters.severities.length > 0) {
        const severityConditions = filters.severities.map(s => buildSeverityRangeCondition(s, complianceIssueAnalyses.finalSeverity));
        conditions.push(or(...severityConditions)!);
      } else if (filters.severity && filters.severity !== 'all') {
        conditions.push(buildSeverityRangeCondition(filters.severity, complianceIssueAnalyses.finalSeverity));
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(and(whereClause, or(isNotNull(regulatoryDocuments.id), isNotNull(guidanceDocuments.id))));

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
      .leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(and(whereClause, or(isNotNull(regulatoryDocuments.id), isNotNull(guidanceDocuments.id))))
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
    jurisdiction: JurisdictionCode,
    options: {
      page: number;
      pageSize: number;
    }
  ): Promise<PaginatedComplianceIssuesResult> {
    const { page, pageSize } = options;
    const offset = (page - 1) * pageSize;

    const conditions = [
      eq(complianceIssues.jurisdiction, normalizeJurisdiction(jurisdiction)),
      eq(complianceIssueAnalyses.developerStatus, 'need_more_info'),
    ];

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssues)
      .leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(and(whereClause, or(isNotNull(regulatoryDocuments.id), isNotNull(guidanceDocuments.id))));

    // Order by developerCheckedAt desc (from analyses)
    const orderBy = [desc(complianceIssueAnalyses.developerCheckedAt)];

    // Get paginated results with analysis fields
    const results = await this.db
      .select(issueListSelectColumns)
      .from(complianceIssues)
      .leftJoin(regulatoryDocuments, eq(complianceIssues.documentId, regulatoryDocuments.id))
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
      .leftJoin(
        complianceIssueAnalyses,
        eq(complianceIssues.analysisId, complianceIssueAnalyses.id)
      )
      .where(and(whereClause, or(isNotNull(regulatoryDocuments.id), isNotNull(guidanceDocuments.id))))
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
  async getNeedMoreInfoCount(jurisdiction: JurisdictionCode): Promise<{ total: number }> {
    const [{ count: total }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
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

    return this.refetchIssue(id, analysisInfo);
  }

  /**
   * Get a smart batch of compliance issues for suggestion mode.
   * Groups items by the specified grouping mode and returns a batch with metadata.
   */
  async getSuggestionBatch(options: {
    jurisdiction: JurisdictionCode;
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
    const { jurisdiction, batchSize, excludeIds, groupingMode, focus, recentIssueTypes } = options;

    // Base conditions: LLM confirmed (from analyses) + unreviewed + exclude shown IDs
    const baseConditions = [
      eq(complianceIssues.jurisdiction, normalizeJurisdiction(jurisdiction)),
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
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
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
      .leftJoin(guidanceDocuments, eq(complianceIssues.guidanceDocumentId, guidanceDocuments.id))
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
  async getAnalysisTierCounts(jurisdiction: JurisdictionCode, source?: AnalysisSource): Promise<TierCompletionCounts> {
    // Count issues by highest tier completed in their analysis
    const conditions = [
      eq(complianceIssues.jurisdiction, normalizeJurisdiction(jurisdiction)),
    ];
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);

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
      .where(and(...conditions))
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
  async getClassificationBreakdown(jurisdiction: JurisdictionCode, source?: AnalysisSource): Promise<ClassificationBreakdown> {
    const breakdown: ClassificationBreakdown = {
      tier1: {},
      tier2: {},
      tier3: {},
      coalesced: {},
    };

    const baseConditions: SQL[] = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      eq(complianceIssueAnalyses.requirementFound, true),
    ];
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) baseConditions.push(sourceCondition);

    // Tier 1 classifications
    const tier1Results = await this.db
      .select({
        classification: complianceIssueAnalyses.tier1Classification,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        ...baseConditions,
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
        ...baseConditions,
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
        ...baseConditions,
        sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL`
      ))
      .groupBy(complianceIssueAnalyses.tier3Classification);

    for (const row of tier3Results) {
      if (row.classification) {
        breakdown.tier3[row.classification] = row.count;
      }
    }

    // Coalesced: each record counted once at its highest completed tier
    const coalescedResults = await this.db
      .select({
        classification: sql<string>`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        ...baseConditions,
        sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification}) IS NOT NULL`
      ))
      .groupBy(sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`);

    for (const row of coalescedResults) {
      if (row.classification) {
        breakdown.coalesced[row.classification] = row.count;
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
        jurisdiction: complianceIssueAnalyses.jurisdiction,
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

    // Build citation string based on jurisdiction
    let citation: string | null = null;
    if (row.docNjacTitle) {
      citation = `N.J.A.C. ${row.docNjacTitle}:${row.docNjacChapter || ''}${row.docNjacSubchapter ? `-${row.docNjacSubchapter}` : ''}`;
    } else if (row.docNycrrTitle) {
      citation = `${row.docNycrrTitle} NYCRR Part ${row.docNycrrPart || ''}${row.docNycrrSection ? ` § ${row.docNycrrSection}` : ''}`;
    }

    return {
      documentId: Number(row.documentId),
      issueType: row.issueType,
      jurisdiction: row.jurisdiction,
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
    jurisdiction: JurisdictionCode,
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

    const conditions = buildAnalysisListFilters({ jurisdiction, filters });
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
    jurisdiction: JurisdictionCode,
    options: {
      sortBy?: string;
      sortOrder?: string;
      filters?: AnalysisListFilters;
    } = {}
  ): Promise<AnalysisExportRow[]> {
    const { sortBy = 'severity', sortOrder = 'desc', filters } = options;

    const conditions = buildAnalysisListFilters({ jurisdiction, filters });
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
        docUrl: regulatoryDocuments.url,
        issueType: complianceIssueAnalyses.issueType,
        argumentAgainstRegulation: complianceIssueAnalyses.argumentAgainstRegulation,
        verbatimRequirements: complianceIssueAnalyses.verbatimRequirements,
        finalSeverity: sql<number | null>`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,
        documentId: complianceIssueAnalyses.documentId,
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
        url: row.docUrl,
        issueType: row.issueType,
        nycrrTitle: row.docNycrrTitle,
        njacTitle: row.docNjacTitle,
        argumentAgainstRegulation: row.argumentAgainstRegulation,
        verbatimRequirements: row.verbatimRequirements,
        finalSeverity: row.finalSeverity,
        cleanupType: row.cleanupType,
        cleanupEffort: row.cleanupEffort,
        documentId: row.documentId,
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // Comprehensive Export (Full CSV + By Agency)
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get comprehensive analysis data for CSV export.
   * Includes all meaningful analysis fields (~38 columns).
   * Same filters as getAnalysisListPaginated but unpaginated. Capped at 10000 rows.
   */
  async getComprehensiveExportData(
    jurisdiction: JurisdictionCode,
    options: {
      sortBy?: string;
      sortOrder?: string;
      filters?: AnalysisListFilters;
    } = {}
  ): Promise<ComprehensiveAnalysisExportRow[]> {
    const { sortBy = 'severity', sortOrder = 'desc', filters } = options;

    const conditions = buildAnalysisListFilters({ jurisdiction, filters });
    const whereClause = and(...conditions);
    const orderClauses = buildAnalysisListSort(sortBy, sortOrder);

    const results = await this.db
      .select({
        // Document info
        docShortTitle: regulatoryDocuments.shortTitle,
        docTitle: regulatoryDocuments.title,
        docCitation: regulatoryDocuments.citation,
        docUrl: regulatoryDocuments.url,
        docNycrrTitle: regulatoryDocuments.nycrrTitle,
        docNjacTitle: regulatoryDocuments.njacTitle,
        docNjacChapter: regulatoryDocuments.njacChapter,
        docNjacSubchapter: regulatoryDocuments.njacSubchapter,
        docNycrrPart: regulatoryDocuments.nycrrPart,
        docNycrrSection: regulatoryDocuments.nycrrSection,
        // Analysis core
        issueType: complianceIssueAnalyses.issueType,
        documentId: complianceIssueAnalyses.documentId,
        groupedMatchCount: complianceIssueAnalyses.groupedMatchCount,
        highestTierCompleted: complianceIssueAnalyses.highestTierCompleted,
        // Tier classifications
        tier1Classification: complianceIssueAnalyses.tier1Classification,
        tier2Classification: complianceIssueAnalyses.tier2Classification,
        tier3Classification: complianceIssueAnalyses.tier3Classification,
        // Severity
        finalSeverity: sql<number | null>`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
        severityBaseline: complianceIssueAnalyses.severityBaseline,
        tier3SeverityAdjustment: complianceIssueAnalyses.tier3SeverityAdjustment,
        // Key analysis fields
        requirementFound: complianceIssueAnalyses.requirementFound,
        isJustified: complianceIssueAnalyses.isJustified,
        verbatimRequirements: complianceIssueAnalyses.verbatimRequirements,
        argumentForRegulation: complianceIssueAnalyses.argumentForRegulation,
        argumentAgainstRegulation: complianceIssueAnalyses.argumentAgainstRegulation,
        // Tier 3 web search
        webSearchSummary: complianceIssueAnalyses.webSearchSummary,
        federalMandateFound: complianceIssueAnalyses.federalMandateFound,
        stateHasDiscretion: complianceIssueAnalyses.stateHasDiscretion,
        tier3EvidenceGap: complianceIssueAnalyses.tier3EvidenceGap,
        tier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
        // Federal mandate
        citesFederalStatute: complianceIssueAnalyses.citesFederalStatute,
        federalCitation: complianceIssueAnalyses.federalCitation,
        // Cleanup
        easyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,
        cleanupRecommendation: complianceIssueAnalyses.cleanupRecommendation,
        // Pipeline
        responsibleAgency: complianceIssueAnalyses.responsibleAgency,
        pipelineVersion: complianceIssueAnalyses.pipelineVersion,
        // Review
        reviewStatus: complianceIssueAnalyses.reviewStatus,
        reviewedBy: complianceIssueAnalyses.reviewedBy,
        justificationNotes: complianceIssueAnalyses.justificationNotes,
        teamNotes: complianceIssueAnalyses.teamNotes,
        impactType: complianceIssueAnalyses.impactType,
        // Developer
        developerStatus: complianceIssueAnalyses.developerStatus,
        developerAssigned: complianceIssueAnalyses.developerAssigned,
        developerNotes: complianceIssueAnalyses.developerNotes,
        resolutionType: complianceIssueAnalyses.resolutionType,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(regulatoryDocuments, eq(complianceIssueAnalyses.documentId, regulatoryDocuments.id))
      .where(whereClause)
      .orderBy(...orderClauses)
      .limit(10000);

    return results.map((row) => {
      // Build citation from structured fields (same logic as getAnalysisExportData)
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
        url: row.docUrl,
        issueType: row.issueType,
        nycrrTitle: row.docNycrrTitle,
        njacTitle: row.docNjacTitle,
        documentId: row.documentId,
        groupedMatchCount: row.groupedMatchCount,
        highestTierCompleted: row.highestTierCompleted,
        tier1Classification: row.tier1Classification,
        tier2Classification: row.tier2Classification,
        tier3Classification: row.tier3Classification,
        finalSeverity: row.finalSeverity,
        severityBaseline: row.severityBaseline,
        tier3SeverityAdjustment: row.tier3SeverityAdjustment,
        requirementFound: row.requirementFound,
        isJustified: row.isJustified,
        verbatimRequirements: row.verbatimRequirements,
        argumentForRegulation: row.argumentForRegulation,
        argumentAgainstRegulation: row.argumentAgainstRegulation,
        webSearchSummary: row.webSearchSummary,
        federalMandateFound: row.federalMandateFound,
        stateHasDiscretion: row.stateHasDiscretion,
        tier3EvidenceGap: row.tier3EvidenceGap,
        tier3TriggerReason: row.tier3TriggerReason,
        citesFederalStatute: row.citesFederalStatute,
        federalCitation: row.federalCitation,
        easyCleanupCandidate: row.easyCleanupCandidate,
        cleanupType: row.cleanupType,
        cleanupEffort: row.cleanupEffort,
        cleanupRecommendation: row.cleanupRecommendation,
        responsibleAgency: row.responsibleAgency,
        pipelineVersion: row.pipelineVersion,
        reviewStatus: row.reviewStatus,
        reviewedBy: row.reviewedBy,
        justificationNotes: row.justificationNotes,
        teamNotes: row.teamNotes,
        impactType: row.impactType,
        developerStatus: row.developerStatus,
        developerAssigned: row.developerAssigned,
        developerNotes: row.developerNotes,
        resolutionType: row.resolutionType,
      };
    });
  }

  /**
   * Get comprehensive export data grouped by responsible agency.
   * Returns a Map of agency name → rows for ZIP-by-agency export.
   */
  async getComprehensiveExportDataGroupedByAgency(
    jurisdiction: JurisdictionCode,
    options: {
      sortBy?: string;
      sortOrder?: string;
      filters?: AnalysisListFilters;
    } = {}
  ): Promise<Map<string, ComprehensiveAnalysisExportRow[]>> {
    const data = await this.getComprehensiveExportData(jurisdiction, options);
    const grouped = new Map<string, ComprehensiveAnalysisExportRow[]>();

    for (const row of data) {
      const agency = row.responsibleAgency || 'Unassigned';
      const existing = grouped.get(agency);
      if (existing) {
        existing.push(row);
      } else {
        grouped.set(agency, [row]);
      }
    }

    return grouped;
  }

  // ═══════════════════════════════════════════════════════════════════
  // Severity Distribution
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get severity distribution (high/medium/low) for compliance issue analyses.
   * Uses COALESCE(final_severity, severity) to get the best available severity.
   */
  async getSeverityDistribution(jurisdiction: JurisdictionCode, source?: AnalysisSource): Promise<SeverityDistribution> {
    const sourceFragment = buildSourceSqlFragment(source);
    const result = await this.db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) >= 7)::int AS "high",
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) >= 4 AND COALESCE(final_severity, severity) < 7)::int AS "medium",
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) >= 1 AND COALESCE(final_severity, severity) < 4)::int AS "low",
        COUNT(*) FILTER (WHERE COALESCE(final_severity, severity) IS NOT NULL)::int AS "total"
      FROM compliance_issue_analyses
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND requirement_found = TRUE
        ${sql.raw(sourceFragment)}
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
  async getPipelineFunnelStats(jurisdiction: JurisdictionCode, issueType?: string, source?: AnalysisSource): Promise<PipelineFunnelData> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      isNotNull(complianceIssueAnalyses.tier1Classification),
      eq(complianceIssueAnalyses.requirementFound, true),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);

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
  async getTier1ContextRequestStats(jurisdiction: JurisdictionCode, issueType?: string, source?: AnalysisSource): Promise<Tier1ContextRequestStats> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      isNotNull(complianceIssueAnalyses.tier1Recommendations),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);
    const sourceFragment = buildSourceSqlFragment(source);

    // Unpack the JSONB context_requests array
    const contextTypeResults = await this.db.execute(sql`
      SELECT
        cr->>'context_type' AS context_type,
        cr->>'need_level' AS need_level,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(tier1_recommendations->'context_requests') AS cr
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND tier1_recommendations IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
      WHERE a.jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND a.tier1_recommendations IS NOT NULL
        ${issueType ? sql`AND a.issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
  async getTierTransitionStats(jurisdiction: JurisdictionCode, issueType?: string, source?: AnalysisSource): Promise<TierTransitionData> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);
    const sourceFragment = buildSourceSqlFragment(source);

    // Tier 2→3 classification cross-tab
    const crossTabResults = await this.db.execute(sql`
      SELECT
        tier2_classification AS tier2_class,
        tier3_classification AS tier3_class,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND tier2_classification IS NOT NULL
        AND tier3_classification IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND tier1_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND tier2_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND tier3_confidence IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
  async getTransitionReasons(jurisdiction: JurisdictionCode, issueType?: string): Promise<TransitionReasonData> {
    const results = await this.db.execute(sql`
      SELECT
        tier2_classification AS tier2_class,
        tier3_classification AS tier3_class,
        tier3_trigger_reason AS trigger_reason,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
  async getConfidenceByClassification(jurisdiction: JurisdictionCode, issueType?: string): Promise<ConfidenceByClassificationData> {
    const results = await this.db.execute(sql`
      SELECT
        'tier1' AS tier,
        tier1_classification AS classification,
        round(avg(tier1_confidence)::numeric, 3)::float AS avg_confidence,
        count(*)::int AS count
      FROM compliance_issue_analyses
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
  async getTier3EvidenceStats(jurisdiction: JurisdictionCode, issueType?: string, source?: AnalysisSource): Promise<Tier3EvidenceStats> {
    const conditions = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      isNotNull(complianceIssueAnalyses.tier3Classification),
    ];
    if (issueType) {
      conditions.push(eq(complianceIssueAnalyses.issueType, issueType));
    }
    const sourceCondition = buildSourceCondition(source);
    if (sourceCondition) conditions.push(sourceCondition);
    const sourceFragment = buildSourceSqlFragment(source);

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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
        AND tier3_classification IS NOT NULL
        ${issueType ? sql`AND issue_type = ${issueType}` : sql``}
        ${sql.raw(sourceFragment)}
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
  async getTier2ContextRequestsStats(jurisdiction: JurisdictionCode, issueType?: string): Promise<Tier2ContextRequestsStats> {
    const issueTypeClause = issueType ? sql`AND issue_type = ${issueType}` : sql``;

    const byTypeResults = await this.db.execute(sql`
      SELECT
        cr->>'context_type' AS context_type,
        cr->>'need_level' AS need_level,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(tier2_context_requests_made) AS cr
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
  async getContextUsedStats(jurisdiction: JurisdictionCode, issueType?: string): Promise<ContextUsedStats> {
    const issueTypeClause = issueType ? sql`AND issue_type = ${issueType}` : sql``;

    const bySourceResults = await this.db.execute(sql`
      SELECT
        ce->>'type' AS source_type,
        count(*)::int AS count
      FROM compliance_issue_analyses,
        jsonb_array_elements(context_used) AS ce
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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
  async getResearchFunnelStats(jurisdiction: JurisdictionCode, issueType?: string): Promise<ResearchFunnelStats> {
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
      WHERE jurisdiction = ${normalizeJurisdiction(jurisdiction)}
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

  // ═══════════════════════════════════════════════════════════════════
  // Guidance Document Analysis Methods
  // ═══════════════════════════════════════════════════════════════════

  async getGuidanceAnalysisTierCounts(jurisdiction: JurisdictionCode): Promise<TierCompletionCounts> {
    const results = await this.db
      .select({
        tier: complianceIssueAnalyses.highestTierCompleted,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
        isNotNull(complianceIssueAnalyses.guidanceDocumentId)
      ))
      .groupBy(complianceIssueAnalyses.highestTierCompleted);

    const counts: TierCompletionCounts = { tier0: 0, tier1: 0, tier2: 0, tier3: 0 };
    for (const row of results) {
      if (row.tier === null) counts.tier0 = row.count;
      else if (row.tier === 1) counts.tier1 = row.count;
      else if (row.tier === 2) counts.tier2 = row.count;
      else if (row.tier === 3) counts.tier3 = row.count;
    }
    return counts;
  }

  async getGuidanceClassificationBreakdown(jurisdiction: JurisdictionCode): Promise<ClassificationBreakdown> {
    const breakdown: ClassificationBreakdown = { tier1: {}, tier2: {}, tier3: {}, coalesced: {} };
    const baseConditions = and(
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      isNotNull(complianceIssueAnalyses.guidanceDocumentId),
      eq(complianceIssueAnalyses.requirementFound, true)
    );

    const [tier1Results, tier2Results, tier3Results, coalescedResults] = await Promise.all([
      this.db.select({
        classification: complianceIssueAnalyses.tier1Classification,
        count: sql<number>`count(*)::int`,
      }).from(complianceIssueAnalyses)
        .where(and(baseConditions, sql`${complianceIssueAnalyses.tier1Classification} IS NOT NULL`))
        .groupBy(complianceIssueAnalyses.tier1Classification),
      this.db.select({
        classification: complianceIssueAnalyses.tier2Classification,
        count: sql<number>`count(*)::int`,
      }).from(complianceIssueAnalyses)
        .where(and(baseConditions, sql`${complianceIssueAnalyses.tier2Classification} IS NOT NULL`))
        .groupBy(complianceIssueAnalyses.tier2Classification),
      this.db.select({
        classification: complianceIssueAnalyses.tier3Classification,
        count: sql<number>`count(*)::int`,
      }).from(complianceIssueAnalyses)
        .where(and(baseConditions, sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL`))
        .groupBy(complianceIssueAnalyses.tier3Classification),
      this.db.select({
        classification: sql<string>`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`,
        count: sql<number>`count(*)::int`,
      }).from(complianceIssueAnalyses)
        .where(and(baseConditions, sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification}) IS NOT NULL`))
        .groupBy(sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`),
    ]);

    for (const row of tier1Results) { if (row.classification) breakdown.tier1[row.classification] = row.count; }
    for (const row of tier2Results) { if (row.classification) breakdown.tier2[row.classification] = row.count; }
    for (const row of tier3Results) { if (row.classification) breakdown.tier3[row.classification] = row.count; }
    for (const row of coalescedResults) { if (row.classification) breakdown.coalesced[row.classification] = row.count; }
    return breakdown;
  }

  async getGuidanceAnalysisListPaginated(
    jurisdiction: JurisdictionCode,
    options: {
      page: number;
      pageSize: number;
      sortBy?: 'issueType' | 'severity' | 'highestTier' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      filters?: AnalysisListFilters;
    }
  ): Promise<{
    data: GuidanceAnalysisListItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const { page, pageSize, sortBy = 'createdAt', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const conditions = buildAnalysisListFilters({ jurisdiction, filters, source: 'guidance' });
    const whereClause = and(...conditions);
    const orderClauses = buildAnalysisListSort(sortBy, sortOrder);

    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssueAnalyses)
      .innerJoin(guidanceDocuments, eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause);

    const results = await this.db
      .select({
        guidanceDocumentId: complianceIssueAnalyses.guidanceDocumentId,
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
        docTitle: guidanceDocuments.title,
        docAgency: guidanceDocuments.agency,
        docType: guidanceDocuments.docType,
        docCanonicalRef: guidanceDocuments.canonicalRef,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(guidanceDocuments, eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause)
      .orderBy(...orderClauses)
      .limit(pageSize)
      .offset(offset);

    return {
      data: results.map(row => ({
        guidanceDocumentId: Number(row.guidanceDocumentId),
        issueType: row.issueType,
        documentTitle: row.docTitle,
        agency: row.docAgency,
        docType: row.docType,
        canonicalRef: row.docCanonicalRef,
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
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getFullGuidanceAnalysis(
    guidanceDocumentId: number,
    issueType: string
  ): Promise<FullGuidanceAnalysisRecord | null> {
    const results = await this.db
      .select({
        // Analysis fields
        guidanceDocumentId: complianceIssueAnalyses.guidanceDocumentId,
        issueType: complianceIssueAnalyses.issueType,
        jurisdiction: complianceIssueAnalyses.jurisdiction,
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
        tier2RerunCount: complianceIssueAnalyses.tier2RerunCount,
        tier2ContextRequestsMade: complianceIssueAnalyses.tier2ContextRequestsMade,
        tier2ForcedClassification: complianceIssueAnalyses.tier2ForcedClassification,
        citesFederalStatute: complianceIssueAnalyses.citesFederalStatute,
        federalCitation: complianceIssueAnalyses.federalCitation,
        claimsNoAlternative: complianceIssueAnalyses.claimsNoAlternative,
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
        tier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
        tier3Flags: complianceIssueAnalyses.tier3Flags,
        tier3EvidenceGap: complianceIssueAnalyses.tier3EvidenceGap,

        // Web search results
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

        // Easy Cleanup
        easyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEvidence: complianceIssueAnalyses.cleanupEvidence,
        cleanupRecommendation: complianceIssueAnalyses.cleanupRecommendation,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,

        // Guidance document fields
        gdId: guidanceDocuments.id,
        gdTitle: guidanceDocuments.title,
        gdAgency: guidanceDocuments.agency,
        gdAgencyDivision: guidanceDocuments.agencyDivision,
        gdDocType: guidanceDocuments.docType,
        gdCanonicalRef: guidanceDocuments.canonicalRef,
        gdUrl: guidanceDocuments.url,
        gdPrograms: guidanceDocuments.programs,
        gdPolicyCategory: guidanceDocuments.policyCategory,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(guidanceDocuments, eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocuments.id))
      .where(and(
        eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocumentId),
        eq(complianceIssueAnalyses.issueType, issueType)
      ))
      .limit(1);

    if (results.length === 0) return null;

    const row = results[0];
    return {
      guidanceDocumentId: Number(row.guidanceDocumentId),
      issueType: row.issueType,
      jurisdiction: row.jurisdiction,
      groupedMatchCount: row.groupedMatchCount,

      guidanceDocument: {
        id: row.gdId,
        title: row.gdTitle,
        agency: row.gdAgency,
        agencyDivision: row.gdAgencyDivision,
        docType: row.gdDocType,
        canonicalRef: row.gdCanonicalRef,
        url: row.gdUrl,
        programs: row.gdPrograms,
        policyCategory: row.gdPolicyCategory,
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
        rerunCount: row.tier2RerunCount ?? 0,
        contextRequestsMade: row.tier2ContextRequestsMade as Tier2ContextRequestMade[] | null,
        forcedClassification: row.tier2ForcedClassification ?? false,
        citesFederalStatute: row.citesFederalStatute ?? false,
        federalCitation: row.federalCitation,
        claimsNoAlternative: row.claimsNoAlternative ?? false,
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
        triggerReason: row.tier3TriggerReason,
        flags: row.tier3Flags as Tier3Flags | null,
        evidenceGap: row.tier3EvidenceGap ?? false,
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
      easyCleanupCandidate: row.easyCleanupCandidate ?? false,
      cleanupType: row.cleanupType,
      cleanupEvidence: row.cleanupEvidence,
      cleanupRecommendation: row.cleanupRecommendation,
      cleanupEffort: row.cleanupEffort,
    };
  }

  async getGuidanceRegexMatches(guidanceDocumentId: number, issueType: string): Promise<ComplianceIssue[]> {
    return this.db
      .select()
      .from(complianceIssues)
      .where(and(
        eq(complianceIssues.guidanceDocumentId, guidanceDocumentId),
        eq(complianceIssues.issueType, issueType)
      ))
      .orderBy(asc(complianceIssues.occurrenceNumber));
  }

  async getGuidanceComplianceIssueStatusCounts(
    jurisdiction: JurisdictionCode
  ): Promise<{ total: number; unreviewed: number; reviewed: number; dismissed: number }> {
    const results = await this.db
      .select({
        status: complianceIssueAnalyses.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(and(
        eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
        isNotNull(complianceIssueAnalyses.guidanceDocumentId),
        eq(complianceIssueAnalyses.requirementFound, true),
      ))
      .groupBy(complianceIssueAnalyses.reviewStatus);

    let total = 0, unreviewed = 0, reviewed = 0, dismissed = 0;
    for (const row of results) {
      total += row.count;
      if (row.status === null || row.status === 'unreviewed') unreviewed += row.count;
      else if (row.status === 'dismissed') dismissed += row.count;
      else reviewed += row.count;
    }
    return { total, unreviewed, reviewed, dismissed };
  }

  async getGuidanceComplianceIssuesPaginated(
    jurisdiction: JurisdictionCode,
    options: ComplianceIssuePaginationOptions
  ): Promise<PaginatedComplianceIssuesResult> {
    const { page, pageSize, sortBy = 'severity', sortOrder = 'desc', filters } = options;
    const offset = (page - 1) * pageSize;

    const conditions: SQL[] = [
      eq(complianceIssueAnalyses.jurisdiction, normalizeJurisdiction(jurisdiction)),
      isNotNull(complianceIssueAnalyses.guidanceDocumentId),
      eq(complianceIssueAnalyses.requirementFound, true),
    ];

    if (filters?.status && filters.status !== 'all') {
      if (filters.status === 'unreviewed') {
        conditions.push(or(isNull(complianceIssueAnalyses.reviewStatus), eq(complianceIssueAnalyses.reviewStatus, 'unreviewed'))!);
      } else {
        conditions.push(eq(complianceIssueAnalyses.reviewStatus, filters.status));
      }
    }
    if (filters?.issueTypes && filters.issueTypes.length > 0) {
      conditions.push(inArray(complianceIssueAnalyses.issueType, filters.issueTypes));
    } else if (filters?.issueType && filters.issueType !== 'all') {
      conditions.push(eq(complianceIssueAnalyses.issueType, filters.issueType));
    }

    // Severity filter (multi-select severities takes precedence)
    if (filters?.severities && filters.severities.length > 0) {
      const severityConditions = filters.severities.map(s => buildSeverityRangeCondition(s, complianceIssueAnalyses.finalSeverity));
      conditions.push(or(...severityConditions)!);
    } else if (filters?.severity && filters.severity !== 'all') {
      conditions.push(buildSeverityRangeCondition(filters.severity, complianceIssueAnalyses.finalSeverity));
    }

    const whereClause = and(...conditions);

    const severityExpr = sql`COALESCE(${complianceIssueAnalyses.reviewerSeverity}, ${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`;
    const sortColumn = {
      issueType: complianceIssueAnalyses.issueType,
      severity: severityExpr,
      createdAt: complianceIssueAnalyses.createdAt,
      reviewedAt: complianceIssueAnalyses.reviewedAt,
      developerCheckedAt: complianceIssueAnalyses.developerCheckedAt,
    }[sortBy] ?? complianceIssueAnalyses.createdAt;

    const primarySort = sortBy === 'severity' && sortOrder === 'desc'
      ? sql`${sortColumn} DESC NULLS LAST`
      : sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get count and data
    const [[{ count: total }], rows] = await Promise.all([
      this.db.select({ count: count() }).from(complianceIssueAnalyses).where(whereClause),
      this.db.select({
        // Analysis fields (id is analysis row id, not compliance_issues match id)
        id: complianceIssueAnalyses.id,
        issueType: complianceIssueAnalyses.issueType,
        guidanceDocumentId: complianceIssueAnalyses.guidanceDocumentId,
        // Analysis fields
        requirementFound: complianceIssueAnalyses.requirementFound,
        severity: severityExpr,
        originalSeverity: sql<number | null>`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
        reviewStatus: complianceIssueAnalyses.reviewStatus,
        reviewedBy: complianceIssueAnalyses.reviewedBy,
        reviewedAt: complianceIssueAnalyses.reviewedAt,
        justificationNotes: complianceIssueAnalyses.justificationNotes,
        teamNotes: complianceIssueAnalyses.teamNotes,
        impactType: complianceIssueAnalyses.impactType,
        tier1Reasoning: complianceIssueAnalyses.tier1Reasoning,
        tier2Reasoning: complianceIssueAnalyses.tier2Reasoning,
        tier3Reasoning: complianceIssueAnalyses.tier3Reasoning,
        // Guidance document context
        gdTitle: guidanceDocuments.title,
        gdAgency: guidanceDocuments.agency,
        gdUrl: guidanceDocuments.url,
        gdDocType: guidanceDocuments.docType,
        gdYear: guidanceDocuments.year,
      })
      .from(complianceIssueAnalyses)
      .innerJoin(guidanceDocuments, eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocuments.id))
      .where(whereClause)
      .orderBy(primarySort, asc(complianceIssueAnalyses.id))
      .limit(pageSize)
      .offset(offset),
    ]);

    // Map to ComplianceIssueWithAnalysis shape expected by review queue
    const data: ComplianceIssueWithAnalysis[] = rows.map(row => ({
      // Minimal compliance issue fields
      id: row.id,
      documentId: null,
      guidanceDocumentId: Number(row.guidanceDocumentId),
      issueType: row.issueType,
      occurrenceNumber: 0,
      regexMatchPattern: '',
      regexMatchContext: '',
      url: row.gdUrl,
      jurisdiction: normalizeJurisdiction(jurisdiction),
      createdAt: null,
      analysisId: null,
      runId: null,
      // Analysis fields
      requirementFound: row.requirementFound,
      verbatimSupportingText: null,
      isVerbatim: null,
      requiredByStatute: null,
      statuteCitation: null,
      tier1Reasoning: row.tier1Reasoning,
      tier2Reasoning: row.tier2Reasoning,
      tier3Reasoning: row.tier3Reasoning,
      severity: row.severity as number | null,
      originalSeverity: row.originalSeverity as number | null,
      reviewStatus: row.reviewStatus,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      justificationNotes: row.justificationNotes,
      teamNotes: row.teamNotes,
      impactType: row.impactType,
      developerStatus: null,
      developerAssigned: null,
      developerNotes: null,
      resolutionType: null,
      resolutionComments: null,
      developerQuestion: null,
      developerCheckedAt: null,
      // Placeholder regulation (guidance issues have no regulation)
      regulation: {
        id: 0,
        title: null,
        content: null,
        nycrrTitle: null,
        nycrrPart: null,
        nycrrSection: null,
        njacTitle: null,
        njacChapter: null,
        njacSubchapter: null,
        url: null,
        summary: null,
        sectionType: null,
        hasForm: null,
        hasIbr: null,
      },
      guidance: {
        id: Number(row.guidanceDocumentId),
        title: row.gdTitle ?? null,
        url: row.gdUrl ?? null,
        agency: row.gdAgency ?? null,
        docType: row.gdDocType ?? null,
        year: row.gdYear ?? null,
      },
      analysis: null,
    }));

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getGuidanceComplianceAnalysisSummary(
    guidanceDocumentId: number
  ): Promise<{
    totalIssues: number;
    analyzedCount: number;
    burdensomeCount: number;
    justifiedCount: number;
    topIssueTypes: Array<{ issueType: string; count: number }>;
  }> {
    const baseCondition = eq(complianceIssueAnalyses.guidanceDocumentId, guidanceDocumentId);

    const [totalResult, analyzedResult, classResults, topIssueTypes] = await Promise.all([
      this.db.select({ count: sql<number>`count(*)::int` })
        .from(complianceIssues)
        .where(eq(complianceIssues.guidanceDocumentId, guidanceDocumentId)),
      this.db.select({ count: sql<number>`count(*)::int` })
        .from(complianceIssueAnalyses)
        .where(baseCondition),
      this.db.select({
        classification: sql<string>`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`,
        count: sql<number>`count(*)::int`,
      })
        .from(complianceIssueAnalyses)
        .where(baseCondition)
        .groupBy(sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`),
      this.db.select({
        issueType: complianceIssueAnalyses.issueType,
        count: sql<number>`count(*)::int`,
      })
        .from(complianceIssueAnalyses)
        .where(baseCondition)
        .groupBy(complianceIssueAnalyses.issueType)
        .orderBy(desc(sql`count(*)`))
        .limit(5),
    ]);

    let burdensomeCount = 0, justifiedCount = 0;
    for (const row of classResults) {
      if (row.classification === 'burdensome') burdensomeCount = row.count;
      else if (row.classification === 'justified') justifiedCount = row.count;
    }

    return {
      totalIssues: totalResult[0].count,
      analyzedCount: analyzedResult[0].count,
      burdensomeCount,
      justifiedCount,
      topIssueTypes,
    };
  }

  /**
   * Get filter dimension counts for the pipeline filter dropdowns.
   * Returns counts by classification, severity bucket, tier, issue type, and federal mandate.
   * Only counts regulation-sourced analyses (documentId IS NOT NULL).
   */
  async getAnalysisFilterStats(jurisdiction: JurisdictionCode): Promise<AnalysisFilterStats> {
    const jur = normalizeJurisdiction(jurisdiction);
    const baseWhere = and(
      eq(complianceIssueAnalyses.jurisdiction, jur),
      isNotNull(complianceIssueAnalyses.documentId)
    );

    const severityExpr = sql`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`;
    const classificationExpr = sql`COALESCE(${complianceIssueAnalyses.tier3Classification}, ${complianceIssueAnalyses.tier2Classification}, ${complianceIssueAnalyses.tier1Classification})`;

    const [byClassification, bySeverity, byTier, byIssueType, byFederalMandate] = await Promise.all([
      // Classification: COALESCE(tier3, tier2, tier1)
      this.db
        .select({
          classification: sql<string>`${classificationExpr}`,
          count: sql<number>`count(*)::int`,
        })
        .from(complianceIssueAnalyses)
        .where(and(baseWhere, sql`${classificationExpr} IS NOT NULL`))
        .groupBy(classificationExpr),

      // Severity: bucket into high/medium/low/none
      this.db
        .select({
          severity: sql<string>`CASE
            WHEN ${severityExpr} >= 7 THEN 'high'
            WHEN ${severityExpr} >= 4 THEN 'medium'
            WHEN ${severityExpr} >= 1 THEN 'low'
            ELSE 'none'
          END`,
          count: sql<number>`count(*)::int`,
        })
        .from(complianceIssueAnalyses)
        .where(baseWhere)
        .groupBy(sql`CASE
            WHEN ${severityExpr} >= 7 THEN 'high'
            WHEN ${severityExpr} >= 4 THEN 'medium'
            WHEN ${severityExpr} >= 1 THEN 'low'
            ELSE 'none'
          END`),

      // Tier: group by highestTierCompleted
      this.db
        .select({
          tier: complianceIssueAnalyses.highestTierCompleted,
          count: sql<number>`count(*)::int`,
        })
        .from(complianceIssueAnalyses)
        .where(baseWhere)
        .groupBy(complianceIssueAnalyses.highestTierCompleted),

      // Issue type: group by issueType, order by count desc
      this.db
        .select({
          issueType: complianceIssueAnalyses.issueType,
          count: sql<number>`count(*)::int`,
        })
        .from(complianceIssueAnalyses)
        .where(baseWhere)
        .groupBy(complianceIssueAnalyses.issueType)
        .orderBy(desc(sql`count(*)`)),

      // Federal mandate: bucket into 'true'/'false'
      this.db
        .select({
          federalMandate: sql<string>`CASE WHEN ${complianceIssueAnalyses.federalMandateFound} = true THEN 'true' ELSE 'false' END`,
          count: sql<number>`count(*)::int`,
        })
        .from(complianceIssueAnalyses)
        .where(baseWhere)
        .groupBy(sql`CASE WHEN ${complianceIssueAnalyses.federalMandateFound} = true THEN 'true' ELSE 'false' END`),
    ]);

    return {
      byClassification: byClassification as Array<{ classification: string; count: number }>,
      bySeverity: bySeverity as Array<{ severity: string; count: number }>,
      byTier: byTier as Array<{ tier: number; count: number }>,
      byIssueType: byIssueType as Array<{ issueType: string; count: number }>,
      byFederalMandate: byFederalMandate as Array<{ federalMandate: string; count: number }>,
    };
  }
}

export interface AnalysisFilterStats {
  byClassification: Array<{ classification: string; count: number }>;
  bySeverity: Array<{ severity: string; count: number }>;
  byTier: Array<{ tier: number; count: number }>;
  byIssueType: Array<{ issueType: string; count: number }>;
  byFederalMandate: Array<{ federalMandate: string; count: number }>;
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

/** Analysis list item for guidance documents. Uses agency/docType instead of regulation citation. */
export interface GuidanceAnalysisListItem {
  guidanceDocumentId: number;
  issueType: string;
  documentTitle: string | null;
  agency: string | null;
  docType: string | null;
  canonicalRef: string | null;
  highestTierCompleted: number;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  finalSeverity: number | null;
  federalMandateFound: boolean;
  isJustified: boolean;
  rerunCount: number;
  createdAt: Date | null;
  easyCleanupCandidate: boolean;
  cleanupType: string | null;
  cleanupEffort: string | null;
  tier3TriggerReason: string | null;
}

/**
 * Full analysis record for guidance document detail page.
 * Replaces regulatory document context with guidance document metadata.
 */
export interface FullGuidanceAnalysisRecord extends Omit<FullAnalysisRecord, 'documentId' | 'document'> {
  guidanceDocumentId: number | null;
  guidanceDocument: {
    id: number;
    title: string;
    agency: string;
    agencyDivision: string | null;
    docType: string | null;
    canonicalRef: string | null;
    url: string | null;
    programs: string[] | null;
    policyCategory: string | null;
  };
}

export interface AnalysisExportRow {
  documentTitle: string | null;
  citation: string | null;
  url: string | null;
  issueType: string;
  nycrrTitle: number | null;
  njacTitle: string | null;
  argumentAgainstRegulation: string | null;
  verbatimRequirements: string[] | null;
  finalSeverity: number | null;
  cleanupType: string | null;
  cleanupEffort: string | null;
  documentId: number | null;
}

export interface ComprehensiveAnalysisExportRow {
  documentTitle: string | null;
  citation: string | null;
  url: string | null;
  issueType: string;
  nycrrTitle: number | null;
  njacTitle: string | null;
  documentId: number | null;
  groupedMatchCount: number;
  highestTierCompleted: number | null;
  tier1Classification: string | null;
  tier2Classification: string | null;
  tier3Classification: string | null;
  finalSeverity: number | null;
  severityBaseline: number | null;
  tier3SeverityAdjustment: number | null;
  requirementFound: boolean | null;
  isJustified: boolean | null;
  verbatimRequirements: string[] | null;
  argumentForRegulation: string | null;
  argumentAgainstRegulation: string | null;
  webSearchSummary: string | null;
  federalMandateFound: boolean | null;
  stateHasDiscretion: boolean | null;
  tier3EvidenceGap: boolean | null;
  tier3TriggerReason: string | null;
  citesFederalStatute: boolean | null;
  federalCitation: string | null;
  easyCleanupCandidate: boolean | null;
  cleanupType: string | null;
  cleanupEffort: string | null;
  cleanupRecommendation: string | null;
  responsibleAgency: string | null;
  pipelineVersion: string | null;
  reviewStatus: string | null;
  reviewedBy: string | null;
  justificationNotes: string | null;
  teamNotes: string | null;
  impactType: string | null;
  developerStatus: string | null;
  developerAssigned: string | null;
  developerNotes: string | null;
  resolutionType: string | null;
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
