import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  jsonb,
  unique
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Cross-references table for internal regulation citations.
 *
 * Stores citations like:
 * - Full-form: "18 NYCRR 505.14", "N.J.A.C. 8:43-1.2"
 * - Short-form: "section 624.8 of this Part"
 * - Same-section: "paragraph (a) of this section"
 */
export const crossReferences = pgTable('cross_references', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sourceDocumentId: bigint('source_document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),

  // Reference identification
  refType: varchar('ref_type', { length: 50 }).notNull(),
  rawText: text('raw_text').notNull(),
  normalizedCitation: text('normalized_citation').notNull(),

  // Position in source document
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
  contextBefore: text('context_before'),
  contextAfter: text('context_after'),

  // Parsed components (JSONB for flexibility)
  components: jsonb('components').$type<CrossReferenceComponents>(),

  // Resolution
  targetDocumentId: bigint('target_document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'set null' }),
  isResolved: boolean('is_resolved').default(false),
  resolutionNotes: text('resolution_notes'),

  // Metadata
  state: varchar('state', { length: 3 }).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueSourceRawText: unique().on(table.sourceDocumentId, table.rawText),
}));

export type CrossReference = typeof crossReferences.$inferSelect;
export type NewCrossReference = typeof crossReferences.$inferInsert;

// Reference types
export const REF_TYPES = ['nycrr', 'njac', 'ny_short_form', 'same_section'] as const;
export type RefType = typeof REF_TYPES[number];

// Components stored in JSONB
export interface CrossReferenceComponents {
  // For NYCRR/NJAC full-form
  title?: string;
  section?: string;
  section_base?: string;
  chapter?: string;

  // For NY short-form
  scope?: 'part' | 'subpart' | 'title';
  requires_context?: boolean;

  // For same-section
  subsection_ref?: string;
  is_relative?: boolean;

  // Common
  state?: string;
}
