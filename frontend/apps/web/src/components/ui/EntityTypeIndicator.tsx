import { type EntityType, getEntityConfig } from '@/lib/constants/entity-types';

const ICON_SIZES = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
} as const;

export interface EntityTypeIndicatorProps {
  /** Which entity type to display */
  type: EntityType;
  /** Icon size: sm (14px), md (16px), lg (20px) */
  size?: 'sm' | 'md' | 'lg';
  /** Show the entity label text alongside the icon */
  showLabel?: boolean;
  /** Render a tinted background pill behind the icon + label */
  showBackground?: boolean;
  /** Optional count badge */
  count?: number;
  /** Additional CSS classes */
  className?: string;
}

export function EntityTypeIndicator({
  type,
  size = 'md',
  showLabel = false,
  showBackground = false,
  count,
  className = '',
}: EntityTypeIndicatorProps) {
  const config = getEntityConfig(type);
  const Icon = config.icon;

  const content = (
    <>
      <Icon className={`${ICON_SIZES[size]} ${config.iconColor}`} />
      {showLabel && (
        <span className={`text-sm font-medium ${config.textColor}`}>
          {config.label}
        </span>
      )}
      {count !== undefined && (
        <span className="text-xs text-[var(--color-text-muted)] tabular-nums">
          {count}
        </span>
      )}
    </>
  );

  if (showBackground) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 ${config.bgColor} ${config.borderColor} ${className}`}
      >
        {content}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {content}
    </span>
  );
}
