import {
  pgTable,
  bigserial,
  bigint,
  text,
  varchar
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

export const statuteReferences = pgTable('statute_references', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  uscCitations: text('usc_citations'),
  cfrCitations: text('cfr_citations'),
  publicLaws: text('public_laws'),
  acts: text('acts'),
  stateTitle: varchar('state_title', { length: 100 }),
  stateSection: varchar('state_section', { length: 100 }),
});

export type StatuteReference = typeof statuteReferences.$inferSelect;
export type NewStatuteReference = typeof statuteReferences.$inferInsert;
