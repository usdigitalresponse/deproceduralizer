import {
  pgTable,
  bigserial,
  integer,
  varchar,
  text,
  timestamp,
  bigint,
  unique
} from 'drizzle-orm/pg-core';

/**
 * Statutes table - stores state statutes (NJ, NY) for linking to regulations.
 *
 * Related to:
 * - regulation_statute_links: Links regulations to statutes they reference
 *
 * For NJ: Citation format is "Title:Chapter-Section" (e.g., "52:27D-119")
 */
export const statutes = pgTable('statutes', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  citation: varchar('citation', { length: 50 }).notNull(),
  state: varchar('state', { length: 2 }).notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),

  // NJ-specific fields (NJSA - New Jersey Statutes Annotated)
  njsaTitle: varchar('njsa_title', { length: 10 }),
  njsaTitleName: text('njsa_title_name'),
  njsaChapter: varchar('njsa_chapter', { length: 20 }),
  njsaSection: varchar('njsa_section', { length: 20 }),
  njsaSectionName: text('njsa_section_name'),

  // NY-specific fields (NYCLS - New York Consolidated Laws)
  nyclsLawId: varchar('nycls_law_id', { length: 10 }),
  nyclsLawName: text('nycls_law_name'),
  nyclsArticle: varchar('nycls_article', { length: 20 }),
  nyclsArticleName: text('nycls_article_name'),
  nyclsSection: varchar('nycls_section', { length: 20 }),
  nyclsSectionName: text('nycls_section_name'),

  // Hierarchy for tree navigation (Issue #48)
  parentId: bigint('parent_id', { mode: 'number' }),
  hierarchyLevel: varchar('hierarchy_level', { length: 50 }),  // 'title', 'chapter', 'section'
  hierarchyPath: text('hierarchy_path'),

  // Precomputed descendant counts (refreshed via refresh_hierarchy_stats.py --statute-links)
  descendantLinkedRegulationCount: integer('descendant_linked_regulation_count').default(0),
  descendantEnablingAuthorityCount: integer('descendant_enabling_authority_count').default(0),

  // Metadata
  sourceIndex: integer('source_index'),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  // Unique constraint on state + citation
  uniqueStateCitation: unique().on(table.state, table.citation),
}));

export type Statute = typeof statutes.$inferSelect;
export type NewStatute = typeof statutes.$inferInsert;
