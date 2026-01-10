'use client';

import { useState, useTransition } from 'react';
import { Layers, Zap } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PipelineOverviewDiagram } from './PipelineOverviewDiagram';
import { IssueSelector } from './IssueSelector';
import { TierTabBar } from './TierTabBar';
import { ComposedPromptViewer } from './ComposedPromptViewer';
import { IssueMetadataPanel } from './IssueMetadataPanel';
import { TokenBreakdown } from './TokenBreakdown';
import { composePromptForTier, getIssueConfigByType } from '@/lib/actions/research-pipeline';
import type { IssueTypeOption, TierNumber, IssueConfig, ComposedPrompt } from './types';

interface V5PipelineComposerProps {
  issueTypes: IssueTypeOption[];
  className?: string;
}

export function V5PipelineComposer({ issueTypes, className = '' }: V5PipelineComposerProps) {
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [activeTier, setActiveTier] = useState<TierNumber>(1);
  const [composedPrompt, setComposedPrompt] = useState<ComposedPrompt | null>(null);
  const [issueConfig, setIssueConfig] = useState<IssueConfig | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleIssueChange = (issueType: string) => {
    setSelectedIssue(issueType);
    setError(null);

    startTransition(async () => {
      // Load both the composed prompt and issue config
      const [promptResult, configResult] = await Promise.all([
        composePromptForTier(activeTier, issueType),
        getIssueConfigByType(issueType),
      ]);

      if (!promptResult.success) {
        setError(promptResult.error);
        return;
      }
      if (!configResult.success) {
        setError(configResult.error);
        return;
      }

      setComposedPrompt(promptResult.data);
      setIssueConfig(configResult.data);
    });
  };

  const handleTierChange = (tier: TierNumber) => {
    setActiveTier(tier);
    if (!selectedIssue) return;

    setError(null);
    startTransition(async () => {
      const result = await composePromptForTier(tier, selectedIssue);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setComposedPrompt(result.data);
    });
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Card */}
      <Card>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-[var(--color-accent-muted)] rounded-[var(--radius-md)]">
            <Layers className="w-6 h-6 text-[var(--color-warning)]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[var(--color-text)]">
              V5 Research Pipeline Prompt Composer
            </h2>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Interactive view of the 3-tier progressive context disclosure system
            </p>
          </div>
        </div>

        {/* Pipeline Overview Diagram */}
        <PipelineOverviewDiagram activeTier={activeTier} />

        {/* Issue Selector */}
        <div className="mt-6">
          <IssueSelector
            issueTypes={issueTypes}
            selectedIssue={selectedIssue}
            onSelect={handleIssueChange}
            isLoading={isPending}
          />
        </div>
      </Card>

      {/* Main Content Area - Only show when issue is selected */}
      {selectedIssue && (
        <>
          {/* Tier Tab Bar */}
          <TierTabBar activeTier={activeTier} onChange={handleTierChange} />

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-[var(--color-danger-bg)] border border-[var(--color-danger)] rounded-[var(--radius-md)]">
              <p className="text-sm text-[var(--color-danger)]">{error}</p>
            </div>
          )}

          {/* Two-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Composed Prompt Viewer (2/3 width) */}
            <div className="lg:col-span-2">
              <ComposedPromptViewer
                composedPrompt={composedPrompt}
                isLoading={isPending}
              />
            </div>

            {/* Issue Metadata Panel (1/3 width) */}
            <div className="lg:col-span-1">
              <IssueMetadataPanel
                issueConfig={issueConfig}
                isLoading={isPending}
              />
            </div>
          </div>

          {/* Token Breakdown */}
          {composedPrompt && (
            <TokenBreakdown composedPrompt={composedPrompt} />
          )}
        </>
      )}

      {/* Empty state when no issue selected */}
      {!selectedIssue && (
        <Card>
          <div className="text-center py-12">
            <Zap className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[var(--color-text)] mb-2">
              Select an Issue Type
            </h3>
            <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
              Choose an issue type above to see how the research pipeline prompts are composed
              for each tier with progressive context disclosure.
            </p>
          </div>
        </Card>
      )}
    </div>
  );
}
