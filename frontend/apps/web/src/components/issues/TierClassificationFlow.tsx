'use client';

import { HTMLAttributes } from 'react';

/**
 * Classification colors for tier results
 */
const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  // Gray - dismissed/unrelated/false positives
  all_false_positives: {
    bg: 'bg-[var(--color-neutral-100)]',
    text: 'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-neutral-300)]',
  },
  unrelated: {
    bg: 'bg-[var(--color-neutral-100)]',
    text: 'text-[var(--color-text-muted)]',
    border: 'border-[var(--color-neutral-300)]',
  },
  // Blue - continuing to next tier
  needs_research: {
    bg: 'bg-[var(--color-info-bg)]',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/30',
  },
  needs_full_context: {
    bg: 'bg-[var(--color-info-bg)]',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/30',
  },
  // Green - justified (regulation is reasonable)
  justified: {
    bg: 'bg-[var(--color-success-bg)]',
    text: 'text-[var(--color-success)]',
    border: 'border-[var(--color-success)]/30',
  },
  // Orange - burdensome (problematic regulation)
  burdensome: {
    bg: 'bg-[var(--color-warning-bg)]',
    text: 'text-[var(--color-warning)]',
    border: 'border-[var(--color-warning)]/30',
  },
};

/**
 * Short labels for classifications
 */
const CLASSIFICATION_LABELS: Record<string, string> = {
  all_false_positives: 'FP',
  needs_research: 'needs research',
  unrelated: 'unrelated',
  justified: 'justified',
  burdensome: 'burdensome',
  needs_full_context: 'needs context',
};

interface TierClassificationFlowProps extends HTMLAttributes<HTMLDivElement> {
  highestTierCompleted: number;
  tier1Classification?: string | null;
  tier2Classification?: string | null;
  tier3Classification?: string | null;
  /** Compact mode shows abbreviated labels */
  compact?: boolean;
}

function getColors(classification: string | null | undefined) {
  if (!classification) {
    return {
      bg: 'bg-[var(--color-neutral-50)]',
      text: 'text-[var(--color-text-muted)]',
      border: 'border-dashed border-[var(--color-neutral-300)]',
    };
  }
  return CLASSIFICATION_COLORS[classification] || CLASSIFICATION_COLORS.unrelated;
}

function getLabel(classification: string | null | undefined): string {
  if (!classification) return '—';
  return CLASSIFICATION_LABELS[classification] || classification;
}

/**
 * TierClassificationFlow - Shows classification results at each tier (V5: 3 tiers)
 *
 * Display format:
 * [T1: needs_research] → [T2: burdensome] → [T3: justified]
 *      (blue)                (orange)          (green)
 */
export function TierClassificationFlow({
  highestTierCompleted,
  tier1Classification,
  tier2Classification,
  tier3Classification,
  compact = false,
  className = '',
  ...props
}: TierClassificationFlowProps) {
  const tiers = [
    { number: 1, label: 'T1', classification: tier1Classification },
    { number: 2, label: 'T2', classification: tier2Classification },
    { number: 3, label: 'T3', classification: tier3Classification },
  ];

  const normalizedHighest = highestTierCompleted;

  // No analysis at all
  if (normalizedHighest === 0) {
    return (
      <div
        className={`inline-flex items-center gap-1 text-xs text-[var(--color-text-muted)] ${className}`}
        {...props}
      >
        <span className="italic">No pipeline analysis</span>
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center flex-wrap gap-1 ${className}`}
      {...props}
    >
      {tiers.map((tier, index) => {
        const isCompleted = tier.number <= normalizedHighest;
        const colors = isCompleted
          ? getColors(tier.classification)
          : getColors(null);
        const isLast = index === tiers.length - 1;

        return (
          <div key={tier.number} className="inline-flex items-center">
            {/* Tier badge */}
            <div
              className={`
                inline-flex items-center gap-1
                px-1.5 py-0.5
                text-xs
                rounded
                border
                ${colors.bg}
                ${colors.text}
                ${colors.border}
                ${!isCompleted ? 'opacity-50' : ''}
              `}
              title={
                isCompleted
                  ? `Tier ${tier.number}: ${tier.classification || 'Unknown'}`
                  : `Tier ${tier.number}: Not reached`
              }
            >
              <span className="font-medium">{tier.label}:</span>
              <span className={compact ? 'max-w-[60px] truncate' : ''}>
                {getLabel(isCompleted ? tier.classification : null)}
              </span>
            </div>

            {/* Arrow connector (except after last tier) */}
            {!isLast && (
              <span
                className={`
                  mx-0.5 text-[10px]
                  ${index < normalizedHighest - 1
                    ? 'text-[var(--color-text-muted)]'
                    : 'text-[var(--color-neutral-300)]'
                  }
                `}
              >
                →
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * ClassificationBadge - Standalone badge for a single classification value
 * Useful in tables and lists
 */
interface ClassificationBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  classification: string | null | undefined;
  showLabel?: boolean;
}

export function ClassificationBadge({
  classification,
  showLabel = true,
  className = '',
  ...props
}: ClassificationBadgeProps) {
  const colors = getColors(classification);
  const label = getLabel(classification);

  return (
    <span
      className={`
        inline-flex items-center
        px-1.5 py-0.5
        text-xs
        rounded
        border
        ${colors.bg}
        ${colors.text}
        ${colors.border}
        ${!classification ? 'opacity-50' : ''}
        ${className}
      `}
      title={classification || 'Not analyzed'}
      {...props}
    >
      {showLabel ? label : ''}
    </span>
  );
}

export default TierClassificationFlow;
