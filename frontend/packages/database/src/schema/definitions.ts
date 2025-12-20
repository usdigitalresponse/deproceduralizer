import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  real,
  timestamp
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Definitions table - extracted terms and definitions from regulations.
 *
 * Both `documentId` and `url` are used for linking to regulatory_documents:
 * - `documentId` is the direct FK (preferred for joins)
 * - `url` is used as a fallback for matching when documentId is NULL
 *
 * After importing definitions, run the document_id migration to populate
 * documentId from url matching. See database.md skill for details.
 */
export const definitions = pgTable('definitions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' }).references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  url: text('url'),  // Source URL for linking to regulatory_documents
  term: text('term').notNull(),
  definition: text('definition').notNull(),
  scope: text('scope'),
  definitionOverlap: real('definition_overlap').default(0),
  sourceLocation: text('source_location'),
  modelVersion: varchar('model_version', { length: 100 }),
  extractedAt: timestamp('extracted_at').defaultNow(),
  notes: text('notes'),
});

export type Definition = typeof definitions.$inferSelect;
export type NewDefinition = typeof definitions.$inferInsert;

// Scope constants (common values from the data)
export const DEFINITION_SCOPES = [
  'in this section',
  'in this Part',
  'in this Subpart',
  'in this regulation',
  'in this part',
  'in this title',
  'in this Title',
  'in this order',
  'in this Chapter',
] as const;
export type DefinitionScope = typeof DEFINITION_SCOPES[number];
