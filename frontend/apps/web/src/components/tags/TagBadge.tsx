import { TAG_DOMAIN_COLORS, formatTagValue, type TagDomain } from '@/lib/constants/tags';

interface TagBadgeProps {
  value: string;
  domain?: TagDomain;
  className?: string;
}

/**
 * Pill badge for displaying tag values.
 * Colors by domain using TAG_DOMAIN_COLORS.
 */
export function TagBadge({ value, domain, className = '' }: TagBadgeProps) {
  const colorClasses = domain
    ? TAG_DOMAIN_COLORS[domain]
    : 'bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]';

  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-xs font-medium
        rounded-full
        ${colorClasses}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {formatTagValue(value)}
    </span>
  );
}
