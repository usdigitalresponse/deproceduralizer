import { getEntityConfig, type EntityType } from '@/lib/constants/entity-types';

export interface ColorStripeProps {
  /** Entity type to derive the border color from */
  entityType: EntityType;
  /** Where to place the stripe (default 'left') */
  position?: 'left' | 'top';
  /** Additional CSS classes */
  className?: string;
}

/**
 * Decorative colored border strip for cards/rows based on entity type.
 *
 * Renders a 3px border in the entity type's canonical color.
 *
 * @example
 * ```tsx
 * <div className="flex">
 *   <ColorStripe entityType="compliance_issue" />
 *   <div>Card content</div>
 * </div>
 * ```
 */
export function ColorStripe({
  entityType,
  position = 'left',
  className = '',
}: ColorStripeProps) {
  const config = getEntityConfig(entityType);
  const positionClass =
    position === 'left' ? 'border-l-[3px]' : 'border-t-[3px]';

  return (
    <div
      className={`${positionClass} ${config.borderColor} ${className}`}
      aria-hidden="true"
    />
  );
}

export default ColorStripe;
