import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  real,
  timestamp,
  boolean,
  jsonb
} from 'drizzle-orm/pg-core';
import { regulatoryDocuments } from './regulatory-documents';

/**
 * Definitions table - extracted terms and definitions from regulations.
 *
 * Both `documentId` and `url` are used for linking to regulatory_documents:
 * - `documentId` is the direct FK (preferred for joins)
 * - `url` is used as a fallback for matching when documentId is NULL
 *
 * Definition text fields:
 * - `verbatimText`: The exact text extracted from the regulation
 * - `isVerbatim`: True if verbatimText is a complete, usable definition
 * - `rephrasedDefinition`: Plain-language definition when verbatimText is insufficient
 *
 * For display purposes, use verbatimText when isVerbatim=true, otherwise
 * use rephrasedDefinition (fallback to verbatimText if null).
 *
 * After importing definitions, run the document_id migration to populate
 * documentId from url matching. See database.md skill for details.
 */
export const definitions = pgTable('definitions', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  documentId: bigint('document_id', { mode: 'number' }).references(() => regulatoryDocuments.id, { onDelete: 'cascade' }),
  url: text('url'),  // Source URL for linking to regulatory_documents
  term: text('term').notNull(),
  verbatimText: text('verbatim_text').notNull(),
  isVerbatim: boolean('is_verbatim').default(true),
  rephrasedDefinition: text('rephrased_definition'),
  scope: text('scope'),
  definitionOverlap: real('definition_overlap').default(0),
  sourceLocation: text('source_location'),
  modelVersion: varchar('model_version', { length: 100 }),
  extractedAt: timestamp('extracted_at').defaultNow(),
  notes: text('notes'),

  // Phase 1 schema additions for enhanced scope tracking
  scopeLevel: varchar('scope_level', { length: 20 }),  // 'section', 'part', 'chapter', 'title', etc.
  scopeDocumentId: bigint('scope_document_id', { mode: 'number' })
    .references(() => regulatoryDocuments.id, { onDelete: 'set null' }),
  definitionType: varchar('definition_type', { length: 20 }).default('formal'),  // 'formal' or 'abbreviation'
  normalizedTerm: text('normalized_term'),  // Generated column (LOWER(TRIM(term))), read-only
  isCrossReference: boolean('is_cross_reference').default(false),

  // Review workflow fields (for correcting LLM extraction errors)
  reviewStatus: varchar('review_status', { length: 50 }).default('unreviewed'),
  reviewedAt: timestamp('reviewed_at'),
  reviewerName: varchar('reviewer_name', { length: 255 }),
  justificationNotes: text('justification_notes'),  // Justification and analysis for the model
  teamNotes: text('team_notes'),  // Notes for the development team
  originalValues: jsonb('original_values'),  // Stores original LLM values when corrections are made

  // Developer tracking fields (same as red-flags)
  developerStatus: varchar('developer_status', { length: 50 }).default('unresolved'),
  developerAssigned: varchar('developer_assigned', { length: 50 }),
  developerNotes: text('developer_notes'),
  resolutionType: varchar('resolution_type', { length: 50 }),
  resolutionComments: text('resolution_comments'),
  developerQuestion: text('developer_question'),
  developerCheckedAt: timestamp('developer_checked_at'),
});

export type Definition = typeof definitions.$inferSelect;
export type NewDefinition = typeof definitions.$inferInsert;

// Scope constants (common values from the data)
export const DEFINITION_SCOPES = [
  'in this section',
  'in this Part',
  'in this Subpart',
  'in this regulation',
  'in this part',
  'in this title',
  'in this Title',
  'in this order',
  'in this Chapter',
] as const;
export type DefinitionScope = typeof DEFINITION_SCOPES[number];

// Definition type classification
// NOTE: These are known values, not hard constraints. New types can be added.
// The database column is VARCHAR without CHECK constraint for extensibility.
export const DEFINITION_TYPES = ['formal', 'abbreviation'] as const;
export type DefinitionType = typeof DEFINITION_TYPES[number];

// Structured scope levels (matches hierarchy_level in regulatory_documents)
// NOTE: These are known values, not hard constraints. New levels can be added.
// The database column is VARCHAR without CHECK constraint for extensibility.
export const SCOPE_LEVELS = [
  'section',
  'subpart',
  'part',
  'subchapter',
  'chapter',
  'subtitle',
  'title',
] as const;
export type ScopeLevel = typeof SCOPE_LEVELS[number];

// Review status workflow for definitions (different from red flags review)
export const DEFINITION_REVIEW_STATUSES = [
  'unreviewed',
  'confirmed',
  'corrected',
  'false_positive',
] as const;
export type DefinitionReviewStatus = typeof DEFINITION_REVIEW_STATUSES[number];

// Type for original values stored in JSONB when corrections are made
export interface DefinitionOriginalValues {
  term?: string;
  isVerbatim?: boolean;
  verbatimText?: string;
  rephrasedDefinition?: string;
  scope?: string;
  scopeLevel?: string;
  scopeDocumentId?: number;
  definitionType?: string;
  isCrossReference?: boolean;
}

// Re-export developer tracking constants from red-flags for convenience
export {
  DEVELOPER_STATUSES,
  RESOLUTION_TYPES,
  DEVELOPERS,
  type DeveloperStatus,
  type ResolutionType,
  type Developer,
} from './red-flags';
