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

/**
 * Bookmarks table
 *
 * User bookmarks for pipeline analyses and regulatory documents.
 * Supports bookmarking either:
 * - A specific analysis (document + issue type)
 * - A document without a specific analysis
 */
export const bookmarks = pgTable('bookmarks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),

  // Target: either an analysis or a standalone document
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  analysisId: bigint('analysis_id', { mode: 'number' })
    .references(() => complianceIssueAnalyses.id, { onDelete: 'cascade' }),

  // Denormalized for easier querying/filtering
  issueType: varchar('issue_type', { length: 50 }),
  state: varchar('state', { length: 3 }).notNull(),

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
export type BookmarkType = 'analysis' | 'document';
