'use client';

import { PromptsList } from './PromptsList';
import { PromptNav } from './PromptNav';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';

interface PromptCatalogTabProps {
  prompts: PromptData[];
  compliancePrompts: CompliancePromptData[];
  barrierPrompts: PromptData[];
  tournamentPrompts?: PromptData[];
  feedbackCounts: Record<string, number>;
}

export function PromptCatalogTab({
  prompts,
  compliancePrompts,
  barrierPrompts,
  tournamentPrompts = [],
  feedbackCounts,
}: PromptCatalogTabProps) {
  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <PromptsList
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          barrierPrompts={barrierPrompts}
          tournamentPrompts={tournamentPrompts}
          feedbackCounts={feedbackCounts}
        />
      </div>
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <PromptNav
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          barrierPrompts={barrierPrompts}
          tournamentPrompts={tournamentPrompts}
        />
      </aside>
    </div>
  );
}
