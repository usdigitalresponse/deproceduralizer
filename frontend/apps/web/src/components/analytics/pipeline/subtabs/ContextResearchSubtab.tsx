'use client';

import type {
  Tier1ContextRequestStats,
  Tier2ContextRequestsStats,
  ContextUsedStats,
  ResearchFunnelStats,
} from '@/lib/actions/pipeline-analytics';
import { Card } from '@/components/ui';
import { ResearchFunnelMini } from '../ResearchFunnelMini';
import { Tier1ContextPanel } from '../Tier1ContextPanel';
import { Tier2ContextRequestsPanel } from '../Tier2ContextRequestsPanel';
import { ContextUsedPanel } from '../ContextUsedPanel';

interface ContextResearchSubtabProps {
  tier1Context: Tier1ContextRequestStats | null;
  tier2Requests: Tier2ContextRequestsStats | null;
  contextUsed: ContextUsedStats | null;
  researchFunnel: ResearchFunnelStats | null;
  isLoading: boolean;
  onIssueTypeClick?: (issueType: string) => void;
}

/**
 * Context & Research subtab: Research funnel + Tier 1/2 request panels + context usage.
 */
export function ContextResearchSubtab({
  tier1Context,
  tier2Requests,
  contextUsed,
  researchFunnel,
  isLoading,
  onIssueTypeClick,
}: ContextResearchSubtabProps) {
  if (isLoading) {
    return (
      <Card padding="lg" className="text-center text-[var(--color-text-muted)] animate-pulse">
        Loading context & research data...
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <ResearchFunnelMini data={researchFunnel} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Tier1ContextPanel data={tier1Context} onIssueTypeClick={onIssueTypeClick} />
        <Tier2ContextRequestsPanel data={tier2Requests} />
      </div>

      <ContextUsedPanel data={contextUsed} />
    </div>
  );
}
