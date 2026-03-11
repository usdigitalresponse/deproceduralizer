import {
  pgTable,
  bigserial,
  bigint,
  varchar,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

/**
 * Canonical agency lookup table for deduplication.
 * Stores one row per (jurisdiction, canonical_name) pair.
 */
export const AGENCY_LEVELS = [
  'federal', 'state', 'county', 'city', 'village', 'town', 'authority', 'judiciary', 'generic',
] as const;

export type AgencyLevel = (typeof AGENCY_LEVELS)[number];

export const agencies = pgTable('agencies', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  jurisdiction: varchar('jurisdiction', { length: 3 }).notNull(),
  canonicalName: text('canonical_name').notNull(),
  abbreviation: varchar('abbreviation', { length: 50 }),
  level: varchar('level', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow(),
});

/**
 * Aliases for agencies — maps variant spellings, cases, abbreviations
 * to a canonical agency record.
 */
export const agencyAliases = pgTable('agency_aliases', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  agencyId: bigint('agency_id', { mode: 'number' })
    .notNull()
    .references(() => agencies.id, { onDelete: 'cascade' }),
  alias: text('alias').notNull(),
  source: varchar('source', { length: 50 }).default('manual'),
  createdAt: timestamp('created_at').defaultNow(),
});

export type Agency = typeof agencies.$inferSelect;
export type NewAgency = typeof agencies.$inferInsert;
export type AgencyAlias = typeof agencyAliases.$inferSelect;
