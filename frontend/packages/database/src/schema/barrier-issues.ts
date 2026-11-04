import {
  pgTable, bigserial, bigint, varchar, text, boolean,
  integer, real, timestamp, unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { barrierAnalyses } from './barrier-analyses';
import { regulatoryDocuments } from './regulatory-documents';
import { guidanceDocuments } from './guidance-documents';

export const BARRIER_CATEGORIES = [
  'REGULATORY_COMPLEXITY',
  'POLICY_IMPLEMENTATION_SEPARATION',
  'CASCADE_OF_RIGIDITY',
  'MANDATED_STEPS_NOT_OUTCOMES',
  'ADMINISTRATIVE_BURDENS',
  'NO_FEEDBACK_LOOPS',
  'PROCESS_WORSHIP_OVERSIGHT',
  'ZERO_RISK_LANGUAGE',
  'FROZEN_TECHNOLOGY',
  'OTHER',
  'MISSING_OUTCOMES',
  'UNCLEAR_DELEGATION',
  'ACCESS_ASSUMPTION_BARRIERS',
  'FEE_COST_BURDENS',
  'DEAD_SUPERSEDED_REFERENCES',
  'MISSING_DIGITAL_AUTHORIZATION',
  'ONE_SIZE_FITS_ALL',
  'UNFUNDED_MANDATE',
] as const;
export type BarrierCategory = typeof BARRIER_CATEGORIES[number];

export const BARRIER_CATEGORY_LABELS: Record<BarrierCategory, string> = {
  REGULATORY_COMPLEXITY: 'Regulatory Complexity',
  POLICY_IMPLEMENTATION_SEPARATION: 'Policy/Implementation Separation',
  CASCADE_OF_RIGIDITY: 'Cascade of Rigidity',
  MANDATED_STEPS_NOT_OUTCOMES: 'Mandated Steps, Not Outcomes',
  ADMINISTRATIVE_BURDENS: 'Administrative Burdens',
  NO_FEEDBACK_LOOPS: 'No Feedback Loops',
  PROCESS_WORSHIP_OVERSIGHT: 'Process Worship Oversight',
  ZERO_RISK_LANGUAGE: 'Zero-Risk Language',
  FROZEN_TECHNOLOGY: 'Frozen Technology',
  OTHER: 'Other',
  MISSING_OUTCOMES: 'Missing Outcomes',
  UNCLEAR_DELEGATION: 'Unclear Delegation',
  ACCESS_ASSUMPTION_BARRIERS: 'Access/Assumption Barriers',
  FEE_COST_BURDENS: 'Fee/Cost Burdens',
  DEAD_SUPERSEDED_REFERENCES: 'Dead/Superseded References',
  MISSING_DIGITAL_AUTHORIZATION: 'Missing Digital Authorization',
  ONE_SIZE_FITS_ALL: 'One Size Fits All',
  UNFUNDED_MANDATE: 'Unfunded Mandate',
};

export const barrierIssues = pgTable('barrier_issues', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  analysisId: bigint('analysis_id', { mode: 'number' })
    .notNull()
    .references(() => barrierAnalyses.id, { onDelete: 'cascade' }),
  documentId: bigint('document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  guidanceDocumentId: bigint('guidance_document_id', { mode: 'number' })
    .references(() => guidanceDocuments.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 50 }).notNull(),

  // Analysis
  explanation: text('explanation').notNull(),
  severity: integer('severity').notNull(),
  complexity: varchar('complexity', { length: 20 }).notNull(),
  confidence: real('confidence').notNull(),
  matchedPhrases: text('matched_phrases').array().default(sql`'{}'`),
  implementationApproach: text('implementation_approach'),
  effortEstimate: text('effort_estimate'),
  textExamples: text('text_examples').array().default(sql`'{}'`),
  tags: text('tags').array().default(sql`'{}'`),
  isVerbatim: boolean('is_verbatim'),

  // Review fields
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  justificationNotes: text('justification_notes'),
  teamNotes: text('team_notes'),
  priority: integer('priority'),
  impactType: varchar('impact_type', { length: 100 }),

  // Developer fields
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

export type BarrierIssue = typeof barrierIssues.$inferSelect;
export type NewBarrierIssue = typeof barrierIssues.$inferInsert;
