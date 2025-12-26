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
// Keep in sync with: backend/scripts/compliance_issues/compliance_issues.yaml
export const ISSUE_TYPES = [
  // Communication & Submission
  'mail_only',
  'certified_mail',
  'fax',
  'obsolete_comm',
  'landline',
  // Payment
  'check_payment',
  'cash_only',
  'no_credit_cards',
  'in_person_payment',
  // Signatures & Authentication
  'wet_signature',
  'notarization',
  'witness',
  'embossed_seal',
  'original_document',
  // Physical Presence & Access
  'in_person_submission',
  'in_person_hearing',
  'in_person_pickup',
  'physical_forms',
  'physical_inspection',
  'physical_posting',
  'bulletin_board',
  // Technology & Media
  'obsolete_media',
  'microfiche',
  'obsolete_software',
  'typewriter',
  'pdf_only',
  'carbon_copy',
  'newspaper',
  // Document Format & Handling
  'multiple_copies',
  'paper_specs',
  'photo_specs',
  'letterhead',
  'handwriting_specs',
  'binding_required',
  // Process & Tracking
  'physical_log',
  'routing_slip',
  'storage_location',
  'fixed_window',
  'waiting_period',
  // Reporting
  'mandated_reports',
  // NOTE: 'incorporation_by_reference' moved to dedicated incorporations_by_reference table (issue #49)
  // Legacy (for backwards compatibility)
  'in_person',
  'paper_form',
  'notarized',
  'certified',
  'reporting_requirement',
  'other',
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
