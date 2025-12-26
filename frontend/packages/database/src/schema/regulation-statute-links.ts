import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
  unique
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';
import { statutes } from './statutes';

export const regulationStatuteLinks = pgTable('regulation_statute_links', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  regulationId: bigint('regulation_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  statuteId: bigint('statute_id', { mode: 'number' }).references(() => statutes.id, { onDelete: 'cascade' }),  // Nullable for unmatched citations
  citation: varchar('citation', { length: 50 }).notNull(),  // The N.J.S.A. citation as found in text (e.g., "52:27D-119")
  context: text('context'),  // Surrounding text where citation was found

  // Link classification
  linkType: varchar('link_type', { length: 50 }).default('reference'),  // 'enabling_authority', 'definition', 'requirement', 'reference'

  // Match status tracking
  matchStatus: varchar('match_status', { length: 50 }).default('matched'),  // 'matched', 'corrected', 'unmatched', 'obsolete'
  originalCitation: varchar('original_citation', { length: 50 }),  // If corrected, what was in the text (citation becomes the corrected value)
  correctionNotes: text('correction_notes'),  // Why correction was made

  // Review tracking
  reviewedAt: timestamp('reviewed_at'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),

  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // One entry per citation per regulation (citation is what's in the text)
  uniqueLink: unique().on(table.regulationId, table.citation),
}));

export type RegulationStatuteLink = typeof regulationStatuteLinks.$inferSelect;
export type NewRegulationStatuteLink = typeof regulationStatuteLinks.$inferInsert;
