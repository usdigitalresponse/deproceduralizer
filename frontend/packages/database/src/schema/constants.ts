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

// Red flag categories (must match backend/scripts/red_flags.py enum)
// Based on Jennifer Pahlka's framework - exactly 12 categories
export const RED_FLAG_CATEGORIES = [
  'administrative_burdens',
  'cascade_of_rigidity',
  'complexity_policy_debt',
  'frozen_technology',
  'implementation_opportunity',
  'mandated_steps_not_outcomes',
  'no_feedback_loops',
  'options_become_requirements',
  'overwrought_legalese',
  'policy_implementation_separation',
  'process_worship_oversight',
  'zero_risk_language',
] as const;

export type RedFlagCategory = typeof RED_FLAG_CATEGORIES[number];
