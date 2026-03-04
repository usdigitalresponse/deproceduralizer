'use client';

import { PromptsList } from './PromptsList';
import { PromptNav } from './PromptNav';
import type { PromptData, CompliancePromptData } from '@/lib/actions/prompts';
import type { PromptFeedback } from '@deproceduralizer/database';

interface PromptCatalogTabProps {
  prompts: PromptData[];
  compliancePrompts: CompliancePromptData[];
  jenaiPrompts: PromptData[];
  feedbackCounts: Record<string, number>;
  orphanedFeedback: PromptFeedback[];
}

export function PromptCatalogTab({
  prompts,
  compliancePrompts,
  jenaiPrompts,
  feedbackCounts,
  orphanedFeedback,
}: PromptCatalogTabProps) {
  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <PromptsList
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          jenaiPrompts={jenaiPrompts}
          feedbackCounts={feedbackCounts}
          orphanedFeedback={orphanedFeedback}
        />
      </div>
      <aside className="hidden lg:block w-56 flex-shrink-0">
        <PromptNav
          prompts={prompts}
          compliancePrompts={compliancePrompts}
          jenaiPrompts={jenaiPrompts}
        />
      </aside>
    </div>
  );
}
