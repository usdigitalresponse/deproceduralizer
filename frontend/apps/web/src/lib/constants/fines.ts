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
/** Labels for the source type filter */
export const SOURCE_TYPE_LABELS: Record<string, string> = {
  regulation: 'Regulations',
  guidance: 'Guidance Documents',
};

export const PENALTY_TYPE_COLORS: Record<string, string> = {
  fine: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  penalty: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  fee: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  surcharge: 'bg-[var(--color-warning-bg)] text-[var(--color-warning)]',
  forfeiture: 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]',
  other: 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]',
};
