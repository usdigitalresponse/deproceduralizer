import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
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
}, (table) => [
  // Partial unique indexes matching migrations 0023, 0060, 0084
  uniqueIndex('idx_bookmarks_unique_analysis')
    .on(table.analysisId)
    .where(sql`${table.analysisId} is not null`),
  uniqueIndex('idx_bookmarks_unique_document')
    .on(table.documentId)
    .where(sql`${table.analysisId} is null`),
  uniqueIndex('idx_bookmarks_unique_guidance_document')
    .on(table.guidanceDocumentId)
    .where(sql`${table.guidanceDocumentId} is not null and ${table.analysisId} is null`),
  uniqueIndex('idx_bookmarks_unique_fine')
    .on(table.fineId)
    .where(sql`${table.fineId} is not null`),
]);

// Type exports
export type Bookmark = typeof bookmarks.$inferSelect;
export type NewBookmark = typeof bookmarks.$inferInsert;

// Bookmark type discriminator
export type BookmarkType = 'analysis' | 'document' | 'guidance' | 'fine';
