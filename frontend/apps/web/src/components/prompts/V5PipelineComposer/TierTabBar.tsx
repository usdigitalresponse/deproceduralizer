'use client';

import { TIER_INFO, type TierNumber } from './types';

interface TierTabBarProps {
  activeTier: TierNumber;
  onChange: (tier: TierNumber) => void;
}

export function TierTabBar({ activeTier, onChange }: TierTabBarProps) {
  return (
    <div className="flex rounded-[var(--radius-md)] bg-[var(--color-neutral-100)] p-1">
      {TIER_INFO.map((tier) => {
        const isActive = tier.tier === activeTier;

        return (
          <button
            key={tier.tier}
            onClick={() => onChange(tier.tier)}
            className={`
              flex-1 px-4 py-2.5 text-sm font-medium rounded-[var(--radius-sm)]
              transition-all
              ${isActive
                ? 'bg-white text-[var(--color-primary)] shadow-sm'
                : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text)]'
              }
            `}
            role="tab"
            aria-selected={isActive}
          >
            {tier.tier !== 'summary' && (
              <>
                <span className="hidden sm:inline">Tier {tier.tier}: </span>
                <span className="sm:hidden">T{tier.tier}: </span>
              </>
            )}
            {tier.shortName}
          </button>
        );
      })}
    </div>
  );
}
