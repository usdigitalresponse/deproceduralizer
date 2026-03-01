/**
 * Jurisdiction type definitions for multi-jurisdiction regulatory document support
 */
import type { JurisdictionCode } from '@deproceduralizer/database/schema';
import { VALID_JURISDICTIONS } from '@deproceduralizer/database/schema';

export type { JurisdictionCode };
export { VALID_JURISDICTIONS };

export interface JurisdictionConfig {
  name: string;
  abbrev: string;
  icon: string;
  accentColor: string;
  bgTint: string;
  regulationsLabel: string;
}

/**
 * Per-jurisdiction display configuration. Each entry drives theming (via CSS
 * variables `--color-state-{code}-*` in tokens.css), navigation labels, and
 * the state selector UI. When adding a jurisdiction, also add matching CSS
 * variables and update `formatStateCitation` in `lib/formatters/citations.ts`.
 */
export const JURISDICTION_CONFIG: Record<JurisdictionCode, JurisdictionConfig> = {
  ny: {
    name: 'New York',
    abbrev: 'NY',
    icon: '🗽',
    accentColor: '#1e40af', // blue-800
    bgTint: 'rgba(30, 64, 175, 0.05)',
    regulationsLabel: 'NY State Regulations',
  },
  nj: {
    name: 'New Jersey',
    abbrev: 'NJ',
    icon: '🏛️',
    accentColor: '#b45309', // amber-700
    bgTint: 'rgba(180, 83, 9, 0.05)',
    regulationsLabel: 'NJ State Regulations',
  },
  nyc: {
    name: 'New York City',
    abbrev: 'NYC',
    icon: '🏙️',
    accentColor: '#059669', // emerald-600
    bgTint: 'rgba(5, 150, 105, 0.05)',
    regulationsLabel: 'NYC Regulations (RCNY)',
  },
} as const;

/**
 * Type guard to check if a string is a valid jurisdiction code
 */
export function isValidJurisdiction(jurisdiction: string): jurisdiction is JurisdictionCode {
  return VALID_JURISDICTIONS.includes(jurisdiction as JurisdictionCode);
}

/**
 * Default jurisdiction when none is selected
 */
export const DEFAULT_JURISDICTION: JurisdictionCode = 'ny';

/**
 * Get jurisdiction config with fallback to default jurisdiction
 */
export function getJurisdictionConfig(jurisdiction: string): JurisdictionConfig {
  if (isValidJurisdiction(jurisdiction)) {
    return JURISDICTION_CONFIG[jurisdiction];
  }
  return JURISDICTION_CONFIG[DEFAULT_JURISDICTION];
}

/**
 * localStorage key for persisting selected jurisdiction
 */
export const JURISDICTION_STORAGE_KEY = 'selectedState';
