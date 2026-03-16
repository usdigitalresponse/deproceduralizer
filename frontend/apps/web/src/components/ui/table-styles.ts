/**
 * Shared table styling constants for consistent table appearance.
 *
 * @example
 * ```tsx
 * import { tableHeaderClass, tableCellClass, tableRowClass } from '@/components/ui/table-styles';
 *
 * <table>
 *   <thead>
 *     <tr><th className={tableHeaderClass}>Name</th></tr>
 *   </thead>
 *   <tbody>
 *     <tr className={tableRowClass}>
 *       <td className={tableCellClass}>Value</td>
 *     </tr>
 *   </tbody>
 * </table>
 * ```
 */

/** Alternating row background */
export const zebraRowClass = 'even:bg-[var(--color-neutral-50)]';

/** Hover highlight for rows */
export const hoverRowClass =
  'hover:bg-[var(--color-primary-faint)] transition-colors';

/** Standard table header cell */
export const tableHeaderClass =
  'text-left px-4 py-3 font-medium text-xs text-[var(--color-text-muted)] uppercase tracking-wide';

/** Standard table body cell */
export const tableCellClass = 'px-4 py-3 text-sm';

/** Combined row styles: zebra + hover + bottom border */
export const tableRowClass =
  'even:bg-[var(--color-neutral-50)] hover:bg-[var(--color-primary-faint)] transition-colors border-b border-[var(--color-neutral-100)]';
