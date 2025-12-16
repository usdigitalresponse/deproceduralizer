import { getHierarchyLevelLabel } from '@/lib/constants/hierarchy';

export interface LevelBadgeProps {
  /** The hierarchy level value (e.g., 'title', 'part', 'section') */
  level: string | null | undefined;
  /** Additional class name */
  className?: string;
}

/**
 * Badge component for displaying hierarchy levels (Title, Part, Section, etc.)
 * Uses consistent styling across the application.
 *
 * @example
 * <LevelBadge level="section" />
 * // Renders: [SECTION] badge
 *
 * @example
 * <LevelBadge level={document.hierarchyLevel} />
 */
export function LevelBadge({ level, className = '' }: LevelBadgeProps) {
  if (!level) return null;

  const label = getHierarchyLevelLabel(level);

  return (
    <span
      className={`
        px-1.5 py-0.5
        bg-[var(--color-neutral-100)]
        rounded
        text-[10px] uppercase tracking-wide font-medium
        text-[var(--color-text-secondary)]
        ${className}
      `}
    >
      {label}
    </span>
  );
}

export default LevelBadge;
