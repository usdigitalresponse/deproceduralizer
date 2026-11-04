import {
  pgTable, bigserial, bigint, varchar, text, boolean,
  timestamp, integer, real, jsonb,
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';
import { guidanceDocuments } from './guidance-documents';

export const barrierAnalyses = pgTable('barrier_analyses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  guidanceDocumentId: bigint('guidance_document_id', { mode: 'number' })
    .references(() => guidanceDocuments.id, { onDelete: 'cascade' }),
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),
  runId: varchar('run_id', { length: 32 }),

  // Single-pass analysis
  batchId: varchar('batch_id', { length: 100 }),
  completedAt: timestamp('completed_at'),
  classification: varchar('classification', { length: 30 }),
  confidence: real('confidence'),
  categories: jsonb('categories'),

  // Derived
  hasImplementationIssues: boolean('has_implementation_issues'),
  overallComplexity: varchar('overall_complexity', { length: 10 }),
  summary: text('summary'),
  maxSeverity: integer('max_severity'),
  numCategoriesFound: integer('num_categories_found'),

  // Composite burden scores (auto-maintained by DB trigger)
  compositeBurden: real('composite_burden'),
  structuralClusterCount: integer('structural_cluster_count'),
  adjustedBurden: real('adjusted_burden'),

  // Pipeline Tracking
  pipelineVersion: varchar('pipeline_version', { length: 20 }),
  modelVersion: varchar('model_version', { length: 100 }),
  responsibleAgency: text('responsible_agency'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type BarrierAnalysis = typeof barrierAnalyses.$inferSelect;
export type NewBarrierAnalysis = typeof barrierAnalyses.$inferInsert;

// Classification types
export type BarrierClassification = 'has_issues' | 'clean';
