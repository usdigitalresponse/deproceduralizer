/**
 * Centralized constants for fines/fees/penalties display.
 *
 * Penalty type labels (singular + plural) and badge color classes.
 * Import from here instead of defining locally in each component.
 */

/** Singular labels for detail views and table cells */
export const PENALTY_TYPE_LABELS: Record<string, string> = {
  fine: 'Fine',
  fee: 'Fee',
  penalty: 'Penalty',
  surcharge: 'Surcharge',
  forfeiture: 'Forfeiture',
  other: 'Other',
};

/** Plural labels for charts and overview summaries */
export const PENALTY_TYPE_LABELS_PLURAL: Record<string, string> = {
  fine: 'Fines',
  fee: 'Fees',
  penalty: 'Penalties',
  surcharge: 'Surcharges',
  forfeiture: 'Forfeitures',
  other: 'Other',
};

/**
 * Badge color classes per penalty type, using semantic CSS variable tokens.
 *
 * Mapping rationale:
 * - fine      -> danger  (red)    — direct monetary penalty
 * - penalty   -> warning (amber)  — punitive but broader
 * - fee       -> info    (blue)   — administrative cost
 * - surcharge -> warning (amber)  — additional charge
 * - forfeiture -> danger (red)    — loss of asset/right
 * - other     -> neutral (gray)   — uncategorized
 */

/** Multi-select options for penalty type filter (empty selection = all) */
export const PENALTY_TYPE_MULTISELECT_OPTIONS = Object.entries(PENALTY_TYPE_LABELS_PLURAL)
  .map(([value, label]) => ({ value, label }));

export const PENALTY_TYPE_COLORS: Record<string, string> = {
  fine: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  penalty: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  fee: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  surcharge: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  forfeiture: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  other: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
};

// ---------------------------------------------------------------------------
// Agency level constants
// ---------------------------------------------------------------------------

export const AGENCY_LEVEL_LABELS: Record<string, string> = {
  federal: 'Federal',
  state: 'State',
  county: 'County',
  city: 'City',
  village: 'Village',
  town: 'Town',
  authority: 'Authority',
  judiciary: 'Judiciary',
  generic: 'Generic',
};

export const AGENCY_LEVEL_MULTISELECT_OPTIONS = Object.entries(AGENCY_LEVEL_LABELS)
  .map(([value, label]) => ({ value, label }));

// ---------------------------------------------------------------------------
// Source type constants (regulation vs guidance)
// ---------------------------------------------------------------------------

/** Full labels for charts and filters */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  regulation: 'Regulations',
  guidance: 'Guidance Documents',
};

export const SOURCE_TYPE_COLORS: Record<string, string> = {
  regulation: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  guidance: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
};

/** Short labels for inline badges (e.g. "Reg", "Guidance") */
export const SOURCE_TYPE_BADGE_LABELS: Record<string, string> = {
  regulation: 'Reg',
  guidance: 'Guidance',
};

/** Multi-select options for fines severity filter */
export const FINES_SEVERITY_MULTISELECT_OPTIONS = [
  { value: 'high', label: 'High (7-10)' },
  { value: 'medium', label: 'Medium (4-6)' },
  { value: 'low', label: 'Low (1-3)' },
  { value: 'false_positive', label: 'False Positive' },
  { value: 'unrelated', label: 'Unrelated to Burden' },
];

/** Filter options for the fines classification dropdown */
export const FINES_CLASSIFICATION_OPTIONS = [
  { value: 'all', label: 'All Analysis' },
  { value: 'burdensome', label: 'Burdensome' },
  { value: 'justified', label: 'Justified' },
  { value: 'not_analyzed', label: 'Not Analyzed' },
] as const;

// ---------------------------------------------------------------------------
// Enrichment column constants
// ---------------------------------------------------------------------------

export const ESTIMATED_PAYERS_LABELS: Record<string, string> = {
  tens: 'Tens per year',
  hundreds: 'Hundreds per year',
  thousands: 'Thousands per year',
  ten_thousands: 'Tens of thousands per year',
  hundred_thousands: 'Hundreds of thousands per year',
};

export const ESTIMATED_PAYERS_MULTISELECT_OPTIONS = [
  { value: 'hundred_thousands', label: 'Hundreds of thousands' },
  { value: 'ten_thousands', label: 'Tens of thousands' },
  { value: 'thousands', label: 'Thousands' },
  { value: 'hundreds', label: 'Hundreds' },
  { value: 'tens', label: 'Tens' },
];

export const ACTIVITY_CATEGORY_LABELS: Record<string, string> = {
  cannabis_alcohol: 'Cannabis & Alcohol',
  financial_services: 'Financial Services',
  transportation: 'Transportation',
  social_services: 'Social Services',
  education: 'Education',
  environmental_permit: 'Environmental Permits',
  professional_licensing: 'Professional Licensing',
  healthcare_facility: 'Healthcare Facility',
  real_estate_housing: 'Real Estate & Housing',
  business_licensing: 'Business Licensing',
  hunting_fishing_wildlife: 'Hunting/Fishing/Wildlife',
  construction_building: 'Construction & Building',
  manufacturing_industrial: 'Manufacturing & Industrial',
  childcare_provider: 'Childcare Provider',
  food_service: 'Food Service',
  other: 'Other',
};

export const AGENCY_LEVEL_COLORS: Record<string, string> = {
  federal: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  state: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  county: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  city: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
  village: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
  town: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
  authority: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  judiciary: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  generic: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
};
