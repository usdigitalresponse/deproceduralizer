'use client';

import { X } from 'lucide-react';

type MarkerBadgeSize = 'sm' | 'md';

interface MarkerBadgeProps {
  name: string;
  color: string;
  size?: MarkerBadgeSize;
  onRemove?: () => void;
  className?: string;
}

const sizeStyles: Record<MarkerBadgeSize, { pill: string; dot: string; text: string; button: string }> = {
  sm: {
    pill: 'px-1.5 py-0.5 gap-1',
    dot: 'w-2 h-2',
    text: 'text-[10px]',
    button: 'w-3 h-3',
  },
  md: {
    pill: 'px-2 py-0.5 gap-1.5',
    dot: 'w-2.5 h-2.5',
    text: 'text-xs',
    button: 'w-3.5 h-3.5',
  },
};

export function MarkerBadge({ name, color, size = 'sm', onRemove, className = '' }: MarkerBadgeProps) {
  const styles = sizeStyles[size];

  return (
    <span
      className={`
        inline-flex items-center
        ${styles.pill}
        rounded-full
        bg-[var(--color-neutral-100)]
        border border-[var(--color-neutral-200)]
        ${styles.text} font-medium text-[var(--color-text-secondary)]
        whitespace-nowrap
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      <span
        className={`${styles.dot} rounded-full shrink-0`}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {name}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onRemove();
          }}
          className={`
            ${styles.button} shrink-0
            inline-flex items-center justify-center
            rounded-full
            text-[var(--color-text-muted)]
            hover:text-[var(--color-danger)]
            hover:bg-[var(--color-danger-bg)]
            transition-colors duration-[var(--duration-fast)]
            cursor-pointer
          `.trim().replace(/\s+/g, ' ')}
          aria-label={`Remove ${name} marker`}
        >
          <X className="w-full h-full" />
        </button>
      )}
    </span>
  );
}

/**
 * Compact dot-only marker indicator for table rows.
 * Shows just colored dots without text labels.
 */
export function MarkerDots({
  markers,
  className = '',
}: {
  markers: { id: number; name: string; color: string }[];
  className?: string;
}) {
  if (markers.length === 0) return null;

  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {markers.map((m) => (
        <span
          key={m.id}
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: m.color }}
          title={m.name}
        />
      ))}
    </span>
  );
}
