import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  integer,
  timestamp
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { analyses } from './analyses';

export const redFlags = pgTable('red_flags', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  analysisId: bigint('analysis_id', { mode: 'number' }).notNull().references(() => analyses.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 100 }).notNull(),
  explanation: text('explanation').notNull(),
  severity: integer('severity').notNull(),
  complexity: varchar('complexity', { length: 20 }).notNull(),
  matchedPhrases: text('matched_phrases').array().default(sql`'{}'`),
  implementationApproach: text('implementation_approach').notNull(),
  effortEstimate: varchar('effort_estimate', { length: 255 }),
  textExamples: text('text_examples').array().default(sql`'{}'`),
  // Reviewer fields
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedBy: varchar('reviewed_by', { length: 255 }),
  reviewedAt: timestamp('reviewed_at'),
  reviewerNotes: text('reviewer_notes'),
  priority: integer('priority'),
  impactType: varchar('impact_type', { length: 100 }),
});

export type RedFlag = typeof redFlags.$inferSelect;
export type NewRedFlag = typeof redFlags.$inferInsert;

// Review status constants
export const REVIEW_STATUSES = [
  'unreviewed',
  'confirmed',
  'false_positive',
  'needs_context',
  'deferred'
] as const;
export type ReviewStatus = typeof REVIEW_STATUSES[number];

// Impact type constants
export const IMPACT_TYPES = [
  'cost_savings',
  'time_savings',
  'accessibility',
  'compliance_risk',
  'operational_efficiency',
  'citizen_experience',
  'other'
] as const;
export type ImpactType = typeof IMPACT_TYPES[number];
