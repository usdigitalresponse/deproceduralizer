import {
  pgTable,
  pgEnum,
  bigserial,
  bigint,
  integer,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

export const noteTypeEnum = pgEnum('note_type', ['anchored', 'document']);

export const documentNotes = pgTable('document_notes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),

  noteType: noteTypeEnum('note_type').notNull(),

  // Text anchoring (null for document-level notes)
  anchorStartOffset: integer('anchor_start_offset'),
  anchorEndOffset: integer('anchor_end_offset'),
  anchorText: text('anchor_text'), // Store selected text for validation

  content: text('content').notNull(),
  authorName: varchar('author_name', { length: 255 }),
  state: varchar('state', { length: 3 }).notNull(),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type DocumentNote = typeof documentNotes.$inferSelect;
export type NewDocumentNote = typeof documentNotes.$inferInsert;
export type NoteType = 'anchored' | 'document';
