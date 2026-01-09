'use client';

import { ArrowRight, Filter, FileSearch, Globe } from 'lucide-react';
import { TIER_INFO, type TierNumber } from './types';

interface PipelineOverviewDiagramProps {
  activeTier: TierNumber;
}

const TIER_ICONS = [Filter, FileSearch, Globe];
const TIER_STATS = ['~40% stop', '~80% final', '~20% final'];

export function PipelineOverviewDiagram({ activeTier }: PipelineOverviewDiagramProps) {
  return (
    <div className="bg-[var(--color-neutral-50)] rounded-[var(--radius-lg)] p-4 md:p-6">
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-2">
        {TIER_INFO.map((tier, index) => {
          const Icon = TIER_ICONS[index];
          const isActive = tier.tier === activeTier;
          const stat = TIER_STATS[index];

          return (
            <div key={tier.tier} className="flex items-center gap-2 md:gap-4">
              {/* Tier Box */}
              <div
                className={`
                  flex flex-col items-center p-4 rounded-[var(--radius-lg)] transition-all
                  min-w-[140px] md:min-w-[160px]
                  ${isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-md scale-105'
                    : 'bg-white text-[var(--color-text)] border border-[var(--color-neutral-200)]'
                  }
                `}
              >
                <div className={`
                  p-2 rounded-full mb-2
                  ${isActive ? 'bg-white/20' : 'bg-[var(--color-neutral-100)]'}
                `}>
                  <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-[var(--color-primary)]'}`} />
                </div>
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                  Tier {tier.tier}
                </span>
                <span className={`text-sm font-semibold text-center ${isActive ? '' : 'text-[var(--color-text)]'}`}>
                  {tier.shortName}
                </span>
                <span className={`
                  text-xs mt-1 px-2 py-0.5 rounded-full
                  ${isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]'
                  }
                `}>
                  {stat}
                </span>
              </div>

              {/* Arrow between tiers */}
              {index < TIER_INFO.length - 1 && (
                <ArrowRight className="w-5 h-5 text-[var(--color-text-muted)] hidden md:block" />
              )}
            </div>
          );
        })}
      </div>

      {/* Description */}
      <p className="text-center text-sm text-[var(--color-text-muted)] mt-4">
        Progressive context disclosure: each tier reveals more context as needed
      </p>
    </div>
  );
}
