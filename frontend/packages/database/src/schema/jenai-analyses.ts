import {
  pgTable, bigserial, bigint, varchar, text, boolean,
  timestamp, integer, real, jsonb, unique,
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

export const jenaiAnalyses = pgTable('jenai_analyses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .notNull()
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  state: varchar('state', { length: 2 }).notNull(),
  runId: varchar('run_id', { length: 32 }),

  // Tier 1
  tier1Categories: jsonb('tier1_categories'),
  tier1HasIssues: boolean('tier1_has_issues'),
  tier1Classification: varchar('tier1_classification', { length: 30 }),
  tier1Confidence: real('tier1_confidence'),
  tier1ContextRequests: jsonb('tier1_context_requests'),
  tier1BatchId: varchar('tier1_batch_id', { length: 100 }),
  tier1CompletedAt: timestamp('tier1_completed_at'),

  // Tier 2
  tier2Categories: jsonb('tier2_categories'),
  tier2HasIssues: boolean('tier2_has_issues'),
  tier2Classification: varchar('tier2_classification', { length: 30 }),
  tier2Confidence: real('tier2_confidence'),
  tier2NewDiscoveries: jsonb('tier2_new_discoveries'),
  tier2ContextUsed: jsonb('tier2_context_used'),
  tier2BatchId: varchar('tier2_batch_id', { length: 100 }),
  tier2CompletedAt: timestamp('tier2_completed_at'),

  // Final Derived
  hasImplementationIssues: boolean('has_implementation_issues'),
  overallComplexity: varchar('overall_complexity', { length: 10 }),
  summary: text('summary'),
  maxSeverity: integer('max_severity'),
  numCategoriesFound: integer('num_categories_found'),

  // Pipeline Tracking
  highestTierCompleted: integer('highest_tier_completed').default(0),
  pipelineVersion: varchar('pipeline_version', { length: 20 }),
  modelVersion: varchar('model_version', { length: 100 }),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  uniqueDocument: unique().on(table.documentId),
}));

export type JenAIAnalysis = typeof jenaiAnalyses.$inferSelect;
export type NewJenAIAnalysis = typeof jenaiAnalyses.$inferInsert;

// Classification types
export type JenAITier1Classification = 'has_issues' | 'clean' | 'needs_context';
export type JenAITier2Classification = 'confirmed' | 'revised' | 'dismissed';
