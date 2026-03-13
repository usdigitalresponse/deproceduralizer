import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';
import { complianceIssueAnalyses } from './compliance-issue-analyses';
import { guidanceDocuments } from './guidance-documents';
import { finesFeesPenalties } from './fines-fees-penalties';

/**
 * Bookmarks table
 *
 * User bookmarks for pipeline analyses, regulatory documents, guidance documents,
 * and individual fines/fees/penalties.
 * Supports bookmarking:
 * - A specific analysis (document + issue type)
 * - A regulatory document without a specific analysis
 * - A guidance document
 * - A fine/fee/penalty
 *
 * CHECK constraint: exactly one source type must be set
 * (fine_id alone, OR document_id/guidance_document_id).
 */
export const bookmarks = pgTable('bookmarks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  // Target: regulatory document (with optional analysis) OR guidance document OR fine
  documentId: bigint('document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  analysisId: bigint('analysis_id', { mode: 'number' })
    .references(() => complianceIssueAnalyses.id, { onDelete: 'cascade' }),
  guidanceDocumentId: bigint('guidance_document_id', { mode: 'number' })
    .references(() => guidanceDocuments.id, { onDelete: 'cascade' }),
  fineId: bigint('fine_id', { mode: 'number' })
    .references(() => finesFeesPenalties.id, { onDelete: 'cascade' }),

  // Denormalized for easier querying/filtering
  issueType: varchar('issue_type', { length: 50 }),
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),

  // Metadata
  notes: text('notes'),
  createdBy: varchar('created_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

// Type exports
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

// Bookmark type discriminator
export type BookmarkType = 'analysis' | 'document' | 'guidance' | 'fine';
