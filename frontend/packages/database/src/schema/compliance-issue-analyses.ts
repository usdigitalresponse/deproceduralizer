import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  real,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Compliance Issue Analyses table
 *
 * Document-level analysis results for the 3-tier research pipeline.
 * One row per (document_id, issue_type) or (guidance_document_id, issue_type) pair.
 */
export const complianceIssueAnalyses = pgTable('compliance_issue_analyses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  // FK to guidance_documents — exactly one of documentId/guidanceDocumentId is set (CHECK constraint cia_one_source)
  guidanceDocumentId: bigint('guidance_document_id', { mode: 'number' }),
  issueType: varchar('issue_type', { length: 50 }).notNull(),
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),

  // ═══════════════════════════════════════════════════════════════════
  // Match Grouping
  // ═══════════════════════════════════════════════════════════════════
  groupedMatchCount: integer('grouped_match_count').notNull(),

  // ═══════════════════════════════════════════════════════════════════
  // Tier 1: Match Filtering
  // ═══════════════════════════════════════════════════════════════════
  tier1RelevantMatchIds: integer('tier1_relevant_match_ids').array(),
  tier1DismissedMatchIds: integer('tier1_dismissed_match_ids').array(),
  tier1DismissedReasons: jsonb('tier1_dismissed_reasons'),
  tier1Classification: varchar('tier1_classification', { length: 30 }),
  tier1Confidence: real('tier1_confidence'),
  tier1Reasoning: text('tier1_reasoning'),
  tier1ContextRequests: jsonb('tier1_context_requests'),
  tier1BatchId: varchar('tier1_batch_id', { length: 100 }),
  tier1CompletedAt: timestamp('tier1_completed_at'),

  // V5: Tier 1 Argument Framing & Context Requests
  tier1ArgumentFraming: jsonb('tier1_argument_framing'), // {best_argument_burdensome, best_argument_justified, best_argument_unrelated}
  tier1Recommendations: jsonb('tier1_recommendations'), // {context_requests: [{context_type, identifier, need_level, reason}, ...]}

  // ═══════════════════════════════════════════════════════════════════
  // Tier 2: Summary-Based Research
  // ═══════════════════════════════════════════════════════════════════
  tier2Classification: varchar('tier2_classification', { length: 30 }),
  tier2Confidence: real('tier2_confidence'),
  tier2Reasoning: text('tier2_reasoning'),

  verbatimRequirements: text('verbatim_requirements').array().default(sql`'{}'::text[]`),
  severity: integer('severity'),
  severityBaseline: integer('severity_baseline'),
  severityCalculation: text('severity_calculation'),

  argumentForRegulation: text('argument_for_regulation'),
  argumentAgainstRegulation: text('argument_against_regulation'),

  contextUsed: jsonb('context_used'),
  tier2FullTextRequests: jsonb('tier2_full_text_requests'),

  needsWebSearch: boolean('needs_web_search').default(false),
  webSearchTopics: text('web_search_topics').array().default(sql`'{}'::text[]`),

  potentiallyControversial: boolean('potentially_controversial').default(false),
  federalMandateSuspected: boolean('federal_mandate_suspected').default(false),
  ambiguityType: varchar('ambiguity_type', { length: 20 }),

  tier2BatchId: varchar('tier2_batch_id', { length: 100 }),
  tier2CompletedAt: timestamp('tier2_completed_at'),

  // V5: Tier 2 Re-run Tracking
  tier2RerunCount: integer('tier2_rerun_count').default(0),
  tier2ContextRequestsMade: jsonb('tier2_context_requests_made'), // Array of context requests from re-runs
  tier2ForcedClassification: boolean('tier2_forced_classification').default(false),

  // V5: Tier 2 Routing Flags (for Tier 3 triggers)
  citesFederalStatute: boolean('cites_federal_statute').default(false),
  federalCitation: text('federal_citation'),
  claimsNoAlternative: boolean('claims_no_alternative').default(false),

  // V5.2: Tier 2 Web Search Disambiguation (helps Tier 3 avoid irrelevant results)
  programContext: text('program_context'),
  notToConfuseWith: text('not_to_confuse_with').array().default(sql`'{}'::text[]`),
  searchScopeGuidance: text('search_scope_guidance'),

  // ═══════════════════════════════════════════════════════════════════
  // Tier 3: Full Context Deep Dive
  // ═══════════════════════════════════════════════════════════════════
  tier3Classification: varchar('tier3_classification', { length: 30 }),
  tier3Confidence: real('tier3_confidence'),
  tier3Reasoning: text('tier3_reasoning'),
  tier3SeverityAdjustment: integer('tier3_severity_adjustment'),
  tier3SeverityAdjustmentReasoning: text('tier3_severity_adjustment_reasoning'),
  tier3BatchId: varchar('tier3_batch_id', { length: 100 }),
  tier3CompletedAt: timestamp('tier3_completed_at'),
  tier3TriggerReason: text('tier3_trigger_reason'),  // V5.1: Why this was escalated to Tier 3

  // V5: Tier 3 Structured Flags (V5 Tier 3 = Web Verification)
  tier3Flags: jsonb('tier3_flags'), // {superseded_by_law, federal_mandate_confirmed, state_discretion_found, modernized_alternative_found}
  tier3EvidenceGap: boolean('tier3_evidence_gap').default(false),

  // Tier 3: Web Search Results
  webSearchSummary: text('web_search_summary'),
  federalMandateFound: boolean('federal_mandate_found').default(false),
  stateHasDiscretion: boolean('state_has_discretion').default(true),

  // ═══════════════════════════════════════════════════════════════════
  // Final Derived Fields
  // ═══════════════════════════════════════════════════════════════════
  requirementFound: boolean('requirement_found'),
  isJustified: boolean('is_justified').default(false),
  isVerbatim: boolean('is_verbatim'),
  finalSeverity: integer('final_severity'),

  // ═══════════════════════════════════════════════════════════════════
  // V5.1: Easy Cleanup Detection
  // ═══════════════════════════════════════════════════════════════════
  easyCleanupCandidate: boolean('easy_cleanup_candidate').default(false),
  cleanupType: varchar('cleanup_type', { length: 50 }),
  cleanupEvidence: text('cleanup_evidence'),
  cleanupRecommendation: text('cleanup_recommendation'),
  cleanupEffort: varchar('cleanup_effort', { length: 20 }),

  // ═══════════════════════════════════════════════════════════════════
  // Pipeline Tracking
  // ═══════════════════════════════════════════════════════════════════
  pipelineVersion: varchar('pipeline_version', { length: 20 }).default('v5'),
  highestTierCompleted: integer('highest_tier_completed').default(0),
  classificationTier: integer('classification_tier'),

  // ═══════════════════════════════════════════════════════════════════
  // Prompt Observability (FK to prompt_templates)
  // ═══════════════════════════════════════════════════════════════════
  tier1PromptId: bigint('tier1_prompt_id', { mode: 'number' }),
  tier2PromptId: bigint('tier2_prompt_id', { mode: 'number' }),
  tier3PromptId: bigint('tier3_prompt_id', { mode: 'number' }),

  // ═══════════════════════════════════════════════════════════════════
  // Human Review (PR 6.3: moved from compliance_issues)
  // ═══════════════════════════════════════════════════════════════════
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  justificationNotes: text('justification_notes'),
  teamNotes: text('team_notes'),
  impactType: varchar('impact_type', { length: 100 }),
  reviewerSeverity: integer('reviewer_severity'),
  reviewerOriginalSeverity: integer('reviewer_original_severity'),

  // ═══════════════════════════════════════════════════════════════════
  // Developer Tracking (PR 6.3: moved from compliance_issues)
  // ═══════════════════════════════════════════════════════════════════
  developerStatus: varchar('developer_status', { length: 50 }).default('unresolved'),
  developerAssigned: varchar('developer_assigned', { length: 50 }),
  developerNotes: text('developer_notes'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionComments: text('resolution_comments'),
  developerQuestion: text('developer_question'),
  developerCheckedAt: timestamp('developer_checked_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
// Note: uniqueness is enforced by partial unique indexes in migration 0058:
//   - cia_unique_reg: UNIQUE(document_id, issue_type) WHERE document_id IS NOT NULL
//   - cia_unique_guidance: UNIQUE(guidance_document_id, issue_type) WHERE guidance_document_id IS NOT NULL

// Type exports
export type ComplianceIssueAnalysis = typeof complianceIssueAnalyses.$inferSelect;
export type NewComplianceIssueAnalysis = typeof complianceIssueAnalyses.$inferInsert;

// Classification types
export type Tier1Classification = 'all_false_positives' | 'needs_research';
export type Tier2Classification = 'unrelated' | 'justified' | 'burdensome';
export type Tier3Classification = 'unrelated' | 'justified' | 'burdensome';
export type AmbiguityType = 'internal' | 'external' | 'both';

// Context entry types for the context_used JSONB field
export interface ContextEntry {
  type: 'self' | 'hierarchy' | 'sibling' | 'definition' | 'cross_reference' | 'statute' | 'web';
  identifier: string;
  sourceId?: number;
  quote?: string;
  summary?: string;
  relevance: string;
  isMandate?: boolean;
  stateDiscretion?: 'none' | 'partial' | 'full';
  // Web-specific fields
  url?: string;
  title?: string;
  sourceType?: 'advocacy' | 'journalism' | 'academic' | 'government';
  publicationDate?: string;
}

// Context request type (for tier*_context_requests JSONB fields)
export interface ContextRequest {
  contextType: 'sibling' | 'cross_reference' | 'definition' | 'hierarchy';
  identifier: string;
  needLevel: 'summary' | 'full_text';
  reason: string;
  scopeDocumentId?: number;  // For scope-aware definition lookup
}

// Dismissed match type (for tier1_dismissed_reasons JSONB field)
export interface DismissedMatch {
  matchId: number;
  matchIndex: number;  // 0-based index into input matches list
  text: string;
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════
// V5 Types
// ═══════════════════════════════════════════════════════════════════

// Tier 1 V5: Argument Framing (tier1_argument_framing JSONB)
export interface Tier1ArgumentFraming {
  best_argument_burdensome?: string;
  best_argument_justified?: string;
  best_argument_unrelated?: string;
}

// Tier 1 V5: Recommendations (tier1_recommendations JSONB) - now uses context_requests
export interface Tier1Recommendations {
  context_requests: Array<{
    context_type: 'sibling' | 'cross_reference' | 'definition' | 'hierarchy';
    identifier: string;
    need_level: 'summary' | 'full_text';
    reason: string;
    scope_document_id?: number;
  }>;
}

// Tier 2 V5: Context request made during re-run
export interface Tier2ContextRequestMade {
  context_type: 'sibling' | 'cross_reference' | 'definition';
  identifier: string;
  need_level: 'summary' | 'full_text';
  reason: string;
  timestamp?: string;
}

// Tier 3 V5: Evidence source for structured flags
export interface WebEvidence {
  url?: string;  // May be in 'url' or 'identifier' depending on pipeline version
  identifier?: string;  // Legacy: URL stored here in some pipeline versions
  source_type?: 'government' | 'academic' | 'journalism' | 'advocacy';
  quote?: string;
  relevance?: string;
  isMandate?: boolean | null;
  stateDiscretion?: string | null;
}

// Tier 3 V5: Evidenced flag structure
export interface EvidencedFlag {
  value: boolean;
  scope: 'reg-specific' | 'issue-type/domain';
  reason: string;
  evidence: WebEvidence[];
}

// Tier 3 V5: Structured flags (tier3_flags JSONB)
export interface Tier3Flags {
  superseded_by_law?: EvidencedFlag;
  federal_mandate_confirmed?: EvidencedFlag;
  state_discretion_found?: EvidencedFlag;
  modernized_alternative_found?: EvidencedFlag;
  advocacy_for_change?: EvidencedFlag;  // V5.2: Advocacy from journalism/groups calling for change
}

// V5.1: Easy Cleanup Detection types
export type CleanupType = 'alternative_in_practice' | 'alternative_authorized' | 'peer_state_solution';
export type CleanupEffort = 'trivial' | 'easy' | 'medium';
