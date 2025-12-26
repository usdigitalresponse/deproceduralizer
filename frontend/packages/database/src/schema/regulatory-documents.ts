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

  // NYCRR (New York Codes, Rules and Regulations) columns
  nycrrTitle: integer('nycrr_title'),
  nycrrTitleName: text('nycrr_title_name'),
  nycrrSubtitle: varchar('nycrr_subtitle', { length: 50 }),
  nycrrSubtitleName: text('nycrr_subtitle_name'),
  nycrrChapter: varchar('nycrr_chapter', { length: 50 }),
  nycrrChapterName: text('nycrr_chapter_name'),
  nycrrSubchapter: varchar('nycrr_subchapter', { length: 50 }),
  nycrrSubchapterName: text('nycrr_subchapter_name'),
  nycrrArticle: varchar('nycrr_article', { length: 50 }),
  nycrrArticleName: text('nycrr_article_name'),
  nycrrPart: varchar('nycrr_part', { length: 50 }),
  nycrrPartName: text('nycrr_part_name'),
  nycrrSubpart: varchar('nycrr_subpart', { length: 50 }),
  nycrrSubpartName: text('nycrr_subpart_name'),
  nycrrSection: varchar('nycrr_section', { length: 50 }),
  nycrrSectionName: text('nycrr_section_name'),

  // NJAC (New Jersey Administrative Code) columns
  njacTitle: varchar('njac_title', { length: 50 }),
  njacTitleName: text('njac_title_name'),
  njacSubtitle: varchar('njac_subtitle', { length: 50 }),
  njacSubtitleName: text('njac_subtitle_name'),
  njacChapter: varchar('njac_chapter', { length: 50 }),
  njacChapterName: text('njac_chapter_name'),
  njacSubchapter: varchar('njac_subchapter', { length: 100 }),
  njacSubchapterName: text('njac_subchapter_name'),
  njacArticle: varchar('njac_article', { length: 50 }),
  njacArticleName: text('njac_article_name'),
  njacPart: varchar('njac_part', { length: 50 }),
  njacPartName: text('njac_part_name'),
  njacSubpart: varchar('njac_subpart', { length: 50 }),
  njacSubpartName: text('njac_subpart_name'),
  njacSection: varchar('njac_section', { length: 50 }),
  njacSectionName: text('njac_section_name'),

  // NJSA (New Jersey Statutes) columns
  njsaTitle: varchar('njsa_title', { length: 10 }),
  njsaTitleName: text('njsa_title_name'),
  njsaChapter: varchar('njsa_chapter', { length: 20 }),
  njsaSection: varchar('njsa_section', { length: 20 }),
  njsaSectionName: text('njsa_section_name'),
  njsaCitation: varchar('njsa_citation', { length: 50 }),

  // Display-optimized fields (populated by backend scripts)
  shortTitle: text('short_title'),
  levelIdentifier: varchar('level_identifier', { length: 100 }),
  citation: varchar('citation', { length: 100 }),

  scrapedFromUrl: text('scraped_from_url'),

  // Precomputed hierarchy stats (for fast browse queries)
  directChildCount: integer('direct_child_count').default(0),
  descendantCount: integer('descendant_count').default(0),
  descendantFlagCount: integer('descendant_flag_count').default(0),
  descendantMaxSeverity: integer('descendant_max_severity'),
  hasDescendantAnalysis: boolean('has_descendant_analysis').default(false),

  // Precomputed compliance issue stats
  complianceIssueCount: integer('compliance_issue_count').default(0),
  descendantComplianceIssueCount: integer('descendant_compliance_issue_count').default(0),

  // Regulatory status (for reserved/repealed/recodified sections)
  regulatoryStatus: varchar('regulatory_status', { length: 20 }).default('active'),
  recodifiedTo: varchar('recodified_to', { length: 100 }),
}, (table) => ({
  uniquePerPull: unique().on(table.state, table.sourceIndex, table.type),
}));

export type RegulatoryDocument = typeof regulatoryDocuments.$inferSelect;
export type NewRegulatoryDocument = typeof regulatoryDocuments.$inferInsert;
