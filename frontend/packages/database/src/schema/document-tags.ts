import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Document tags for flexible scan scoping.
 *
 * Tags use a flat namespace with prefixes:
 * - `scan:compliance` — include in compliance issue scanning
 * - `scan:red-flags` — include in red flags analysis
 * - `scan:summarize` — include in summarization pipeline
 * - `topic:childcare` — relates to childcare regulation
 * - `topic:permitting` — relates to permitting/building regulation
 * - `priority:high` — high priority for analysis
 */
export const documentTags = pgTable('document_tags', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  tag: varchar('tag', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: varchar('created_by', { length: 100 }),
}, (table) => [
  unique('document_tags_document_tag_key').on(table.documentId, table.tag),
]);
