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
      />
      {analysis.highestTierCompleted >= 3 && analysis.tier3TriggerReason && (
        <div className="mt-2 pt-2 border-t border-[var(--color-neutral-200)]">
          <span className="text-xs text-[var(--color-text-muted)]">
            Escalated to web search: {analysis.tier3TriggerReason}
          </span>
        </div>
      )}
    </div>
  );
}
