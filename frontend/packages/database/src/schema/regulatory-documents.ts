import {
  pgTable,
  bigserial,
  integer,
  varchar,
  text,
  timestamp,
  bigint,
  boolean,
  unique
} from 'drizzle-orm/pg-core';

export const regulatoryDocuments = pgTable('regulatory_documents', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  sourceIndex: integer('source_index'),
  type: varchar('type', { length: 50 }).notNull(),
  state: varchar('state', { length: 2 }),
  title: text('title').notNull(),
  url: text('url'),
  urlType: varchar('url_type', { length: 50 }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  parentId: bigint('parent_id', { mode: 'number' }),
  hierarchyLevel: varchar('hierarchy_level', { length: 50 }),
  hierarchyPath: text('hierarchy_path'),
  nycrrTitle: integer('nycrr_title'),
  nycrrPart: varchar('nycrr_part', { length: 50 }),
  nycrrSection: varchar('nycrr_section', { length: 50 }),
  // Precomputed hierarchy stats (for fast browse queries)
  directChildCount: integer('direct_child_count').default(0),
  descendantCount: integer('descendant_count').default(0),
  descendantFlagCount: integer('descendant_flag_count').default(0),
  descendantMaxSeverity: integer('descendant_max_severity'),
  hasDescendantAnalysis: boolean('has_descendant_analysis').default(false),
}, (table) => ({
  uniquePerPull: unique().on(table.state, table.sourceIndex, table.type),
}));

export type RegulatoryDocument = typeof regulatoryDocuments.$inferSelect;
export type NewRegulatoryDocument = typeof regulatoryDocuments.$inferInsert;
