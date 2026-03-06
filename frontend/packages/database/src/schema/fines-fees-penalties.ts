import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  numeric,
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';
import { guidanceDocuments } from './guidance-documents';

/**
 * Fines, Fees & Penalties: Structured extraction of monetary charges
 * from regulations and guidance documents.
 *
 * Follows the IBR pattern: dedicated table with domain-specific columns.
 */
export const finesFeesPenalties = pgTable('fines_fees_penalties', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  // Exactly one source (regulation OR guidance)
  documentId: bigint('document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  guidanceDocumentId: bigint('guidance_document_id', { mode: 'number' })
    .references(() => guidanceDocuments.id, { onDelete: 'cascade' }),

  // Structured fine/fee/penalty data
  penaltyType: varchar('penalty_type', { length: 50 }).notNull(),
  amount: text('amount'),
  amountMin: numeric('amount_min', { precision: 12, scale: 2 }),
  amountMax: numeric('amount_max', { precision: 12, scale: 2 }),
  perUnit: text('per_unit'),
  whoPays: text('who_pays'),
  responsibleAgency: text('responsible_agency'),
  violationDescription: text('violation_description'),
  requirementQuote: text('requirement_quote'),
  context: text('context').notNull(),
  termMatched: text('term_matched'),
  llmConfirmed: boolean('llm_confirmed').default(false),

  // Metadata
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),
  url: text('url'),

  // Review workflow
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
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

export type FineFeePenalty = typeof finesFeesPenalties.$inferSelect;
export type NewFineFeePenalty = typeof finesFeesPenalties.$inferInsert;

// Penalty type constants
export const PENALTY_TYPES = ['fine', 'fee', 'penalty', 'surcharge', 'forfeiture', 'other'] as const;
export type PenaltyType = (typeof PENALTY_TYPES)[number];

// Re-export shared review workflow types
export type { ReviewStatus, DeveloperStatus, ResolutionType, Developer } from './red-flags';
export {
  REVIEW_STATUSES,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_DESCRIPTIONS,
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS
} from './red-flags';
