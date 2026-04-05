'use client';

import { PromptsList } from './PromptsList';
import { PromptNav } from './PromptNav';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';

interface PromptCatalogTabProps {
  prompts: PromptData[];
  compliancePrompts: CompliancePromptData[];
  jenaiPrompts: PromptData[];
  tournamentPrompts?: PromptData[];
  feedbackCounts: Record<string, number>;
}

export function PromptCatalogTab({
  prompts,
  compliancePrompts,
  jenaiPrompts,
  tournamentPrompts = [],
  feedbackCounts,
}: PromptCatalogTabProps) {
  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <PromptsList
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          jenaiPrompts={jenaiPrompts}
          tournamentPrompts={tournamentPrompts}
          feedbackCounts={feedbackCounts}
        />
      </div>
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <PromptNav
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          jenaiPrompts={jenaiPrompts}
          tournamentPrompts={tournamentPrompts}
        />
      </aside>
    </div>
  );
}
