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

  // Issue identification (from regex scan)
  issueType: varchar('issue_type', { length: 50 }).notNull(), // 'wet_signature', 'mail_only', 'fax', etc.
  matchedPattern: varchar('matched_pattern', { length: 255 }), // Regex pattern that triggered scan
  matchedContext: text('matched_context').notNull(), // ~600 char text window around the regex match
  url: text('url'), // Link to the regulation

  // LLM analysis results
  requirementFound: boolean('requirement_found').default(false), // Did LLM find an actual requirement?
  requirementText: text('requirement_text'), // The specific text creating the requirement
  requiredByStatute: boolean('required_by_statute'), // true=statute mandates, false=agency added
  severity: integer('severity'), // 1-10 scale of how problematic
  impactAssessment: text('impact_assessment'), // LLM explanation of why this is/isn't problematic

  // Human review
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'), // 'unreviewed', 'confirmed', 'rejected_false_positive'
  reviewerNotes: text('reviewer_notes'), // Human explanation of review decision

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
