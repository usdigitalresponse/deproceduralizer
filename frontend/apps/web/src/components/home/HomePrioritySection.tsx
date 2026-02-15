'use client';

import type { StateCode, AnalysisListItem } from '@deproceduralizer/database';
import { PriorityPicksBanner } from '@/components/analysis/PriorityPicksBanner';
import { STATE_CONFIG } from '@/types/state';

interface StatePriorityData {
  state: StateCode;
  items: AnalysisListItem[];
  totalQuickWins: number;
  isQuickWinMode: boolean;
}

interface HomePrioritySectionProps {
  statePriorities: StatePriorityData[];
}

export function HomePrioritySection({ statePriorities }: HomePrioritySectionProps) {
  const nonEmpty = statePriorities.filter((sp) => sp.items.length > 0);

  if (nonEmpty.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {nonEmpty.map((sp) => (
        <div key={sp.state}>
          {nonEmpty.length > 1 && (
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {STATE_CONFIG[sp.state].name}
            </h3>
          )}
          <PriorityPicksBanner
            state={sp.state}
            items={sp.items}
            totalQuickWins={sp.totalQuickWins}
            isQuickWinMode={sp.isQuickWinMode}
            viewAllHref={`/${sp.state}/pipeline?severity=high&easyCleanup=any&page=1`}
          />
        </div>
      ))}
    </div>
  );
}
