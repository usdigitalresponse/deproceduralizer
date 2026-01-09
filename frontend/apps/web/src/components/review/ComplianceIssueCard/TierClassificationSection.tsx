import { TierClassificationFlow } from '@/components/issues/TierClassificationFlow';
import type { TierClassificationSectionProps } from './types';

export function TierClassificationSection({ analysis }: TierClassificationSectionProps) {
  if (analysis.highestTierCompleted <= 0) {
    return null;
  }

  return (
    <div className="mb-3 py-2 px-3 bg-[var(--color-neutral-50)] rounded-[var(--radius-sm)] border border-[var(--color-neutral-200)]">
      <TierClassificationFlow
        highestTierCompleted={analysis.highestTierCompleted}
        tier1Classification={analysis.tier1Classification}
        tier2Classification={analysis.tier2Classification}
        tier3Classification={analysis.tier3Classification}
        tier4Classification={analysis.tier4Classification}
      />
    </div>
  );
}
