import {
  pgTable,
  bigserial,
  integer,
  varchar,
  text,
  timestamp,
  boolean,
} from 'drizzle-orm/pg-core';

export const guidanceDocuments = pgTable('guidance_documents', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  catalogId: text('catalog_id'),
  canonicalRef: text('canonical_ref'),
  title: text('title').notNull(),
  agency: text('agency').notNull(),
  agencyDivision: text('agency_division'),
  docType: text('doc_type'),
  domain: text('domain'),
  policyCategory: text('policy_category'),
  isAttachment: boolean('is_attachment').default(false),
  datePublished: text('date_published'),
  dateEffective: text('date_effective'),
  dateRevised: text('date_revised'),
  dateExpires: text('date_expires'),
  year: integer('year'),
  content: text('content'),
  url: text('url'),
  fileFormat: text('file_format'),
  status: text('status').default('active'),
  supersedes: text('supersedes').array(),
  supersededBy: text('superseded_by'),
  revisionOf: text('revision_of'),
  senderName: text('sender_name'),
  senderTitle: text('sender_title'),
  distributionTo: text('distribution_to').array(),
  programs: text('programs').array(),
  citesRegulations: text('cites_regulations').array(),
  citesFederal: text('cites_federal').array(),
  citesDocuments: text('cites_documents').array(),
  sourceProject: text('source_project'),
  textPath: text('text_path'),
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),
  targetAudience: text('target_audience').array(),
  isApplication: boolean('is_application'),

  // Summarization & audience classification
  summary: text('summary'),
  audienceDirection: varchar('audience_direction', { length: 20 }),
  audienceExpertise: varchar('audience_expertise', { length: 20 }),
  audienceExplanation: text('audience_explanation'),

  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export type GuidanceDocument = typeof guidanceDocuments.$inferSelect;
export type NewGuidanceDocument = typeof guidanceDocuments.$inferInsert;

export const POLICY_CATEGORIES = [
  'policy_directive', 'legal_interpretation', 'tax_guidance',
  'informational', 'reference_material', 'non_policy', 'data_dump', 'unclassified'
] as const;
export type PolicyCategory = typeof POLICY_CATEGORIES[number];

export const GUIDANCE_STATUSES = ['active', 'superseded', 'canceled', 'expired'] as const;
export type GuidanceStatus = typeof GUIDANCE_STATUSES[number];
