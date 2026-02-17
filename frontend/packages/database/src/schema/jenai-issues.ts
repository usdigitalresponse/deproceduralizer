import {
  pgTable, bigserial, bigint, varchar, text,
  integer, real, boolean, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { jenaiAnalyses } from './jenai-analyses';
import { regulatoryDocuments } from './regulatory-documents';

export const JENAI_CATEGORIES = [
  'REGULATORY_COMPLEXITY',
  'POLICY_IMPLEMENTATION_SEPARATION',
  'CASCADE_OF_RIGIDITY',
  'MANDATED_STEPS_NOT_OUTCOMES',
  'ADMINISTRATIVE_BURDENS',
  'NO_FEEDBACK_LOOPS',
  'PROCESS_WORSHIP_OVERSIGHT',
  'ZERO_RISK_LANGUAGE',
  'FROZEN_TECHNOLOGY',
  'IMPLEMENTATION_OPPORTUNITY',
  'MISSING_OUTCOMES',
  'UNCLEAR_DELEGATION',
  'ACCESS_ASSUMPTION_BARRIERS',
  'INTERAGENCY_FRAGMENTATION',
] as const;
export type JenAICategory = typeof JENAI_CATEGORIES[number];

export const JENAI_CATEGORY_LABELS: Record<JenAICategory, string> = {
  REGULATORY_COMPLEXITY: 'Regulatory Complexity',
  POLICY_IMPLEMENTATION_SEPARATION: 'Policy/Implementation Separation',
  CASCADE_OF_RIGIDITY: 'Cascade of Rigidity',
  MANDATED_STEPS_NOT_OUTCOMES: 'Mandated Steps, Not Outcomes',
  ADMINISTRATIVE_BURDENS: 'Administrative Burdens',
  NO_FEEDBACK_LOOPS: 'No Feedback Loops',
  PROCESS_WORSHIP_OVERSIGHT: 'Process Worship Oversight',
  ZERO_RISK_LANGUAGE: 'Zero-Risk Language',
  FROZEN_TECHNOLOGY: 'Frozen Technology',
  IMPLEMENTATION_OPPORTUNITY: 'Implementation Opportunity',
  MISSING_OUTCOMES: 'Missing Outcomes',
  UNCLEAR_DELEGATION: 'Unclear Delegation',
  ACCESS_ASSUMPTION_BARRIERS: 'Access/Assumption Barriers',
  INTERAGENCY_FRAGMENTATION: 'Interagency Fragmentation',
};

export const jenaiIssues = pgTable('jenai_issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  analysisId: bigint('analysis_id', { mode: 'number' })
    .notNull()
    .references(() => jenaiAnalyses.id, { onDelete: 'cascade' }),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(),

  // Analysis
  explanation: text('explanation').notNull(),
  severity: integer('severity').notNull(),
  complexity: varchar('complexity', { length: 20 }).notNull(),
  confidence: real('confidence').notNull(),
  matchedPhrases: text('matched_phrases').array().default(sql`'{}'`),
  implementationApproach: text('implementation_approach'),
  effortEstimate: varchar('effort_estimate', { length: 255 }),
  textExamples: text('text_examples').array().default(sql`'{}'`),

  // Tier Tracking
  discoveredInTier: integer('discovered_in_tier').notNull(),
  confirmedInTier: integer('confirmed_in_tier'),
  tier2Revised: boolean('tier2_revised').default(false),

  // Review fields (same as red_flags)
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  justificationNotes: text('justification_notes'),
  teamNotes: text('team_notes'),
  priority: integer('priority'),
  impactType: varchar('impact_type', { length: 100 }),

  // Developer fields (same as red_flags)
  developerStatus: varchar('developer_status', { length: 50 }).default('unresolved'),
  developerAssigned: varchar('developer_assigned', { length: 50 }),
  developerNotes: text('developer_notes'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionComments: text('resolution_comments'),
  developerQuestion: text('developer_question'),
  developerCheckedAt: timestamp('developer_checked_at'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueAnalysisCategory: unique().on(table.analysisId, table.category),
}));

export type JenAIIssue = typeof jenaiIssues.$inferSelect;
export type NewJenAIIssue = typeof jenaiIssues.$inferInsert;
