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
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Incorporations by Reference: Track external standards incorporated into regulations
 * (NFPA codes, ICC codes, ASTM standards, CFR references, etc.)
 *
 * Extracted from compliance_issues into dedicated table per GitHub issue #49
 */
export const incorporationsByReference = pgTable('incorporations_by_reference', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),

  // Core IBR data
  incorporatedDocument: text('incorporated_document'),        // e.g., "International Building Code/2021"
  sourceOrganization: varchar('source_organization', { length: 100 }), // e.g., "ICC", "NFPA", "CFR"
  version: text('version'),                                   // e.g., "2021", "2020 edition"
  requirementQuote: text('requirement_quote'),                // exact quote from regulation
  termMatched: varchar('term_matched', { length: 255 }),      // which pattern matched
  context: text('context').notNull(),                         // full snippet for context
  llmConfirmed: boolean('llm_confirmed').default(false),      // true = confirmed IBR
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),           // 'NY', 'NJ', or 'NYC'
  url: text('url').notNull(),                                 // source URL

  // Review workflow (matching compliance_issues pattern)
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  justificationNotes: text('justification_notes'),
  teamNotes: text('team_notes'),
  priority: integer('priority'),

  // Developer tracking
  developerStatus: varchar('developer_status', { length: 50 }).default('unresolved'),
  developerAssigned: varchar('developer_assigned', { length: 50 }),
  developerNotes: text('developer_notes'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionComments: text('resolution_comments'),
  developerQuestion: text('developer_question'),
  developerCheckedAt: timestamp('developer_checked_at'),

  createdAt: timestamp('created_at').defaultNow(),
});

export type IncorporationByReference = typeof incorporationsByReference.$inferSelect;
export type NewIncorporationByReference = typeof incorporationsByReference.$inferInsert;

// Shared types and constants from red-flags (for review workflow)
export type { ReviewStatus, DeveloperStatus, ResolutionType, Developer } from './red-flags';
export {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_DESCRIPTIONS,
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS
} from './red-flags';
