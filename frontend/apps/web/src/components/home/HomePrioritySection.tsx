'use client';

import type { JurisdictionCode, AnalysisListItem } from '@deproceduralizer/database';
import { PriorityPicksBanner } from '@/components/analysis/PriorityPicksBanner';
import { JURISDICTION_CONFIG } from '@/types/state';

interface JurisdictionPriorityData {
  jurisdiction: JurisdictionCode;
  items: AnalysisListItem[];
  totalQuickWins: number;
  isQuickWinMode: boolean;
}

interface HomePrioritySectionProps {
  jurisdictionPriorities: JurisdictionPriorityData[];
}

export function HomePrioritySection({ jurisdictionPriorities }: HomePrioritySectionProps) {
  const nonEmpty = jurisdictionPriorities.filter((sp) => sp.items.length > 0);

  if (nonEmpty.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {nonEmpty.map((sp) => (
        <div key={sp.jurisdiction}>
          {nonEmpty.length > 1 && (
            <h3 className="text-sm font-medium text-[var(--color-text-muted)] mb-2">
              {JURISDICTION_CONFIG[sp.jurisdiction].name}
            </h3>
          )}
          <PriorityPicksBanner
            jurisdiction={sp.jurisdiction}
            items={sp.items}
            totalQuickWins={sp.totalQuickWins}
            isQuickWinMode={sp.isQuickWinMode}
            viewAllHref={`/${sp.jurisdiction}/pipeline?severity=high&easyCleanup=any&page=1`}
          />
        </div>
      ))}
    </div>
  );
}
