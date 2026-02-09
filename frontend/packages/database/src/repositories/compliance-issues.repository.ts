import { eq, and, desc, asc, sql, count, or, isNull, isNotNull, ne, gte, lt } from 'drizzle-orm';
import { BaseRepository } from './base.repository';
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
      .where(eq(complianceIssues.state, state.toUpperCase()))
      .orderBy(asc(complianceIssues.issueType));

    return result.map(r => r.issueType);
  }

  /**
   * Get counts by review status for progress display.
   * PR 6.3: Counts analysis rows (one per document+issue_type) instead of match rows.
   */
  async getCountsByStatus(state: StateCode): Promise<ComplianceIssueStatusCounts> {
    const result = await this.db
      .select({
        status: complianceIssueAnalyses.reviewStatus,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssueAnalyses)
      .where(eq(complianceIssueAnalyses.state, state.toUpperCase()))
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
        eq(complianceIssueAnalyses.state, state.toUpperCase()),
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
   */
  async getStatsByState(state?: StateCode): Promise<ComplianceIssueStats> {
    const conditions = state
      ? [eq(complianceIssues.state, state.toUpperCase())]
      : [];

    // Get total count
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssues)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    // Get unreviewed count (PR 6.3: review status now on analyses)
    const unreviewedConditions = state
      ? [eq(complianceIssueAnalyses.state, state.toUpperCase())]
      : [];
    const [unreviewedResult] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(complianceIssueAnalyses)
      .where(and(
        ...(unreviewedConditions.length > 0 ? unreviewedConditions : []),
        or(
          eq(complianceIssueAnalyses.reviewStatus, 'unreviewed'),
          isNull(complianceIssueAnalyses.reviewStatus)
        )
      ));

    // Get counts by type
    const typeResults = await this.db
      .select({
        issueType: complianceIssues.issueType,
        count: sql<number>`count(*)::int`,
      })
      .from(complianceIssues)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(complianceIssues.issueType);

    const byType: Record<string, number> = {};
    for (const row of typeResults) {
      byType[row.issueType] = row.count;
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
      eq(complianceIssues.state, state.toUpperCase()),
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
        eq(complianceIssueAnalyses.state, state.toUpperCase()),
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
      eq(complianceIssues.state, state.toUpperCase()),
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
      eq(complianceIssues.state, state.toUpperCase()),
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
        eq(complianceIssueAnalyses.state, state.toUpperCase()),
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
      eq(complianceIssues.state, state.toUpperCase()),
      eq(complianceIssueAnalyses.requirementFound, true),
      or(
        eq(complianceIssueAnalyses.reviewStatus, 'unreviewed'),
        isNull(complianceIssueAnalyses.reviewStatus)
      )!,
    ];

    // Exclude already-shown IDs
    if (excludeIds.length > 0) {
      baseConditions.push(
        sql`${complianceIssues.id} NOT IN (${sql.raw(excludeIds.join(','))})`
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
            sql`${complianceIssues.issueType} NOT IN (${sql.raw(recentIssueTypes.map(t => `'${t}'`).join(','))})`
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
            sql`${complianceIssues.issueType} NOT IN (${sql.raw(recentIssueTypes.map(t => `'${t}'`).join(','))})`
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
      // Order by severity from analyses (high first) with random tiebreaker
      .orderBy(desc(complianceIssueAnalyses.finalSeverity), sql`RANDOM()`)
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
      .where(eq(complianceIssues.state, state.toUpperCase()))
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
        eq(complianceIssueAnalyses.state, state.toUpperCase()),
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
        eq(complianceIssueAnalyses.state, state.toUpperCase()),
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
        eq(complianceIssueAnalyses.state, state.toUpperCase()),
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
        citation,
        content: row.docContent,
        url: row.docUrl,
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
   */
  async getAnalysisListPaginated(
    state: StateCode,
    options: {
      page: number;
      pageSize: number;
      sortBy?: 'issueType' | 'severity' | 'highestTier' | 'createdAt';
      sortOrder?: 'asc' | 'desc';
      filters?: {
        tierCompleted?: number;
        classification?: string;
        federalMandate?: boolean;
        pipelineRun?: boolean;
        issueType?: string;
        // V5 Tier 3 filters
        severity?: 'high' | 'medium' | 'low' | 'none';
        severityChanged?: 'increased' | 'decreased' | 'unchanged' | 'no_tier3';
        federalMandateConfirmed?: 'true' | 'false' | 'no_tier3';
        stateDiscretion?: 'true' | 'false' | 'no_tier3';
        alternativeFound?: 'true' | 'false' | 'no_tier3';
        evidenceGap?: 'true' | 'false' | 'no_tier3';
        supersededByLaw?: 'true' | 'false' | 'no_tier3';
        advocacyForChange?: 'true' | 'false' | 'no_tier3';
        tier3Trigger?: string;
        // V5.1 Easy Cleanup filter
        easyCleanup?: 'any' | 'trivial' | 'easy' | 'medium';
        // Bookmarks filter
        bookmarkedOnly?: boolean;
      };
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

    // Build where conditions
    const conditions: ReturnType<typeof eq>[] = [
      eq(complianceIssueAnalyses.state, state.toUpperCase()),
    ];

    if (filters) {
      if (filters.tierCompleted !== undefined) {
        conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, filters.tierCompleted));
      }
      if (filters.classification) {
        // Check final classification across tiers (tier3 → tier2 → tier1)
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
        // pipelineRun = true means tier >= 1 (pipeline has actually run)
        // pipelineRun = false means tier = 0 (not run yet)
        if (filters.pipelineRun) {
          conditions.push(gte(complianceIssueAnalyses.highestTierCompleted, 1));
        } else {
          conditions.push(eq(complianceIssueAnalyses.highestTierCompleted, 0));
        }
      }
      if (filters.issueType) {
        conditions.push(eq(complianceIssueAnalyses.issueType, filters.issueType));
      }

      // V5 Tier 3 filters

      // Severity filter (high=7-10, medium=4-6, low=1-3, none=null)
      // Use COALESCE to fall back to tier2 severity if final_severity is NULL
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

      // Severity changed filter (Tier 3 adjustment)
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

      // Federal mandate confirmed filter (Tier 3 flag from JSONB)
      // Using pure SQL to avoid drizzle type inference issues with mixed and/or/sql
      if (filters.federalMandateConfirmed) {
        if (filters.federalMandateConfirmed === 'true') {
          conditions.push(sql`(${complianceIssueAnalyses.tier3Flags}->'federal_mandate_confirmed'->>'value')::boolean = true`);
        } else if (filters.federalMandateConfirmed === 'false') {
          // Only include rows that completed Tier 3 but have false/NULL for this flag
          conditions.push(
            sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND (
              (${complianceIssueAnalyses.tier3Flags}->'federal_mandate_confirmed'->>'value')::boolean = false
              OR ${complianceIssueAnalyses.tier3Flags}->'federal_mandate_confirmed' IS NULL
            )`
          );
        } else if (filters.federalMandateConfirmed === 'no_tier3') {
          conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
        }
      }

      // State discretion filter (Tier 3 flag from JSONB)
      if (filters.stateDiscretion) {
        if (filters.stateDiscretion === 'true') {
          conditions.push(sql`(${complianceIssueAnalyses.tier3Flags}->'state_discretion_found'->>'value')::boolean = true`);
        } else if (filters.stateDiscretion === 'false') {
          // Only include rows that completed Tier 3 but have false/NULL for this flag
          conditions.push(
            sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND (
              (${complianceIssueAnalyses.tier3Flags}->'state_discretion_found'->>'value')::boolean = false
              OR ${complianceIssueAnalyses.tier3Flags}->'state_discretion_found' IS NULL
            )`
          );
        } else if (filters.stateDiscretion === 'no_tier3') {
          conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
        }
      }

      // Alternative found filter (Tier 3 flag from JSONB)
      if (filters.alternativeFound) {
        if (filters.alternativeFound === 'true') {
          conditions.push(sql`(${complianceIssueAnalyses.tier3Flags}->'modernized_alternative_found'->>'value')::boolean = true`);
        } else if (filters.alternativeFound === 'false') {
          // Only include rows that completed Tier 3 but have false/NULL for this flag
          conditions.push(
            sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND (
              (${complianceIssueAnalyses.tier3Flags}->'modernized_alternative_found'->>'value')::boolean = false
              OR ${complianceIssueAnalyses.tier3Flags}->'modernized_alternative_found' IS NULL
            )`
          );
        } else if (filters.alternativeFound === 'no_tier3') {
          conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
        }
      }

      // Evidence gap filter (Tier 3 boolean column)
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

      // Superseded by law filter (Tier 3 flag from JSONB)
      if (filters.supersededByLaw) {
        if (filters.supersededByLaw === 'true') {
          conditions.push(sql`(${complianceIssueAnalyses.tier3Flags}->'superseded_by_law'->>'value')::boolean = true`);
        } else if (filters.supersededByLaw === 'false') {
          conditions.push(
            sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND (
              (${complianceIssueAnalyses.tier3Flags}->'superseded_by_law'->>'value')::boolean = false
              OR ${complianceIssueAnalyses.tier3Flags}->'superseded_by_law' IS NULL
            )`
          );
        } else if (filters.supersededByLaw === 'no_tier3') {
          conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
        }
      }

      // Advocacy for change filter (Tier 3 flag from JSONB)
      if (filters.advocacyForChange) {
        if (filters.advocacyForChange === 'true') {
          conditions.push(sql`(${complianceIssueAnalyses.tier3Flags}->'advocacy_for_change'->>'value')::boolean = true`);
        } else if (filters.advocacyForChange === 'false') {
          conditions.push(
            sql`${complianceIssueAnalyses.tier3Classification} IS NOT NULL AND (
              (${complianceIssueAnalyses.tier3Flags}->'advocacy_for_change'->>'value')::boolean = false
              OR ${complianceIssueAnalyses.tier3Flags}->'advocacy_for_change' IS NULL
            )`
          );
        } else if (filters.advocacyForChange === 'no_tier3') {
          conditions.push(isNull(complianceIssueAnalyses.tier3Classification));
        }
      }

      // Tier 3 trigger filter (derived from existing fields based on routing.py logic)
      // IMPORTANT: These thresholds must match backend/scripts/research_pipeline/routing.py
      // Thresholds: HIGH_RISK_SEVERITY >= 7, NO_ALTERNATIVE_SEVERITY >= 7, BURDENSOME_SEVERITY >= 8
      if (filters.tier3Trigger) {
        // High-risk issue types that trigger Tier 3 when severity >= 6
        const HIGH_RISK_ISSUE_TYPES = ['newspaper', 'notarization', 'wet_signature', 'witness', 'mandated_reports'];
        const IN_PERSON_PREFIX = 'in_person';

        if (filters.tier3Trigger === 'high_risk_issue') {
          // High-risk issue type + severity >= 6
          conditions.push(
            and(
              or(
                sql`${complianceIssueAnalyses.issueType} = ANY(ARRAY[${sql.raw(HIGH_RISK_ISSUE_TYPES.map(t => `'${t}'`).join(','))}])`,
                sql`${complianceIssueAnalyses.issueType} LIKE '${IN_PERSON_PREFIX}%'`
              )!,
              gte(complianceIssueAnalyses.severity, 6)
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

      // V5.1: Easy Cleanup filter
      if (filters.easyCleanup) {
        if (filters.easyCleanup === 'any') {
          conditions.push(eq(complianceIssueAnalyses.easyCleanupCandidate, true));
        } else {
          // Filter by specific effort level
          conditions.push(
            and(
              eq(complianceIssueAnalyses.easyCleanupCandidate, true),
              eq(complianceIssueAnalyses.cleanupEffort, filters.easyCleanup)
            )!
          );
        }
      }

      // Bookmarked only filter - uses EXISTS subquery for efficiency
      if (filters.bookmarkedOnly) {
        conditions.push(
          sql`EXISTS (
            SELECT 1 FROM ${bookmarks}
            WHERE ${bookmarks.analysisId} = ${complianceIssueAnalyses.id}
          )`
        );
      }
    }

    const whereClause = and(...conditions);

    // Get total count
    const [{ count: total }] = await this.db
      .select({ count: count() })
      .from(complianceIssueAnalyses)
      .innerJoin(regulatoryDocuments, eq(complianceIssueAnalyses.documentId, regulatoryDocuments.id))
      .where(whereClause);

    // Build sort column
    // Use COALESCE for severity to fall back to tier2 severity if final_severity is NULL
    const sortColumn = {
      issueType: complianceIssueAnalyses.issueType,
      severity: sql`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
      highestTier: complianceIssueAnalyses.highestTierCompleted,
      createdAt: complianceIssueAnalyses.createdAt,
    }[sortBy] ?? complianceIssueAnalyses.createdAt;

    // For severity sorting, put nulls at the end (they represent unanalyzed items)
    // PostgreSQL defaults nulls to the beginning for DESC, which is unintuitive for severity
    const primarySort = sortBy === 'severity' && sortOrder === 'desc'
      ? sql`${sortColumn} DESC NULLS LAST`
      : sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    // Get paginated results
    const results = await this.db
      .select({
        documentId: complianceIssueAnalyses.documentId,
        issueType: complianceIssueAnalyses.issueType,
        highestTierCompleted: complianceIssueAnalyses.highestTierCompleted,
        tier1Classification: complianceIssueAnalyses.tier1Classification,
        tier2Classification: complianceIssueAnalyses.tier2Classification,
        tier3Classification: complianceIssueAnalyses.tier3Classification,
        tier2RerunCount: complianceIssueAnalyses.tier2RerunCount,  // Track re-runs
        // Use COALESCE to fall back to tier2 severity if final_severity is NULL
        finalSeverity: sql<number | null>`COALESCE(${complianceIssueAnalyses.finalSeverity}, ${complianceIssueAnalyses.severity})`,
        federalMandateFound: complianceIssueAnalyses.federalMandateFound,
        isJustified: complianceIssueAnalyses.isJustified,
        createdAt: complianceIssueAnalyses.createdAt,
        // V5.1: Easy Cleanup fields
        easyCleanupCandidate: complianceIssueAnalyses.easyCleanupCandidate,
        cleanupType: complianceIssueAnalyses.cleanupType,
        cleanupEffort: complianceIssueAnalyses.cleanupEffort,
        // V5.1: Tier 3 trigger reason
        tier3TriggerReason: complianceIssueAnalyses.tier3TriggerReason,
        // Document info
        docTitle: regulatoryDocuments.title,
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
      .orderBy(primarySort)
      .limit(pageSize)
      .offset(offset);

    // Transform results
    const data: AnalysisListItem[] = results.map(row => {
      // Build citation
      let citation: string | null = null;
      if (row.docNjacTitle) {
        citation = `N.J.A.C. ${row.docNjacTitle}:${row.docNjacChapter || ''}${row.docNjacSubchapter ? `-${row.docNjacSubchapter}` : ''}`;
      } else if (row.docNycrrTitle) {
        citation = `${row.docNycrrTitle} NYCRR Part ${row.docNycrrPart || ''}`;
      }

      return {
        documentId: Number(row.documentId),
        issueType: row.issueType,
        documentTitle: row.docTitle,
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
        // V5.1: Easy Cleanup fields
        easyCleanupCandidate: row.easyCleanupCandidate ?? false,
        cleanupType: row.cleanupType,
        cleanupEffort: row.cleanupEffort,
        // V5.1: Tier 3 trigger reason
        tier3TriggerReason: row.tier3TriggerReason,
      };
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
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
