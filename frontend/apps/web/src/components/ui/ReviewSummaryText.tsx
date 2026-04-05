interface ReviewSummaryTextProps {
  summary: string | null | undefined;
  variant?: 'bordered' | 'inline' | 'compact';
  className?: string;
}

export function ReviewSummaryText({ summary, variant = 'bordered', className = '' }: ReviewSummaryTextProps) {
  if (!summary) return null;

  if (variant === 'compact') {
    return (
      <p className={`text-[11px] text-[var(--color-text-secondary)] leading-snug line-clamp-2 ${className}`}>
        {summary}
      </p>
    );
  }

  if (variant === 'inline') {
    return (
      <p className={`text-sm text-[var(--color-text-secondary)] leading-relaxed ${className}`}>
        {summary}
      </p>
    );
  }

  return (
    <div className={`pl-3 border-l-[var(--border-width-4)] border-[var(--color-neutral-200)] ${className}`}>
      <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
        {summary}
      </p>
    </div>
  );
}
