import {
  pgTable,
  bigint,
  timestamp,
  primaryKey
} from 'drizzle-orm/pg-core';
import { definitions } from './definitions';
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Definition-Document Occurrences - links definitions to documents where terms appear.
 *
 * This is a many-to-many relationship tracking boolean presence of definition terms
 * within document text. Uses word-boundary matching (not substring matching):
 * - 'applicant' matches 'Applicant' but not 'reapplicant'
 *
 * Different from scope-based applicability:
 * - definitions.scopeDocumentId tracks which scope a definition APPLIES to
 * - definition_document_occurrences tracks where terms ACTUALLY APPEAR in text
 *
 * Population:
 * - Run `link_definitions.py` after definition extraction
 * - Can also be triggered as part of batch_definitions.py pipeline
 */
export const definitionDocumentOccurrences = pgTable('definition_document_occurrences', {
  definitionId: bigint('definition_id', { mode: 'number' })
    .notNull()
    .references(() => definitions.id, { onDelete: 'cascade' }),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.definitionId, table.documentId] }),
}));

export type DefinitionDocumentOccurrence = typeof definitionDocumentOccurrences.$inferSelect;
export type NewDefinitionDocumentOccurrence = typeof definitionDocumentOccurrences.$inferInsert;
