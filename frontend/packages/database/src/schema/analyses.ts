import {
  pgTable,
  bigserial,
  bigint,
  timestamp,
  varchar,
  boolean,
  text,
  integer
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

export const analyses = pgTable('analyses', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' }).notNull().references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  analyzedAt: timestamp('analyzed_at').defaultNow(),
  modelVersion: varchar('model_version', { length: 100 }),
  hasImplementationIssues: boolean('has_implementation_issues').default(false),
  overallComplexity: varchar('overall_complexity', { length: 10 }),
  summary: text('summary'),
  requiresTechnicalReview: boolean('requires_technical_review').default(false),
  hasReportingRequirement: boolean('has_reporting_requirement').default(false),
  maxSeverity: integer('max_severity'),
  numFlags: integer('num_flags').default(0),
  isCurrent: boolean('is_current').default(true),
});

export type Analysis = typeof analyses.$inferSelect;
export type NewAnalysis = typeof analyses.$inferInsert;
