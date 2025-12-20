/**
 * State type definitions for multi-state regulatory document support
 */
import type { StateCode } from '@deproceduralizer/database/schema';
import { VALID_STATES } from '@deproceduralizer/database/schema';

export type { StateCode };
export { VALID_STATES };

export interface StateConfig {
  name: string;
  abbrev: string;
  icon: string;
  accentColor: string;
  bgTint: string;
  regulationsLabel: string;
}

export const STATE_CONFIG: Record<StateCode, StateConfig> = {
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
} as const;

/**
 * Type guard to check if a string is a valid state code
 */
export function isValidState(state: string): state is StateCode {
  return VALID_STATES.includes(state as StateCode);
}

/**
 * Get state config with fallback to NY
 */
export function getStateConfig(state: string): StateConfig {
  if (isValidState(state)) {
    return STATE_CONFIG[state];
  }
  return STATE_CONFIG.ny;
}

/**
 * Default state when none is selected
 */
export const DEFAULT_STATE: StateCode = 'ny';

/**
 * localStorage key for persisting selected state
 */
export const STATE_STORAGE_KEY = 'selectedState';
