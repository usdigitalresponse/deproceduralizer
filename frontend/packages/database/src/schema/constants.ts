// State types
export type StateCode = 'ny' | 'nj';
export const VALID_STATES: StateCode[] = ['ny', 'nj'];

// Red flag categories
export const RED_FLAG_CATEGORIES = [
  'administrative_burdens',
  'cascade_of_rigidity',
  'complexity_policy_debt',
  'implementation_opportunity',
  'mandated_steps_not_outcomes',
  'no_feedback_loops',
  'overwrought_legalese',
  'process_worship_oversight',
  'zero_risk_language',
] as const;

export type RedFlagCategory = typeof RED_FLAG_CATEGORIES[number];
