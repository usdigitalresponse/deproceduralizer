interface ReviewSummaryTextProps {
  summary: string | null | undefined;
  variant?: 'bordered' | 'inline' | 'compact';
  label?: string;
  className?: string;
}

export function ReviewSummaryText({ summary, variant = 'bordered', label = 'Analysis Summary', className = '' }: ReviewSummaryTextProps) {
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

  // Default 'bordered' variant — prominent card-style box for key summary
  return (
    <div className={`bg-[var(--color-primary-weaker)] border border-[var(--color-primary-weak)] rounded-[var(--radius-md)] px-4 py-3 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-primary-mid)] mb-1">
        {label}
      </p>
      <p className="text-sm text-[var(--color-text)] leading-relaxed">
        {summary}
      </p>
    </div>
  );
}
