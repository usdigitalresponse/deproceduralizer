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
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),
  runId: varchar('run_id', { length: 32 }),

  // Single-pass analysis
  batchId: varchar('batch_id', { length: 100 }),
  completedAt: timestamp('completed_at'),
  classification: varchar('classification', { length: 30 }),
  confidence: real('confidence'),
  categories: jsonb('categories'),
  worstThing: text('worst_thing'),

  // Derived
  hasImplementationIssues: boolean('has_implementation_issues'),
  overallComplexity: varchar('overall_complexity', { length: 10 }),
  summary: text('summary'),
  maxSeverity: integer('max_severity'),
  numCategoriesFound: integer('num_categories_found'),

  // Pipeline Tracking
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
export type JenAIClassification = 'has_issues' | 'clean';
