import { getEntityConfig, type EntityType } from '@/lib/constants/entity-types';

export interface EntityTypeBadgeProps {
  /** Entity type to display */
  type: EntityType;
  /** Badge size (default 'sm') */
  size?: 'sm' | 'md';
  /** Whether to show the label next to the icon (default true) */
  showLabel?: boolean;
  /** Additional CSS classes */
  className?: string;
}

const sizeStyles = {
  sm: {
    badge: 'text-xs px-2 py-0.5 gap-1',
    icon: 'w-3 h-3',
  },
  md: {
    badge: 'text-sm px-2.5 py-1 gap-1.5',
    icon: 'w-4 h-4',
  },
} as const;

/**
 * Badge showing entity type with its canonical icon and label.
 *
 * @example
 * ```tsx
 * <EntityTypeBadge type="compliance_issue" />
 * <EntityTypeBadge type="statute" size="md" />
 * <EntityTypeBadge type="cross_reference" showLabel={false} />
 * ```
 */
export function EntityTypeBadge({
  type,
  size = 'sm',
  showLabel = true,
  className = '',
}: EntityTypeBadgeProps) {
  const config = getEntityConfig(type);
  const Icon = config.icon;
  const styles = sizeStyles[size];

  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${config.bgColor} ${config.textColor}
        ${styles.badge}
        ${className}
      `}
    >
      <Icon className={`${styles.icon} ${config.iconColor} shrink-0`} aria-hidden="true" />
      {showLabel && <span>{config.shortLabel}</span>}
    </span>
  );
}

export default EntityTypeBadge;
