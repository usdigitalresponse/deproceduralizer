import {
  pgTable,
  bigserial,
  bigint,
  boolean,
  real,
  text,
  varchar,
  timestamp,
  unique
} from 'drizzle-orm/pg-core';
import { complianceIssueAnalyses } from './compliance-issue-analyses';
import { statutes } from './statutes';
import { regulationStatuteLinks } from './regulation-statute-links';

/**
 * Statute mandate checks table.
 *
 * Stores LLM analysis of whether a cited statute actually mandates
 * the flagged regulatory issue, or if the agency went beyond the statute.
 *
 * Related to:
 * - compliance_issue_analyses: The flagged analysis being checked
 * - statutes: The cited statute being compared
 * - regulation_statute_links: The link between the regulation and statute
 */
export const statuteMandateChecks = pgTable('statute_mandate_checks', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  analysisId: bigint('analysis_id', { mode: 'number' }).notNull().references(() => complianceIssueAnalyses.id, { onDelete: 'cascade' }),
  statuteId: bigint('statute_id', { mode: 'number' }).notNull().references(() => statutes.id, { onDelete: 'cascade' }),
  linkId: bigint('link_id', { mode: 'number' }).references(() => regulationStatuteLinks.id, { onDelete: 'set null' }),

  // LLM output
  statuteMandated: boolean('statute_mandated').notNull(),
  confidence: real('confidence').notNull(),
  reasoning: text('reasoning').notNull(),
  statuteTextExcerpt: text('statute_text_excerpt'),

  // Metadata
  model: varchar('model', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow(),
}, (table) => ({
  uniqueAnalysisStatute: unique().on(table.analysisId, table.statuteId),
}));

export type StatuteMandateCheck = typeof statuteMandateChecks.$inferSelect;
export type NewStatuteMandateCheck = typeof statuteMandateChecks.$inferInsert;
