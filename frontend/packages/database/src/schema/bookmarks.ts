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

/**
 * Bookmarks table
 *
 * User bookmarks for pipeline analyses, regulatory documents, and guidance documents.
 * Supports bookmarking:
 * - A specific analysis (document + issue type)
 * - A regulatory document without a specific analysis
 * - A guidance document
 *
 * CHECK constraint: exactly one of document_id or guidance_document_id must be set.
 */
export const bookmarks = pgTable('bookmarks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  // Target: regulatory document (with optional analysis) OR guidance document
  documentId: bigint('document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  analysisId: bigint('analysis_id', { mode: 'number' })
    .references(() => complianceIssueAnalyses.id, { onDelete: 'cascade' }),
  guidanceDocumentId: bigint('guidance_document_id', { mode: 'number' })
    .references(() => guidanceDocuments.id, { onDelete: 'cascade' }),

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
export type BookmarkType = 'analysis' | 'document' | 'guidance';
