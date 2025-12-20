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

export const regulationStatuteLinks = pgTable('regulation_statute_links', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  regulationId: bigint('regulation_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  statuteId: bigint('statute_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  citation: varchar('citation', { length: 50 }).notNull(),  // The N.J.S.A. citation (e.g., "52:27D-119")
  context: text('context'),  // Surrounding text where citation was found
  linkType: varchar('link_type', { length: 50 }).default('reference'),  // 'enabling_authority', 'reference', 'amendment', etc.
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueLink: unique().on(table.regulationId, table.statuteId, table.citation),
}));

export type RegulationStatuteLink = typeof regulationStatuteLinks.$inferSelect;
export type NewRegulationStatuteLink = typeof regulationStatuteLinks.$inferInsert;
