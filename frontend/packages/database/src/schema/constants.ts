/**
 * Jurisdiction code. Represents a regulatory jurisdiction, not strictly a US state.
 * - 'ny': New York State (NYCRR regulations, NY Consolidated Laws statutes)
 * - 'nj': New Jersey (NJAC regulations, NJSA statutes)
 * - 'nyc': New York City (RCNY regulations, NYC Charter + Admin Code statutes)
 *
 * When adding a new jurisdiction: update this type, VALID_JURISDICTIONS, CHECK constraints
 * on all tables with a jurisdiction column, CSS variables, JURISDICTION_CONFIG, and formatStateCitation.
 */
export type JurisdictionCode = 'ny' | 'nj' | 'nyc';
export const VALID_JURISDICTIONS: JurisdictionCode[] = ['ny', 'nj', 'nyc'];

/**
 * Normalize a jurisdiction string for DB queries.
 * The DB stores jurisdiction codes as uppercase ('NY', 'NJ', 'NYC'),
 * while the app layer uses lowercase JurisdictionCode ('ny', 'nj', 'nyc').
 */
export function normalizeJurisdiction(jurisdiction: string): string {
  return jurisdiction.toUpperCase();
}

/**
 * Flesch Reading Ease score ranges for readability tiers.
 * Single source of truth used by ReadabilityBadge, repository filters, and analytics queries.
 */
export const READABILITY_TIERS = {
  very_difficult: { min: -Infinity, max: 30 },
  difficult: { min: 30, max: 50 },
  fairly_difficult: { min: 50, max: 60 },
  standard: { min: 60, max: 70 },
  easy: { min: 70, max: Infinity },
} as const;

export type ReadabilityTier = keyof typeof READABILITY_TIERS;

