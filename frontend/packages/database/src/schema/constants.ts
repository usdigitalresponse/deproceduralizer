// State types
export type StateCode = 'ny' | 'nj' | 'nyc';
export const VALID_STATES: StateCode[] = ['ny', 'nj', 'nyc'];

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
