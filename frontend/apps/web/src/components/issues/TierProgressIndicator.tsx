'use client';

import { HTMLAttributes } from 'react';

interface TierProgressIndicatorProps extends HTMLAttributes<HTMLDivElement> {
  highestTierCompleted: number; // 0-3 for V5, 0-4 for legacy V4
  tier1Classification?: string | null;
  tier2Classification?: string | null;
  tier3Classification?: string | null;
  tier4Classification?: string | null; // Legacy V4 - maps to T3 display
  compact?: boolean;
}

interface TierInfo {
  number: number;
  name: string;
  shortName: string;
  classification: string | null | undefined;
}

// V5 uses 3 tiers (T3 = Web Search, was T4 in V4)
const TIER_NAMES = [
  { name: 'Match Filtering', shortName: 'T1' },
  { name: 'Full Classification', shortName: 'T2' },
  { name: 'Web Verification', shortName: 'T3' },
];

function getTierStatus(tierNumber: number, highestCompleted: number): 'completed' | 'current' | 'pending' {
  if (tierNumber <= highestCompleted) return 'completed';
  if (tierNumber === highestCompleted + 1) return 'current';
  return 'pending';
}

const statusStyles = {
  completed: 'bg-[var(--color-success)] border-[var(--color-success)]',
  current: 'bg-[var(--color-info)] border-[var(--color-info)] animate-pulse',
  pending: 'bg-[var(--color-neutral-200)] border-[var(--color-neutral-300)]',
};

const connectorStyles = {
  completed: 'bg-[var(--color-success)]',
  current: 'bg-[var(--color-neutral-300)]',
  pending: 'bg-[var(--color-neutral-200)]',
};

function formatClassification(classification: string | null | undefined): string {
  if (!classification) return 'Not analyzed';
  // Convert snake_case to Title Case
  return classification
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function TierProgressIndicator({
  highestTierCompleted,
  tier1Classification,
  tier2Classification,
  tier3Classification,
  tier4Classification,
  compact = false,
  className = '',
  ...props
}: TierProgressIndicatorProps) {
  // V5: 3 tiers. For T3, prefer tier3Classification, fall back to tier4Classification for V4 legacy data
  const tiers: TierInfo[] = [
    { number: 1, ...TIER_NAMES[0], classification: tier1Classification },
    { number: 2, ...TIER_NAMES[1], classification: tier2Classification },
    { number: 3, ...TIER_NAMES[2], classification: tier3Classification || tier4Classification },
  ];

  // Normalize highestTierCompleted: V4's tier4 = V5's tier3
  const normalizedHighest = highestTierCompleted >= 4 ? 3 : highestTierCompleted;

  // No analysis at all
  if (normalizedHighest === 0) {
    return (
      <div
        className={`inline-flex items-center gap-1 ${className}`}
        title="Not analyzed by research pipeline"
        {...props}
      >
        {compact ? (
          <span className="text-xs text-[var(--color-text-muted)]">No analysis</span>
        ) : (
          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className={`
                  w-2 h-2 rounded-full
                  ${statusStyles.pending}
                  border
                `}
              />
            ))}
            <span className="ml-1 text-xs text-[var(--color-text-muted)]">
              Not analyzed
            </span>
          </div>
        )}
      </div>
    );
  }

  if (compact) {
    // Compact mode: show small dots with tooltip
    return (
      <div
        className={`inline-flex items-center gap-0.5 ${className}`}
        title={`Tier ${normalizedHighest}/3 complete`}
        {...props}
      >
        {tiers.map((tier) => {
          const status = getTierStatus(tier.number, normalizedHighest);
          return (
            <div
              key={tier.number}
              className={`
                w-1.5 h-1.5 rounded-full
                ${statusStyles[status]}
                border
              `}
              title={`${tier.shortName}: ${tier.name} - ${formatClassification(tier.classification)}`}
            />
          );
        })}
      </div>
    );
  }

  // Expanded mode: show dots with connectors and labels
  return (
    <div className={`flex items-center ${className}`} {...props}>
      {tiers.map((tier, index) => {
        const status = getTierStatus(tier.number, normalizedHighest);
        const isLast = index === tiers.length - 1;

        return (
          <div key={tier.number} className="flex items-center">
            {/* Tier dot with tooltip */}
            <div
              className="group relative flex flex-col items-center"
              title={`${tier.name}: ${formatClassification(tier.classification)}`}
            >
              <div
                className={`
                  w-3 h-3 rounded-full
                  ${statusStyles[status]}
                  border-2
                  transition-all duration-200
                  group-hover:scale-110
                `}
              />
              <span className="absolute -bottom-4 text-[10px] text-[var(--color-text-muted)] whitespace-nowrap">
                {tier.shortName}
              </span>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                <div className="bg-[var(--color-neutral-900)] text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                  <div className="font-medium">{tier.name}</div>
                  <div className="text-[var(--color-neutral-300)]">
                    {formatClassification(tier.classification)}
                  </div>
                </div>
              </div>
            </div>

            {/* Connector line */}
            {!isLast && (
              <div
                className={`
                  w-4 h-0.5 mx-0.5
                  ${connectorStyles[status]}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// Badge variant for inline display
interface TierBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  highestTierCompleted: number;
}

export function TierBadge({ highestTierCompleted, className = '', ...props }: TierBadgeProps) {
  // Normalize: V4's tier4 = V5's tier3
  const normalizedTier = highestTierCompleted >= 4 ? 3 : highestTierCompleted;

  let variant: 'success' | 'info' | 'default' = 'default';
  let label = 'Not analyzed';

  if (normalizedTier >= 3) {
    variant = 'success';
    label = 'Tier 3';
  } else if (normalizedTier >= 1) {
    variant = 'info';
    label = `Tier ${normalizedTier}`;
  }

  const variantStyles = {
    success: 'bg-[var(--color-success-bg)] text-[var(--color-success)]',
    info: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
    default: 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]',
  };

  return (
    <span
      className={`
        inline-flex items-center
        px-2 py-0.5
        text-xs font-medium
        rounded-[var(--radius-sm)]
        ${variantStyles[variant]}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
      title={normalizedTier === 0 ? 'Not processed by research pipeline' : `Completed through tier ${normalizedTier}`}
      {...props}
    >
      {label}
    </span>
  );
}

export default TierProgressIndicator;
