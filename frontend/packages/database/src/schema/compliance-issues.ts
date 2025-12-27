import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  unique
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

export const complianceIssues = pgTable('compliance_issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),

  // Issue identification (from regex scan)
  issueType: varchar('issue_type', { length: 50 }).notNull(), // 'wet_signature', 'mail_only', 'fax', etc.
  occurrenceNumber: integer('occurrence_number').notNull().default(1), // 1, 2, 3... for multiple issues of same type per document
  matchedPattern: varchar('matched_pattern', { length: 255 }), // Regex pattern that triggered scan
  matchedContext: text('matched_context').notNull(), // ~600 char text window around the regex match
  url: text('url'), // Link to the regulation

  // LLM analysis results
  requirementFound: boolean('requirement_found').default(false), // Did LLM find an actual requirement?
  requirementText: text('requirement_text'), // The specific text creating the requirement
  isVerbatim: boolean('is_verbatim'), // True if requirement_text is verbatim from regulation
  requiredByStatute: boolean('required_by_statute'), // true=statute mandates, false=agency added
  severity: integer('severity'), // 1-10 scale of how problematic
  statuteCitation: varchar('statute_citation', { length: 255 }), // Citation to statute if applicable
  impactAssessment: text('impact_assessment'), // LLM explanation of why this is/isn't problematic

  // Human review
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'), // 'unreviewed', 'confirmed', 'rejected_false_positive'
  reviewedBy: varchar('reviewed_by', { length: 255 }), // Who reviewed it
  reviewedAt: timestamp('reviewed_at'), // When it was reviewed
  justificationNotes: text('justification_notes'), // Justification and analysis for the model
  teamNotes: text('team_notes'), // Notes for development team (replaces reviewer_notes)
  originalSeverity: integer('original_severity'), // LLM-assigned severity (preserved on first review)
  impactType: varchar('impact_type', { length: 100 }), // Type of impact

  // Developer tracking
  developerStatus: varchar('developer_status', { length: 50 }).default('unresolved'),
  developerAssigned: varchar('developer_assigned', { length: 50 }),
  developerNotes: text('developer_notes'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionComments: text('resolution_comments'),
  developerQuestion: text('developer_question'),
  developerCheckedAt: timestamp('developer_checked_at'),

  // Metadata
  state: varchar('state', { length: 2 }).notNull(), // 'NY' or 'NJ'
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueDocumentIssueOccurrence: unique().on(table.documentId, table.issueType, table.occurrenceNumber),
}));

export type ComplianceIssue = typeof complianceIssues.$inferSelect;
export type NewComplianceIssue = typeof complianceIssues.$inferInsert;

// Issue types auto-generated from prompts/compliance_issues.yaml
// Re-export from generated file (run: python scripts/generate_prompt_types.py)
export {
  ISSUE_TYPES as ISSUE_TYPES_GENERATED,
  type IssueType as IssueTypeGenerated,
  ISSUE_TYPE_META,
  type IssueTypeMeta,
  getIssueTypesByCategory,
  getCategories,
} from '../generated/issue-types';

// Legacy issue types for backwards compatibility (not in YAML)
export const LEGACY_ISSUE_TYPES = [
  'in_person',
  'paper_form',
  'notarized',
  'certified',
  'reporting_requirement',
  'other',
] as const;
export type LegacyIssueType = typeof LEGACY_ISSUE_TYPES[number];

// Combined issue types (generated + legacy)
import { ISSUE_TYPES as ISSUE_TYPES_FROM_YAML } from '../generated/issue-types';
export const ISSUE_TYPES = [...ISSUE_TYPES_FROM_YAML, ...LEGACY_ISSUE_TYPES] as const;
export type IssueType = typeof ISSUE_TYPES[number];

// Shared types and constants from red-flags
export type { ReviewStatus, DeveloperStatus, ResolutionType, Developer } from './red-flags';
export {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_DESCRIPTIONS,
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS
} from './red-flags';
