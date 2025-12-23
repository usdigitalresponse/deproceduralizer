import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { regulatoryDocuments } from './regulatory-documents';

export const complianceIssues = pgTable('compliance_issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  issueType: varchar('issue_type', { length: 50 }).notNull(), // 'wet_signature', 'in_person', 'paper_form', etc.
  termMatched: varchar('term_matched', { length: 255 }),
  context: text('context').notNull(),
  requirementQuote: text('requirement_quote').notNull(),
  fromStatute: boolean('from_statute'),
  statuteCitation: varchar('statute_citation', { length: 255 }),
  llmConfirmed: boolean('llm_confirmed').default(false),

  // Review fields
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  justificationNotes: text('justification_notes'),
  teamNotes: text('team_notes'),
  priority: integer('priority'),
  impactType: varchar('impact_type', { length: 100 }),

  // Developer tracking fields
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
});

export type ComplianceIssue = typeof complianceIssues.$inferSelect;
export type NewComplianceIssue = typeof complianceIssues.$inferInsert;

// Issue type constants
export const ISSUE_TYPES = [
  'wet_signature',
  'in_person',
  'paper_form',
  'notarized',
  'certified',
  'reporting_requirement',
  'other'
] as const;
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
